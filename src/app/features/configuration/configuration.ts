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
import { StationMappingDialogComponent, StationMappingDialogResult } from './station-mapping-dialog.component';

interface Kostenstelle {
  kostenstelle: string;
  stations: string[];
  standorte: string[];
  standortnummer?: string | number | null;
  ik?: string | number | null;
  paediatrie?: string | null;
}

interface StationMapping {
  dienstplanStation: string;
  minaMitaStation?: string | null;
  beschreibung?: string | null;
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

  // Station Mapping
  stationMappings = signal<StationMapping[]>([]);
  stationMappingDataSource = new MatTableDataSource<StationMapping>([]);
  stationMappingLoading = signal(false);
  stationMappingSaving = signal(false);
  
  displayedStationMappingColumns: string[] = ['dienstplanStation', 'minaMitaStation', 'beschreibung', 'actions'];

  stationOptions = signal<string[]>([]);

  ngOnInit() {
    this.loadKostenstellen();
    this.loadStationMappings();
    void this.loadStationOptions();
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


  clearSelectedFile() {
    this.selectedFile.set(null);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    if (input) {
      input.value = '';
    }
  }

  // Station Mapping Methods
  loadStationMappings() {
    this.stationMappingLoading.set(true);
    this.api.getStationMapping().subscribe({
      next: (response) => {
        this.stationMappings.set(response.data);
        this.stationMappingDataSource.data = response.data;
        this.stationMappingLoading.set(false);
      },
      error: (err) => {
        console.error('Error loading station mappings:', err);
        this.snackBar.open('Fehler beim Laden der Stations-Mappings', 'Schließen', { duration: 3000 });
        this.stationMappingLoading.set(false);
      }
    });
  }

  openCreateStationMappingDialog() {
    this.openStationMappingDialog();
  }

  openEditStationMappingDialog(mapping: StationMapping) {
    this.openStationMappingDialog(mapping);
  }

  private openStationMappingDialog(existing?: StationMapping) {
    const dialogRef = this.dialog.open(StationMappingDialogComponent, {
      width: '520px',
      data: existing ? { ...existing } : null
    });

    dialogRef.afterClosed().subscribe((result: StationMappingDialogResult | null) => {
      if (!result) {
        return;
      }
      
      if (existing) {
        this.updateStationMapping(result);
      } else {
        this.saveStationMapping(result);
      }
    });
  }

  private saveStationMapping(result: StationMappingDialogResult) {
    this.stationMappingSaving.set(true);

    const payload = {
      dienstplanStation: result.dienstplanStation,
      minaMitaStation: result.minaMitaStation,
      beschreibung: result.beschreibung
    };

    this.api.saveStationMapping(payload).subscribe({
      next: (response) => {
        this.snackBar.open(response.message, 'Schließen', { duration: 3000 });
        this.stationMappingSaving.set(false);
        this.loadStationMappings();
      },
      error: (err) => {
        console.error('Error saving station mapping:', err);
        const errorMessage = err.error?.error || err.message || 'Fehler beim Speichern';
        this.snackBar.open(errorMessage, 'Schließen', { duration: 5000 });
        this.stationMappingSaving.set(false);
      }
    });
  }

  private updateStationMapping(result: StationMappingDialogResult) {
    this.stationMappingSaving.set(true);

    const payload = {
      minaMitaStation: result.minaMitaStation,
      beschreibung: result.beschreibung
    };

    this.api.updateStationMapping(result.dienstplanStation, payload).subscribe({
      next: (response) => {
        this.snackBar.open(response.message, 'Schließen', { duration: 3000 });
        this.stationMappingSaving.set(false);
        this.loadStationMappings();
      },
      error: (err) => {
        console.error('Error updating station mapping:', err);
        const errorMessage = err.error?.error || err.message || 'Fehler beim Aktualisieren';
        this.snackBar.open(errorMessage, 'Schließen', { duration: 5000 });
        this.stationMappingSaving.set(false);
      }
    });
  }

  deleteStationMapping(dienstplanStation: string) {
    if (!confirm(`Möchten Sie das Mapping für Station "${dienstplanStation}" wirklich löschen?`)) {
      return;
    }

    this.stationMappingSaving.set(true);

    this.api.deleteStationMapping(dienstplanStation).subscribe({
      next: (response) => {
        this.snackBar.open(response.message, 'Schließen', { duration: 3000 });
        this.stationMappingSaving.set(false);
        this.loadStationMappings();
      },
      error: (err) => {
        console.error('Error deleting station mapping:', err);
        const errorMessage = err.error?.error || err.message || 'Fehler beim Löschen';
        this.snackBar.open(errorMessage, 'Schließen', { duration: 3000 });
        this.stationMappingSaving.set(false);
      }
    });
  }

  importStationMappingsFromJson() {
    if (!confirm('Möchten Sie die Stations-Mappings aus der JSON-Datei importieren? Bestehende Einträge werden aktualisiert.')) {
      return;
    }

    this.stationMappingLoading.set(true);
    this.api.importStationMappingFromJson().subscribe({
      next: (response) => {
        this.stationMappingLoading.set(false);
        this.snackBar.open(`${response.message} (${response.imported} importiert, ${response.skipped} übersprungen)`, 'Schließen', { duration: 5000 });
        this.loadStationMappings();
      },
      error: (err) => {
        this.stationMappingLoading.set(false);
        console.error('Error importing station mappings:', err);
        const errorMessage = err.error?.error || err.message || 'Fehler beim Importieren';
        this.snackBar.open(errorMessage, 'Schließen', { duration: 5000 });
      }
    });
  }

}
