import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

@Component({
  selector: 'pg-stat-badge',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="badge" [style.--c]="color()">
      <span class="glow"></span>
      <span class="label">{{ label() }}</span>
      <span class="value">{{ value() }}<span class="unit">{{ unit() }}</span></span>
      <div class="bar"><div class="bar-fill" [style.width.%]="pct()"></div></div>
    </div>
  `,
  styles: [`
    .badge { position: relative; overflow: hidden; display: flex; flex-direction: column; gap: 8px;
      padding: 14px 16px; background: var(--surface-raised); border: 1px solid var(--border);
      border-radius: var(--radius-sm); min-width: 96px; transition: border-color 0.2s ease; }
    .badge:hover { border-color: var(--c); }
    .glow { position: absolute; top: -30%; right: -20%; width: 70px; height: 70px; border-radius: 50%;
      background: var(--c); opacity: 0.16; filter: blur(18px); pointer-events: none; }
    .label { font-size: 11px; color: var(--text-muted); text-transform: capitalize; font-weight: 500; }
    .value { font-family: var(--font-mono); font-size: 21px; font-weight: 700; color: var(--c); }
    .unit { font-size: 12px; opacity: 0.7; margin-left: 1px; }
    .bar { height: 3px; border-radius: 3px; background: rgba(28,29,38,0.08); overflow: hidden; }
    .bar-fill { height: 100%; background: var(--c); border-radius: 3px; transition: width 0.4s var(--ease); }
  `],
})
export class StatBadgeComponent {
  readonly label = input.required<string>();
  readonly value = input.required<number>();
  readonly unit = input('%');
  readonly warnAt = input(70);
  readonly dangerAt = input(90);

  readonly color = computed(() => {
    const v = this.value();
    if (v >= this.dangerAt()) return 'var(--danger)';
    if (v >= this.warnAt()) return 'var(--warn)';
    return 'var(--ok)';
  });

  readonly pct = computed(() => Math.max(4, Math.min(100, this.value())));
}
