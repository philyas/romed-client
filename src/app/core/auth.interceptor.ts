import { HttpInterceptorFn } from '@angular/common/http';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  // Read token directly from localStorage to avoid circular dependency
  // Don't inject AuthService here as it causes circular dependency during initialization
  let token: string | null = null;
  
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      token = localStorage.getItem('auth_token');
    } catch (error) {
      console.warn('[interceptor] Failed to read token from localStorage:', error);
    }
  }

  // Skip auth routes and add token to all other requests
  // Also handle relative URLs and full URLs
  const isAuthRoute = req.url.includes('/api/auth/login') || 
                      req.url.includes('/api/auth/register') ||
                      req.url.includes('/api/auth/verify-email');

  if (token && !isAuthRoute) {
    const clonedReq = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
    return next(clonedReq);
  }

  return next(req);
};
