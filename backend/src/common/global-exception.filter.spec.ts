/**
 * GlobalExceptionFilter invariants — Prisma error-class → HTTP status mapping.
 * Regression: POST /api/admin/modules with a duplicate `key` used to surface
 * P2002 as an unhandled 500; it is a client conflict (409).
 */
import { GlobalExceptionFilter } from './global-exception.filter';
import { Prisma } from '@prisma/client';
import type { ArgumentsHost } from '@nestjs/common';

const makeHost = () => {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  const host = {
    switchToHttp: () => ({
      getResponse: () => res,
      getRequest: () => ({ method: 'POST', url: '/api/admin/modules' }),
    }),
  } as unknown as ArgumentsHost;
  return { host, res };
};

const prismaError = (code: string, meta?: Record<string, unknown>) =>
  new Prisma.PrismaClientKnownRequestError('boom', {
    code,
    clientVersion: 'test',
    meta,
  });

describe('GlobalExceptionFilter — Prisma mapping', () => {
  const filter = new GlobalExceptionFilter();

  it('maps P2002 unique-constraint to 409 with the violated fields', () => {
    const { host, res } = makeHost();
    filter.catch(prismaError('P2002', { target: ['key'] }), host);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'conflict', fields: ['key'] }),
    );
  });

  it('P2002 with a string meta.target (driver adapters) carries it as the field', () => {
    const { host, res } = makeHost();
    filter.catch(prismaError('P2002', { target: 'LearningModule_key_key' }), host);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'conflict', fields: ['LearningModule_key_key'] }),
    );
  });

  it('P2002 without meta.target still returns 409 (empty fields)', () => {
    const { host, res } = makeHost();
    filter.catch(prismaError('P2002'), host);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'conflict', fields: [] }),
    );
  });

  it('keeps DB-unreachable codes on 503', () => {
    const { host, res } = makeHost();
    filter.catch(prismaError('P1001'), host);
    expect(res.status).toHaveBeenCalledWith(503);
  });

  it('other Prisma query errors still fall through to 500', () => {
    const { host, res } = makeHost();
    filter.catch(prismaError('P2025'), host);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});
