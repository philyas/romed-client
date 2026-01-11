import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { isDevMode } from '@angular/core';

export interface AdminUser {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: 'admin' | 'viewer';
  emailVerified: boolean;
  isActive: boolean;
  lastLogin?: string;
  createdAt: string;
  updatedAt?: string;
  hasPassword?: boolean;
}

export interface CreateUserRequest {
  email: string;
  password?: string;
  firstName?: string;
  lastName?: string;
  role?: 'admin' | 'viewer';
  sendVerificationEmail?: boolean;
  emailVerified?: boolean;
}

export interface UpdateUserRequest {
  firstName?: string;
  lastName?: string;
  role?: 'admin' | 'viewer';
  isActive?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class AdminService {
  private http = inject(HttpClient);
  private readonly baseUrl = this.resolveBaseUrl();

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

  getAllUsers(): Observable<{ users: AdminUser[] }> {
    return this.http.get<{ users: AdminUser[] }>(`${this.baseUrl}/api/admin/users`).pipe(
      catchError(error => {
        console.error('[admin] Get users error:', error);
        return throwError(() => error);
      })
    );
  }

  createUser(userData: CreateUserRequest): Observable<{ user: AdminUser; message: string }> {
    return this.http.post<{ user: AdminUser; message: string }>(`${this.baseUrl}/api/admin/users`, userData).pipe(
      catchError(error => {
        console.error('[admin] Create user error:', error);
        return throwError(() => error);
      })
    );
  }

  updateUser(userId: string, userData: UpdateUserRequest): Observable<{ user: AdminUser; message: string }> {
    return this.http.put<{ user: AdminUser; message: string }>(`${this.baseUrl}/api/admin/users/${userId}`, userData).pipe(
      catchError(error => {
        console.error('[admin] Update user error:', error);
        return throwError(() => error);
      })
    );
  }

  deleteUser(userId: string): Observable<{ success: boolean; message: string }> {
    return this.http.delete<{ success: boolean; message: string }>(`${this.baseUrl}/api/admin/users/${userId}`).pipe(
      catchError(error => {
        console.error('[admin] Delete user error:', error);
        return throwError(() => error);
      })
    );
  }

  resendVerificationEmail(userId: string): Observable<{ success: boolean; message: string }> {
    return this.http.post<{ success: boolean; message: string }>(
      `${this.baseUrl}/api/admin/users/${userId}/resend-verification`,
      {}
    ).pipe(
      catchError(error => {
        console.error('[admin] Resend verification email error:', error);
        return throwError(() => error);
      })
    );
  }

  resetUserPassword(userId: string, password: string): Observable<{ success: boolean; message: string }> {
    return this.http.post<{ success: boolean; message: string }>(
      `${this.baseUrl}/api/admin/users/${userId}/reset-password`,
      { password }
    ).pipe(
      catchError(error => {
        console.error('[admin] Reset password error:', error);
        return throwError(() => error);
      })
    );
  }
}
