import { Component, signal, computed, inject, effect } from '@angular/core';
import { RouterOutlet, RouterLinkActive, RouterLink } from '@angular/router';
import { Router, NavigationEnd } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { CommonModule } from '@angular/common';
import { AuthService } from './core/auth.service';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLinkActive, RouterLink, MatIconModule, MatButtonModule, MatMenuModule, MatDividerModule, CommonModule],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('frontend');
  menuOpen = signal(false);
  currentUrl = signal('');
  private router = inject(Router);
  private authService = inject(AuthService);
  
  // Computed signals
  currentUser = this.authService.currentUser;
  isAuthenticated = this.authService.isAuthenticated;
  isAdmin = this.authService.isAdmin;
  
  // Check if we're on auth pages (login, register, verify-email)
  isAuthPage = computed(() => {
    const url = this.currentUrl();
    return url.startsWith('/login') || url.startsWith('/register') || url.startsWith('/verify-email');
  });

  constructor() {
    // Update current URL on route changes
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: NavigationEnd) => {
        this.currentUrl.set(event.urlAfterRedirects);
      });
    
    // Set initial URL
    if (typeof window !== 'undefined') {
      this.currentUrl.set(this.router.url);
    }
  }

  isManualEntryActive(): boolean {
    const url = this.router.url || '';
    return url.startsWith('/manual-entry') || url.startsWith('/manual-entry-nacht');
  }

  toggleMenu() {
    this.menuOpen.set(!this.menuOpen());
  }

  closeMenu() {
    this.menuOpen.set(false);
  }

  logout() {
    this.authService.logout();
    this.closeMenu();
  }

  getUserDisplayName(): string {
    const user = this.currentUser();
    if (!user) return '';
    if (user.firstName || user.lastName) {
      return `${user.firstName || ''} ${user.lastName || ''}`.trim();
    }
    return user.email;
  }
}
