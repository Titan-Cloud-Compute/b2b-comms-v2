import { z } from 'zod';
import { extractJsonText, parseLlmJson } from './llm-json';

describe('extractJsonText', () => {
  it('returns clean JSON untouched, with no repairs', () => {
    const r = extractJsonText('{"a":1}');
    expect(r.text).toBe('{"a":1}');
    expect(r.repairs).toEqual([]);
  });

  it('unwraps a fenced block', () => {
    expect(extractJsonText('```json\n{"a":1}\n```').text).toBe('{"a":1}');
    expect(extractJsonText('```\n{"a":1}\n```').repairs).toEqual(['fenced-block']);
  });

  // Truncated responses are the observed mistral/claude failure at the audit
  // judge — an unclosed fence must still yield a usable body.
  it('strips an UNCLOSED leading fence', () => {
    const r = extractJsonText('```json\n{"a":1}');
    expect(r.text).toBe('{"a":1}');
    expect(r.repairs).toEqual(['unclosed-fence']);
  });
});

describe('parseLlmJson', () => {
  const Schema = z.object({ a: z.number() });

  it('reports ok for a conforming payload', () => {
    const r = parseLlmJson('{"a":1}', Schema);
    expect(r.outcome).toBe('ok');
    expect(r.data).toEqual({ a: 1 });
  });

  // Salvage is a conformance MISS even though the caller still gets data —
  // folding it into success is what would hide a model regression.
  it('reports salvaged (not ok) when a fence had to be stripped', () => {
    const r = parseLlmJson('```json\n{"a":1}\n```', Schema);
    expect(r.outcome).toBe('salvaged');
    expect(r.data).toEqual({ a: 1 });
  });

  it('slices a top-level object out of wrapping prose', () => {
    const r = parseLlmJson('Sure! Here you go:\n{"a":1}\nHope that helps.', Schema);
    expect(r.outcome).toBe('salvaged');
    expect(r.repairs).toContain('prose-slice');
    expect(r.data).toEqual({ a: 1 });
  });

  it('handles a top-level array', () => {
    const r = parseLlmJson('```json\n[{"a":1}]\n```', z.array(Schema));
    expect(r.outcome).toBe('salvaged');
    expect(r.data).toEqual([{ a: 1 }]);
  });

  // Never throw from inside a completion handler: a schema miss is a
  // caller-visible outcome, not a 500.
  it('fails (does not throw) on a schema violation, naming the path', () => {
    const r = parseLlmJson('{"a":"not-a-number"}', Schema);
    expect(r.outcome).toBe('failed');
    expect(r.data).toBeUndefined();
    expect(r.error).toContain('a:');
  });

  it('fails on unparseable output with no JSON at all', () => {
    const r = parseLlmJson('I cannot answer that.', Schema);
    expect(r.outcome).toBe('failed');
    expect(r.error).toMatch(/no JSON/);
  });

  it('parses without a schema when none is supplied', () => {
    expect(parseLlmJson('{"a":1}').outcome).toBe('ok');
  });
});
