import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { JsonPipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { SettingsService } from '../../core/services/settings.service';
import { DEFAULT_THRESHOLDS } from '../../shared/thresholds';

// NOTE ON SIGNAL FORMS: v22 also ships @angular/forms/signals (form(),
// a Field directive, functional validators like required()/min()/max()).
// I tried that API here first and it broke the build — 'Field' isn't
// importable the way I guessed, and without network/install access in my
// sandbox I can't confirm the real export names against your installed
// version. Rather than guess again, this is built on Reactive Forms, which
// is guaranteed stable. Once you're running, check
// node_modules/@angular/forms/signals/index.d.ts for the real exports and
// I'll port this file over — the two models below explain the actual
// conceptual difference either way:
//
// Reactive Forms (this file): FormGroup/FormControl are a PARALLEL object
// graph you keep in sync with your app's data by hand — read values via
// .value or valueChanges, push external changes in via patchValue().
// Signal Forms: form() wraps a signal you already own; there's no second
// object to reconcile — the signal IS the form's source of truth.

@Component({
  selector: 'pg-settings',
  standalone: true,
  imports: [ReactiveFormsModule, JsonPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
  <h2>Settings</h2>

  <form [formGroup]="settingsForm" (ngSubmit)="onSubmit()">
    <label>
      Poll interval (ms)
      <input type="number" formControlName="pollIntervalMs" />
    </label>
    @if (settingsForm.controls.pollIntervalMs.invalid && settingsForm.controls.pollIntervalMs.touched) {
      <small class="err">Must be between 500 and 10000</small>
    }

    <label>
      CPU alert threshold (%)
      <input type="number" formControlName="cpuAlertThreshold" />
    </label>
    @if (settingsForm.controls.cpuAlertThreshold.invalid && settingsForm.controls.cpuAlertThreshold.touched) {
      <small class="err">Must be between 1 and 100</small>
    }

    <label>
      Device label filter
      <input type="text" formControlName="deviceLabel" />
    </label>

    <button type="submit" [disabled]="settingsForm.invalid">Save</button>
  </form>

  <pre>{{ saved() | json }}</pre>
`,
styles: [`
  h2 { font-size: 20px; font-weight: 600; letter-spacing: -0.01em; margin-bottom: var(--space-4); }
  form { display: flex; flex-direction: column; gap: var(--space-4); max-width: 340px;
    background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: var(--space-5); }
  label { display: flex; flex-direction: column; gap: 6px; font-size: 13px; color: var(--text-muted); }
  input { background: var(--surface-raised); border: 1px solid var(--border); border-radius: 8px;
    padding: 8px 10px; color: var(--text); font-family: var(--font-mono); font-size: 14px; }
  input:focus { outline: none; border-color: var(--accent); }
  .err { color: var(--danger); }
  button { align-self: flex-start; background: var(--accent); border: none; border-radius: 8px;
    padding: 8px 16px; color: #fff; font-weight: 500; font-size: 13px; cursor: pointer; }
  button:disabled { opacity: .4; cursor: not-allowed; }
  pre { margin-top: var(--space-4); color: var(--text-muted); font-size: 12px; font-family: var(--font-mono);
    background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: var(--space-3); }
`],
})
export class SettingsComponent {
  private readonly fb = new FormBuilder();
  private readonly settingsSvc = inject(SettingsService);

  // Backed by SettingsService now — DeviceService reads pollIntervalMs to
  // drive its periodic refresh, widget-host/device-detail read
  // cpuAlertThreshold for the CPU warn/danger line, and the dashboard's
  // "Add widget" picker reads deviceLabel to filter its device list.
  protected readonly saved = this.settingsSvc.settings;

  protected readonly settingsForm = this.fb.group({
    pollIntervalMs: this.fb.control(this.saved().pollIntervalMs, [Validators.required, Validators.min(500), Validators.max(10000)]),
    cpuAlertThreshold: this.fb.control(this.saved().cpuAlertThreshold, [Validators.required, Validators.min(1), Validators.max(100)]),
    deviceLabel: this.fb.control(this.saved().deviceLabel),
  });

  protected onSubmit(): void {
    if (this.settingsForm.invalid) return;
    const raw = this.settingsForm.getRawValue();
    this.settingsSvc.save({
      pollIntervalMs: raw.pollIntervalMs ?? 2000,
      cpuAlertThreshold: raw.cpuAlertThreshold ?? DEFAULT_THRESHOLDS.cpu.dangerAt,
      deviceLabel: raw.deviceLabel ?? '',
    });
  }
}
