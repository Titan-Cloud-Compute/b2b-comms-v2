import { Injectable } from '@nestjs/common';
import { Router, Query, Input } from 'nestjs-trpc';
import { z } from 'zod';
import { UsersService } from './users.service';
import type { User } from '@prisma/client';

@Injectable()
@Router({ alias: 'users' })
export class UsersRouter {
  constructor(private readonly usersService: UsersService) {}

  @Query()
  async findAll(): Promise<User[]> {
    return this.usersService.findAll();
  }

  @Query({
    input: z.object({ id: z.string().uuid() }),
  })
  async findById(
    @Input('id') id: string,
  ): Promise<User | null> {
    return this.usersService.findById(id);
  }
}
