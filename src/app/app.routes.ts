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
  { path: '**', redirectTo: 'dashboard' }
];
