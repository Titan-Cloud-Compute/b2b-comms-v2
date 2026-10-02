import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuditActor, Prisma } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RequireAdmin } from '../auth/roles.guard';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Audit log endpoints.
 *
 * GET /api/admin/audit-log — queryable "who did what" trail.
 */
@ApiTags('admin-audit')
@UseGuards(JwtAuthGuard)
@RequireAdmin()
@Controller('api/admin')
export class AdminAuditController {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  /**
   * GET /api/admin/audit-log — the queryable "who did what" trail. Filters:
   * ?actor=ADMIN|USER|SYSTEM, ?action= (prefix match, e.g. 'integration.'),
   * ?actorUserId=, ?from=/?to= (ISO on createdAt), ?page=/?pageSize=
   * (default 50, max 200). Newest first.
   */
  @Get('audit-log')
  async auditLog(
    @Query('actor') actor?: string,
    @Query('action') action?: string,
    @Query('actorUserId') actorUserId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const take = Math.min(Math.max(parseInt(pageSize ?? '50', 10) || 50, 1), 200);
    const pageNum = Math.max(parseInt(page ?? '1', 10) || 1, 1);
    const skip = (pageNum - 1) * take;

    const where: Prisma.AuditLogWhereInput = {};
    if (actor && (['SYSTEM', 'USER', 'ADMIN'] as const).includes(actor as AuditActor)) {
      where.actor = actor as AuditActor;
    }
    if (action) where.action = { startsWith: action };
    if (actorUserId) where.actorUserId = actorUserId;

    const gte = from ? new Date(from) : undefined;
    const lte = to ? new Date(to) : undefined;
    const hasGte = gte && !Number.isNaN(gte.getTime());
    const hasLte = lte && !Number.isNaN(lte.getTime());
    if (hasGte || hasLte) {
      where.createdAt = { ...(hasGte ? { gte } : {}), ...(hasLte ? { lte } : {}) };
    }

    const [rows, total] = await this.prisma.runAsAdmin((tx) =>
      Promise.all([
        tx.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, take, skip }),
        tx.auditLog.count({ where }),
      ]),
    );
    return { rows, total, page: pageNum, pageSize: take };
  }
}
