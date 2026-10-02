import { Module } from '@nestjs/common';
import { AdminUsersController } from './admin-users.controller';
import { AdminSettingsController } from './admin-settings.controller';
import { AdminSettingsService } from './admin-settings.service';
import { AdminAuditController } from './admin-audit.controller';
import { AuditLogService } from '../common/audit-log.service';

/**
 * AdminModule registers all admin-namespaced controllers. Services provided
 * explicitly here; globally available services (AppConfigService, PrismaService)
 * arrive via AppConfigModule and PrismaModule which are all @Global in AppModule.
 */
@Module({
  imports: [],
  controllers: [
    AdminUsersController,
    AdminSettingsController,
    AdminAuditController,
  ],
  providers: [AdminSettingsService, AuditLogService],
})
export class AdminModule {}
