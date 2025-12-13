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
import { Api, CalculationConstant } from '../../core/api';
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
  
  displayedColumns: string[] = ['kostenstelle', 'stations', 'standorte', 'standortnummer', 'ik', 'paediatrie', 'actions'];

  stationOptions = signal<string[]>([]);

  // Backup
  creatingBackup = signal(false);
  backups = signal<Array<{ name: string; timestamp: string; size: number; sizeFormatted: string }>>([]);
  loadingBackups = signal(false);

  // Calculation Constants
  constants = signal<CalculationConstant[]>([]);
  loadingConstants = signal(false);
  savingConstants = signal(false);
  editingValues: Record<string, number | undefined> = {};

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
    this.loadConstants();
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

  // Calculation Constants Methods
  loadConstants() {
    this.loadingConstants.set(true);
    this.api.getCalculationConstants().subscribe({
      next: (response) => {
        this.constants.set(response.data);
        // Initialize editing values with current values
        this.editingValues = {};
        response.data.forEach(c => {
          this.editingValues[c.key] = c.value;
        });
        this.loadingConstants.set(false);
      },
      error: (err) => {
        console.error('Error loading calculation constants:', err);
        this.snackBar.open('Fehler beim Laden der Berechnungskonstanten', 'Schließen', { duration: 3000 });
        this.loadingConstants.set(false);
      }
    });
  }

  onConstantValueChange(key: string, event: Event) {
    const input = event.target as HTMLInputElement;
    const value = parseFloat(input.value);
    if (!isNaN(value)) {
      this.editingValues[key] = value;
    }
  }

  hasChanges(): boolean {
    return this.constants().some(c => {
      if (!c.is_editable) return false;
      const currentValue = this.editingValues[c.key];
      return currentValue !== undefined && currentValue !== c.value;
    });
  }

  resetConstants() {
    this.constants().forEach(c => {
      this.editingValues[c.key] = c.value;
    });
  }

  saveConstants() {
    if (!this.hasChanges()) {
      return;
    }

    this.savingConstants.set(true);
    const constantsToUpdate = this.constants().filter(c => {
      if (!c.is_editable) return false;
      const newValue = this.editingValues[c.key];
      return newValue !== undefined && newValue !== c.value;
    });

    const updatePromises = constantsToUpdate.map(c => {
      const newValue = this.editingValues[c.key];
      if (newValue === undefined) {
        throw new Error(`Value for constant ${c.key} is undefined`);
      }
      return firstValueFrom(this.api.updateCalculationConstant(c.key, newValue));
    });

    Promise.all(updatePromises).then(() => {
      this.savingConstants.set(false);
      this.snackBar.open(
        `${constantsToUpdate.length} Konstante(n) erfolgreich aktualisiert`,
        'Schließen',
        { duration: 3000 }
      );
      this.loadConstants(); // Reload to get updated values
    }).catch((err) => {
      console.error('Error saving calculation constants:', err);
      this.savingConstants.set(false);
      const errorMessage = err.error?.error || err.message || 'Fehler beim Speichern der Konstanten';
      this.snackBar.open(errorMessage, 'Schließen', { duration: 5000 });
    });
  }

}
