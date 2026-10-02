import { Injectable, Logger } from '@nestjs/common';
import { Client } from 'minio';
import { Readable } from 'stream';
import { PrismaService } from '../../prisma/prisma.service';
import { isUnconfigured, resolveConfig } from '../config';
import { ServiceUnconfiguredError } from '../../common/errors/service-unconfigured.error';

const SERVICE = 'minio';

/**
 * Thin wrapper around the MinIO JS client.
 *
 * Throws `ServiceUnconfiguredError` when MINIO_ENDPOINT / MINIO_ACCESS_KEY /
 * MINIO_SECRET_KEY are unset or hold the placeholder. The GlobalExceptionFilter
 * maps that error to a 503 with `{ service: 'minio' }`.
 */
@Injectable()
export class MinioService {
  private readonly logger = new Logger('MinioService');
  private cachedClient: Client | null = null;
  private cachedBucket: string | null = null;
  private cachedEndpointSignature = '';

  constructor(private readonly prisma: PrismaService) {}

  private async getClientAndBucket(): Promise<{ client: Client; bucket: string }> {
    const endpoint = await resolveConfig(this.prisma, 'MINIO_ENDPOINT');
    const accessKey = await resolveConfig(this.prisma, 'MINIO_ACCESS_KEY');
    const secretKey = await resolveConfig(this.prisma, 'MINIO_SECRET_KEY');
    const bucket =
      (await resolveConfig(this.prisma, 'MINIO_BUCKET')) ?? 'app-uploads';

    if (isUnconfigured(endpoint) || isUnconfigured(accessKey) || isUnconfigured(secretKey)) {
      throw new ServiceUnconfiguredError(
        SERVICE,
        'MinIO endpoint / access key / secret key are not configured.',
      );
    }

    // Cache the client per resolved endpoint+credentials so SystemSetting
    // overrides take effect without restarting the process.
    const signature = `${endpoint}|${accessKey}|${secretKey}|${bucket}`;
    if (this.cachedClient && this.cachedEndpointSignature === signature) {
      return { client: this.cachedClient, bucket: this.cachedBucket! };
    }

    const url = new URL(endpoint!);
    const useSSL = url.protocol === 'https:';
    const port = url.port
      ? parseInt(url.port, 10)
      : useSSL
        ? 443
        : 80;

    const client = new Client({
      endPoint: url.hostname,
      port,
      useSSL,
      accessKey: accessKey!,
      secretKey: secretKey!,
    });

    this.cachedClient = client;
    this.cachedBucket = bucket;
    this.cachedEndpointSignature = signature;
    return { client, bucket };
  }

  /** Streams a buffer or readable into MinIO. Creates the bucket if missing. */
  async putObject(
    key: string,
    data: Buffer | Readable,
    size: number,
    contentType?: string,
  ): Promise<{ etag: string; bucket: string; key: string }> {
    const { client, bucket } = await this.getClientAndBucket();
    try {
      const exists = await client.bucketExists(bucket).catch(() => false);
      if (!exists) {
        await client.makeBucket(bucket, '');
      }
    } catch (err) {
      this.logger.warn(`bucketExists/makeBucket failed: ${(err as Error).message}`);
    }
    const meta: Record<string, string> = {};
    if (contentType) meta['Content-Type'] = contentType;
    const result = await client.putObject(bucket, key, data, size, meta);
    return { etag: result.etag, bucket, key };
  }

  /** Returns a presigned GET URL valid for `expirySeconds`. */
  async getSignedUrl(key: string, expirySeconds = 60 * 15): Promise<string> {
    const { client, bucket } = await this.getClientAndBucket();
    return client.presignedGetObject(bucket, key, expirySeconds);
  }

  async deleteObject(key: string): Promise<void> {
    const { client, bucket } = await this.getClientAndBucket();
    await client.removeObject(bucket, key);
  }

  /** Used by the OCR worker to stream object data back into memory. */
  async getObjectBuffer(key: string): Promise<Buffer> {
    const { client, bucket } = await this.getClientAndBucket();
    const stream = await client.getObject(bucket, key);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(chunk as Buffer);
    }
    return Buffer.concat(chunks);
  }
}
