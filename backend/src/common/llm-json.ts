import type { ZodType } from 'zod';

/**
 * The single parse boundary for model-authored JSON (anti-corruption layer).
 *
 * WHY THIS EXISTS: before this file the codebase carried THREE divergent
 * salvage implementations — `stripFences` (diagnostic.service), `extractJson`
 * (audit-judge, the only one hardened against truncated fences) and an inline
 * brace-slice (intake.service) — so a model swap had as many conformance
 * behaviours as it had call sites, and only one of them had been hardened
 * against the exact failure mistral exhibits (fenced JSON). Format quirks of a
 * model belong in ONE seam so they can be measured and fixed once.
 *
 * THREE-VALUED BY DESIGN:
 *   ok       — parsed (and validated) with no salvage; the model conformed.
 *   salvaged — recovered only after stripping fences / slicing prose. Counts as
 *              a conformance MISS even though the caller gets data: silently
 *              folding salvage into success is what hides a model regression.
 *   failed   — unparseable or schema-invalid. Never throws; the caller decides.
 */
export type LlmJsonOutcome = 'ok' | 'salvaged' | 'failed';

export interface LlmJsonResult<T> {
  outcome: LlmJsonOutcome;
  /** Present iff outcome !== 'failed'. */
  data?: T;
  /** Human-readable reason, present iff outcome === 'failed'. */
  error?: string;
  /** Which salvage steps were applied (empty when the model conformed). */
  repairs: string[];
}

/**
 * Reduce a raw completion to its most likely JSON body.
 * Handles: fenced blocks anywhere in the text, an UNCLOSED leading fence
 * (truncated response), and prose wrapped around a top-level object/array.
 */
export function extractJsonText(text: string): { text: string; repairs: string[] } {
  const repairs: string[] = [];
  let out = String(text ?? '').trim();

  const fenced = out.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) {
    out = fenced[1].trim();
    repairs.push('fenced-block');
  } else if (/^\s*```/.test(out)) {
    // Unclosed fence — a truncated response still carries a usable prefix.
    out = out.replace(/^\s*```(?:json)?\s*/, '').replace(/\s*```$/, '').trim();
    repairs.push('unclosed-fence');
  }
  return { text: out, repairs };
}

/** First balanced-looking top-level object or array, for prose-wrapped output. */
function sliceJsonBody(text: string): string | null {
  const candidates: Array<[number, number]> = [
    [text.indexOf('{'), text.lastIndexOf('}')],
    [text.indexOf('['), text.lastIndexOf(']')],
  ].filter(([s, e]) => s >= 0 && e > s) as Array<[number, number]>;
  if (!candidates.length) return null;
  // Prefer whichever delimiter opens first — an object inside an array and an
  // array inside an object both resolve to the outermost structure.
  candidates.sort((a, b) => a[0] - b[0]);
  const [start, end] = candidates[0];
  return text.slice(start, end + 1);
}

/**
 * Parse (and optionally schema-validate) model-authored JSON.
 *
 * Validation always uses `safeParse` — a conformance miss must become a
 * caller-visible outcome, never a thrown 500 from inside a completion handler.
 */
export function parseLlmJson<T = unknown>(raw: string, schema?: ZodType<T>): LlmJsonResult<T> {
  const { text, repairs } = extractJsonText(raw);

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    const sliced = sliceJsonBody(text);
    if (sliced === null) {
      return { outcome: 'failed', error: 'no JSON object or array found in model output', repairs };
    }
    try {
      parsed = JSON.parse(sliced);
      repairs.push('prose-slice');
    } catch (e) {
      return { outcome: 'failed', error: `unparseable JSON: ${(e as Error).message}`, repairs };
    }
  }

  if (!schema) {
    return { outcome: repairs.length ? 'salvaged' : 'ok', data: parsed as T, repairs };
  }

  const result = schema.safeParse(parsed);
  if (!result.success) {
    return {
      outcome: 'failed',
      error: result.error.issues
        .slice(0, 5)
        .map((i) => `${i.path.join('.') || '<root>'}: ${i.message}`)
        .join('; '),
      repairs,
    };
  }
  return { outcome: repairs.length ? 'salvaged' : 'ok', data: result.data, repairs };
}
