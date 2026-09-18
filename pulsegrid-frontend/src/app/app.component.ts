import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ShellComponent } from './layout/shell/shell.component';

@Component({
  selector: 'pg-root',
  standalone: true,
  imports: [ShellComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<pg-shell />`,
})
export class AppComponent {}
