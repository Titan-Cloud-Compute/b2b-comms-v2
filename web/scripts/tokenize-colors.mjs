#!/usr/bin/env node
/**
 * tokenize-colors.mjs — replace raw hex colours in component styles with
 * design-token references (`var(--color-*)`).
 *
 * Why: frontend/src/styles/tokens.css is the declared single source of truth
 * for colour, but components accumulated ~2,100 raw hex literals across 226
 * distinct values. A palette change therefore meant editing ~75 files. This
 * codemod maps every literal to a semantic token so the palette lives in ONE
 * file. It is idempotent and re-runnable (already-tokenized files are no-ops).
 *
 * Usage:
 *   node scripts/tokenize-colors.mjs --dry      # report only
 *   node scripts/tokenize-colors.mjs            # rewrite files in place
 *   node scripts/tokenize-colors.mjs --emit-tokens   # print the :root block for tokens.css
 *
 * Rules:
 *  - Hex preceded by `&` (HTML numeric entities like &#128274;) is NOT a colour.
 *  - Hex inside an attribute/string quote (`fill="#..."`, `'#fff'`) is skipped and
 *    reported — SVG presentation attributes cannot take var(); fix by hand
 *    (currentColor or a style binding).
 *  - A line carrying the comment marker `tokenize-allow` is left untouched
 *    (third-party brand colours that must not follow the palette).
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('../src/app/', import.meta.url).pathname;
const DRY = process.argv.includes('--dry');
const EMIT = process.argv.includes('--emit-tokens');

/** Token name → exact value. T1 keeps the values already in use (pixel-neutral). */
export const TOKENS = {
  // --- existing tokens (tokens.css) — values unchanged ---
  'color-primary': '#0a2a5e',
  'color-primary-hover': '#08214a',
  'color-primary-light': '#e6ecf5',
  'color-accent': '#00718c',
  'color-accent-hover': '#005a70',
  'color-accent-light': '#d6ebf0',
  'color-bg-primary': '#ffffff',
  'color-bg-secondary': '#f5f7fa',
  'color-bg-tertiary': '#ebeef3',
  'color-surface': '#ffffff',
  'color-surface-hover': '#f5f7fa',
  'color-text-primary': '#0e1726',
  'color-text-secondary': '#5b6675',
  'color-text-tertiary': '#7a8494',
  'color-text-muted': '#9ca3b0',
  'color-success': '#137d4e',
  'color-success-bg': '#e3f5ec',
  'color-warning': '#b9710a',
  'color-warning-bg': '#fdf3e3',
  'color-error': '#b32531',
  'color-error-bg': '#fbe6e8',
  'color-border': '#d8dde5',
  'color-border-light': '#ebeef3',
  // --- new: brand navy shades + text-on-navy ---
  'color-primary-600': '#143066',
  'color-primary-900': '#1a2b4a',
  'color-primary-border-soft': '#d4dfef',
  'color-on-primary': '#ffffff',
  'color-on-primary-soft': '#e8edf3',
  'color-on-primary-muted': '#b8c9e0',
  'color-on-primary-faint': '#8fa8cc',
  // --- new: neutral (slate) ramp ---
  'color-neutral-50': '#f8fafc',
  'color-neutral-100': '#f1f5f9',
  'color-neutral-200': '#e2e8f0',
  'color-neutral-300': '#cbd5e1',
  'color-neutral-400': '#94a3b8',
  'color-neutral-500': '#64748b',
  'color-neutral-600': '#475569',
  'color-neutral-700': '#334155',
  'color-neutral-800': '#1e293b',
  'color-neutral-900': '#0f172a',
  // --- new: gray ramp (warmer than slate; kept distinct to stay pixel-neutral) ---
  'color-gray-100': '#f3f4f6',
  'color-gray-200': '#e5e7eb',
  'color-gray-300': '#d1d5db',
  'color-gray-400': '#9ca3af',
  'color-gray-500': '#6b7280',
  'color-gray-700': '#374151',
  // --- new: info (blue) ramp ---
  'color-info-50': '#eff6ff',
  'color-info-100': '#dbeafe',
  'color-info-200': '#bfdbfe',
  'color-info-300': '#93c5fd',
  'color-info-400': '#60a5fa',
  'color-info': '#2d6cdf',
  'color-info-hover': '#1e5bc6',
  'color-info-600': '#2563eb',
  'color-info-700': '#1d4ed8',
  'color-info-800': '#1e40af',
  // --- new: success (green) ramp ---
  'color-success-50': '#f0fdf4',
  'color-success-100': '#dcfce7',
  'color-success-200': '#bbf7d0',
  'color-success-300': '#86efac',
  'color-success-400': '#34d399',
  'color-success-500': '#22c55e',
  'color-success-600': '#16a34a',
  'color-success-700': '#15803d',
  'color-success-800': '#166534',
  'color-success-900': '#14532d',
  // --- new: warning (amber/orange) ramp ---
  'color-warning-50': '#fffbeb',
  'color-warning-100': '#fef3c7',
  'color-warning-200': '#fde68a',
  'color-warning-300': '#fcd34d',
  'color-warning-400': '#f0b429',
  'color-warning-500': '#f59e0b',
  'color-warning-600': '#d97706',
  'color-warning-700': '#b45309',
  'color-warning-800': '#92400e',
  'color-warning-900': '#78350f',
  // --- new: error (red) ramp ---
  'color-error-50': '#fef2f2',
  'color-error-100': '#fee2e2',
  'color-error-200': '#fecaca',
  'color-error-300': '#fca5a5',
  'color-error-400': '#f87171',
  'color-error-500': '#ef4444',
  'color-error-600': '#dc2626',
  'color-error-700': '#b91c1c',
  'color-error-800': '#991b1b',
  'color-error-900': '#7f1d1d',
  // --- new: highlight (violet/indigo) ramp ---
  'color-highlight-50': '#faf5ff',
  'color-highlight-100': '#ede9fe',
  'color-highlight-200': '#c7d2fe',
  'color-highlight-300': '#a78bfa',
  'color-highlight-400': '#818cf8',
  'color-highlight-500': '#8b5cf6',
  'color-highlight-600': '#7c3aed',
  'color-highlight-700': '#6d28d9',
  'color-highlight-800': '#5b21b6',
  // --- new: accent (teal/cyan) ramp ---
  'color-accent-50': '#f0f9ff',
  'color-accent-100': '#e0f2fe',
  'color-accent-200': '#a5f3fc',
  'color-accent-300': '#22d3ee',
  'color-accent-500': '#0284c7',
  'color-accent-600': '#0369a1',
  'color-accent-700': '#075985',
  'color-white': '#ffffff',
};

/** raw hex (lowercase) → token name. Near-duplicates snap to the nearest ramp step. */
const MAP = {
  // whites / surfaces
  '#fff': 'color-white', '#ffffff': 'color-white', '#fafafa': 'color-neutral-50',
  '#fbfcfe': 'color-neutral-50', '#f7f9fc': 'color-neutral-50', '#f5f8fc': 'color-neutral-50',
  '#f4f6fa': 'color-neutral-50', '#f2f6fb': 'color-neutral-50', '#f8fafc': 'color-neutral-50',
  '#f5f7fa': 'color-bg-secondary', '#ebeef3': 'color-bg-tertiary', '#f1f5f9': 'color-neutral-100',
  '#f3f4f6': 'color-gray-100', '#f0f4f8': 'color-neutral-100', '#eef1f5': 'color-neutral-100',
  '#edf0f5': 'color-neutral-100', '#eef2f7': 'color-neutral-100', '#eef2f8': 'color-neutral-100',
  '#eef2f9': 'color-neutral-100',
  // brand blue tints
  '#e6ecf5': 'color-primary-light', '#e8effd': 'color-primary-light', '#e6effa': 'color-primary-light',
  '#eef4ff': 'color-primary-light', '#eef6ff': 'color-primary-light', '#f1f5ff': 'color-primary-light',
  '#f4f8ff': 'color-primary-light', '#f0f7ff': 'color-primary-light', '#e6f0ff': 'color-primary-light',
  '#e8f0fe': 'color-primary-light',
  '#d4dfef': 'color-primary-border-soft', '#d3deef': 'color-primary-border-soft',
  '#d7dfea': 'color-primary-border-soft', '#c3cde0': 'color-on-primary-muted',
  '#b8c9e0': 'color-on-primary-muted', '#e8edf3': 'color-on-primary-soft', '#8fa8cc': 'color-on-primary-faint',
  // borders
  '#d8dde5': 'color-border', '#e2e6ea': 'color-border-light', '#e6e9ef': 'color-border-light',
  '#e5e9f0': 'color-border-light', '#e6eaf0': 'color-border-light', '#e6e8ec': 'color-border-light',
  '#e2e8f0': 'color-neutral-200', '#e5e7eb': 'color-gray-200', '#cbd5e1': 'color-neutral-300',
  '#d1d5db': 'color-gray-300',
  // brand navy
  '#0a2a5e': 'color-primary', '#08214a': 'color-primary-hover',
  '#143066': 'color-primary-600', '#123a7a': 'color-primary-600', '#0e3a7e': 'color-primary-600',
  '#0d3a7a': 'color-primary-600', '#0d3373': 'color-primary-600', '#1e3a6e': 'color-primary-600',
  '#1a2b4a': 'color-primary-900', '#1f2c40': 'color-primary-900', '#1e3a5f': 'color-primary-900',
  '#24344d': 'color-primary-900',
  // text
  '#0e1726': 'color-text-primary', '#333': 'color-text-primary', '#1a1a1a': 'color-text-primary',
  '#1a1d23': 'color-text-primary', '#2a2e36': 'color-text-primary', '#3a3f4a': 'color-text-primary',
  '#5b6675': 'color-text-secondary', '#5b6b80': 'color-text-secondary', '#667085': 'color-text-secondary',
  '#6b7785': 'color-text-secondary', '#5a6270': 'color-text-secondary',
  '#7a8494': 'color-text-tertiary', '#7a8798': 'color-text-tertiary', '#8593a6': 'color-text-tertiary',
  '#8a94a4': 'color-text-tertiary', '#8892a0': 'color-text-tertiary',
  '#9ca3b0': 'color-text-muted', '#9aa4b2': 'color-text-muted',
  '#415066': 'color-neutral-600', '#3a4555': 'color-neutral-600',
  '#94a3b8': 'color-neutral-400', '#64748b': 'color-neutral-500', '#475569': 'color-neutral-600',
  '#334155': 'color-neutral-700', '#1e293b': 'color-neutral-800', '#0f172a': 'color-neutral-900',
  '#9ca3af': 'color-gray-400', '#6b7280': 'color-gray-500', '#374151': 'color-gray-700',
  // info blue
  '#2d6cdf': 'color-info', '#1e5bc6': 'color-info-hover', '#2563eb': 'color-info-600',
  '#1d4ed8': 'color-info-700', '#1e40af': 'color-info-800', '#dbeafe': 'color-info-100',
  '#eff6ff': 'color-info-50', '#bfdbfe': 'color-info-200', '#93c5fd': 'color-info-300',
  '#60a5fa': 'color-info-400', '#3d7ce5': 'color-info', '#1967d2': 'color-info-hover',
  '#1a56a3': 'color-info-hover', '#1d5bc9': 'color-info-hover', '#4f8ef7': 'color-info-400',
  // success
  '#137d4e': 'color-success', '#1a7f4e': 'color-success', '#e3f5ec': 'color-success-bg',
  '#e7f6ec': 'color-success-bg', '#e8f5e9': 'color-success-bg', '#e6f4ea': 'color-success-bg',
  '#d5ecd6': 'color-success-bg', '#ecfdf3': 'color-success-50', '#ecfdf5': 'color-success-50',
  '#f0fdf4': 'color-success-50', '#dcfce7': 'color-success-100', '#d1fae5': 'color-success-100',
  '#bbf7d0': 'color-success-200', '#a3d9be': 'color-success-200', '#abefc6': 'color-success-200',
  '#86efac': 'color-success-300', '#6ee7b7': 'color-success-300', '#34d399': 'color-success-400',
  '#22c55e': 'color-success-500', '#10b981': 'color-success-500', '#16a34a': 'color-success-600',
  '#059669': 'color-success-600', '#15803d': 'color-success-700', '#047857': 'color-success-700',
  '#2e7d32': 'color-success-700', '#166534': 'color-success-800', '#065f46': 'color-success-800',
  '#137333': 'color-success-800', '#05603a': 'color-success-800', '#14532d': 'color-success-900',
  '#0b3d2e': 'color-success-900',
  // warning
  '#b9710a': 'color-warning', '#fdf3e3': 'color-warning-bg', '#fff8e6': 'color-warning-bg',
  '#fff6da': 'color-warning-bg', '#fff4e0': 'color-warning-bg', '#fffdf7': 'color-warning-50',
  '#fffbeb': 'color-warning-50', '#fff7ed': 'color-warning-50', '#fef3c7': 'color-warning-100',
  '#fef9c3': 'color-warning-100', '#ffedd5': 'color-warning-100', '#fde68a': 'color-warning-200',
  '#fed7aa': 'color-warning-200', '#f1e4c3': 'color-warning-200', '#fcd34d': 'color-warning-300',
  '#f0d48a': 'color-warning-300', '#f3d38a': 'color-warning-300', '#f0b429': 'color-warning-400',
  '#f59e0b': 'color-warning-500', '#f97316': 'color-warning-500', '#f79009': 'color-warning-500',
  '#eab308': 'color-warning-500', '#d97706': 'color-warning-600', '#b45309': 'color-warning-700',
  '#b54708': 'color-warning-700', '#92400e': 'color-warning-800', '#854d0e': 'color-warning-800',
  '#9a3412': 'color-warning-800', '#78350f': 'color-warning-900', '#7c2d12': 'color-warning-900',
  // error
  '#b32531': 'color-error', '#fbe6e8': 'color-error-bg', '#fdeaea': 'color-error-bg',
  '#fce8e6': 'color-error-bg', '#fde3d3': 'color-error-bg', '#fef2f2': 'color-error-50',
  '#fef3f2': 'color-error-50', '#fee2e2': 'color-error-100', '#fecaca': 'color-error-200',
  '#fecdca': 'color-error-200', '#fca5a5': 'color-error-300', '#d1a3a3': 'color-error-300',
  '#f87171': 'color-error-400', '#ef4444': 'color-error-500', '#dc2626': 'color-error-600',
  '#c5221f': 'color-error-600', '#c62929': 'color-error-600', '#b91c1c': 'color-error-700',
  '#991b1b': 'color-error-800', '#b42318': 'color-error-800', '#7f1d1d': 'color-error-900',
  // highlight violet/indigo/pink
  '#faf5ff': 'color-highlight-50', '#eef2ff': 'color-highlight-50', '#f3e8ff': 'color-highlight-50',
  '#fae8ff': 'color-highlight-50', '#ede9fe': 'color-highlight-100', '#e0e7ff': 'color-highlight-100',
  '#f1e9fd': 'color-highlight-100', '#c7d2fe': 'color-highlight-200', '#a78bfa': 'color-highlight-300',
  '#818cf8': 'color-highlight-400', '#6366f1': 'color-highlight-400', '#8b5cf6': 'color-highlight-500',
  '#ec4899': 'color-highlight-500', '#7c3aed': 'color-highlight-600', '#6d28d9': 'color-highlight-700',
  '#4338ca': 'color-highlight-700', '#a21caf': 'color-highlight-700', '#5b21b6': 'color-highlight-800',
  '#3730a3': 'color-highlight-800',
  // accent teal/cyan
  '#00718c': 'color-accent', '#005a70': 'color-accent-hover', '#d6ebf0': 'color-accent-light',
  '#a3d4e0': 'color-accent-light', '#f0f9ff': 'color-accent-50', '#e0f2fe': 'color-accent-100',
  '#ccfbf1': 'color-accent-100', '#a5f3fc': 'color-accent-200', '#22d3ee': 'color-accent-300',
  '#14b8a6': 'color-accent-500', '#0284c7': 'color-accent-500', '#0d9488': 'color-accent-600',
  '#0369a1': 'color-accent-600', '#075985': 'color-accent-700',
};

for (const [hex, tok] of Object.entries(MAP)) {
  if (!(tok in TOKENS)) throw new Error(`MAP ${hex} → unknown token ${tok}`);
}

if (EMIT) {
  console.log(':root {');
  for (const [k, v] of Object.entries(TOKENS)) console.log(`  --${k}: ${v};`);
  console.log('}');
  process.exit(0);
}

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else if (/\.(css|ts|html)$/.test(name) && !name.endsWith('.spec.ts')) yield p;
  }
}

// A hex colour: 3/6/8 digits, not part of an entity (&#...), not opening a quoted attribute/string.
const HEX_RE = /(?<![&"'\w])#([0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g;
const QUOTED_RE = /(["'])#([0-9a-fA-F]{3,8})\b/g;

let replaced = 0, files = 0;
const unmapped = new Map();
const quoted = [];

for (const file of walk(ROOT)) {
  const src = readFileSync(file, 'utf8');
  const rel = relative(ROOT, file);
  const lines = src.split('\n');
  let changed = false;
  const out = lines.map((line, i) => {
    if (line.includes('tokenize-allow')) return line;
    for (const m of line.matchAll(QUOTED_RE)) quoted.push(`${rel}:${i + 1}: ${m[0]}`);
    return line.replace(HEX_RE, (whole) => {
      const key = whole.toLowerCase();
      const tok = MAP[key];
      if (!tok) {
        unmapped.set(key, (unmapped.get(key) ?? 0) + 1);
        return whole;
      }
      replaced++; changed = true;
      return `var(--${tok})`;
    });
  });
  if (changed) {
    files++;
    if (!DRY) writeFileSync(file, out.join('\n'));
  }
}

console.log(`${DRY ? '[dry] ' : ''}replaced ${replaced} literals in ${files} files`);
if (unmapped.size) {
  console.log('UNMAPPED (add to MAP or mark tokenize-allow):');
  for (const [k, n] of [...unmapped].sort((a, b) => b[1] - a[1])) console.log(`  ${k} ×${n}`);
}
if (quoted.length) {
  console.log('QUOTED hex (fix by hand — var() is invalid in SVG presentation attributes):');
  for (const q of quoted) console.log('  ' + q);
}
process.exit(unmapped.size ? 1 : 0);
