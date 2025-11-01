import { Component, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTabsModule } from '@angular/material/tabs';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { FormsModule } from '@angular/forms';
import { Api } from '../../core/api';

interface Kostenstelle {
  kostenstelle: string;
  stations: string[];
  standorte: string[];
  standortnummer?: number | null;
  ik?: number | null;
  paediatrie?: string | null;
}

@Component({
  selector: 'app-configuration',
  imports: [
    CommonModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatTabsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatTableModule,
    MatDialogModule,
    MatSnackBarModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    FormsModule
  ],
  templateUrl: './configuration.html',
  styleUrl: './configuration.scss'
})
export class Configuration implements OnInit {
  private api = inject(Api);
  private snackBar = inject(MatSnackBar);
  private dialog = inject(MatDialog);

  kostenstellen = signal<Kostenstelle[]>([]);
  dataSource = new MatTableDataSource<Kostenstelle>([]);
  loading = signal(false);
  selectedFile = signal<File | null>(null);
  
  displayedColumns: string[] = ['kostenstelle', 'stations', 'standorte', 'standortnummer', 'ik', 'paediatrie', 'actions'];

  ngOnInit() {
    this.loadKostenstellen();
  }

  loadKostenstellen() {
    this.loading.set(true);
    this.api.getKostenstellenMapping().subscribe({
      next: (response) => {
        this.kostenstellen.set(response.data);
        this.dataSource.data = response.data;
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Error loading kostenstellen:', err);
        this.snackBar.open('Fehler beim Laden der Kostenstellen', 'Schließen', { duration: 3000 });
        this.loading.set(false);
      }
    });
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
        this.snackBar.open('Bitte wählen Sie eine Excel-Datei (.xlsx oder .xls)', 'Schließen', { duration: 3000 });
        return;
      }
      this.selectedFile.set(file);
    }
  }

  importFromFile() {
    const file = this.selectedFile();
    if (!file) {
      this.snackBar.open('Bitte wählen Sie eine Datei aus', 'Schließen', { duration: 3000 });
      return;
    }

    this.loading.set(true);
    this.api.importKostenstellenFromFile(file).subscribe({
      next: (response) => {
        this.loading.set(false);
        this.snackBar.open(response.message, 'Schließen', { duration: 3000 });
        this.selectedFile.set(null);
        this.loadKostenstellen();
      },
      error: (err) => {
        this.loading.set(false);
        console.error('Error importing kostenstellen:', err);
        const errorMessage = err.error?.error || err.message || 'Fehler beim Importieren';
        this.snackBar.open(errorMessage, 'Schließen', { duration: 5000 });
      }
    });
  }

  importFromSample() {
    if (!confirm('Möchten Sie die Beispieldatei importieren? Alle vorhandenen Daten werden überschrieben.')) {
      return;
    }

    this.loading.set(true);
    this.api.importKostenstellenFromSample().subscribe({
      next: (response) => {
        this.loading.set(false);
        this.snackBar.open(response.message, 'Schließen', { duration: 3000 });
        this.loadKostenstellen();
      },
      error: (err) => {
        this.loading.set(false);
        console.error('Error importing sample:', err);
        const errorMessage = err.error?.error || err.message || 'Fehler beim Importieren';
        this.snackBar.open(errorMessage, 'Schließen', { duration: 5000 });
      }
    });
  }

  deleteKostenstelle(kostenstelle: string) {
    if (!confirm(`Möchten Sie die Kostenstelle ${kostenstelle} wirklich löschen?`)) {
      return;
    }

    this.api.deleteKostenstelle(kostenstelle).subscribe({
      next: (response) => {
        this.snackBar.open(response.message, 'Schließen', { duration: 3000 });
        this.loadKostenstellen();
      },
      error: (err) => {
        console.error('Error deleting kostenstelle:', err);
        const errorMessage = err.error?.error || err.message || 'Fehler beim Löschen';
        this.snackBar.open(errorMessage, 'Schließen', { duration: 3000 });
      }
    });
  }

  clearSelectedFile() {
    this.selectedFile.set(null);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    if (input) {
      input.value = '';
    }
  }
}
