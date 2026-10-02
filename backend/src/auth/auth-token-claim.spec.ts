/**
 * Security regression (T3 U3.4): registration-token redemption must be an
 * ATOMIC single-winner claim, not a check-then-act. Before this change the
 * redeem path read the token in one transaction and marked it consumed in a
 * later one, so two concurrent signups could share one token; and tokens never
 * expired. These cases pin the atomic `updateMany WHERE consumed = false`
 * pattern + the expiry predicate. They fail against the old findUnique/update
 * flow and pass against claimRegistrationToken.
 */

import { AuthService } from './auth.service';

type UpdateManyArgs = {
  where: Record<string, unknown>;
  data: Record<string, unknown>;
};

/**
 * Build an AuthService whose prisma.runAsAdmin runs the callback against a tx
 * stub, with updateMany returning the supplied claim count.
 */
function makeService(claimCount: number) {
  const updateMany = jest
    .fn()
    .mockResolvedValue({ count: claimCount });
  const findUnique = jest
    .fn()
    .mockResolvedValue({ firmId: 'firm-1', role: 'USER' });
  const tx = { registrationToken: { updateMany, findUnique } };
  const prisma = {
    runAsAdmin: (fn: (t: typeof tx) => unknown) => fn(tx),
  } as unknown as ConstructorParameters<typeof AuthService>[0];
  const service = new AuthService(prisma, {} as never, {} as never, {} as never);
  return { service, updateMany, findUnique };
}

describe('AuthService.claimRegistrationToken — atomic single-winner claim', () => {
  it('claims with an atomic updateMany gated on consumed:false (not findUnique-then-update)', async () => {
    const { service, updateMany } = makeService(1);

    const result = await service.claimRegistrationToken('tok-1');

    expect(updateMany).toHaveBeenCalledTimes(1);
    const args = updateMany.mock.calls[0][0] as UpdateManyArgs;
    expect(args.where).toMatchObject({ token: 'tok-1', consumed: false });
    expect(args.data).toMatchObject({ consumed: true });
    expect(result).toEqual({
      firmId: 'firm-1',
      role: 'USER',
      // Token model grants: the claim also surfaces the token's entitlement
      // (empty for legacy tokens whose row predates the grant column).
      grantedModelIds: [],
    });
  });

  it('returns null when the claim wins 0 rows (already consumed / lost race)', async () => {
    const { service, findUnique } = makeService(0);

    const result = await service.claimRegistrationToken('tok-1');

    expect(result).toBeNull();
    // No point reading a token we did not claim.
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('excludes expired tokens via an expiresAt predicate in the same statement', async () => {
    const { service, updateMany } = makeService(1);
    const now = new Date('2026-07-31T00:00:00.000Z');

    await service.claimRegistrationToken('tok-1', now);

    const args = updateMany.mock.calls[0][0] as UpdateManyArgs;
    // The where-clause must admit only unexpired tokens: expiresAt null OR > now.
    expect(JSON.stringify(args.where)).toContain('expiresAt');
    expect(args.where.OR).toEqual([
      { expiresAt: null },
      { expiresAt: { gt: now } },
    ]);
  });
});
