import { Injectable, effect, inject, signal } from '@angular/core';
import { httpResource } from '@angular/common/http';
import { APP_CONFIG } from '../tokens/app-config.token';
import { SettingsService } from './settings.service';

export interface Device {
  deviceId: string;
  cpu?: string;
  memory?: string;
  latency?: string;
  status?: string;
}

export interface MetricPoint {
  _id: string;
  deviceId: string;
  cpu: number;
  memory: number;
  latency: number;
  rollingAvgCpu: number;
  alert: boolean;
  timestamp: number;
}

@Injectable({ providedIn: 'root' })
export class DeviceService {
  private readonly config = inject(APP_CONFIG);
  private readonly settingsSvc = inject(SettingsService);

  // httpResource() (stable in v22): the signal-native replacement for
  // "subscribe in ngOnInit, push into a signal by hand". It fetches on
  // creation, re-fetches whenever a signal read inside the URL function
  // changes, and exposes .value()/.isLoading()/.error()/.reload() directly —
  // no manual toSignal()+HttpClient bridging needed.
  readonly devicesResource = httpResource<Device[]>(
    () => `${this.config.apiUrl}/devices`,
    { defaultValue: [] },
  );

  constructor() {
    // Re-fetch the device list on the interval set on the Settings page —
    // this is what keeps each device's online/offline status (now backed by
    // the presence key) and the fleet count from going stale between visits.
    // Clamped defensively at the point of use: setInterval treats 0 or a
    // negative delay as "fire ASAP, repeatedly", which would hammer the API
    // in a near-tight loop if this value were ever corrupted or set by a
    // future code path that skips the Settings form's own validators.
    effect((onCleanup) => {
      const intervalMs = Math.max(500, this.settingsSvc.settings().pollIntervalMs);
      const id = setInterval(() => this.devicesResource.reload(), intervalMs);
      onCleanup(() => clearInterval(id));
    });
  }

  // Params the caller can change to re-trigger the request reactively.
  readonly selectedDeviceId = signal<string | null>(null);
  readonly historyMinutes = signal(60);

  // Because the URL function reads two signals, changing either one
  // (selectedDeviceId or historyMinutes) automatically re-fires the request —
  // this is what "the new default way to fetch async data" buys you over
  // hand-rolled RxJS + signal bridging.
  readonly historyResource = httpResource<MetricPoint[]>(
    () => {
      const id = this.selectedDeviceId();
      if (!id) return undefined; // undefined URL = resource stays idle, no request fired
      return `${this.config.apiUrl}/devices/${id}/history?minutes=${this.historyMinutes()}`;
    },
    { defaultValue: [] },
  );
}
