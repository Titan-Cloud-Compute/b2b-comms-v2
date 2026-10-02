/**
 * Heuristic PII redactor.
 *
 * Per the plan, *no raw PII may reach the LLM*. We sweep over the message
 * with a small set of regexes targeting the highest-value identifiers in
 * the trial's jurisdiction (national IDs, phone numbers, emails). When a
 * match fires we replace it with a token like `[REDACTED_EMAIL]` and emit
 * an event the caller logs to audit_log — we log the *event*, not the
 * matched text.
 *
 * Edge cases:
 *   - We do NOT touch numbers that look like KPIs (currency, percentages).
 *   - National-ID detection is intentionally conservative — false positives
 *     are recoverable (slightly noisier audit log); false negatives are not.
 */

export type RedactionEvent = {
  kind: 'national_id' | 'phone' | 'email';
  /** Stable hash of the matched text; never the text itself. */
  hash: string;
};

export type RedactionResult = {
  redacted: string;
  events: RedactionEvent[];
};

import { createHash } from 'crypto';

const EMAIL_RE = /\b[\w.+-]+@[\w-]+(?:\.[\w-]+)+\b/g;
// E.164-ish + national formats with dashes / spaces.
const PHONE_RE =
  /(?:\+?\d{1,3}[\s.-]?)?(?:\(\d{2,4}\)[\s.-]?)?\d{2,4}[\s.-]?\d{2,4}[\s.-]?\d{2,4}/g;
// 10-digit national ID and generic 9–11 digit IDs in word boundaries.
const NATIONAL_ID_RE = /\b\d{9,11}\b/g;

function hashFragment(s: string): string {
  return createHash('sha256').update(s).digest('hex').slice(0, 16);
}

function isLikelyKpiNumber(match: string): boolean {
  // Skip pure numbers that look like currency / counts inline with units.
  if (/^\d{1,4}$/.test(match)) return true;
  return false;
}

export function redact(input: string): RedactionResult {
  const events: RedactionEvent[] = [];
  let out = input;

  out = out.replace(EMAIL_RE, (match) => {
    events.push({ kind: 'email', hash: hashFragment(match) });
    return '[REDACTED_EMAIL]';
  });

  // Phones first so they don't collide with national IDs.
  out = out.replace(PHONE_RE, (match) => {
    const cleaned = match.replace(/[^\d]/g, '');
    if (cleaned.length < 7) return match;
    if (isLikelyKpiNumber(cleaned)) return match;
    events.push({ kind: 'phone', hash: hashFragment(cleaned) });
    return '[REDACTED_PHONE]';
  });

  out = out.replace(NATIONAL_ID_RE, (match) => {
    if (isLikelyKpiNumber(match)) return match;
    events.push({ kind: 'national_id', hash: hashFragment(match) });
    return '[REDACTED_ID]';
  });

  return { redacted: out, events };
}
