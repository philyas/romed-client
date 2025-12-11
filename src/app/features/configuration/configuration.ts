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
import { firstValueFrom } from 'rxjs';
import { Api } from '../../core/api';
import { KostenstelleDialogComponent, KostenstelleDialogResult } from './kostenstelle-dialog.component';

interface Kostenstelle {
  kostenstelle: string;
  stations: string[];
  standorte: string[];
  standortnummer?: string | number | null;
  ik?: string | number | null;
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

  searchTerm = signal('');
  kostenstellen = signal<Kostenstelle[]>([]);
  dataSource = new MatTableDataSource<Kostenstelle>([]);
  loading = signal(false);
  saving = signal(false);
  selectedFile = signal<File | null>(null);
  
  displayedColumns: string[] = ['kostenstelle', 'stations', 'standorte', 'standortnummer', 'ik', 'paediatrie', 'actions'];

  stationOptions = signal<string[]>([]);

  // Backup
  creatingBackup = signal(false);
  backups = signal<Array<{ name: string; timestamp: string; size: number; sizeFormatted: string }>>([]);
  loadingBackups = signal(false);

  ngOnInit() {
    this.dataSource.filterPredicate = (data, filter) => {
      if (!filter) return true;
      const term = filter.trim().toLowerCase();
      const fields = [
        data.kostenstelle,
        ...(data.stations || []),
        ...(data.standorte || []),
        data.standortnummer ?? '',
        data.ik ?? '',
        data.paediatrie ?? ''
      ];
      return fields.some(f => (f ?? '').toString().toLowerCase().includes(term));
    };
    this.loadKostenstellen();
    void this.loadStationOptions();
    this.loadBackups();
  }

  loadKostenstellen() {
    this.loading.set(true);
    this.api.getKostenstellenMapping().subscribe({
      next: (response) => {
        this.kostenstellen.set(response.data);
        this.dataSource.data = response.data;
        // Reapply filter after data reload so search stays consistent
        this.applyFilter(this.searchTerm());
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Error loading kostenstellen:', err);
        this.snackBar.open('Fehler beim Laden der Kostenstellen', 'Schließen', { duration: 3000 });
        this.loading.set(false);
      }
    });
  }

  openCreateDialog() {
    this.openDialog();
  }

  openEditDialog(kostenstelle: Kostenstelle) {
    this.openDialog(kostenstelle);
  }

  private openDialog(existing?: Kostenstelle) {
    const dialogRef = this.dialog.open(KostenstelleDialogComponent, {
      width: '520px',
      data: existing ? { ...existing } : null
    });

    dialogRef.afterClosed().subscribe((result: KostenstelleDialogResult | null) => {
      if (!result) {
        return;
      }
      this.saveKostenstelle(result);
    });
  }

  private saveKostenstelle(result: KostenstelleDialogResult) {
    this.saving.set(true);

    const payload = {
      kostenstelle: result.kostenstelle,
      stations: result.stations,
      standorte: result.standorte,
      standortnummer: result.standortnummer,
      ik: result.ik,
      paediatrie: result.paediatrie
    };

    this.api.saveKostenstelle(payload).subscribe({
      next: (response) => {
        this.snackBar.open(response.message, 'Schließen', { duration: 3000 });
        this.saving.set(false);
        this.loadKostenstellen();
      },
      error: (err) => {
        console.error('Error saving kostenstelle:', err);
        const errorMessage = err.error?.error || err.message || 'Fehler beim Speichern';
        this.snackBar.open(errorMessage, 'Schließen', { duration: 5000 });
        this.saving.set(false);
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

    this.saving.set(true);

    this.api.deleteKostenstelle(kostenstelle).subscribe({
      next: (response) => {
        this.snackBar.open(response.message, 'Schließen', { duration: 3000 });
        this.saving.set(false);
        this.loadKostenstellen();
      },
      error: (err) => {
        console.error('Error deleting kostenstelle:', err);
        const errorMessage = err.error?.error || err.message || 'Fehler beim Löschen';
        this.snackBar.open(errorMessage, 'Schließen', { duration: 3000 });
        this.saving.set(false);
      }
    });
  }

  async loadStationOptions() {
    try {
      const [day, night] = await Promise.all([
        firstValueFrom(this.api.getManualEntryStations()),
        firstValueFrom(this.api.getManualEntryNachtStations())
      ]);
      const stations = new Set<string>([
        ...(day?.stations ?? []),
        ...(night?.stations ?? [])
      ]);
      const sorted = Array.from(stations).sort((a, b) => a.localeCompare(b, 'de-DE'));
      this.stationOptions.set(sorted);
    } catch (error) {
      console.error('Fehler beim Laden der Stationsliste:', error);
    }
  }


  clearSelectedFile() {
    this.selectedFile.set(null);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    if (input) {
      input.value = '';
    }
  }

  // Backup Methods
  createBackup() {
    if (!confirm('Möchten Sie ein SQL-Backup der Datenbank erstellen? Dies kann einige Minuten dauern.')) {
      return;
    }

    this.creatingBackup.set(true);
    this.api.createSqlBackup().subscribe({
      next: (response) => {
        this.creatingBackup.set(false);
        this.snackBar.open(
          `SQL-Backup erfolgreich erstellt: ${response.backup.name} (${response.backup.sizeFormatted})`,
          'Schließen',
          { duration: 5000 }
        );
        this.loadBackups();
      },
      error: (err) => {
        this.creatingBackup.set(false);
        console.error('Error creating backup:', err);
        const errorMessage = err.error?.error || err.error?.message || err.message || 'Fehler beim Erstellen des Backups';
        this.snackBar.open(errorMessage, 'Schließen', { duration: 5000 });
      }
    });
  }

  loadBackups() {
    this.loadingBackups.set(true);
    this.api.listSqlBackups().subscribe({
      next: (response) => {
        this.backups.set(response.backups);
        this.loadingBackups.set(false);
      },
      error: (err) => {
        console.error('Error loading backups:', err);
        this.snackBar.open('Fehler beim Laden der Backups', 'Schließen', { duration: 3000 });
        this.loadingBackups.set(false);
      }
    });
  }

  applyFilter(value: string) {
    const filterValue = (value || '').trim().toLowerCase();
    this.searchTerm.set(filterValue);
    this.dataSource.filter = filterValue;
  }

  downloadBackup(backupName: string) {
    this.api.downloadSqlBackup(backupName).subscribe({
      next: (blob) => {
        // Create a download link
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = backupName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        this.snackBar.open(`Backup "${backupName}" wird heruntergeladen`, 'Schließen', { duration: 2000 });
      },
      error: (err) => {
        console.error('Error downloading backup:', err);
        const errorMessage = err.error?.error || err.error?.message || err.message || 'Fehler beim Herunterladen des Backups';
        this.snackBar.open(errorMessage, 'Schließen', { duration: 5000 });
      }
    });
  }

}
