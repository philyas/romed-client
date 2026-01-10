import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap, catchError, throwError, firstValueFrom } from 'rxjs';
import { isDevMode } from '@angular/core';

export interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: 'admin' | 'viewer';
  emailVerified: boolean;
  createdAt?: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  private readonly baseUrl = this.resolveBaseUrl();

  private readonly userSignal = signal<User | null>(null);
  private readonly tokenSignal = signal<string | null>(null);
  private readonly isInitializedSignal = signal(false);
  private initializationPromise: Promise<void> | null = null;

  // Public computed signals
  readonly currentUser = computed(() => this.userSignal());
  readonly isAuthenticated = computed(() => this.isInitializedSignal() && this.userSignal() !== null);
  readonly isInitialized = computed(() => this.isInitializedSignal());
  readonly isAdmin = computed(() => this.userSignal()?.role === 'admin');
  readonly isEmailVerified = computed(() => this.userSignal()?.emailVerified === true);

  constructor() {
    // Load token and user from localStorage on init
    this.initializationPromise = this.initializeAuth();
  }

  async waitForInitialization(): Promise<void> {
    if (this.initializationPromise) {
      await this.initializationPromise;
    }
  }

  private async initializeAuth(): Promise<void> {
    try {
      const token = localStorage.getItem('auth_token');
      const userStr = localStorage.getItem('auth_user');
      
      console.log('[auth] Initializing auth...', { hasToken: !!token, hasUser: !!userStr });
      
      if (!token || !userStr) {
        console.log('[auth] No token or user found in localStorage');
        this.isInitializedSignal.set(true);
        return;
      }

      // Set token and user temporarily for immediate UI feedback
      this.tokenSignal.set(token);
      const user = JSON.parse(userStr);
      this.userSignal.set(user);
      console.log('[auth] Token and user loaded from localStorage, validating...');
      
      // Verify token is still valid by fetching current user
      try {
        const response = await firstValueFrom(this.getCurrentUser());
        console.log('[auth] Token validation successful:', response.user.email);
        // Token is valid, user is already set by getCurrentUser
        this.isInitializedSignal.set(true);
      } catch (error: any) {
        // Token is invalid or expired, clear auth (but don't navigate yet)
        console.error('[auth] Token validation failed:', error);
        console.error('[auth] Error details:', error?.error || error?.message || error);
        this.userSignal.set(null);
        this.tokenSignal.set(null);
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_user');
        this.isInitializedSignal.set(true);
      }
    } catch (error) {
      console.error('[auth] Failed to restore user from localStorage:', error);
      this.userSignal.set(null);
      this.tokenSignal.set(null);
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');
      this.isInitializedSignal.set(true);
    }
  }

  private resolveBaseUrl(): string {
    if (isDevMode()) {
      return 'http://localhost:3000';
    }
    if (typeof window !== 'undefined') {
      if (window.location.hostname === 'localhost' || 
          window.location.hostname === '127.0.0.1' ||
          window.location.port === '4200') {
        return '';
      }
    }
    return 'https://romed-server.onrender.com';
  }

  register(email: string, password: string, firstName?: string, lastName?: string, role?: 'admin' | 'viewer'): Observable<{ success: boolean; message: string; email: string }> {
    return this.http.post<{ success: boolean; message: string; email: string }>(`${this.baseUrl}/api/auth/register`, {
      email,
      password,
      firstName,
      lastName,
      role: role || 'viewer'
    }).pipe(
      catchError(error => {
        console.error('[auth] Registration error:', error);
        return throwError(() => error);
      })
    );
  }

  login(email: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.baseUrl}/api/auth/login`, {
      email,
      password
    }).pipe(
      tap(response => {
        this.setAuth(response.user, response.token);
      }),
      catchError(error => {
        console.error('[auth] Login error:', error);
        return throwError(() => error);
      })
    );
  }

  verifyEmail(token: string): Observable<{ success: boolean; message: string }> {
    return this.http.post<{ success: boolean; message: string }>(`${this.baseUrl}/api/auth/verify-email`, {
      token
    }).pipe(
      tap(() => {
        // Update user email verified status
        const currentUser = this.userSignal();
        if (currentUser) {
          this.userSignal.set({ ...currentUser, emailVerified: true });
          localStorage.setItem('auth_user', JSON.stringify(this.userSignal()));
        }
      })
    );
  }

  getCurrentUser(): Observable<{ user: User }> {
    const token = this.tokenSignal();
    if (!token) {
      console.error('[auth] getCurrentUser called but no token available');
      return throwError(() => new Error('No token available'));
    }

    // Don't manually set Authorization header - the interceptor will add it
    console.log('[auth] Fetching current user from:', `${this.baseUrl}/api/auth/me`);
    return this.http.get<{ user: User }>(`${this.baseUrl}/api/auth/me`).pipe(
      tap(response => {
        console.log('[auth] Current user fetched successfully:', response.user.email);
        this.userSignal.set(response.user);
        localStorage.setItem('auth_user', JSON.stringify(response.user));
      }),
      catchError(error => {
        console.error('[auth] Failed to fetch current user:', error);
        console.error('[auth] Error status:', error?.status);
        console.error('[auth] Error message:', error?.message);
        console.error('[auth] Error details:', error?.error);
        return throwError(() => error);
      })
    );
  }

  logout(): void {
    this.userSignal.set(null);
    this.tokenSignal.set(null);
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    this.isInitializedSignal.set(true); // Ensure initialized after logout
    this.router.navigate(['/login']);
  }

  getToken(): string | null {
    return this.tokenSignal();
  }

  private setAuth(user: User, token: string): void {
    this.userSignal.set(user);
    this.tokenSignal.set(token);
    localStorage.setItem('auth_token', token);
    localStorage.setItem('auth_user', JSON.stringify(user));
    this.isInitializedSignal.set(true); // Ensure initialized after login
  }
}
