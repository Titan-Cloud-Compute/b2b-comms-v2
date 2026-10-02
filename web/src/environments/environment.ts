/**
 * Runtime + build-time environment flags.
 *
 * `useMocks`:
 *   - Set window.__USE_MOCKS__ = true in index.html or a dev-server script to
 *     enable MockApiClient at runtime without a build change.
 *   - Set USE_MOCKS=true as an Angular define (via angular.json fileReplacements
 *     or a custom webpack plugin) to bake the flag in at build time.
 */

declare global {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  interface Window { __USE_MOCKS__?: boolean; }
}

// Build-time flag — replaced by the build system when USE_MOCKS is set.
const BUILD_TIME_USE_MOCKS = false;

export const environment = {
  useMocks: BUILD_TIME_USE_MOCKS || (typeof window !== 'undefined' && window.__USE_MOCKS__ === true),
};
