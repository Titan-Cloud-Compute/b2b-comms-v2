import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import type { User } from '@prisma/client';
import { AuditActor, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AppConfigService } from '../config/config.service';
import type { SessionPayload } from './session.types';
import { MailerService } from './mailer.service';

/** Default org seat cap when SystemSetting ORG_MAX_SEATS is unset. */
const DEFAULT_ORG_MAX_SEATS = 5;

/** Fallback LLM model ID when no specific model is configured. */
const DEFAULT_LLM_MODEL_ID = 'gpt-4o-mini';

export interface SignupArgs {
  email: string;
  password: string;
  name?: string;
  /** 48-char hex registration token issued by an admin. Required for all
   *  signups after the first (bootstrap) user. */
  registrationToken?: string;
}
export interface LoginArgs {
  email: string;
  password: string;
}

/**
 * Auth flows: signup (first user → ADMIN, otherwise USER), login, logout.
 *
 * Password hashing uses bcryptjs (cost 10, OWASP-acceptable baseline). The choice
 * to count *all* users (not just admins) when deciding the bootstrap admin
 * role matches the auth_model 'full_auth' contract documented in the plan.
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger('AuthService');

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: AppConfigService,
    private readonly mailer: MailerService,
  ) {}

  /**
   * Atomically claim an unconsumed, unexpired registration token. Returns the
   * claimed token's role and grantedModelIds, or null when it was already
   * consumed, expired, or absent.
   */
  async claimRegistrationToken(
    rawToken: string,
    now: Date = new Date(),
  ): Promise<{
    firmId: string | null;
    role: string | null;
    grantedModelIds: string[];
  } | null> {
    const result = await this.prisma.runAsAdmin((tx) =>
      tx.registrationToken.updateMany({
        where: {
          token: rawToken,
          consumed: false,
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
        data: { consumed: true, consumedAt: now },
      }),
    );
    if (result.count !== 1) {
      return null;
    }
    const claimed = await this.prisma.runAsAdmin((tx) =>
      tx.registrationToken.findUnique({
        where: { token: rawToken },
        select: { firmId: true, role: true, grantedModelIds: true },
      }),
    );
    if (!claimed) return null;
    return { ...claimed, grantedModelIds: claimed.grantedModelIds ?? [] };
  }

  /**
   * PUBLIC, read-only preview of what a registration token grants — used by the
   * unauthenticated signup page to show the (non-editable) AI model the token
   * entitles the registrant to, BEFORE the token is redeemed.
   */
  async previewRegistrationToken(
    rawToken: string,
    now: Date = new Date(),
  ): Promise<{ valid: boolean; models: { id: string; label: string }[] }> {
    const token = rawToken.trim().toLowerCase();
    const row = await this.prisma.runAsAdmin((tx) =>
      tx.registrationToken.findUnique({
        where: { token },
        select: { consumed: true, expiresAt: true, grantedModelIds: true },
      }),
    );
    if (
      !row ||
      row.consumed ||
      (row.expiresAt && row.expiresAt.getTime() <= now.getTime())
    ) {
      return { valid: false, models: [] };
    }

    const granted = (row.grantedModelIds ?? []).filter(
      (id): id is string => typeof id === 'string' && id.length > 0,
    );
    if (granted.length > 0) {
      return {
        valid: true,
        models: granted.map((id) => ({ id, label: id })),
      };
    }

    return {
      valid: true,
      models: [{ id: DEFAULT_LLM_MODEL_ID, label: DEFAULT_LLM_MODEL_ID }],
    };
  }

  /**
   * Apply a token's model grant to a freshly created user.
   */
  private async applyModelGrant(
    userId: string,
    grantedModelIds: string[],
  ): Promise<void> {
    if (!grantedModelIds.length) return;
    const [primary] = grantedModelIds;
    await this.prisma.runAsAdmin(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { grantedModelIds, defaultLlmModelId: primary },
      });
    });
    this.logger.log(
      `user=${userId} granted models [${grantedModelIds.join(', ')}] via registration token`,
    );
  }

  async signup(args: SignupArgs): Promise<{ user: User; token: string }> {
    const email = args.email.trim().toLowerCase();
    if (!email.includes('@')) throw new BadRequestException('invalid email');
    if (!args.password || args.password.length < 8) {
      throw new BadRequestException('password must be at least 8 characters');
    }

    const count = await this.prisma.runAsAdmin((tx) => tx.user.count());
    const isBootstrap = count === 0;

    let grantedModelIds: string[] = [];
    if (!isBootstrap) {
      const rawToken = args.registrationToken?.trim().toLowerCase();
      if (!rawToken) {
        throw new BadRequestException('registration token is required');
      }
      const regToken = await this.prisma.runAsAdmin((tx) =>
        tx.registrationToken.findUnique({ where: { token: rawToken } }),
      );
      if (!regToken || regToken.consumed) {
        throw new BadRequestException('invalid or already-used registration token');
      }

      const claimed = await this.claimRegistrationToken(rawToken);
      if (!claimed) {
        throw new BadRequestException(
          'registration token is invalid, already used, or expired',
        );
      }
      grantedModelIds = claimed.grantedModelIds;
    }

    const role = isBootstrap ? 'ADMIN' : 'USER';
    const passwordHash = await bcrypt.hash(args.password, 10);

    let user: User;
    try {
      user = await this.prisma.runAsAdmin((tx) =>
        tx.user.create({
          data: { email, passwordHash, name: args.name, role },
        }),
      );
    } catch (err) {
      if (err instanceof Error && /Unique constraint/.test(err.message)) {
        throw new ConflictException('email already registered');
      }
      throw err;
    }

    if (!isBootstrap && args.registrationToken) {
      const rawToken = args.registrationToken.trim().toLowerCase();
      await this.prisma.runAsAdmin((tx) =>
        tx.registrationToken.update({
          where: { token: rawToken },
          data: { consumedById: user.id },
        }),
      );
    }

    await this.applyModelGrant(user.id, grantedModelIds);

    return { user, token: await this.issueToken(user) };
  }

  async login(args: LoginArgs): Promise<{ user: User; token: string }> {
    const email = args.email.trim().toLowerCase();
    const user = await this.prisma.runAsAdmin((tx) =>
      tx.user.findUnique({ where: { email } }),
    );
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('invalid credentials');
    }
    let ok = false;
    try {
      ok = await bcrypt.compare(args.password, user.passwordHash);
    } catch {
      ok = false;
    }
    if (!ok) throw new UnauthorizedException('invalid credentials');

    return { user, token: await this.issueToken(user) };
  }

  async getCurrentUser(userId: string): Promise<User> {
    const user = await this.prisma.runAsAdmin((tx) =>
      tx.user.findUnique({ where: { id: userId } }),
    );
    if (!user) throw new NotFoundException('user not found');
    return user;
  }

  async updateProfile(userId: string, args: { name?: string }): Promise<User> {
    const name = args.name?.trim();
    if (!name) throw new BadRequestException('display name is required');
    if (name.length > 120) throw new BadRequestException('display name too long');
    return this.prisma.runAsAdmin((tx) =>
      tx.user.update({ where: { id: userId }, data: { name } }),
    );
  }

  async changePassword(
    userId: string,
    args: { currentPassword: string; newPassword: string },
  ): Promise<User> {
    if (!args.newPassword || args.newPassword.length < 8) {
      throw new BadRequestException('new password must be at least 8 characters');
    }
    const user = await this.prisma.runAsAdmin((tx) =>
      tx.user.findUnique({ where: { id: userId } }),
    );
    if (!user || !user.passwordHash) throw new NotFoundException('user not found');

    let ok = false;
    try {
      ok = await bcrypt.compare(args.currentPassword, user.passwordHash);
    } catch {
      ok = false;
    }
    if (!ok) throw new UnauthorizedException('current password is incorrect');

    const passwordHash = await bcrypt.hash(args.newPassword, 10);
    const updated = await this.prisma.runAsAdmin((tx) =>
      tx.user.update({ where: { id: userId }, data: { passwordHash } }),
    );
    this.logger.log(`password changed for user=${userId}`);
    return updated;
  }

  /** Org seat cap (SystemSetting ORG_MAX_SEATS, default 5). */
  private async orgMaxSeats(): Promise<number> {
    const raw = await this.config.resolveConfig('ORG_MAX_SEATS');
    const n = parseInt(raw ?? '', 10);
    return Number.isFinite(n) && n > 0 ? n : DEFAULT_ORG_MAX_SEATS;
  }

  /**
   * Create an invite a teammate can redeem at signup.
   */
  async createInvite(
    createdByUserId: string,
  ): Promise<{ token: string }> {
    const token = randomBytes(24).toString('hex'); // 48 hex chars
    await this.prisma.runAsAdmin((tx) =>
      tx.registrationToken.create({
        data: { token, role: 'USER', createdById: createdByUserId },
      }),
    );
    this.logger.log(`invite created by user=${createdByUserId}`);
    return { token };
  }

  /**
   * Request a password reset for the given email.
   *
   * Per OWASP Forgot Password Cheat Sheet: always returns void regardless of
   * whether the email is registered — never reveal account existence.
   * A cryptographically random single-use token is created and emailed to the
   * user; it expires in 1 hour.
   */
  async requestPasswordReset(
    email: string,
    now: Date = new Date(),
  ): Promise<void> {
    const user = await this.prisma.runAsAdmin((tx) =>
      tx.user.findUnique({ where: { email } }),
    );
    if (!user) return; // no account enumeration

    const token = randomBytes(32).toString('hex'); // 64 hex chars — CSPRNG
    const expiresAt = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour

    await this.prisma.runAsAdmin((tx) =>
      tx.passwordResetToken.create({
        data: { token, userId: user.id, expiresAt },
      }),
    );

    await this.mailer.sendPasswordReset(email, token);
  }

  /**
   * Confirm a password reset using a single-use token.
   *
   * Uses an atomic updateMany (consumed:false + expiresAt>now) to guarantee
   * single-winner semantics under concurrent requests. Returns true on success,
   * false when the token is unknown, already consumed, or expired.
   */
  async confirmPasswordReset(
    token: string,
    newPassword: string,
    now: Date = new Date(),
  ): Promise<boolean> {
    const result = await this.prisma.runAsAdmin((tx) =>
      tx.passwordResetToken.updateMany({
        where: { token, consumed: false, expiresAt: { gt: now } },
        data: { consumed: true, consumedAt: now },
      }),
    );

    if (result.count !== 1) return false;

    const resetToken = await this.prisma.runAsAdmin((tx) =>
      tx.passwordResetToken.findUnique({ where: { token } }),
    );

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.prisma.runAsAdmin((tx) =>
      tx.user.update({
        where: { id: resetToken!.userId },
        data: { passwordHash },
      }),
    );

    return true;
  }

  async issueToken(user: User): Promise<string> {
    const payload: SessionPayload = {
      userId: user.id,
      role: user.role,
      firmId: null,
    };
    return this.jwt.signAsync(payload);
  }
}
