import { ThemeMode } from '../core/services/theme.service';

/** Chart.js reads plain color strings, not CSS custom properties, so the
 *  handful of colors that need to flip between light/dark mode are kept
 *  here rather than in styles.scss. Line/fill accent colors (coral,
 *  indigo, teal, amber, red) stay the same in both modes — they have
 *  enough contrast either way — only the "paper" chrome around the data
 *  changes. */
export function chartChrome(mode: ThemeMode) {
  return mode === 'dark'
    ? {
      grid: 'rgba(255,255,255,0.07)',
      tick: '#8b8f9c',
      legend: '#9a9eab',
      tooltipBg: '#f7f4ee',
      tooltipTitle: '#6b6f7d',
      tooltipBody: '#1c1d26',
      tooltipBorder: 'rgba(28,29,38,0.08)',
      pointHoverBorder: '#14151f',
    }
    : {
      grid: 'rgba(28,29,38,0.07)',
      tick: '#8b8f9c',
      legend: '#6b6f7d',
      tooltipBg: '#1c1d26',
      tooltipTitle: '#9a9eab',
      tooltipBody: '#f7f4ee',
      tooltipBorder: 'rgba(255,255,255,0.08)',
      pointHoverBorder: '#ffffff',
    };
}

/** Rebuilds a fill gradient sized to the canvas's CURRENT height.
 *  Chart.js CanvasGradient objects are fixed at creation to the pixel
 *  height passed in — if the canvas is resized afterwards (a gridster
 *  drag-resize) without rebuilding the gradient, the fade-to-transparent
 *  stop stays pinned to the OLD height. Shrinking the widget then leaves
 *  the fill without ever reaching transparent before the axis line —
 *  looking like the fill/line "isn't sitting on the same baseline"
 *  anymore. Call this every time the canvas size changes, not just once
 *  at chart creation. */
export function buildAreaGradient(ctx: CanvasRenderingContext2D, heightPx: number, hexColor: string): CanvasGradient {
  const gradient = ctx.createLinearGradient(0, 0, 0, heightPx || 160);
  gradient.addColorStop(0, `${hexColor}55`);
  gradient.addColorStop(1, `${hexColor}00`);
  return gradient;
}
