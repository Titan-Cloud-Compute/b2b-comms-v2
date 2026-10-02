import { AdminSettingsController } from './admin-settings.controller';
import { maskValue } from './admin-settings.masking';

/**
 * The write path must survive a buggy client. Every admin form is supposed to
 * drop an untouched (masked) field before saving, but that check is hand-rolled
 * in each form; this proves the server does not depend on them getting it right.
 *
 * Mutation check: delete the isMaskEcho filter in patch() and the first two
 * tests below fail — the stored key is overwritten with bullets.
 */
describe('PATCH /api/admin/settings — masked-echo guard', () => {
  const STORED = 'sk-live-abcdefghijkl';
  let upserts: { key: string; value: string }[];
  let invalidated: string[];
  let controller: AdminSettingsController;

  beforeEach(() => {
    upserts = [];
    invalidated = [];
    const tx = {
      systemSetting: {
        findMany: async () => [{ key: 'LITELLM_API_KEY', value: STORED }],
        upsert: async ({ create }: { create: { key: string; value: string } }) => {
          upserts.push(create);
          return create;
        },
      },
    };
    const prisma = { runAsAdmin: (fn: (t: typeof tx) => unknown) => fn(tx) };
    const config = { invalidate: (k: string) => invalidated.push(k) };
    controller = new AdminSettingsController(
      prisma as never,
      config as never,
      {} as never,
      {} as never,
      {} as never,
    );
  });

  it('ignores a write that echoes the preview it served', async () => {
    const r = await controller.patch([{ key: 'LITELLM_API_KEY', value: maskValue(STORED) }]);
    expect(upserts).toEqual([]);
    expect(r).toMatchObject({ ok: true, updated: 0, skipped: 1 });
    expect(invalidated).toEqual([]);
  });

  it('ignores the generic all-bullets placeholder', async () => {
    const r = await controller.patch([{ key: 'LITELLM_API_KEY', value: '••••••••' }]);
    expect(upserts).toEqual([]);
    expect(r).toMatchObject({ updated: 0, skipped: 1 });
  });

  it('still writes a real edit, and only that one', async () => {
    const r = await controller.patch([
      { key: 'LITELLM_API_KEY', value: maskValue(STORED) },
      { key: 'SMTP_HOST', value: 'smtp.gmail.com' },
    ]);
    expect(upserts).toEqual([{ key: 'SMTP_HOST', value: 'smtp.gmail.com' }]);
    expect(r).toMatchObject({ updated: 1, skipped: 1 });
    expect(invalidated).toEqual(['SMTP_HOST']);
  });

  it('lets an admin clear a setting on purpose', async () => {
    const r = await controller.patch([{ key: 'LITELLM_API_KEY', value: '' }]);
    expect(upserts).toEqual([{ key: 'LITELLM_API_KEY', value: '' }]);
    expect(r).toMatchObject({ updated: 1, skipped: 0 });
  });
});
