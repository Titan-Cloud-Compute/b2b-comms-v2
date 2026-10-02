import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { AppConfigModule } from './config/config.module';
import { CommonModule } from './common/common.module';
import { IntegrationsModule } from './lib/integrations/integrations.module';
import { AuthModule } from './auth/auth.module';
import { AdminModule } from './admin/admin.module';
import { AuditModule } from './audit/audit.module';
import { UsersModule } from './users/users.module';
import { FEATURE_MODULES } from './features/index';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AppConfigModule,
    CommonModule,
    IntegrationsModule,
    AuthModule,
    HealthModule,
    AdminModule,
    AuditModule,
    UsersModule,
    ...FEATURE_MODULES,
  ],
})
export class AppModule {}
