





import { Injectable, effect, signal } from '@angular/core';
import { WidgetConfig, WidgetType, MetricKey, AggInterval } from '../models/widget-config.model';

const STORAGE_KEY = 'pulsegrid.customDashboard.v1';
const DEVICE_IDS = ['device1', 'device2', 'device3', 'device4', 'device5'];

function defaultLayout(): WidgetConfig[] {
  return DEVICE_IDS.map((id, i) => ({
    id: `chart-${id}`,
    type: 'chart' as WidgetType,
    deviceId: id,
    metric: 'cpu' as MetricKey,
    title: `${id} — CPU`,
    x: (i % 3) * 3,
    y: Math.floor(i / 3) * 2,
    cols: 3,
    rows: 2,
  }));
}

function isWidgetConfig(v: any): v is WidgetConfig {
  return v && typeof v === 'object'
    && typeof v.id === 'string'
    && typeof v.x === 'number' && typeof v.y === 'number'
    && typeof v.cols === 'number' && typeof v.rows === 'number';
}

function loadInitial(): WidgetConfig[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.every(isWidgetConfig)) {
        return parsed as WidgetConfig[];
      }
    }
  } catch {
    // corrupt or blocked storage — fall through to defaults
  }
  return defaultLayout();
}

@Injectable({ providedIn: 'root' })
export class DashboardLayoutService {
  readonly widgets = signal<WidgetConfig[]>(loadInitial());

  constructor() {
    effect(() => {
      const snapshot = this.widgets();
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
      } catch {
        // storage full/blocked — layout still works for this session
      }
    });
  }

  addWidget(partial: { deviceId: string; metric: MetricKey; type: WidgetType; interval?: AggInterval }): void {
    this.widgets.update((list: any[]) => {
      const maxY = list.length ? Math.max(...list.map((w: { y: any; rows: any; }) => w.y + w.rows)) : 0;
      const id = `${partial.type}-${partial.deviceId}-${partial.metric}-${Date.now()}`;
      const interval = partial.type === 'chart' ? (partial.interval ?? '1m') : undefined;
      const intervalSuffix = interval && interval !== '1m' ? ` · ${interval}` : '';
      return list.concat({
          id,
          deviceId: partial.deviceId,
          metric: partial.metric,
          type: partial.type,
          interval,
          title: `${partial.deviceId} — ${partial.metric}${intervalSuffix}`,
          x: 0, y: maxY,
          cols: partial.type === 'chart' ? 3 : 2,
          rows: partial.type === 'chart' ? 2 : 1,
        });
    });
  }

  removeWidget(id: string): void {
    this.widgets.update((list: any[]) => list.filter((w: { id: string; }) => w.id !== id));
  }

  duplicateWidget(id: string): void {
    this.widgets.update((list: any[]) => {
      const src = list.find((w: { id: string; }) => w.id === id);
      if (!src) return list;
      const maxY = Math.max(...list.map((w: { y: any; rows: any; }) => w.y + w.rows));
      const copy: WidgetConfig = Object.assign({}, src, {
        id: `${src.type}-${src.deviceId}-${src.metric}-${Date.now()}`,
        title: `${src.title} (copy)`,
        x: 0,
        y: maxY,
      });
      return list.concat(copy);
    });
  }

  renameWidget(id: string, title: string): void {
    const trimmed = title.trim();
    if (!trimmed) return;
    this.widgets.update((list: WidgetConfig[]) => list.map((w: WidgetConfig): WidgetConfig => (w.id === id ? { ...w, title: trimmed } : w)));
  }

  resetLayout(): void {
    this.widgets.set(defaultLayout());
  }
}