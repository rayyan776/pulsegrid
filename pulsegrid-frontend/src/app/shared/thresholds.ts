import { MetricKey } from '../features/custom-dashboard/models/widget-config.model';

// Single source for warn/danger thresholds — previously duplicated as literal
// 70/90/350 across stat-badge, widget-host, device-detail and fleet-summary,
// which could silently drift out of sync with each other.
export const DEFAULT_THRESHOLDS: Record<MetricKey, { warnAt: number; dangerAt: number }> = {
  cpu: { warnAt: 70, dangerAt: 90 },
  memory: { warnAt: 70, dangerAt: 90 },
  latency: { warnAt: 200, dangerAt: 350 },
};
