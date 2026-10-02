/**
 * One definition of "a masked value", shared by the read path and the write path.
 *
 * WHY THIS IS ITS OWN MODULE. The admin settings API serves a redacted preview
 * of every credential, and every admin form then has to remember NOT to save
 * that preview back. Four different hand-rolled versions of that check exist in
 * the frontend (`patchUnchanged`, `hydratedMasked`, and two `!== ...Masked`
 * comparisons), and the server accepted whatever it was sent — so one forgetful
 * caller silently overwrites a real credential with bullets, and the only way to
 * notice is a service that stops authenticating.
 *
 * The invariant belongs at the trust boundary instead: the server refuses to
 * persist a value that is identical to the preview it just served. That is the
 * standard "reject the redacted echo" rule (Django admin renders password
 * widgets empty; AWS and Rails credential editors discard an unchanged mask).
 * Keeping mask() and isMaskEcho() in one file is what makes the guard exact —
 * a guard that recomputes the mask differently from the reader silently misses.
 */

/** The redacted preview shown to an admin: a short prefix, then bullets. */
export function maskValue(value: string): string {
  const visible = Math.min(4, value.length);
  const prefix = value.slice(0, visible);
  const maskedLen = Math.max(8, value.length - visible);
  return `${prefix}${'•'.repeat(maskedLen)}`;
}

/** The all-bullets placeholder a form shows when it has no preview to display. */
const GENERIC_PLACEHOLDER = /^•+$/;

/**
 * True when `value` is a preview being echoed back rather than a real value.
 *
 * An EMPTY value is deliberately not an echo: clearing a setting is a thing an
 * admin may legitimately do, and it is explicit rather than accidental.
 */
export function isMaskEcho(value: string, stored?: string | null): boolean {
  if (!value) return false;
  if (GENERIC_PLACEHOLDER.test(value)) return true;
  return !!stored && value === maskValue(stored);
}
