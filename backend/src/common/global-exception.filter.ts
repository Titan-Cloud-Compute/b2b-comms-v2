import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import {
  MODEL_UNAVAILABLE,
  ModelUnavailableError,
  ServiceUnconfiguredError,
} from "./errors";

// Prisma error codes that indicate the DB is unreachable (not a query error).
const PRISMA_DB_UNREACHABLE_CODES = new Set(["P1001", "P1002", "P1008"]);

/**
 * Single global exception filter.
 *
 *  - ServiceUnconfiguredError -> 503 { service, message }
 *  - Prisma DB connection errors (P1001/P1002/P1008, init failure) -> 503
 *  - Prisma unique-constraint violation (P2002) -> 409 { error: "conflict", fields }
 *  - ZodError -> 400 { error: "validation", issues }
 *  - HttpException (NestJS-native) -> passes through with its status + body.
 *  - Everything else -> 500 with a redacted message in prod.
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger("GlobalExceptionFilter");

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    if (exception instanceof ServiceUnconfiguredError) {
      this.logger.warn(
        `[${req.method} ${req.url}] ServiceUnconfiguredError: ${exception.service}`,
      );
      res.status(HttpStatus.SERVICE_UNAVAILABLE).json({
        service: exception.service,
        message: exception.message,
      });
      return;
    }

    // Catalog/config drift: the requested model is not served by the LLM
    // proxy. Deterministic 400 with a typed code — NOT 503 — so clients fail
    // fast with a specific message instead of retrying a permanent failure.
    if (exception instanceof ModelUnavailableError) {
      this.logger.warn(
        `[${req.method} ${req.url}] ModelUnavailableError: ${exception.modelId}`,
      );
      res.status(HttpStatus.BAD_REQUEST).json({
        code: MODEL_UNAVAILABLE,
        modelId: exception.modelId,
        message: exception.message,
      });
      return;
    }

    // Prisma: DB unreachable (connection refused, DNS failure, timeout)
    if (
      exception instanceof Prisma.PrismaClientInitializationError ||
      (exception instanceof Prisma.PrismaClientKnownRequestError &&
        PRISMA_DB_UNREACHABLE_CODES.has(exception.code))
    ) {
      this.logger.warn(`[${req.method} ${req.url}] DB unreachable: ${String(exception)}`);
      res.status(HttpStatus.SERVICE_UNAVAILABLE).json({
        service: "postgresql",
        message: "database is unreachable — try again shortly",
      });
      return;
    }

    // Prisma: unique-constraint violation -> 409 (a client conflict, not a crash).
    if (
      exception instanceof Prisma.PrismaClientKnownRequestError &&
      exception.code === "P2002"
    ) {
      // meta.target is a field array on the classic engine but a constraint-name
      // STRING (e.g. "LearningModule_key_key") under Prisma driver adapters.
      const target = exception.meta?.target;
      const fields = Array.isArray(target)
        ? (target as string[])
        : typeof target === "string"
          ? [target]
          : [];
      this.logger.warn(
        `[${req.method} ${req.url}] unique-constraint conflict on: ${fields.join(", ") || "(unknown)"}`,
      );
      res.status(HttpStatus.CONFLICT).json({
        error: "conflict",
        message: `a record with the same ${fields.join(", ") || "unique value"} already exists`,
        fields,
      });
      return;
    }

    if (exception instanceof ZodError) {
      res.status(HttpStatus.BAD_REQUEST).json({
        error: "validation",
        issues: exception.issues,
      });
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      res.status(status).json(typeof body === "string" ? { message: body } : body);
      return;
    }

    this.logger.error(
      `[${req.method} ${req.url}] Unhandled error`,
      exception instanceof Error ? exception.stack : String(exception),
    );
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      error: "internal",
      message:
        process.env.NODE_ENV === "production"
          ? "internal server error"
          : exception instanceof Error
            ? exception.message
            : String(exception),
    });
  }
}
