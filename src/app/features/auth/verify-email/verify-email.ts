import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { AuthService } from '../../../core/auth.service';

@Component({
  selector: 'app-verify-email',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatSnackBarModule
  ],
  templateUrl: './verify-email.html',
  styleUrl: './verify-email.scss'
})
export class VerifyEmailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private authService = inject(AuthService);
  private snackBar = inject(MatSnackBar);

  isVerifying = signal(false);
  isVerified = signal(false);
  error = signal<string | null>(null);

  ngOnInit(): void {
    const token = this.route.snapshot.queryParams['token'];
    if (token) {
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
        this.isVerified.set(true);
        this.snackBar.open(response.message || 'E-Mail-Adresse erfolgreich verifiziert!', 'Schließen', {
          duration: 5000,
          panelClass: ['success-snackbar']
        });
        
        // Redirect to login after 2 seconds
        setTimeout(() => {
          this.router.navigate(['/login']);
        }, 2000);
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

  goToLogin(): void {
    this.router.navigate(['/login']);
  }
}
