import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, input, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { StatBadgeComponent } from '../../../shared/components/stat-badge/stat-badge.component';
import { AgoFromPipe } from '../../../shared/pipes/duration-ago.pipe';
import { MiniChartComponent } from '../mini-chart/mini-chart.component';
import { SocketService } from '../../../core/services/socket.service';
import { DashboardLayoutService } from '../services/dashboard-layout.service';
import { WidgetConfig, MetricKey } from '../models/widget-config.model';

const UNITS: Record<MetricKey, string> = { cpu: '%', memory: '%', latency: 'ms' };
const THRESHOLDS: Record<MetricKey, { warnAt: number; dangerAt: number }> = {
  cpu: { warnAt: 70, dangerAt: 90 },
  memory: { warnAt: 70, dangerAt: 90 },
  latency: { warnAt: 200, dangerAt: 350 },
};

@Component({
  selector: 'pg-widget-host',
  standalone: true,
  imports: [StatBadgeComponent, AgoFromPipe, MiniChartComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="widget glass" [class.ok]="status() === 'ok'" [class.warn]="status() === 'warn'" [class.danger]="status() === 'danger'">
      <header class="drag-handle">
        <div class="title-group">
          <span class="live-dot"></span>
          @if (renaming()) {
            <input #renameInput class="title-input" [value]="config().title"
              (click)="$event.stopPropagation()"
              (keydown.enter)="commitRename(renameInput.value)"
              (keydown.escape)="renaming.set(false)"
              (blur)="commitRename(renameInput.value)" />
          } @else {
            <span class="title" (dblclick)="startRename()" title="Double-click to rename">{{ config().title }}</span>
          }
        </div>
        <div class="header-right">
          <span class="ago">{{ latestUpdate()?.timestamp | agoFrom }}</span>
          <button class="icon-btn" [class.active]="menuOpen()" (click)="menuOpen.set(!menuOpen())" aria-label="Widget menu">
            <svg viewBox="0 0 20 20" width="13" height="13" fill="currentColor"><circle cx="10" cy="4.5" r="1.5"/><circle cx="10" cy="10" r="1.5"/><circle cx="10" cy="15.5" r="1.5"/></svg>
          </button>
        </div>

        @if (menuOpen()) {
          <div class="menu-backdrop" (click)="menuOpen.set(false)"></div>
          <div class="menu glass" (click)="$event.stopPropagation()">
            <button (click)="goToDevice()">
              <svg viewBox="0 0 20 20" width="13" height="13" fill="none"><path d="M8 4.5H4a1 1 0 0 0-1 1V16a1 1 0 0 0 1 1h10.5a1 1 0 0 0 1-1v-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M11 3h6v6M17 3l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
              View device
            </button>
            <button (click)="startRename(); menuOpen.set(false)">
              <svg viewBox="0 0 20 20" width="13" height="13" fill="none"><path d="M13.5 3.5 16.5 6.5 7 16H4v-3L13.5 3.5Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>
              Rename
            </button>
            <button (click)="layout.duplicateWidget(config().id); menuOpen.set(false)">
              <svg viewBox="0 0 20 20" width="13" height="13" fill="none"><rect x="7" y="7" width="9.5" height="9.5" rx="1.4" stroke="currentColor" stroke-width="1.5"/><path d="M13.5 7V4.9A1.4 1.4 0 0 0 12.1 3.5H4.9A1.4 1.4 0 0 0 3.5 4.9v7.2a1.4 1.4 0 0 0 1.4 1.4H7" stroke="currentColor" stroke-width="1.5"/></svg>
              Duplicate
            </button>
            <button class="danger" (click)="layout.removeWidget(config().id); menuOpen.set(false)">
              <svg viewBox="0 0 20 20" width="13" height="13" fill="none"><path d="M4.5 6h11M8 6V4.5h4V6M6 6l.6 9.4a1 1 0 0 0 1 .9h4.8a1 1 0 0 0 1-.9L14 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
              Remove
            </button>
          </div>
        }
      </header>

      <button class="body" (click)="goToDevice()" [attr.aria-label]="'Open ' + config().deviceId + ' details'">
        @switch (config().type) {
          @case ('chart') { <pg-mini-chart [deviceId]="config().deviceId" [metric]="config().metric" [interval]="config().interval ?? '1m'" /> }
          @case ('stat') {
            <pg-stat-badge [label]="config().metric" [value]="currentValue()" [unit]="unit()"
              [warnAt]="thresholds().warnAt" [dangerAt]="thresholds().dangerAt" />
          }
        }
        <span class="hover-hint">
          Open device
          <svg viewBox="0 0 20 20" width="11" height="11" fill="none"><path d="M4 10h11M11 5l5 5-5 5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </span>
      </button>
    </div>
  `,
  styles: [`
    .widget { height: 100%; display: flex; flex-direction: column; position: relative;
      border-left: 3px solid var(--border);
      overflow: visible; box-shadow: var(--shadow-sm);
      transition: border-color 0.3s ease, box-shadow 0.3s ease, transform 0.18s var(--ease); }
    .widget:hover { transform: translateY(-2px); border-color: var(--border-hover); }
    .widget.ok { border-left-color: var(--ok); }
    .widget.warn { border-left-color: var(--warn); box-shadow: var(--shadow-sm), 0 0 0 1px rgba(255,183,66,0.15); }
    .widget.danger { border-left-color: var(--danger); box-shadow: var(--shadow-sm), 0 0 22px color-mix(in srgb, var(--danger) 22%, transparent); }

    header { position: relative; display: flex; justify-content: space-between; align-items: center;
      padding: 10px 14px; border-bottom: 1px solid var(--border); cursor: move; border-radius: var(--radius) var(--radius) 0 0; }
    .title-group { display: flex; align-items: center; gap: var(--space-2); min-width: 0; }
    .live-dot { width: 6px; height: 6px; min-width: 6px; border-radius: 50%; background: var(--text-dim); }
    .widget.ok .live-dot { background: var(--ok); box-shadow: 0 0 6px var(--ok); animation: blip 2.4s ease-in-out infinite; }
    .widget.warn .live-dot { background: var(--warn); box-shadow: 0 0 6px var(--warn); animation: blip 1.4s ease-in-out infinite; }
    .widget.danger .live-dot { background: var(--danger); box-shadow: 0 0 6px var(--danger); animation: blip 0.8s ease-in-out infinite; }
    @keyframes blip { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }
    .title { font-size: 12px; font-weight: 600; color: var(--text); white-space: nowrap; overflow: hidden;
      text-overflow: ellipsis; cursor: text; }
    .title-input { font: inherit; font-size: 12px; font-weight: 600; color: var(--text); background: var(--surface-raised);
      border: 1px solid var(--accent); border-radius: 5px; padding: 1px 5px; width: 120px; cursor: text; }

    .header-right { display: flex; align-items: center; gap: var(--space-2); }
    .ago { font-size: 11px; color: var(--text-muted); font-family: var(--font-mono); }

    .icon-btn { display: flex; align-items: center; justify-content: center; width: 20px; height: 20px;
      background: var(--surface-raised); border: 1px solid var(--border); border-radius: 6px;
      color: var(--text-muted); cursor: pointer; opacity: 0; transition: opacity 0.15s ease, color 0.15s ease, border-color 0.15s ease; }
    .widget:hover .icon-btn, .icon-btn.active { opacity: 1; }
    .icon-btn:hover { color: var(--text); border-color: var(--border-hover); }

    .menu-backdrop { position: fixed; inset: 0; z-index: 49; }
    .menu { position: absolute; top: 40px; right: 10px; z-index: 50; width: 168px; padding: 6px;
      box-shadow: var(--shadow); animation: pop-in 0.14s var(--ease); }
    @keyframes pop-in { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }
    .menu button { display: flex; align-items: center; gap: 8px; width: 100%; background: none; border: none;
      color: var(--text-muted); font-size: 12.5px; text-align: left; padding: 7px 9px; border-radius: 7px; cursor: pointer; }
    .menu button:hover { background: var(--surface-raised); color: var(--text); }
    .menu button.danger:hover { background: color-mix(in srgb, var(--danger) 12%, transparent); color: var(--danger); }

    .body { flex: 1; padding: var(--space-3); display: flex; align-items: stretch; justify-content: center;
  position: relative; background: none; border: none; width: 100%; cursor: pointer; border-radius: 0 0 var(--radius) var(--radius);
  font: inherit; color: inherit; overflow: hidden; }
    .hover-hint { position: absolute; bottom: 6px; right: 10px; display: flex; align-items: center; gap: 4px;
      font-size: 10.5px; font-weight: 600; color: #fff; background: rgba(28,29,38,0.88);
      padding: 3px 8px; border-radius: 20px; opacity: 0; transform: translateY(3px);
      transition: opacity 0.15s ease, transform 0.15s ease; pointer-events: none; }
    .widget:hover .hover-hint { opacity: 1; transform: none; }
  `],
})
export class WidgetHostComponent {
  readonly config = input.required<WidgetConfig>();
  protected readonly layout = inject(DashboardLayoutService);
  private readonly socket = inject(SocketService);
  private readonly router = inject(Router);

  protected readonly menuOpen = signal(false);
  protected readonly renaming = signal(false);
  private readonly renameInputRef = viewChild<ElementRef<HTMLInputElement>>('renameInput');

  protected readonly unit = computed(() => UNITS[this.config().metric]);
  protected readonly thresholds = computed(() => THRESHOLDS[this.config().metric]);

  protected readonly latestUpdate = computed(() =>
    this.socket.updatesByDevice().get(this.config().deviceId) ?? null,
  );

  protected readonly currentValue = computed(() => this.latestUpdate()?.[this.config().metric] ?? 0);

  protected readonly status = computed((): 'ok' | 'warn' | 'danger' => {
    const v = this.currentValue();
    const t = this.thresholds();
    if (v >= t.dangerAt) return 'danger';
    if (v >= t.warnAt) return 'warn';
    return 'ok';
  });

  protected goToDevice(): void {
    this.router.navigate(['/devices', this.config().deviceId]);
  }

  protected startRename(): void {
    this.renaming.set(true);
    // Focus happens on the next tick, once the input has actually rendered.
    queueMicrotask(() => this.renameInputRef()?.nativeElement.select());
  }

  protected commitRename(value: string): void {
    if (!this.renaming()) return;
    this.renaming.set(false);
    this.layout.renameWidget(this.config().id, value);
  }
}
