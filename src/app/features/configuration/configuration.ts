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
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { Api } from '../../core/api';
import { KostenstelleDialogComponent, KostenstelleDialogResult } from './kostenstelle-dialog.component';
import { StationConfigEditDialogComponent } from './station-config-edit-dialog.component';

interface Kostenstelle {
  kostenstelle: string;
  stations: string[];
  standorte: string[];
  standortnummer?: string | number | null;
  ik?: string | number | null;
  paediatrie?: string | null;
  include_in_statistics?: boolean;
}

interface StationConfigValues {
  schicht_stunden: number;
  phk_anteil_base: number | null;
  pp_ratio_base: number;
}

interface StationConfig {
  station: string;
  tag_pfk: StationConfigValues | null;
  nacht_pfk: StationConfigValues | null;
  tag_phk: StationConfigValues | null;
  nacht_phk: StationConfigValues | null;
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
    MatSlideToggleModule,
    MatButtonToggleModule,
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

  // Filter for statistics inclusion
  statisticsFilter = signal<'all' | 'included' | 'excluded'>('all');

  // Station search
  stationSearchTerm = signal('');
  filteredStationConfigs = signal<StationConfig[]>([]);
  
  displayedColumns: string[] = ['kostenstelle', 'stations', 'standorte', 'standortnummer', 'ik', 'paediatrie', 'include_in_statistics', 'actions'];

  stationOptions = signal<string[]>([]);

  // Backup
  creatingBackup = signal(false);
  backups = signal<Array<{ name: string; timestamp: string; size: number; sizeFormatted: string }>>([]);
  loadingBackups = signal(false);

  // Station Config
  stationConfigs = signal<StationConfig[]>([]);
  loadingStationConfigs = signal(false);
  savingStationConfig = signal(false);

  ngOnInit() {
    this.dataSource.filterPredicate = (data, filter) => {
      if (!filter) return true;

      // Apply text search
      const term = filter.trim().toLowerCase();
      const matchesSearch = !term ||
        data.kostenstelle.toLowerCase().includes(term) ||
        data.stations.some(station => station.toLowerCase().includes(term)) ||
        data.standorte.some(standort => standort.toLowerCase().includes(term));

      // Apply statistics filter
      const statsFilter = this.statisticsFilter();
      const matchesStats = statsFilter === 'all' ||
        (statsFilter === 'included' && (data.include_in_statistics ?? true)) ||
        (statsFilter === 'excluded' && !(data.include_in_statistics ?? true));

      return matchesSearch && matchesStats;
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
    this.loadStationConfigs();
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

  toggleIncludeInStatistics(item: Kostenstelle, include: boolean) {
    this.saving.set(true);
    const updateData = {
      kostenstelle: item.kostenstelle,
      stations: item.stations,
      standorte: item.standorte,
      standortnummer: item.standortnummer,
      ik: item.ik,
      paediatrie: item.paediatrie,
      include_in_statistics: include
    };

    this.api.saveKostenstelle(updateData).subscribe({
      next: () => {
        this.snackBar.open(`Kostenstelle ${include ? 'wird nun' : 'wird nicht mehr'} in Statistiken berücksichtigt`, 'Schließen', { duration: 2000 });
        this.loadKostenstellen();
        this.saving.set(false);
      },
      error: (err) => {
        console.error('Error updating kostenstelle:', err);
        const errorMessage = err.error?.error || err.message || 'Fehler beim Aktualisieren';
        this.snackBar.open(errorMessage, 'Schließen', { duration: 3000 });
        this.saving.set(false);
        // Revert the toggle on error
        this.loadKostenstellen();
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
    this.updateCombinedFilter();
  }

  applyStatisticsFilter(filterValue: 'all' | 'included' | 'excluded') {
    this.statisticsFilter.set(filterValue);
    this.updateCombinedFilter();
  }

  private updateCombinedFilter() {
    // Trigger filter update by setting filter to current search term
    this.dataSource.filter = this.searchTerm();
  }

  applyStationFilter(value: string) {
    const filterValue = (value || '').trim().toLowerCase();
    this.stationSearchTerm.set(filterValue);

    if (!filterValue) {
      this.filteredStationConfigs.set(this.stationConfigs());
    } else {
      const filtered = this.stationConfigs().filter(stationConfig =>
        stationConfig.station.toLowerCase().includes(filterValue)
      );
      this.filteredStationConfigs.set(filtered);
    }
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

  // Station Config Methods
  refreshStationConfigs() {
    this.loadStationConfigs();
  }

  loadStationConfigs() {
    this.loadingStationConfigs.set(true);
    // Get all stations from both day and night manual entry
    Promise.all([
      firstValueFrom(this.api.getManualEntryStations()),
      firstValueFrom(this.api.getManualEntryNachtStations())
    ]).then(([dayStations, nightStations]) => {
      const allStations = new Set<string>([
        ...(dayStations?.stations ?? []),
        ...(nightStations?.stations ?? [])
      ]);

      // Load config for each station and category combination
      const configPromises: Promise<StationConfig>[] = Array.from(allStations).map(station =>
        this.loadStationConfig(station)
      );

      Promise.all(configPromises).then(stationConfigs => {
        this.stationConfigs.set(stationConfigs);
        this.applyStationFilter(this.stationSearchTerm()); // Apply initial filter
        this.loadingStationConfigs.set(false);
      }).catch(err => {
        console.error('Error loading station configs:', err);
        this.snackBar.open('Fehler beim Laden der Stationskonfigurationen', 'Schließen', { duration: 3000 });
        this.loadingStationConfigs.set(false);
      });
    }).catch(err => {
      console.error('Error loading stations:', err);
      this.snackBar.open('Fehler beim Laden der Stationen', 'Schließen', { duration: 3000 });
      this.loadingStationConfigs.set(false);
    });
  }

  private async loadStationConfig(station: string): Promise<StationConfig> {
    const config: StationConfig = {
      station,
      tag_pfk: null,
      nacht_pfk: null,
      tag_phk: null,
      nacht_phk: null
    };

    try {
      // Load Tag PFK
      const tagPfk = await firstValueFrom(this.api.getStationConfig(station, 'PFK', 'tag'));
      config.tag_pfk = {
        schicht_stunden: tagPfk.schicht_stunden,
        phk_anteil_base: tagPfk.phk_anteil_base,
        pp_ratio_base: tagPfk.pp_ratio_base
      };
    } catch (err) {
      // Config doesn't exist, keep null
    }

    try {
      // Load Nacht PFK
      const nachtPfk = await firstValueFrom(this.api.getStationConfigNacht(station, 'PFK'));
      config.nacht_pfk = {
        schicht_stunden: nachtPfk.schicht_stunden,
        phk_anteil_base: nachtPfk.phk_anteil_base,
        pp_ratio_base: nachtPfk.pp_ratio_base
      };
    } catch (err) {
      // Config doesn't exist, keep null
    }

    try {
      // Load Tag PHK
      const tagPhk = await firstValueFrom(this.api.getStationConfig(station, 'PHK', 'tag'));
      config.tag_phk = {
        schicht_stunden: tagPhk.schicht_stunden,
        phk_anteil_base: null, // PHK doesn't have this
        pp_ratio_base: tagPhk.pp_ratio_base
      };
    } catch (err) {
      // Config doesn't exist, keep null
    }

    try {
      // Load Nacht PHK
      const nachtPhk = await firstValueFrom(this.api.getStationConfigNacht(station, 'PHK'));
      config.nacht_phk = {
        schicht_stunden: nachtPhk.schicht_stunden,
        phk_anteil_base: null, // PHK doesn't have this
        pp_ratio_base: nachtPhk.pp_ratio_base
      };
    } catch (err) {
      // Config doesn't exist, keep null
    }

    return config;
  }

  editStationConfig(stationConfig: StationConfig) {
    // Open a dialog for editing the station config
    // We'll implement this as a separate component similar to the existing station config dialog
    this.openStationConfigEditDialog(stationConfig);
  }

  private openStationConfigEditDialog(stationConfig: StationConfig) {
    const dialogRef = this.dialog.open(StationConfigEditDialogComponent, {
      width: '800px',
      maxWidth: '90vw',
      data: { stationConfig },
      disableClose: true
    });

    dialogRef.afterClosed().subscribe((result: boolean | null) => {
      if (result) {
        this.loadStationConfigs(); // Reload configs after successful edit
      }
    });
  }

  trackByStation(index: number, item: StationConfig): string {
    return item.station;
  }

  trackByKostenstelle(index: number, item: Kostenstelle): string {
    return item.kostenstelle;
  }

}
