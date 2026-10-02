# Shared Contracts

This folder holds the request/response type definitions shared between the backend and the web frontend.

## Layout

```
shared/contracts/
  <slug>/
    index.ts      ← export all types for this feature
    fixtures.ts   ← optional: mock data seed for MockApiClient
```

## Rules

- **Contract types** are plain TypeScript interfaces/types — no runtime code.
- **Fixtures** export typed mock responses that `MockApiClient` seeds on startup.
- Import via the `@contracts/<slug>` path alias (available in both backend and web tsconfigs).
- This folder is written by the contracts card; feature cards must NOT edit it.
