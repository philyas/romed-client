import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AbstractControl, FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../../core/auth.service';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-verify-email',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatIconModule,
    MatSnackBarModule,
    MatFormFieldModule,
    MatInputModule,
    MatCardModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './verify-email.html',
  styleUrl: './verify-email.scss'
})
export class VerifyEmailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private authService = inject(AuthService);
  private snackBar = inject(MatSnackBar);
  private fb = inject(FormBuilder);

  isVerifying = signal(false);
  isVerified = signal(false);
  needsPassword = signal(false);
  error = signal<string | null>(null);
  verificationToken = signal<string | null>(null);
  
  passwordForm: FormGroup;
  hidePassword = signal(true);
  hideConfirmPassword = signal(true);
  settingPassword = signal(false);

  passwordMatchValidator = (control: AbstractControl): { [key: string]: any } | null => {
    const password = control.get('password');
    const confirmPassword = control.get('confirmPassword');
    
    if (!password || !confirmPassword) {
      return null;
    }
    
    return password.value === confirmPassword.value ? null : { passwordMismatch: true };
  };

  constructor() {
    this.passwordForm = this.fb.group({
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required]]
    }, { validators: this.passwordMatchValidator.bind(this) });
  }

  ngOnInit(): void {
    const token = this.route.snapshot.queryParams['token'];
    if (token) {
      this.verificationToken.set(token);
      this.verifyEmail(token);
    } else {
      this.error.set('Kein Verifizierungstoken gefunden.');
    }
  }


  verifyEmail(token: string): void {
    this.isVerifying.set(true);
    this.error.set(null);

    this.authService.verifyEmail(token).subscribe({
      next: (response) => {
        this.isVerifying.set(false);
        
        if (response.needsPassword) {
          this.needsPassword.set(true);
          this.verificationToken.set(response.token || token);
        } else {
          this.isVerified.set(true);
          this.snackBar.open(response.message || 'E-Mail-Adresse erfolgreich verifiziert!', 'Schließen', {
            duration: 5000,
            panelClass: ['success-snackbar']
          });
          
          // Redirect to login after 2 seconds
          setTimeout(() => {
            this.router.navigate(['/login']);
          }, 2000);
        }
      },
      error: (error) => {
        this.isVerifying.set(false);
        const errorMessage = error.error?.error || 'E-Mail-Verifizierung fehlgeschlagen.';
        this.error.set(errorMessage);
        this.snackBar.open(errorMessage, 'Schließen', {
          duration: 5000,
          panelClass: ['error-snackbar']
        });
      }
    });
  }

  async setPassword(): Promise<void> {
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      return;
    }

    const token = this.verificationToken();
    if (!token) {
      this.error.set('Kein Verifizierungstoken verfügbar.');
      return;
    }

    this.settingPassword.set(true);
    this.error.set(null);

    try {
      const password = this.passwordForm.get('password')?.value;
      const response = await firstValueFrom(this.authService.verifyEmail(token, password));
      
      this.settingPassword.set(false);
      this.isVerified.set(true);
      this.needsPassword.set(false);
      
      this.snackBar.open(response?.message || 'Passwort wurde gesetzt und E-Mail-Adresse verifiziert!', 'Schließen', {
        duration: 5000,
        panelClass: ['success-snackbar']
      });
      
      // Redirect to login after 2 seconds
      setTimeout(() => {
        this.router.navigate(['/login']);
      }, 2000);
    } catch (error: any) {
      this.settingPassword.set(false);
      const errorMessage = error.error?.error || 'Fehler beim Setzen des Passworts.';
      this.error.set(errorMessage);
      this.snackBar.open(errorMessage, 'Schließen', {
        duration: 5000,
        panelClass: ['error-snackbar']
      });
    }
  }

  goToLogin(): void {
    this.router.navigate(['/login']);
  }
}
