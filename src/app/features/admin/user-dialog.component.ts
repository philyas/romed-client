import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, AbstractControl, ValidationErrors } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AdminService, AdminUser, CreateUserRequest, UpdateUserRequest } from '../../core/admin.service';
import { firstValueFrom } from 'rxjs';

export interface UserDialogData {
  mode: 'create' | 'edit';
  user?: AdminUser;
}

@Component({
  selector: 'app-user-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatCheckboxModule,
    MatSnackBarModule,
    MatProgressSpinnerModule
  ],
  template: `
    <h2 mat-dialog-title>
      <mat-icon>{{ data.mode === 'create' ? 'person_add' : 'edit' }}</mat-icon>
      {{ data.mode === 'create' ? 'Neuen Benutzer anlegen' : 'Benutzer bearbeiten' }}
    </h2>

    <mat-dialog-content>
      <form [formGroup]="userForm" class="user-form">
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>E-Mail</mat-label>
          <input matInput type="email" formControlName="email" required>
          <mat-icon matPrefix>email</mat-icon>
          @if (userForm.get('email')?.hasError('required') && userForm.get('email')?.touched) {
            <mat-error>E-Mail ist erforderlich</mat-error>
          }
          @if (userForm.get('email')?.hasError('email') && userForm.get('email')?.touched) {
            <mat-error>Ungültige E-Mail-Adresse</mat-error>
          }
        </mat-form-field>

        <div class="form-row">
          <mat-form-field appearance="outline" class="half-width">
            <mat-label>Vorname</mat-label>
            <input matInput formControlName="firstName">
            <mat-icon matPrefix>person</mat-icon>
          </mat-form-field>

          <mat-form-field appearance="outline" class="half-width">
            <mat-label>Nachname</mat-label>
            <input matInput formControlName="lastName">
            <mat-icon matPrefix>person</mat-icon>
          </mat-form-field>
        </div>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Rolle</mat-label>
          <mat-select formControlName="role" required>
            <mat-option value="viewer">Betrachter</mat-option>
            <mat-option value="admin">Administrator</mat-option>
          </mat-select>
          <mat-icon matPrefix>security</mat-icon>
          @if (userForm.get('role')?.hasError('required') && userForm.get('role')?.touched) {
            <mat-error>Rolle ist erforderlich</mat-error>
          }
        </mat-form-field>

        @if (data.mode === 'create') {
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Passwort (optional)</mat-label>
            <input
              matInput
              [type]="hidePassword() ? 'password' : 'text'"
              formControlName="password">
            <mat-icon matPrefix>lock</mat-icon>
            <button
              mat-icon-button
              matSuffix
              (click)="hidePassword.set(!hidePassword())"
              type="button">
              <mat-icon>{{ hidePassword() ? 'visibility_off' : 'visibility' }}</mat-icon>
            </button>
            <mat-hint>Wenn kein Passwort angegeben wird, muss der Benutzer es beim Verifizieren der E-Mail setzen.</mat-hint>
            @if (userForm.get('password')?.hasError('minlength') && userForm.get('password')?.touched) {
              <mat-error>Das Passwort muss mindestens 8 Zeichen lang sein</mat-error>
            }
          </mat-form-field>

          <mat-checkbox formControlName="emailVerified" class="full-width">
            E-Mail als verifiziert markieren (User kann direkt einloggen)
          </mat-checkbox>

          <mat-checkbox formControlName="sendVerificationEmail" class="full-width">
            Verifizierungs-E-Mail beim Anlegen senden
          </mat-checkbox>
        }

        @if (data.mode === 'edit') {
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Status</mat-label>
            <mat-select formControlName="isActive">
              <mat-option [value]="true">Aktiv</mat-option>
              <mat-option [value]="false">Inaktiv</mat-option>
            </mat-select>
            <mat-icon matPrefix>toggle_on</mat-icon>
          </mat-form-field>
        }
      </form>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close [disabled]="saving()">
        Abbrechen
      </button>
      <button
        mat-raised-button
        color="primary"
        (click)="onSubmit()"
        [disabled]="userForm.invalid || saving()">
        @if (saving()) {
          <mat-spinner diameter="20" style="display: inline-block; margin-right: 8px;"></mat-spinner>
        }
        {{ data.mode === 'create' ? 'Anlegen' : 'Speichern' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    h2 {
      display: flex;
      align-items: center;
      gap: 12px;
      margin: 0;
      font-weight: 600;
      color: #1976d2;
    }

    mat-icon {
      color: #1976d2;
    }

    mat-dialog-content {
      min-width: 500px;
      max-height: 70vh;
      overflow-y: auto;
      padding: 24px !important;
    }

    .user-form {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .full-width {
      width: 100%;
    }

    .form-row {
      display: flex;
      gap: 16px;
    }

    .half-width {
      flex: 1;
    }

    mat-checkbox {
      margin-top: 8px;
    }

    mat-dialog-actions {
      padding: 16px 24px !important;
      border-top: 1px solid #e0e0e0;
    }

    @media (max-width: 600px) {
      mat-dialog-content {
        min-width: auto;
        padding: 16px !important;
      }

      .form-row {
        flex-direction: column;
      }

      .half-width {
        width: 100%;
      }
    }
  `]
})
export class UserDialogComponent implements OnInit {
  private fb = inject(FormBuilder);
  private adminService = inject(AdminService);
  private dialogRef = inject(MatDialogRef<UserDialogComponent>);
  private snackBar = inject(MatSnackBar);
  readonly data = inject(MAT_DIALOG_DATA);

  userForm: FormGroup;
  saving = signal(false);
  hidePassword = signal(true);

  constructor() {
    this.userForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      firstName: [''],
      lastName: [''],
      role: ['viewer', [Validators.required]],
      ...(this.data.mode === 'create' ? {
        password: ['', [this.passwordValidator]],
        emailVerified: [false],
        sendVerificationEmail: [false]
      } : {
        isActive: [true]
      })
    });
  }

  ngOnInit(): void {
    if (this.data.mode === 'edit' && this.data.user) {
      this.userForm.patchValue({
        email: this.data.user.email,
        firstName: this.data.user.firstName || '',
        lastName: this.data.user.lastName || '',
        role: this.data.user.role,
        isActive: this.data.user.isActive
      });
    }
  }

  passwordValidator(control: AbstractControl): ValidationErrors | null {
    if (!control.value || control.value.length === 0) {
      return null; // Password is optional
    }
    if (control.value.length < 8) {
      return { minlength: { requiredLength: 8, actualLength: control.value.length } };
    }
    return null;
  }

  async onSubmit(): Promise<void> {
    if (this.userForm.invalid) {
      this.userForm.markAllAsTouched();
      return;
    }

    this.saving.set(true);

    try {
      const formValue = this.userForm.value;

      if (this.data.mode === 'create') {
        const createData: CreateUserRequest = {
          email: formValue.email,
          firstName: formValue.firstName || undefined,
          lastName: formValue.lastName || undefined,
          role: formValue.role,
          password: formValue.password || undefined,
          emailVerified: formValue.emailVerified,
          sendVerificationEmail: formValue.sendVerificationEmail
        };

        await firstValueFrom(this.adminService.createUser(createData));
        this.snackBar.open('Benutzer wurde erfolgreich angelegt.', 'Schließen', {
          duration: 3000,
          panelClass: ['success-snackbar']
        });
        this.dialogRef.close(true);
      } else {
        const updateData: UpdateUserRequest = {
          firstName: formValue.firstName || undefined,
          lastName: formValue.lastName || undefined,
          role: formValue.role,
          isActive: formValue.isActive
        };

        await firstValueFrom(this.adminService.updateUser(this.data.user!.id, updateData));
        this.snackBar.open('Benutzer wurde erfolgreich aktualisiert.', 'Schließen', {
          duration: 3000,
          panelClass: ['success-snackbar']
        });
        this.dialogRef.close(true);
      }
    } catch (error: any) {
      console.error('Error saving user:', error);
      this.snackBar.open(
        error.error?.error || 'Fehler beim Speichern des Benutzers.',
        'Schließen',
        { duration: 5000, panelClass: ['error-snackbar'] }
      );
    } finally {
      this.saving.set(false);
    }
  }
}
