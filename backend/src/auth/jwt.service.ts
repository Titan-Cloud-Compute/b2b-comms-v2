import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '@prisma/client';
import { AppConfigService } from '../common/config.service';
import { ServiceUnconfiguredError } from '../common/errors';

export interface SessionPayload {
  /** User id (cuid). */
  userId: string;
  email: string;
  role: UserRole;
  /** Null for ADMIN before they pick a firm to view. */
  firmId: string | null;
}

/**
 * Thin wrapper around @nestjs/jwt that resolves the JWT signing secret
 * lazily via AppConfigService (env var first, SystemSetting fallback).
 *
 * Tokens are signed with HS256. The same secret is used to verify them.
 */
@Injectable()
export class AppJwtService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: AppConfigService,
  ) {}

  private async secret(): Promise<string> {
    const s = await this.config.resolveConfig('JWT_SECRET');
    if (!s) {
      throw new ServiceUnconfiguredError(
        'jwt',
        'JWT_SECRET must be configured',
      );
    }
    return s;
  }

  async sign(
    payload: SessionPayload,
    expiresInSeconds = 7 * 24 * 60 * 60,
  ): Promise<string> {
    const secret = await this.secret();
    return this.jwt.signAsync(payload, {
      secret,
      expiresIn: expiresInSeconds,
    });
  }

  async verify(token: string): Promise<SessionPayload> {
    const secret = await this.secret();
    return this.jwt.verifyAsync<SessionPayload>(token, { secret });
  }
}
