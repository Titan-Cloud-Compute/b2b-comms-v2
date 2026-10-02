/**
 * Lead-written fail-to-pass oracle for docs/plans/template-skeleton.md (U2 backend/skeleton).
 * Verify expr copies this file to scaffold-templates/template-enterprise/backend/src/auth/
 * and runs `npx jest src/auth`. Mirrors auth-token-claim.spec.ts: prisma.runAsAdmin runs the
 * callback against a tx stub; nothing touches a database.
 *
 * Contract pinned here (workers implement TO this file):
 *   new AuthService(prisma, jwt, config, mailer)      — mailer is the 4th constructor param
 *   requestPasswordReset(email, now?)  → Promise<void> — tx.user.findUnique({ where: { email } });
 *       known user: tx.passwordResetToken.create({ data: { token, userId, expiresAt > now } })
 *                   then mailer.sendPasswordReset(email, token);  unknown user: no create, no mail,
 *                   still resolves (no account enumeration).
 *   confirmPasswordReset(token, newPassword, now?) → Promise<boolean> — ATOMIC single-winner claim
 *       tx.passwordResetToken.updateMany({ where: { token, consumed: false, expiresAt: { gt: now } },
 *       data: { consumed: true, consumedAt: now } }); count !== 1 → false and no user.update;
 *       count === 1 → findUnique the row's userId, tx.user.update({ where: { id }, data: { passwordHash } })
 *       with a bcrypt hash of newPassword, → true.
 * FAILS today: AuthService has neither method.
 */
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';

type Call = { where: Record<string, any>; data: Record<string, any> };

function makeService(opts: { user?: { id: string; email: string } | null; claimCount?: number }) {
  const userFindUnique = jest.fn().mockResolvedValue(opts.user ?? null);
  const userUpdate = jest.fn().mockResolvedValue({});
  const tokenCreate = jest.fn().mockResolvedValue({});
  const tokenUpdateMany = jest.fn().mockResolvedValue({ count: opts.claimCount ?? 0 });
  const tokenFindUnique = jest.fn().mockResolvedValue({ userId: 'u-1' });
  const tx = {
    user: { findUnique: userFindUnique, update: userUpdate },
    passwordResetToken: { create: tokenCreate, updateMany: tokenUpdateMany, findUnique: tokenFindUnique },
  };
  const prisma = { runAsAdmin: (fn: (t: typeof tx) => unknown) => fn(tx) } as any;
  const mailer = { sendPasswordReset: jest.fn().mockResolvedValue(undefined) };
  const service = new (AuthService as any)(prisma, {}, {}, mailer) as AuthService;
  return { service, userFindUnique, userUpdate, tokenCreate, tokenUpdateMany, tokenFindUnique, mailer };
}

describe('AuthService password reset — request', () => {
  it('known email: stores an unexpired token for that user and mails it', async () => {
    const now = new Date('2026-09-25T00:00:00.000Z');
    const s = makeService({ user: { id: 'u-1', email: 'a@example.com' } });

    await (s.service as any).requestPasswordReset('a@example.com', now);

    expect(s.userFindUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { email: 'a@example.com' } }));
    expect(s.tokenCreate).toHaveBeenCalledTimes(1);
    const { data } = s.tokenCreate.mock.calls[0][0] as Call;
    expect(data.userId).toBe('u-1');
    expect(typeof data.token).toBe('string');
    expect(data.token.length).toBeGreaterThanOrEqual(32);
    expect(new Date(data.expiresAt).getTime()).toBeGreaterThan(now.getTime());
    expect(s.mailer.sendPasswordReset).toHaveBeenCalledWith('a@example.com', data.token);
  });

  it('unknown email: no token, no mail, still resolves (no enumeration)', async () => {
    const s = makeService({ user: null });
    await expect((s.service as any).requestPasswordReset('nobody@example.com')).resolves.toBeUndefined();
    expect(s.tokenCreate).not.toHaveBeenCalled();
    expect(s.mailer.sendPasswordReset).not.toHaveBeenCalled();
  });
});

describe('AuthService password reset — confirm (atomic single-winner claim)', () => {
  it('claims with updateMany gated on consumed:false + expiresAt>now, then updates the password hash', async () => {
    const now = new Date('2026-09-25T00:00:00.000Z');
    const s = makeService({ claimCount: 1 });

    const ok = await (s.service as any).confirmPasswordReset('tok-1', 'newpassword1234', now);

    expect(ok).toBe(true);
    const { where, data } = s.tokenUpdateMany.mock.calls[0][0] as Call;
    expect(where).toMatchObject({ token: 'tok-1', consumed: false });
    expect(JSON.stringify(where)).toContain('expiresAt');
    expect(data).toMatchObject({ consumed: true });
    expect(s.userUpdate).toHaveBeenCalledTimes(1);
    const upd = s.userUpdate.mock.calls[0][0] as Call;
    expect(upd.where).toEqual({ id: 'u-1' });
    expect(upd.data.passwordHash).not.toBe('newpassword1234');
    expect(await bcrypt.compare('newpassword1234', upd.data.passwordHash)).toBe(true);
  });

  it('returns false and never touches the user when the claim wins 0 rows (used / expired / unknown)', async () => {
    const s = makeService({ claimCount: 0 });
    const ok = await (s.service as any).confirmPasswordReset('tok-x', 'newpassword1234');
    expect(ok).toBe(false);
    expect(s.userUpdate).not.toHaveBeenCalled();
    expect(s.tokenFindUnique).not.toHaveBeenCalled();
  });
});
