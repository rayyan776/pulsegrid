import { ChangeDetectionStrategy, Component, contentChild, input } from '@angular/core';
import { PanelActionsDirective } from './panel-actions.directive';

@Component({
  selector: 'pg-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="panel glass">
      <header>
        <div class="title-row">
          <span class="accent-bar"></span>
          <h3>{{ title() }}</h3>
        </div>
        <!-- Content Query: contentChild looks inside <ng-content>, i.e. what
             the PARENT template projected in — as opposed to viewChild,
             which looks inside THIS component's own template. -->
        @if (actions()) {
          <div class="actions"><ng-content select="[pgPanelActions]" /></div>
        }
      </header>
      <div class="body"><ng-content /></div>
    </section>
  `,
  styles: [`
    .panel { transition: border-color 0.2s ease, transform 0.2s ease; }
    .panel:hover { border-color: var(--border-hover); }
    header { display: flex; justify-content: space-between; align-items: center;
      padding: 14px 20px; border-bottom: 1px solid var(--border); }
    .title-row { display: flex; align-items: center; gap: 9px; }
    .accent-bar { width: 4px; height: 14px; border-radius: 3px; background: var(--accent-grad); }
    h3 { margin: 0; font-size: 13px; font-weight: 600; color: var(--text); letter-spacing: 0.01em; }
    .body { padding: 20px; }
  `],
})
export class PanelComponent {
  readonly title = input('');
  readonly actions = contentChild(PanelActionsDirective);
}
