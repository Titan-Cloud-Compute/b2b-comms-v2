/**
 * Preview-mode flag for the STATIC design-review build only.
 *
 * angular.json's `mockup` configuration file-replaces `preview-mode.ts` with
 * this file. It is never part of a production or staging build — see the
 * header of preview-mode.ts for why the preview needs its own behaviour.
 */
export const PREVIEW_MODE = true;

/**
 * Every mockup is served from the same origin under /<mockup_id>/, and browser
 * storage is origin-scoped rather than path-scoped, so unprefixed keys leak
 * between mockups (one preview's signed-in user showing up in another).
 * Namespacing by the first path segment keeps each preview isolated.
 */
const NS = (() => {
  try {
    return location.pathname.split('/')[1] || 'app';
  } catch {
    return 'app';
  }
})();

export function nsKey(key: string): string {
  return `${NS}:${key}`;
}
