/**
 * Cookie-session auth HTTP contract (supertest): login sets the session cookie,
 * auth/me confirms it, logout clears it, routes are deny-by-default, and the
 * role guard keeps non-admins off admin-only routes.
 */
import 'reflect-metadata';
import { Controller, Get, INestApplication, UnauthorizedException } from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RequireAdmin, RolesGuard } from './roles.guard';
import { SESSION_COOKIE_NAME } from './session-cookie';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const cookieParser = require('cookie-parser');

@Controller('api/probe')
class ProbeController {
  @Get('open-to-any-session')
  any() {
    return { ok: true };
  }

  @RequireAdmin()
  @Get('admin-only')
  admin() {
    return { ok: true };
  }
}

type Role = 'USER' | 'MANAGER' | 'ADMIN';
const USERS: Record<string, { id: string; email: string; name: string; role: Role; password: string }> = {
  'user@demo.local': { id: 'u1', email: 'user@demo.local', name: 'User', role: 'USER', password: 'pw-user' },
  'manager@demo.local': { id: 'u2', email: 'manager@demo.local', name: 'Manager', role: 'MANAGER', password: 'pw-manager' },
  'admin@demo.local': { id: 'u3', email: 'admin@demo.local', name: 'Admin', role: 'ADMIN', password: 'pw-admin' },
};

describe('auth session HTTP contract', () => {
  let app: INestApplication;
  let jwt: JwtService;

  beforeAll(async () => {
    const authService = {
      login: jest.fn(async ({ email, password }: { email: string; password: string }) => {
        const user = USERS[email];
        if (!user || user.password !== password) throw new UnauthorizedException('invalid credentials');
        const token = await jwt.signAsync({ userId: user.id, role: user.role, firmId: null });
        return { user, token };
      }),
      getCurrentUser: jest.fn(async (userId: string) => {
        const user = Object.values(USERS).find((u) => u.id === userId);
        if (!user) throw new UnauthorizedException();
        return user;
      }),
    };
    const moduleRef = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: 'contract-test-secret', signOptions: { expiresIn: '1h' } })],
      controllers: [AuthController, ProbeController],
      providers: [
        Reflector,
        { provide: AuthService, useValue: authService },
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
      ],
    }).compile();
    jwt = moduleRef.get(JwtService);
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  const sessionCookie = (res: request.Response): string => {
    const raw = res.headers['set-cookie'] as unknown as string[] | string | undefined;
    const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
    const c = list.find((v) => v.startsWith(`${SESSION_COOKIE_NAME}=`));
    if (!c) throw new Error('no session cookie set');
    return c;
  };

  async function signIn(email: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password: USERS[email].password })
      .expect(200);
    expect(res.body).toEqual({ id: USERS[email].id, email, role: USERS[email].role });
    const cookie = sessionCookie(res);
    expect(cookie.toLowerCase()).toContain('httponly');
    return cookie.split(';')[0];
  }

  it('rejects bad credentials with 401 and sets no session', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'user@demo.local', password: 'wrong' })
      .expect(401);
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  it('is deny-by-default: no cookie → 401 on me and on undecorated routes', async () => {
    await request(app.getHttpServer()).get('/api/auth/me').expect(401);
    await request(app.getHttpServer()).get('/api/probe/open-to-any-session').expect(401);
    await request(app.getHttpServer()).get('/api/probe/admin-only').expect(401);
  });

  it('rejects a forged session cookie', async () => {
    await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Cookie', `${SESSION_COOKIE_NAME}=not-a-jwt`)
      .expect(401);
  });

  it.each(['user@demo.local', 'manager@demo.local', 'admin@demo.local'])(
    'login as %s → auth/me confirms the session server-side',
    async (email) => {
      const cookie = await signIn(email);
      const me = await request(app.getHttpServer()).get('/api/auth/me').set('Cookie', cookie).expect(200);
      expect(me.body).toEqual({ id: USERS[email].id, email, name: USERS[email].name, role: USERS[email].role });
    },
  );

  it('role guard: USER and MANAGER get 403 on admin-only, ADMIN gets 200', async () => {
    for (const email of ['user@demo.local', 'manager@demo.local']) {
      const cookie = await signIn(email);
      await request(app.getHttpServer()).get('/api/probe/open-to-any-session').set('Cookie', cookie).expect(200);
      await request(app.getHttpServer()).get('/api/probe/admin-only').set('Cookie', cookie).expect(403);
    }
    const admin = await signIn('admin@demo.local');
    await request(app.getHttpServer()).get('/api/probe/admin-only').set('Cookie', admin).expect(200);
  });

  it('logout clears the session cookie', async () => {
    const cookie = await signIn('user@demo.local');
    const res = await request(app.getHttpServer()).post('/api/auth/logout').set('Cookie', cookie).expect(204);
    const cleared = sessionCookie(res);
    expect(cleared).toMatch(new RegExp(`^${SESSION_COOKIE_NAME}=;`));
    // Expired either by a 1970 Expires date (Express 5) or Max-Age=0.
    expect(/Expires=Thu, 01 Jan 1970/.test(cleared) || /Max-Age=0\b/.test(cleared)).toBe(true);
  });
});
