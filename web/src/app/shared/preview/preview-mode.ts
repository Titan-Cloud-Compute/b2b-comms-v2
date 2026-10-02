/**
 * Preview (static design-review) mode — OFF in every real build.
 *
 * The design-review preview is a STATIC export of this app served under
 * https://<host>/<mockup_id>/ with no backend, no API and no database. To be
 * reviewable at all it needs three behaviours the real app must NEVER have:
 *
 *   1. a sign-in that resolves entirely in the client (no /api/auth/login),
 *   2. path-based routing so /<mockup_id>/integrations deep-links,
 *   3. stubbed API responses so screens render populated instead of empty.
 *
 * All of that sits behind this flag. Production compiles THIS file, where the
 * flag is a `false` literal, so every preview branch is statically dead and is
 * dropped by the optimizer — the shipped bundle contains no client-side
 * credential check and keeps the server-authoritative session.
 *
 * The preview build (`ng build --configuration mockup`) swaps this file for
 * `preview-mode.mockup.ts` via `fileReplacements` in angular.json.
 *
 * NEVER flip this constant to true.
 */
export const PREVIEW_MODE = false;

/**
 * Storage-key namespace. Identity in real builds: production owns its origin,
 * so its keys stay exactly as they were. Only the preview — where many mockups
 * share one origin and would otherwise collide — prefixes them.
 */
export function nsKey(key: string): string {
  return key;
}
