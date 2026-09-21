import { Injectable, effect, signal } from '@angular/core';
import { DEFAULT_THRESHOLDS } from '../../shared/thresholds';

export interface AppSettings {
  pollIntervalMs: number;
  cpuAlertThreshold: number;
  deviceLabel: string;
}

const STORAGE_KEY = 'pulsegrid.settings.v1';
const DEFAULTS: AppSettings = { pollIntervalMs: 2000, cpuAlertThreshold: DEFAULT_THRESHOLDS.cpu.dangerAt, deviceLabel: '' };

function isFiniteNumberInRange(v: unknown, min: number, max: number): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
}

// A blind { ...DEFAULTS, ...parsed } merge trusts whatever shape happens to
// be in localStorage — a corrupted deviceLabel (e.g. not a string) would
// crash the first .trim() call downstream, and a corrupted pollIntervalMs
// (e.g. 0 or negative) would make DeviceService's setInterval fire in a
// near-tight loop, hammering the API from nothing but a bad stored value.
// Bounds here match the Settings form's own validators (500-10000ms,
// 1-100%), so a value the form would reject can't sneak in from storage.
function loadInitial(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        pollIntervalMs: isFiniteNumberInRange(parsed?.pollIntervalMs, 500, 10000) ? parsed.pollIntervalMs : DEFAULTS.pollIntervalMs,
        cpuAlertThreshold: isFiniteNumberInRange(parsed?.cpuAlertThreshold, 1, 100) ? parsed.cpuAlertThreshold : DEFAULTS.cpuAlertThreshold,
        deviceLabel: typeof parsed?.deviceLabel === 'string' ? parsed.deviceLabel : DEFAULTS.deviceLabel,
      };
    }
  } catch {
    // corrupt or blocked storage — fall through to defaults
  }
  return DEFAULTS;
}

// Backs the Settings page with a real, shared source of truth: pollIntervalMs
// drives DeviceService's periodic devicesResource refresh, cpuAlertThreshold
// feeds the CPU warn/danger thresholds on widgets and device-detail, and
// deviceLabel filters the "Add widget" device picker.
@Injectable({ providedIn: 'root' })
export class SettingsService {
  readonly settings = signal<AppSettings>(loadInitial());

  constructor() {
    effect(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings()));
      } catch {
        // storage full/blocked — settings still work for this session
      }
    });
  }

  save(next: AppSettings): void {
    this.settings.set(next);
  }
}
