import { ApplicationConfig, provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { routes } from './app.routes';
import { requestIdInterceptor, timingInterceptor } from './core/interceptors/api.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    // Zoneless (stable v22): no zone.js patch of setTimeout/addEventListener/
    // Promise etc. in the bundle. Change detection now runs only when a
    // signal a template reads actually changes, or a host/DOM event fires —
    // not "something async happened somewhere, re-check the whole tree".
    provideZonelessChangeDetection(),

    // withComponentInputBinding(): route params/query params bind straight
    // to matching input()s on the routed component — no ActivatedRoute
    // subscription needed to read `:id`.
    provideRouter(routes, withComponentInputBinding()),

    // withFetch(): HttpClient now issues requests through the Fetch API
    // instead of XMLHttpRequest — smaller polyfill surface, and it composes
    // naturally with zoneless since fetch was never something zone.js had to
    // monkey-patch specially in the first place.
    provideHttpClient(withFetch(), withInterceptors([requestIdInterceptor, timingInterceptor])),
  ],
};
