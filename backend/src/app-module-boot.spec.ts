/**
 * BOOT SMOKE TEST — resolves the ENTIRE application dependency graph.
 *
 * WHY THIS EXISTS. On 2026-08-04 staging went down for ~17 minutes and every
 * gate we run stayed green:
 *   - `tsc` GREEN, because the types were valid; only the EMIT was wrong.
 *   - the unit suite GREEN, because specs construct classes with mocks and so
 *     never ask Nest to resolve anything.
 *   - the pod 1/1 READY, because supervisord respawned the crashed process
 *     fast enough that the readiness probe never observed the gap.
 * The cause was `import type` on four Nest-injected constructor params: TS
 * ELIDES a type-only import, so emitDecoratorMetadata wrote
 * design:paramtypes=[Function,...] and Nest threw UnknownDependenciesException
 * at boot. Nothing but actually booting the app could have caught it.
 *
 * WHY `.compile()` AND NOT `.init()` / `NestFactory.create()`. `.compile()`
 * instantiates every provider and resolves the full dependency graph — which is
 * exactly what raises UnknownDependenciesException — but it does NOT invoke the
 * onModuleInit / onApplicationBootstrap lifecycle hooks. In this codebase every
 * external connection is made in a lifecycle hook (PrismaService.onModuleInit
 * -> $connect, RedisService.onModuleInit), NEVER in a constructor. So the whole
 * DI topology is verifiable with NO Postgres, NO Redis and NO service
 * containers. That property is what keeps this test cheap enough to always run.
 *
 * IF THIS TEST EVER NEEDS A DATABASE TO PASS, DO NOT ADD ONE — find the
 * provider that started connecting from its constructor and move that work into
 * onModuleInit. A boot test that gets skipped because its dependencies flake is
 * worse than no boot test: it reports green while checking nothing.
 */

// A dummy URL is enough: PrismaService's constructor only READS DATABASE_URL,
// and @prisma/adapter-pg builds its pool lazily, so nothing dials out here.
const DUMMY_ENV: Record<string, string> = {
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
};

describe('AppModule boot (DI graph)', () => {
  const saved: Record<string, string | undefined> = {};

  beforeAll(() => {
    for (const [k, v] of Object.entries(DUMMY_ENV)) {
      saved[k] = process.env[k];
      process.env[k] ??= v;
    }
  });

  afterAll(() => {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  it('resolves every provider in the real AppModule', async () => {
    // Imported dynamically so the env above is in place before app.module.ts
    // (and the PrismaService constructor it reaches) is ever evaluated.
    const { Test } = await import('@nestjs/testing');
    const { AppModule } = await import('./app.module');

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    // Reaching here means Nest mapped every constructor param of every
    // provider to a real provider — the check that the outage defeated.
    expect(moduleRef).toBeDefined();
    await moduleRef.close();
  }, 120_000);
});
