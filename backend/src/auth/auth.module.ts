import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { MailerService } from './mailer.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';
import { SessionRenewInterceptor } from './session-renew.interceptor';
import { DEV_JWT_SECRET_SENTINEL } from '../config/security-config';

/**
 * AuthModule is global so JwtAuthGuard / RolesGuard are usable from any
 * feature module without a re-import.
 *
 * Guard execution order (APP_GUARD providers run in registration order):
 *   1. JwtAuthGuard — validates the session cookie; populates req.session.
 *      Routes decorated with @Public() bypass JWT validation entirely.
 *   2. RolesGuard   — checks req.session.role against @Roles / @RequireAdmin
 *      metadata. Routes without role metadata pass through.
 */
@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: process.env.JWT_SECRET ?? DEV_JWT_SECRET_SENTINEL,
        signOptions: {
          expiresIn: (process.env.JWT_EXPIRES_IN ?? '7d') as unknown as number,
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    MailerService,
    JwtAuthGuard,
    RolesGuard,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_INTERCEPTOR, useClass: SessionRenewInterceptor },
  ],
  exports: [AuthService, MailerService, JwtAuthGuard, RolesGuard, JwtModule],
})
export class AuthModule {}
