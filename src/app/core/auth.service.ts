import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap, catchError, throwError } from 'rxjs';
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

  // Public computed signals
  readonly currentUser = computed(() => this.userSignal());
  readonly isAuthenticated = computed(() => this.userSignal() !== null);
  readonly isAdmin = computed(() => this.userSignal()?.role === 'admin');
  readonly isEmailVerified = computed(() => this.userSignal()?.emailVerified === true);

  constructor() {
    // Load token and user from localStorage on init
    const token = localStorage.getItem('auth_token');
    const userStr = localStorage.getItem('auth_user');
    
    if (token && userStr) {
      try {
        this.tokenSignal.set(token);
        this.userSignal.set(JSON.parse(userStr));
        // Verify token is still valid by fetching current user
        this.getCurrentUser().subscribe({
          error: () => {
            // Token is invalid, clear auth
            this.logout();
          }
        });
      } catch (error) {
        console.error('[auth] Failed to restore user from localStorage:', error);
        this.logout();
      }
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
      return throwError(() => new Error('No token available'));
    }

    return this.http.get<{ user: User }>(`${this.baseUrl}/api/auth/me`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    }).pipe(
      tap(response => {
        this.userSignal.set(response.user);
        localStorage.setItem('auth_user', JSON.stringify(response.user));
      })
    );
  }

  logout(): void {
    this.userSignal.set(null);
    this.tokenSignal.set(null);
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
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
  }
}
