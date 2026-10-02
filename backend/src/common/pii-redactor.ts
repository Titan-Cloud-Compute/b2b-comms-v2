/**
 * Lightweight regex + heuristic PII redactor.
 *
 * Used by every code path that forwards user-provided text to the LLM.
 * Returns the redacted string PLUS a structured list of events so the audit
 * log can record WHAT was redacted (which patterns fired, how many hits)
 * without ever logging the PII itself.
 *
 * The patterns target:
 *   - 10-digit national ID (optional spaces/dashes)
 *   - International phone numbers (E.164 + common national formats)
 *   - Email addresses
 *   - IBAN-like sequences (rough — better than nothing)
 *
 * Not exhaustive; this is a defense-in-depth layer, not the only one. The
 * deployment must also ensure LiteLLM's storage retention is configured.
 */

export interface RedactionEvent {
  /** Category of PII that fired. */
  kind: 'national_id' | 'phone' | 'email' | 'iban';
  /** Number of distinct matches replaced. */
  count: number;
}

export interface RedactionResult {
  redacted: string;
  events: RedactionEvent[];
}

// 10-digit national ID. Bare 10-digit numbers are also caught.
const NATIONAL_ID_RE_10 = /\b\d{10}\b/g;

// Email: simple but safe — RFC-compliant matching is overkill for redaction.
const EMAIL_RE = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;

// Phone: matches +CC..., 00CC..., or 0XXX-XXX-XXX with 7+ digits.
// Intentionally greedy on separators (spaces, dashes, parens).
const PHONE_RE =
  /(?:\+|00)?\d{1,3}[\s().-]{0,2}\d{2,4}[\s().-]{0,2}\d{2,4}[\s().-]{0,2}\d{2,4}/g;

// IBAN: 2 letters + 2 digits + 11–30 alphanumeric.
const IBAN_RE = /\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b/g;

export function redactPii(input: string): RedactionResult {
  const events: RedactionEvent[] = [];
  let out = input;

  // Order matters: redact phones AFTER EGN to avoid stealing the digits.
  // But EGN is a strict word-boundary 10-digit pattern, so it doesn't
  // overlap with the broader phone regex in practice. We still do EGN
  // first because the phone regex would greedily eat 10-digit runs.
  const apply = (
    pattern: RegExp,
    kind: RedactionEvent['kind'],
    placeholder: string,
  ): void => {
    let count = 0;
    out = out.replace(pattern, () => {
      count++;
      return placeholder;
    });
    if (count > 0) events.push({ kind, count });
  };

  apply(NATIONAL_ID_RE_10, 'national_id', '[REDACTED_ID]');
  apply(EMAIL_RE, 'email', '[REDACTED_EMAIL]');
  apply(IBAN_RE, 'iban', '[REDACTED_IBAN]');
  apply(PHONE_RE, 'phone', '[REDACTED_PHONE]');

  return { redacted: out, events };
}
