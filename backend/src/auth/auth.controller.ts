import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { SignupSchema } from './signup.schema';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RequireAdmin } from './roles.guard';
import { Public } from './decorators/public.decorator';
import type { SessionPayload } from './session.types';
import {
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_MS,
  sessionCookieOptions,
} from './session-cookie';

/** JWT claims present at runtime after verifyAsync (not in SessionPayload). */
type SessionClaims = SessionPayload & { iat?: number; exp?: number };

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
const UpdateProfileSchema = z.object({
  name: z.string().min(1).max(120),
});
const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

const PasswordResetRequestSchema = z.object({
  email: z.string().email(),
});

const PasswordResetConfirmSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8),
});

// Shared with SessionRenewInterceptor — see session-cookie.ts.
const COOKIE_NAME = SESSION_COOKIE_NAME;
const COOKIE_MAX_AGE_MS = SESSION_MAX_AGE_MS;

@ApiTags('auth')
@Controller('api/auth')
export class AuthController {
  private readonly logger = new Logger('AuthController');

  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('signup')
  @HttpCode(HttpStatus.CREATED)
  async signup(@Body() body: unknown, @Res({ passthrough: true }) res: Response) {
    const parsed = SignupSchema.parse(body);
    const { user, token } = await this.authService.signup(parsed);
    this.setSessionCookie(res, token);
    return { id: user.id, email: user.email, role: user.role };
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() body: unknown, @Res({ passthrough: true }) res: Response) {
    const parsed = LoginSchema.parse(body);
    const { user, token } = await this.authService.login(parsed);
    this.setSessionCookie(res, token);
    return { id: user.id, email: user.email, role: user.role };
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  logout(@Res({ passthrough: true }) res: Response): void {
    res.clearCookie(COOKIE_NAME, this.cookieOptions(0));
  }

  /**
   * PUBLIC preview of a registration token's model entitlement, for the
   * unauthenticated signup page: the "Preferred AI model" field is a static
   * display of the model the registrant's token grants, so it needs to resolve
   * that model before the account exists.
   *
   * Malformed tokens are rejected with 400; unknown / consumed / expired tokens
   * answer 200 `{ valid: false, models: [] }`. Never returns user data.
   */
  @Public()
  @Get('registration-token/:token')
  @HttpCode(HttpStatus.OK)
  async previewRegistrationToken(@Param('token') token: string) {
    if (!/^[a-fA-F0-9]{48}$/.test((token ?? '').trim())) {
      throw new BadRequestException('invalid registration token format');
    }
    return this.authService.previewRegistrationToken(token.trim());
  }

  @UseGuards(JwtAuthGuard)
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    // The cookie holds enough state to reissue without a DB hop. We deliberately
    // re-sign so the exp gets bumped on every active request.
    //
    // Strip iat/exp before re-signing: JwtModule registers a default
    // signOptions.expiresIn, and jsonwebtoken REJECTS a payload that already
    // carries an `exp` claim ("Bad options.expiresIn — the payload already has
    // an exp property"). The verified session always carries iat/exp, so
    // without this strip every call to /auth/refresh threw and the caller was
    // left holding its stale cookie — which then 401s and bounces the user to
    // '/login' (the intake-finish handoff). Mirrors SessionRenewInterceptor.
    const { iat: _iat, exp: _exp, ...payload } = req.session! as SessionClaims;
    const token = await this.authService['jwt'].signAsync(payload);
    this.setSessionCookie(res, token);
    return { ok: true };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  @HttpCode(HttpStatus.OK)
  async getMe(@Req() req: Request) {
    const { userId } = req.session!;
    const user = await this.authService.getCurrentUser(userId);
    return { id: user.id, email: user.email, name: user.name, role: user.role };
  }

  /** Update the signed-in user's editable profile (display name). */
  @UseGuards(JwtAuthGuard)
  @Patch('me')
  @HttpCode(HttpStatus.OK)
  async updateMe(@Req() req: Request, @Body() body: unknown) {
    const { userId } = req.session!;
    const parsed = UpdateProfileSchema.parse(body);
    const user = await this.authService.updateProfile(userId, parsed);
    return { id: user.id, email: user.email, name: user.name, role: user.role };
  }

  /** Change the signed-in user's password, then re-issue a fresh session
   *  cookie so the active session continues on the new credential. */
  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @Req() req: Request,
    @Body() body: unknown,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { userId } = req.session!;
    const parsed = ChangePasswordSchema.parse(body);
    const user = await this.authService.changePassword(userId, parsed);
    this.setSessionCookie(res, await this.authService.issueToken(user));
    return { ok: true };
  }

  /**
   * Create an invite token a teammate can use to sign up.
   */
  @UseGuards(JwtAuthGuard)
  @Post('invite')
  @HttpCode(HttpStatus.CREATED)
  async invite(@Req() req: Request) {
    const session = req.session!;
    return this.authService.createInvite(session.userId);
  }

  /**
   * Request a password-reset email. Always answers { ok: true } — never reveals
   * whether the address is registered (OWASP Forgot Password Cheat Sheet).
   */
  @Public()
  @Post('password-reset/request')
  @HttpCode(HttpStatus.OK)
  async requestPasswordReset(@Body() body: unknown) {
    const { email } = PasswordResetRequestSchema.parse(body);
    await this.authService.requestPasswordReset(email);
    return { ok: true };
  }

  /**
   * Consume a single-use reset token and set the new password.
   */
  @Public()
  @Post('password-reset/confirm')
  @HttpCode(HttpStatus.OK)
  async confirmPasswordReset(@Body() body: unknown) {
    const { token, password } = PasswordResetConfirmSchema.parse(body);
    const ok = await this.authService.confirmPasswordReset(token, password);
    if (!ok) throw new BadRequestException('invalid or expired reset token');
    return { ok: true };
  }

  private setSessionCookie(res: Response, token: string): void {
    res.cookie(COOKIE_NAME, token, this.cookieOptions(COOKIE_MAX_AGE_MS));
  }

  private cookieOptions(maxAgeMs: number) {
    return sessionCookieOptions(maxAgeMs);
  }
}
