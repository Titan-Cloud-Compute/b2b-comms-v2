/**
 * Lead-written fail-to-pass oracle for docs/plans/golden-debug-provenance.md (U4: password-reset ROUTES).
 * U2 (template-skeleton.md) delivered AuthService.requestPasswordReset/confirmPasswordReset but the
 * controller never exposed them, so the web's `auth/password-reset/request|confirm` POSTs 404 live
 * (golden run d87c0f84, 2026-09-26). This spec pins the controller wiring; it ships into
 * scaffold-templates/template-enterprise/backend/src/auth/ as the template's own test.
 *
 * Contract (workers implement TO this file):
 *   AuthController.requestPasswordReset(body)  — @Public() @Post('password-reset/request') @HttpCode(200)
 *       parses { email } (zod), awaits authService.requestPasswordReset(email), returns { ok: true }.
 *   AuthController.confirmPasswordReset(body)  — @Public() @Post('password-reset/confirm') @HttpCode(200)
 *       parses { token, password } (zod), awaits authService.confirmPasswordReset(token, password);
 *       true → { ok: true }; false → throws BadRequestException.
 * FAILS today: AuthController has neither handler.
 */
import { BadRequestException, HttpStatus, RequestMethod } from '@nestjs/common';
import { HTTP_CODE_METADATA, METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { AuthController } from './auth.controller';
import { IS_PUBLIC_KEY } from './decorators/public.decorator';

function makeController(confirmResult = true) {
  const authService = {
    requestPasswordReset: jest.fn().mockResolvedValue(undefined),
    confirmPasswordReset: jest.fn().mockResolvedValue(confirmResult),
  };
  const controller = new (AuthController as any)(authService) as AuthController;
  return { controller, authService };
}

const handler = (name: string) => (AuthController.prototype as any)[name];

describe('AuthController password-reset routes (U4)', () => {
  it('exposes POST api/auth/password-reset/request as a public 200 route', () => {
    const h = handler('requestPasswordReset');
    expect(typeof h).toBe('function');
    expect(Reflect.getMetadata(PATH_METADATA, h)).toBe('password-reset/request');
    expect(Reflect.getMetadata(METHOD_METADATA, h)).toBe(RequestMethod.POST);
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, h)).toBe(true);
    expect(Reflect.getMetadata(HTTP_CODE_METADATA, h)).toBe(HttpStatus.OK);
  });

  it('exposes POST api/auth/password-reset/confirm as a public 200 route', () => {
    const h = handler('confirmPasswordReset');
    expect(typeof h).toBe('function');
    expect(Reflect.getMetadata(PATH_METADATA, h)).toBe('password-reset/confirm');
    expect(Reflect.getMetadata(METHOD_METADATA, h)).toBe(RequestMethod.POST);
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, h)).toBe(true);
    expect(Reflect.getMetadata(HTTP_CODE_METADATA, h)).toBe(HttpStatus.OK);
  });

  it('request delegates the email to the service and always answers { ok: true }', async () => {
    const { controller, authService } = makeController();
    await expect((controller as any).requestPasswordReset({ email: 'user@demo.local' })).resolves.toEqual({ ok: true });
    expect(authService.requestPasswordReset).toHaveBeenCalledWith('user@demo.local');
  });

  it('request rejects a malformed email without calling the service', async () => {
    const { controller, authService } = makeController();
    await expect((controller as any).requestPasswordReset({ email: 'not-an-email' })).rejects.toBeDefined();
    expect(authService.requestPasswordReset).not.toHaveBeenCalled();
  });

  it('confirm passes token + password to the service and answers { ok: true } on success', async () => {
    const { controller, authService } = makeController(true);
    await expect((controller as any).confirmPasswordReset({ token: 't0k', password: 'Golden-U5-newpass1234' })).resolves.toEqual({ ok: true });
    expect(authService.confirmPasswordReset).toHaveBeenCalledWith('t0k', 'Golden-U5-newpass1234');
  });

  it('confirm throws BadRequestException when the service rejects the token', async () => {
    const { controller } = makeController(false);
    await expect((controller as any).confirmPasswordReset({ token: 'stale', password: 'Golden-U5-newpass1234' })).rejects.toBeInstanceOf(BadRequestException);
  });
});
