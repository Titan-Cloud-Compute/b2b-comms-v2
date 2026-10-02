import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Prisma, UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import type { Request } from 'express';
import { z } from 'zod';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RequireAdmin, RolesGuard } from '../auth/roles.guard';
import { Audit } from '../common/audit.decorator';
import { PrismaService } from '../prisma/prisma.service';

const USER_ROLES: readonly UserRole[] = ['ADMIN', 'MANAGER', 'USER'];

const ADMIN_ROLES: readonly UserRole[] = ['ADMIN'];

const CreateAdminUserSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  name: z.string().trim().min(1).max(200),
  role: z.enum(['ADMIN', 'MANAGER', 'USER']),
});

export type CreateAdminUserDto = z.infer<typeof CreateAdminUserSchema>;

const UpdateUserRoleSchema = z.object({
  role: z.enum(['ADMIN', 'MANAGER', 'USER']),
});

export type UpdateUserRoleDto = z.infer<typeof UpdateUserRoleSchema>;

/** Shared select so POST returns the same shape as GET rows. */
const USER_ROW_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

@ApiTags('admin-users')
@UseGuards(JwtAuthGuard, RolesGuard)
@RequireAdmin()
@Controller('api/admin/users')
export class AdminUsersController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@Query('q') q?: string, @Query('role') role?: string) {
    const where: Prisma.UserWhereInput = {};

    const trimmed = q?.trim();
    if (trimmed) {
      where.OR = [
        { name: { contains: trimmed, mode: 'insensitive' } },
        { email: { contains: trimmed, mode: 'insensitive' } },
      ];
    }

    if (role && USER_ROLES.includes(role as UserRole)) {
      where.role = role as UserRole;
    }

    return this.prisma.runAsAdmin((tx) =>
      tx.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 1000,
        select: USER_ROW_SELECT,
      }),
    );
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Audit('user.create', { bodyKeys: ['email', 'role'] })
  async create(@Body() body: unknown) {
    const dto = CreateAdminUserSchema.parse(body ?? {});

    const tempPassword = randomBytes(24).toString('hex');
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    try {
      const user = await this.prisma.runAsAdmin((tx) =>
        tx.user.create({
          data: {
            email: dto.email,
            name: dto.name,
            role: dto.role,
            passwordHash,
          },
          select: USER_ROW_SELECT,
        }),
      );
      return { ...user, temporaryPassword: tempPassword };
    } catch (err) {
      if (err instanceof Error && /Unique constraint/.test(err.message)) {
        throw new ConflictException('email already registered');
      }
      throw err;
    }
  }

  @Patch(':id')
  @Audit('user.updateRole', { bodyKeys: ['role'] })
  async updateRole(@Param('id') id: string, @Body() body: unknown) {
    const dto = UpdateUserRoleSchema.parse(body ?? {});

    const existing = await this.prisma.runAsAdmin((tx) =>
      tx.user.findUnique({ where: { id }, select: { id: true } }),
    );
    if (!existing) throw new NotFoundException('user not found');

    return this.prisma.runAsAdmin((tx) =>
      tx.user.update({
        where: { id },
        data: { role: dto.role },
        select: USER_ROW_SELECT,
      }),
    );
  }

  @Post(':id/reset-password')
  @HttpCode(HttpStatus.OK)
  @Audit('user.resetPassword')
  async resetPassword(@Param('id') id: string) {
    const existing = await this.prisma.runAsAdmin((tx) =>
      tx.user.findUnique({ where: { id }, select: { id: true } }),
    );
    if (!existing) throw new NotFoundException('user not found');

    const tempPassword = randomBytes(24).toString('hex');
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    const user = await this.prisma.runAsAdmin((tx) =>
      tx.user.update({
        where: { id },
        data: { passwordHash },
        select: { id: true },
      }),
    );

    return { id: user.id, temporaryPassword: tempPassword };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @Audit('user.delete')
  async remove(@Param('id') id: string, @Req() req: Request): Promise<{ ok: true }> {
    const session = req.session;
    const selfIds = new Set(
      [session?.impersonatedBy, session?.userId].filter(
        (v): v is string => typeof v === 'string' && v.length > 0,
      ),
    );
    if (selfIds.has(id)) {
      throw new BadRequestException('you cannot delete your own account');
    }

    const existing = await this.prisma.runAsAdmin((tx) =>
      tx.user.findUnique({ where: { id }, select: { id: true, role: true } }),
    );
    if (!existing) throw new NotFoundException('user not found');

    if (existing.role === 'ADMIN') {
      const adminCount = await this.prisma.runAsAdmin((tx) =>
        tx.user.count({ where: { role: 'ADMIN' } }),
      );
      if (adminCount <= 1) {
        throw new BadRequestException('cannot delete the last remaining ADMIN');
      }
    }

    await this.prisma.runAsAdmin((tx) => tx.user.delete({ where: { id } }));
    return { ok: true };
  }
}
