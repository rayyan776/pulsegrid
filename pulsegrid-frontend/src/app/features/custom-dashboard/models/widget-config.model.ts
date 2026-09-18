export type WidgetType = 'chart' | 'stat';
export type MetricKey = 'cpu' | 'memory' | 'latency';
export type AggInterval = '1m' | '10m' | '1h';

export interface WidgetConfig {
  id: string;
  type: WidgetType;
  deviceId: string;
  metric: MetricKey;
  title: string;
  x: number;
  y: number;
  cols: number;
  rows: number;
  /** Which Rollup collection a chart widget reads from (server's
   *  /aggregates?interval=... route). Only meaningful for type:'chart';
   *  optional so older saved layouts without it still load — treat a
   *  missing value as '1m'. */
  interval?: AggInterval;
}