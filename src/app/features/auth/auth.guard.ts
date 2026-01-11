import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../../core/auth.service';

export const authGuard: CanActivateFn = async (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Wait for auth initialization (checking localStorage and validating token)
  await authService.waitForInitialization();

  if (authService.isAuthenticated()) {
    return true;
  }

  // Redirect to login with return URL
  router.navigate(['/login'], { queryParams: { returnUrl: state.url } });
  return false;
};

export const adminGuard: CanActivateFn = async (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Wait for auth initialization
  await authService.waitForInitialization();

  if (authService.isAuthenticated() && authService.isAdmin()) {
    return true;
  }

  // Redirect to dashboard or login
  if (!authService.isAuthenticated()) {
    router.navigate(['/login'], { queryParams: { returnUrl: state.url } });
  } else {
    router.navigate(['/dashboard']);
  }
  return false;
};

export const viewerGuard: CanActivateFn = async (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Wait for auth initialization
  await authService.waitForInitialization();

  if (!authService.isAuthenticated()) {
    router.navigate(['/login'], { queryParams: { returnUrl: state.url } });
    return false;
  }

  // Viewer can only access dashboard
  // If viewer tries to access other routes, redirect to dashboard
  if (authService.currentUser()?.role === 'viewer' && state.url !== '/dashboard' && !state.url.startsWith('/dashboard')) {
    router.navigate(['/dashboard']);
    return false;
  }

  // Admin can access all routes
  if (authService.isAdmin()) {
    return true;
  }

  // Viewer can access dashboard
  return true;
};
