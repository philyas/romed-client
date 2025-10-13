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
  { path: '**', redirectTo: 'dashboard' }
];
