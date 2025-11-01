import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  {
    path: 'upload',
    loadComponent: () => import('./features/upload/upload').then(m => m.Upload)
  },
  {
    path: 'dashboard',
    loadComponent: () => import('./features/dashboard/dashboard').then(m => m.Dashboard)
  },
  {
    path: 'manual-entry',
    loadComponent: () => import('./features/manual-entry/manual-entry').then(m => m.ManualEntry)
  },
  {
    path: 'manual-entry-nacht',
    loadComponent: () => import('./features/manual-entry-nacht/manual-entry-nacht').then(m => m.ManualEntryNacht)
  },
  {
    path: 'configuration',
    loadComponent: () => import('./features/configuration/configuration').then(m => m.Configuration)
  },
  { path: '**', redirectTo: 'dashboard' }
];
