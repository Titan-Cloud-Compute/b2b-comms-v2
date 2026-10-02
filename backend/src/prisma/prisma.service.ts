import { Injectable, OnModuleInit, INestApplication } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

/**
 * Prisma 7 requires either a datasourceUrl or a driver adapter in the
 * PrismaClient constructor — the implicit URL-from-schema bootstrap was
 * removed. We use @prisma/adapter-pg so the same pg driver handles all
 * connections, which lets SET LOCAL GUC behaviour work correctly for RLS.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  constructor() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error(
        'PrismaService: DATABASE_URL is not set — cannot construct the Postgres adapter.',
      );
    }
    super({ adapter: new PrismaPg({ connectionString }) });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  enableShutdownHooks(app: INestApplication): void {
    this.$on('beforeExit' as never, async () => {
      await app.close();
    });
  }

  /**
   * Run fn inside a Prisma transaction scoped to firmId.
   * Sets app.firm_id via SET LOCAL so Postgres RLS policies filter every
   * query in this transaction to the given firm. The GUC reverts
   * automatically on commit or rollback.
   *
   * Use this for ALL firm-scoped reads and writes.
   */
  async runForFirm<T>(
    firmId: string,
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.firm_id', ${firmId}, true)`;
      return fn(tx);
    });
  }

  /**
   * Run fn scoped to BOTH a firm and a user. Sets app.firm_id AND app.user_id
   * so RLS additionally restricts user-private tables (chat) to this user,
   * while firm-shared tables stay visible. Use for the chat read/write path;
   * firm-shared reads (intake, RAG, documents) keep using runForFirm.
   */
  async runForUser<T>(
    firmId: string,
    userId: string,
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.firm_id', ${firmId}, true)`;
      await tx.$executeRaw`SELECT set_config('app.user_id', ${userId}, true)`;
      return fn(tx);
    });
  }

  /**
   * Run fn inside a Prisma transaction with no RLS GUC set.
   * Use for admin operations that must read or write across all firms.
   * Never use this in firm-scoped service code.
   */
  async runAsAdmin<T>(
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.$transaction(async (tx) => {
      // Opt into the admin RLS escape hatch (see migration 0025): firm-isolation
      // policies also pass when app.is_admin = 'true', so admin queries can read
      // and write across all firms. Without this, every firm-scoped row is
      // filtered out because app.firm_id is intentionally unset here.
      await tx.$executeRaw`SELECT set_config('app.is_admin', 'true', true)`;
      return fn(tx);
    });
  }
}
