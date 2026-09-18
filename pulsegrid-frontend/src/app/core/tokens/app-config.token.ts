import { InjectionToken } from '@angular/core';
import { environment } from '../../../environments/environment';

// InjectionToken carries a value that isn't a class, so there's nothing to
// inject() by type alone — the token IS the lookup key.
export interface AppConfig {
  apiUrl: string;
  socketUrl: string;
  pollIntervalMs: number;
  cpuAlertThreshold: number;
}

export const APP_CONFIG = new InjectionToken<AppConfig>('APP_CONFIG', {
  // providedIn factory means most call sites never need an explicit provider —
  // override it per-component (component-level DI scoping) only for tests.
  factory: () => ({
    apiUrl: environment.apiUrl,
    socketUrl: environment.socketUrl,
    pollIntervalMs: 2000,
    cpuAlertThreshold: 90,
  }),
});
