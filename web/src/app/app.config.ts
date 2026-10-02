import { ApplicationConfig, ErrorHandler, inject, isDevMode, provideAppInitializer } from '@angular/core';
import { provideServiceWorker, SwUpdate } from '@angular/service-worker';
import { provideRouter, withHashLocation, withNavigationErrorHandler } from '@angular/router';
import {
  provideHttpClient,
  withInterceptors,
  withFetch,
} from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { routes } from './app.routes';
import { apiErrorInterceptor } from './shared/api/api-error.interceptor';
import { ChunkErrorHandler, isChunkLoadError, reloadForChunkError } from './shared/chunk-error.handler';
import { PREVIEW_MODE } from './shared/preview/preview-mode';
import { ApiClient, HttpApiClient, MockApiClient } from './shared/api/api-client';
import { environment } from '../environments/environment';

/**
 * Hash routing (#/route) everywhere EXCEPT the static design-review preview.
 *
 * The preview is served as plain files under /<mockup_id>/ with an index.html
 * fallback, so a reviewer (and the screenshot capture) opens screens by real
 * path — /<mockup_id>/integrations. Under withHashLocation() every such URL
 * boots at the empty hash and lands on /login instead, which makes every
 * screen behind the sign-in unreachable. Path routing resolves them.
 */
const locationFeatures: unknown[] = PREVIEW_MODE ? [] : [withHashLocation()];

export const appConfig: ApplicationConfig = {
  providers: [
    // PWA service worker (ngsw): navigation stays network-first (see ngsw-config.json)
    // so the serve-time-injected feedback widget is never hash-broken by the SW.
    provideServiceWorker('ngsw-worker.js', {
      // Never in the preview: mockups share one origin, so a worker registered
      // under /<mockup_id>/ would serve a stale build of a sibling mockup.
      enabled: !isDevMode() && !PREVIEW_MODE,
      registrationStrategy: 'registerWhenStable:30000',
    }),
    // Stale-build recovery for the SUCCESSFUL-cache-hit case.
    //
    // ngsw prefetches every /*.js into the "app" asset group and then keeps
    // serving that frozen version for the lifetime of the installed worker.
    // The ChunkErrorHandler below only rescues the case where a lazy chunk
    // 404s; when the SW answers from cache the fetch SUCCEEDS, so no error
    // ever fires and a returning user silently keeps running the previous
    // build — e.g. missing an App Settings tab that is already deployed.
    // Activating a ready version and reloading once closes that gap.
    provideAppInitializer(() => {
      const updates = inject(SwUpdate);
      if (!updates.isEnabled) return;
      updates.versionUpdates.subscribe((evt) => {
        if (evt.type !== 'VERSION_READY') return;
        void updates
          .activateUpdate()
          // Reuses the shared single-reload guard in chunk-error.handler so a
          // version activation and a chunk-error reload can never ping-pong.
          .then((activated) => { if (activated) reloadForChunkError(); })
          .catch(() => { /* activation raced another tab — next load picks it up */ });
      });
    }),
    provideRouter(
      routes,
      ...(locationFeatures as []),
      // Lazy-route load failures after a deploy (stale chunk) → reload once to
      // pull the fresh build instead of leaving the route broken.
      withNavigationErrorHandler((err) => {
        if (isChunkLoadError(err)) reloadForChunkError();
      }),
    ),
    provideHttpClient(
      withFetch(),
      withInterceptors([apiErrorInterceptor]),
    ),
    provideAnimations(),
    // Catch dynamic-import / chunk failures that don't surface via the router.
    { provide: ErrorHandler, useClass: ChunkErrorHandler },
    // ApiClient: swap to MockApiClient when USE_MOCKS is set (dev / stories).
    { provide: ApiClient, useClass: environment.useMocks ? MockApiClient : HttpApiClient },
  ],
};
