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
import { Api, PfkSchicht, PfkSeverity, PfkThresholdConfig } from '../../core/api';
import { KostenstelleDialogComponent, KostenstelleDialogResult } from './kostenstelle-dialog.component';
import type { PfkThresholdDialogResult } from './pfk-threshold-dialog.component';

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

  kostenstellen = signal<Kostenstelle[]>([]);
  dataSource = new MatTableDataSource<Kostenstelle>([]);
  loading = signal(false);
  saving = signal(false);
  selectedFile = signal<File | null>(null);
  
  displayedColumns: string[] = ['kostenstelle', 'stations', 'standorte', 'standortnummer', 'ik', 'paediatrie', 'actions'];

  stationOptions = signal<string[]>([]);
  pfkThresholds = signal<PfkThresholdConfig[]>([]);
  pfkThresholdDataSource = new MatTableDataSource<PfkThresholdConfig>([]);
  pfkThresholdColumns: string[] = ['station', 'schicht', 'year', 'months', 'limits', 'severity', 'recommendation', 'updatedAt', 'actions'];
  pfkThresholdsLoading = signal(false);
  pfkThresholdsSaving = signal(false);

  private readonly monthNames = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
  private readonly severityOrder: Record<PfkSeverity, number> = {
    critical: 0,
    warning: 1,
    info: 2
  };
  private readonly schichtOrder: Record<PfkSchicht, number> = {
    day: 0,
    night: 1
  };

  ngOnInit() {
    this.loadKostenstellen();
    void this.loadStationOptions();
    this.loadPfkThresholds();
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

  loadPfkThresholds() {
    this.pfkThresholdsLoading.set(true);
    this.api.getPfkThresholds().subscribe({
      next: (response) => {
        const sorted = this.sortThresholds(response.data ?? []);
        this.pfkThresholds.set(sorted);
        this.pfkThresholdDataSource.data = sorted;
        this.pfkThresholdsLoading.set(false);
      },
      error: (err) => {
        console.error('Error loading PFK thresholds:', err);
        this.snackBar.open('Fehler beim Laden der PFK-Grenzwerte', 'Schließen', { duration: 3000 });
        this.pfkThresholdsLoading.set(false);
      }
    });
  }

  openThresholdCreateDialog() {
    void this.openThresholdDialog();
  }

  openThresholdEditDialog(threshold: PfkThresholdConfig) {
    void this.openThresholdDialog(threshold);
  }

  private async openThresholdDialog(existing?: PfkThresholdConfig) {
    const { PfkThresholdDialogComponent } = await import('./pfk-threshold-dialog.component');
    const dialogRef = this.dialog.open(PfkThresholdDialogComponent, {
      width: '520px',
      data: {
        stationOptions: this.stationOptions(),
        threshold: existing ?? null
      }
    });

    dialogRef.afterClosed().subscribe((result: PfkThresholdDialogResult | null) => {
      if (!result) {
        return;
      }
      if (existing) {
        this.updatePfkThresholdEntry(existing.id, result);
      } else {
        this.createPfkThreshold(result);
      }
    });
  }

  deletePfkThreshold(threshold: PfkThresholdConfig) {
    if (!confirm(`Grenzwert für ${this.pfkSchichtLabel(threshold.schicht)} auf ${this.stationLabel(threshold.station)} wirklich löschen?`)) {
      return;
    }

    this.pfkThresholdsSaving.set(true);
    this.api.deletePfkThreshold(threshold.id).subscribe({
      next: () => {
        this.snackBar.open('Grenzwert gelöscht', 'Schließen', { duration: 3000 });
        this.pfkThresholdsSaving.set(false);
        this.loadPfkThresholds();
      },
      error: (err) => {
        console.error('Error deleting threshold:', err);
        const message = err.error?.error || err.message || 'Fehler beim Löschen des Grenzwerts';
        this.snackBar.open(message, 'Schließen', { duration: 4000 });
        this.pfkThresholdsSaving.set(false);
      }
    });
  }

  pfkSchichtLabel(schicht: PfkSchicht) {
    return schicht === 'night' ? 'Nacht' : 'Tag';
  }

  pfkSeverityLabel(severity: PfkSeverity) {
    switch (severity) {
      case 'critical':
        return 'Kritisch';
      case 'warning':
        return 'Warnung';
      default:
        return 'Info';
    }
  }

  pfkSeverityClass(severity: PfkSeverity) {
    return `severity-${severity}`;
  }

  monthLabel(month: number) {
    return this.monthNames[month - 1] ?? `M${month}`;
  }

  formatThresholdRange(threshold: PfkThresholdConfig) {
    const lower = this.formatThresholdValue(threshold.lowerLimit);
    const upper = this.formatThresholdValue(threshold.upperLimit);
    if (lower !== '–' && upper !== '–') {
      return `${lower} – ${upper}`;
    }
    if (lower !== '–') {
      return `≥ ${lower}`;
    }
    if (upper !== '–') {
      return `≤ ${upper}`;
    }
    return '–';
  }

  clearSelectedFile() {
    this.selectedFile.set(null);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    if (input) {
      input.value = '';
    }
  }

  private createPfkThreshold(result: PfkThresholdDialogResult) {
    this.pfkThresholdsSaving.set(true);
    const payload = this.buildThresholdPayload(result);
    this.api.createPfkThreshold(payload).subscribe({
      next: (response) => {
        this.snackBar.open('Grenzwert gespeichert', 'Schließen', { duration: 3000 });
        this.pfkThresholdsSaving.set(false);
        this.updateStationOptionsWith(response.data.station);
        this.loadPfkThresholds();
      },
      error: (err) => {
        console.error('Error creating threshold:', err);
        const message = err.error?.error || err.message || 'Fehler beim Speichern des Grenzwerts';
        this.snackBar.open(message, 'Schließen', { duration: 4000 });
        this.pfkThresholdsSaving.set(false);
      }
    });
  }

  private updatePfkThresholdEntry(id: string, result: PfkThresholdDialogResult) {
    this.pfkThresholdsSaving.set(true);
    const payload = this.buildThresholdPayload(result);
    this.api.updatePfkThreshold(id, payload).subscribe({
      next: (response) => {
        this.snackBar.open('Grenzwert aktualisiert', 'Schließen', { duration: 3000 });
        this.pfkThresholdsSaving.set(false);
        this.updateStationOptionsWith(response.data.station);
        this.loadPfkThresholds();
      },
      error: (err) => {
        console.error('Error updating threshold:', err);
        const message = err.error?.error || err.message || 'Fehler beim Aktualisieren des Grenzwerts';
        this.snackBar.open(message, 'Schließen', { duration: 4000 });
        this.pfkThresholdsSaving.set(false);
      }
    });
  }

  private buildThresholdPayload(result: PfkThresholdDialogResult) {
    const normalizeNumber = (value: number | null | undefined) => {
      if (value === null || value === undefined) return null;
      return Number.isFinite(value) ? Number(value) : null;
    };
    const year = normalizeNumber(result.year);
    const lower = normalizeNumber(result.lowerLimit);
    const upper = normalizeNumber(result.upperLimit);
    const months = Array.isArray(result.months)
      ? Array.from(new Set(result.months.filter((m) => Number.isInteger(m) && m >= 1 && m <= 12))).sort((a, b) => a - b)
      : [];

    return {
      station: this.normalizeStationInput(result.station),
      schicht: result.schicht,
      year,
      lowerLimit: lower,
      upperLimit: upper,
      recommendation: result.recommendation ?? null,
      note: result.note ?? null,
      severity: result.severity,
      months
    };
  }

  private normalizeStationInput(value: string) {
    const trimmed = (value ?? '').trim();
    if (!trimmed || trimmed === '*') {
      return '*';
    }
    return trimmed;
  }

  private updateStationOptionsWith(station: string) {
    const trimmed = this.normalizeStationInput(station);
    if (trimmed === '*') {
      return;
    }
    const current = new Set(this.stationOptions());
    if (!current.has(trimmed)) {
      current.add(trimmed);
      this.stationOptions.set(Array.from(current).sort((a, b) => a.localeCompare(b, 'de-DE')));
    }
  }

  private sortThresholds(thresholds: PfkThresholdConfig[]) {
    return [...thresholds].sort((a, b) => {
      const stationA = this.stationLabelForSort(a.station);
      const stationB = this.stationLabelForSort(b.station);
      const stationCompare = stationA.localeCompare(stationB, 'de-DE');
      if (stationCompare !== 0) {
        return stationCompare;
      }

      const schichtCompare = (this.schichtOrder[a.schicht] ?? 0) - (this.schichtOrder[b.schicht] ?? 0);
      if (schichtCompare !== 0) {
        return schichtCompare;
      }

      const severityCompare = (this.severityOrder[a.severity] ?? 0) - (this.severityOrder[b.severity] ?? 0);
      if (severityCompare !== 0) {
        return severityCompare;
      }

      const yearA = a.year ?? Number.MAX_SAFE_INTEGER;
      const yearB = b.year ?? Number.MAX_SAFE_INTEGER;
      return yearA - yearB;
    });
  }

  stationLabel(value: string) {
    return value === '*' ? 'Alle Stationen' : value;
  }

  private stationLabelForSort(value: string) {
    return value === '*' ? '0_Alle Stationen' : value;
  }

  private formatThresholdValue(value: number | null | undefined) {
    if (value === null || value === undefined) {
      return '–';
    }
    return value.toLocaleString('de-DE', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
  }
}
