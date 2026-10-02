/**
 * Migration-lineage collision guard (T4 U4.4).
 *
 * `prisma migrate deploy` keys on migration NAME, and staging carries two
 * divergent lineages whose numbers collide after 0005. A same-named migration
 * already recorded is SILENTLY SKIPPED — the CREATE never runs and you get a
 * runtime 500 ("column X does not exist"), never a migration error. The repo
 * cannot see staging's _prisma_migrations, but it CAN refuse the local mistake
 * that feeds the trap: two migrations sharing a numeric prefix, or a duplicate
 * full name. This guard fails on that drift.
 *
 * See docs/runbooks/staging-migration-lineages.md.
 */

import { readdirSync } from 'fs';
import { join } from 'path';

const MIGRATIONS_DIR = join(__dirname, '..', '..', 'prisma', 'migrations');

/** Return the numbered migration directory names (e.g. "0059_token_expiry"). */
function migrationDirs(): string[] {
  return readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && /^\d{4}_/.test(d.name))
    .map((d) => d.name);
}

describe('migration lineage collision guard', () => {
  const dirs = migrationDirs();

  it('no two migrations share the same NNNN numeric prefix', () => {
    const byNumber = new Map<string, string[]>();
    for (const name of dirs) {
      const num = name.slice(0, 4);
      byNumber.set(num, [...(byNumber.get(num) ?? []), name]);
    }
    const collisions = [...byNumber.entries()].filter(([, names]) => names.length > 1);
    // A collision = the exact silent-skip trap. Renumber the newer migration.
    expect(collisions).toEqual([]);
  });

  it('every migration directory name is unique', () => {
    const dupes = dirs.filter((n, i) => dirs.indexOf(n) !== i);
    expect(dupes).toEqual([]);
  });

  it('sanity: the migration set was actually found (non-vacuous)', () => {
    expect(dirs.length).toBeGreaterThanOrEqual(1);
  });
});
