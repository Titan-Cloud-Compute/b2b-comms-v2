import { ErrorHandler, Injectable } from '@angular/core';

/**
 * Stale-deploy recovery for lazy chunks.
 *
 * After a frontend deploy, hashed lazy chunk names change and the old files are
 * removed. A user who had the app open before the deploy will fail to fetch the
 * now-missing chunk when they lazy-navigate ("Failed to fetch dynamically
 * imported module" / ChunkLoadError) and the route silently breaks until a
 * manual hard refresh. The industry-standard fix is to detect that specific
 * failure and reload ONCE to pull the fresh build.
 */

const RELOAD_KEY = 'chunkReloadAt';
// If a reload already happened within this window, do NOT reload again — a
// genuinely-missing chunk (not just a stale deploy) must not loop the page.
const RELOAD_WINDOW_MS = 15_000;

const CHUNK_ERROR_RE =
  /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|ChunkLoadError|Loading chunk [\w-]+ failed/i;

/** True when an error (or any nested message/error/reason) is a chunk-load failure. */
export function isChunkLoadError(err: unknown): boolean {
  const parts: string[] = [];
  const collect = (v: unknown, depth = 0) => {
    if (v == null || depth > 3) return;
    if (typeof v === 'string') { parts.push(v); return; }
    if (typeof v === 'object') {
      const o = v as Record<string, unknown>;
      collect(o['message'], depth + 1);
      collect(o['error'], depth + 1);
      collect(o['reason'], depth + 1);
    }
  };
  collect(err);
  return CHUNK_ERROR_RE.test(parts.join(' '));
}

/**
 * Reload once to recover from a stale chunk. Guarded by a timestamp in
 * sessionStorage so it cannot loop. Returns true if a reload was triggered.
 */
export function reloadForChunkError(): boolean {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
    if (Date.now() - last < RELOAD_WINDOW_MS) return false; // already tried recently
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    // private mode / storage disabled — still attempt a single reload.
  }
  location.reload();
  return true;
}

/** Global handler: recover from stale-chunk failures, log everything else. */
@Injectable()
export class ChunkErrorHandler implements ErrorHandler {
  handleError(error: unknown): void {
    if (isChunkLoadError(error) && reloadForChunkError()) return;
    console.error(error);
  }
}
