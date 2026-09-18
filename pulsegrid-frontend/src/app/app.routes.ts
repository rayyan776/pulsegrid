import { Routes } from '@angular/router';
import { deviceExistsGuard } from './core/guards/device-exists.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'custom-dashboard' },
  { path: 'dashboard', redirectTo: 'custom-dashboard' }, // keep old links alive
  {
    path: 'custom-dashboard',
    loadComponent: () =>
      import('./features/custom-dashboard/custom-dashboard.component').then((m) => m.CustomDashboardComponent),
  },
  {
    path: 'devices/:id',
    canActivate: [deviceExistsGuard],
    loadComponent: () =>
      import('./features/device-detail/device-detail.component').then((m) => m.DeviceDetailComponent),
  },
  {
    path: 'settings',
    loadComponent: () =>
      import('./features/settings/settings.component').then((m) => m.SettingsComponent),
  },
  { path: '**', redirectTo: 'custom-dashboard' },
];