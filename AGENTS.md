# AGENTS.md — Coding Agent Contract

This file tells you how to work safely in this app. Read it before touching any code.

## App commands

| Action | Command |
|--------|---------|
| Build  | `npx ng build --configuration production` |
| Dev server | `npx ng serve` |

Frontend source lives under: `frontend/`

## Before planning any change

Read `.colossus/site-map.json` to understand the app's current pages and action ids.

Every task in your plan MUST either:
- Name the `page_id` and action ids it touches (for changes to existing screens), OR
- Declare a new `page_id` with its action ids (for tasks that add a new screen or route).

Without this, the manifest becomes stale and the next plan cites wrong data.

## After your edits — regenerate and check the site map

Run this after making any changes that add, remove, or rename pages or actions:

> The rails paths below are absolute because the scripts ship in the pipeline image,
> not in this repo. Running them outside the pipeline needs a local checkout of the
> rails; the contract they enforce is the same either way.

```
node /app/agent-rails/site-map.mjs --root . --check
```

- Exit 0: manifest is in sync — proceed.
- Exit 1: drift detected — regenerate before committing:

```
node /app/agent-rails/site-map.mjs --root .
```

## Ratchet lints — run before committing

These two lints enforce that selector counts and style-token counts do not grow
patch-over-patch. Run them as ratchets:

```
node /app/agent-rails/check-selectors.mjs --root . --ratchet
node /app/agent-rails/check-style-tokens.mjs --root . --ratchet
```

Exit codes:
- 0: clean (count did not grow).
- 1: ratchet breached (count grew — fix or get baseline updated).
- 3: no baseline exists yet — safe to proceed (a freshly scaffolded app has no
  baseline until the first seed run; do not block on this).

## Summary of rails scripts

| Script | Purpose | Ratchet? |
|--------|---------|---------|
| `site-map.mjs` | Regenerate / check `.colossus/site-map.json` | No (drift check) |
| `check-selectors.mjs` | Selector count ratchet | Yes (`--ratchet`) |
| `check-style-tokens.mjs` | Style-token count ratchet | Yes (`--ratchet`) |
