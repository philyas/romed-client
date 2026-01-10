import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { AdminService, AdminUser, CreateUserRequest, UpdateUserRequest } from '../../core/admin.service';
import { AuthService } from '../../core/auth.service';
import { UserDialogComponent } from './user-dialog.component';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatTableModule,
    MatDialogModule,
    MatSnackBarModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatCheckboxModule,
    MatSlideToggleModule
  ],
  templateUrl: './admin.html',
  styleUrl: './admin.scss'
})
export class AdminComponent implements OnInit {
  private adminService = inject(AdminService);
  private authService = inject(AuthService);
  private snackBar = inject(MatSnackBar);
  private dialog = inject(MatDialog);

  users = signal<AdminUser[]>([]);
  dataSource = new MatTableDataSource<AdminUser>([]);
  loading = signal(false);
  displayedColumns: string[] = ['email', 'name', 'role', 'status', 'emailVerified', 'lastLogin', 'createdAt', 'actions'];

  ngOnInit(): void {
    this.loadUsers();
  }

  async loadUsers(): Promise<void> {
    this.loading.set(true);
    try {
      const response = await firstValueFrom(this.adminService.getAllUsers());
      if (response?.users) {
        this.users.set(response.users);
        this.dataSource.data = response.users;
      }
    } catch (error: any) {
      console.error('Error loading users:', error);
      this.snackBar.open(
        error.error?.error || 'Fehler beim Laden der Benutzer.',
        'Schließen',
        { duration: 5000, panelClass: ['error-snackbar'] }
      );
    } finally {
      this.loading.set(false);
    }
  }

  openCreateUserDialog(): void {
    const dialogRef = this.dialog.open(UserDialogComponent, {
      width: '600px',
      data: { mode: 'create' }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.loadUsers();
      }
    });
  }

  openEditUserDialog(user: AdminUser): void {
    const dialogRef = this.dialog.open(UserDialogComponent, {
      width: '600px',
      data: { mode: 'edit', user }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.loadUsers();
      }
    });
  }

  async deleteUser(user: AdminUser): Promise<void> {
    if (!confirm(`Möchten Sie den Benutzer "${user.email}" wirklich löschen?`)) {
      return;
    }

    try {
      await firstValueFrom(this.adminService.deleteUser(user.id));
      this.snackBar.open('Benutzer wurde erfolgreich gelöscht.', 'Schließen', {
        duration: 3000,
        panelClass: ['success-snackbar']
      });
      this.loadUsers();
    } catch (error: any) {
      console.error('Error deleting user:', error);
      this.snackBar.open(
        error.error?.error || 'Fehler beim Löschen des Benutzers.',
        'Schließen',
        { duration: 5000, panelClass: ['error-snackbar'] }
      );
    }
  }

  async resendVerificationEmail(user: AdminUser): Promise<void> {
    try {
      await firstValueFrom(this.adminService.resendVerificationEmail(user.id));
      this.snackBar.open('Verifizierungs-E-Mail wurde erfolgreich gesendet.', 'Schließen', {
        duration: 3000,
        panelClass: ['success-snackbar']
      });
    } catch (error: any) {
      console.error('Error resending verification email:', error);
      this.snackBar.open(
        error.error?.error || 'Fehler beim Versenden der Verifizierungs-E-Mail.',
        'Schließen',
        { duration: 5000, panelClass: ['error-snackbar'] }
      );
    }
  }

  async toggleUserActive(user: AdminUser): Promise<void> {
    try {
      await firstValueFrom(this.adminService.updateUser(user.id, { isActive: !user.isActive }));
      this.snackBar.open(
        `Benutzer wurde erfolgreich ${!user.isActive ? 'aktiviert' : 'deaktiviert'}.`,
        'Schließen',
        { duration: 3000, panelClass: ['success-snackbar'] }
      );
      this.loadUsers();
    } catch (error: any) {
      console.error('Error toggling user active:', error);
      this.snackBar.open(
        error.error?.error || 'Fehler beim Aktualisieren des Benutzers.',
        'Schließen',
        { duration: 5000, panelClass: ['error-snackbar'] }
      );
    }
  }

  formatDate(dateString: string | undefined): string {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  getUserName(user: AdminUser): string {
    if (user.firstName && user.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    if (user.firstName) return user.firstName;
    if (user.lastName) return user.lastName;
    return '-';
  }

  canDelete(user: AdminUser): boolean {
    return user.id !== this.authService.currentUser()?.id;
  }
}
