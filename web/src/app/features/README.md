# Feature Folders — Web

Each story owns exactly one feature folder under `src/app/features/<slug>/`.

## Rules (one screen)

1. **Own folder only** — create `features/<slug>/<slug>.component.ts` (and related files). Never edit another feature's folder or the shared pages.
2. **Register routes** — export your Angular `Routes` from `features/index.ts` by appending to `FEATURE_ROUTES`. The `app.routes.ts` already spreads this array before the wildcard catch-all.
3. **Mock first** — build the UI against `MockApiClient` until the backend endpoint lands. Register handlers via `mockClient.registerMock('GET', '/api/my-endpoint', async () => fixture)`.
4. **Contract types** — import request/response types from `@contracts/<slug>`. Never define duplicates inline.
5. **No cross-feature imports** — a feature may only import from `src/app/shared` and `src/app/features/<its-own-slug>`.
