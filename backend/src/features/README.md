# Feature Folders — Backend

Each story owns exactly one feature folder under `features/<slug>/`.

## Rules (one screen)

1. **Own folder only** — create `features/<slug>/<slug>.module.ts`, `<slug>.controller.ts`, `<slug>.service.ts`. Never edit another feature's folder.
2. **Schema untouched** — do NOT edit `prisma/schema.prisma` unless the card explicitly says so; if you need a new model, create a migration card first.
3. **Register in index** — export your NestJS module from `features/index.ts` by appending it to `FEATURE_MODULES`. The `AppModule` already spreads this array.
4. **Contracts first** — define request/response types in `shared/contracts/<slug>/` and import them via the `@contracts/*` path alias. The web MockApiClient seeds from those same types.
5. **No cross-feature imports** — a feature may only import from `src/common`, `src/auth`, `src/prisma`, and `src/shared/contracts/<its-own-slug>`.
