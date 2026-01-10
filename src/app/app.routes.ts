import { Routes } from '@angular/router';
import { authGuard } from './features/auth/auth.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login/login').then(m => m.LoginComponent)
  },
  {
    path: 'register',
    loadComponent: () => import('./features/auth/register/register').then(m => m.RegisterComponent)
  },
  {
    path: 'verify-email',
    loadComponent: () => import('./features/auth/verify-email/verify-email').then(m => m.VerifyEmailComponent)
  },
  {
    path: 'upload',
    loadComponent: () => import('./features/upload/upload').then(m => m.Upload),
    canActivate: [authGuard]
  },
  {
    path: 'dashboard',
    loadComponent: () => import('./features/dashboard/dashboard').then(m => m.Dashboard),
    canActivate: [authGuard]
  },
  {
    path: 'manual-entry',
    loadComponent: () => import('./features/manual-entry/manual-entry').then(m => m.ManualEntry),
    canActivate: [authGuard]
  },
  {
    path: 'configuration',
    loadComponent: () => import('./features/configuration/configuration').then(m => m.Configuration),
    canActivate: [authGuard]
  },
  { path: '**', redirectTo: 'dashboard' }
];
