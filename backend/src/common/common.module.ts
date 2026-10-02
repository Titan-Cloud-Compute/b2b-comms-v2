import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AppConfigService } from './config.service';
import { AuditLogService } from './audit-log.service';
import { AuditInterceptor } from './audit.interceptor';

/**
 * Shared service layer used by every feature module.
 *
 * @Global so feature modules don't need to import CommonModule themselves —
 * they just inject these services. PrismaModule is also @Global, so the
 * combination gives every module access to: PrismaService, AppConfigService,
 * AuditLogService.
 */
@Global()
@Module({
  providers: [
    AppConfigService,
    AuditLogService,
    // Global audit interceptor — writes a row for any @Audit()-decorated handler.
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
  exports: [
    AppConfigService,
    AuditLogService,
  ],
})
export class CommonModule {}
