import { Component, inject, signal, computed, effect, ViewChild, ElementRef, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialogModule, MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Api } from '../../core/api';
import { Router, ActivatedRoute } from '@angular/router';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { RecomputeConfigDialogComponent } from '../manual-entry/recompute-config-dialog.component';
import { StationConfigDialogComponent } from '../manual-entry/station-config-dialog.component';
import { MatDividerModule } from '@angular/material/divider';

interface DayEntry {
  tag: number;
  stunden: number;
  minuten: number;
  pfkNormal?: number;
  gesamtPfkPhk?: number;
  phkEnd?: number;
  phkAnrechenbar?: number;
}

interface GeleistetePhkStunden {
  durchschnitt: number;
  stunden: number;
  minuten: number;
  anzahlTageMitDaten: number;
}

@Component({
  selector: 'app-manual-entry-nacht',
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatSelectModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatDialogModule,
    MatButtonToggleModule,
    MatTooltipModule,
    MatDividerModule
  ],
  templateUrl: './manual-entry-nacht.html',
  styleUrl: './manual-entry-nacht.scss'
})
export class ManualEntryNacht {
  private api = inject(Api);
  private snackBar = inject(MatSnackBar);
  private dialog = inject(MatDialog);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  @ViewChild('fileInput', { static: false }) fileInput!: ElementRef<HTMLInputElement>;

  // State
  stations = signal<string[]>([]);
  selectedStation = signal<string>('');
  selectedYear = signal<number>(new Date().getFullYear());
  selectedMonth = signal<number>(new Date().getMonth() + 1);
  selectedKategorie = signal<'PFK' | 'PHK'>('PFK');
  loading = signal<boolean>(false);
  saving = signal<boolean>(false);
  uploading = signal<boolean>(false);
  recomputing = signal<boolean>(false);
  selectedFile = signal<File | null>(null);
  selectedVariant = signal<'2026' | 'legacy'>('legacy');
  
  // Konstante für Patienten-Berechnung (MiNa-Durchschnitt für Nacht)
  belegteBettenKonstante = signal<number | null>(null); // Kein Fallback mehr, wird aus täglichen Werten berechnet
  
  // P:P Werte aus calculation rules
  ppRatioTagBase = signal<number>(10); // Default: 10
  ppRatioNachtBase = signal<number>(20); // Default: 20
  
  // Schichtstunden aus calculation rules
  schichtStundenTag = signal<number>(16); // Default: 16
  schichtStundenNacht = signal<number>(8); // Default: 8
  
  // PHK-Anteil Base aus calculation rules
  phkAnteilTagBase = signal<number | null>(null);
  phkAnteilNachtBase = signal<number | null>(null);
  
  // Day entries for the selected month
  dayEntries = signal<DayEntry[]>([]);
  
  // Tägliche MiNa/MiTa-Werte (für jeden Tag des Monats)
  dailyMinaMita = signal<Map<number, { mina: number | null; mita: number | null }>>(new Map());
  
  // Durchschnittswerte (aus Backend Tag=0)
  durchschnittPhkAnrechenbar = signal<number | null>(null);
  
  // Geleistete PHK-Stunden (für PFK-Ansicht)
  geleistetePhkStunden = signal<GeleistetePhkStunden | null>(null);
  
  // PHK-Tageswerte (für jeden Tag des Monats)
  phkTageswerte = signal<Array<{
    tag: number;
    stunden: number;
    minuten: number;
    gesamtDezimal: number;
  }> | null>(null);
  
  // Config Snapshot (gespeicherte Konfiguration zum Zeitpunkt der Speicherung)
  configSnapshot = signal<import('../../core/api').ConfigSnapshot | null>(null);
  loadingConfigSnapshot = signal<boolean>(false);
  
  // Available categories
  kategorien = [
    { value: 'PFK' as const, label: 'PFK - Pflegefachkräfte', shortLabel: 'PFK' },
    { value: 'PHK' as const, label: 'PHK - Pflegehilfskräfte', shortLabel: 'PHK' }
  ];
  
  // Computed
  daysInMonth = computed(() => {
    const year = this.selectedYear();
    const month = this.selectedMonth();
    return new Date(year, month, 0).getDate();
  });

  // Available years and months
  availableYears = signal<number[]>([2023, 2024, 2025, 2026, 2027]);
  availableMonths = [
    { value: 1, label: 'Januar' },
    { value: 2, label: 'Februar' },
    { value: 3, label: 'März' },
    { value: 4, label: 'April' },
    { value: 5, label: 'Mai' },
    { value: 6, label: 'Juni' },
    { value: 7, label: 'Juli' },
    { value: 8, label: 'August' },
    { value: 9, label: 'September' },
    { value: 10, label: 'Oktober' },
    { value: 11, label: 'November' },
    { value: 12, label: 'Dezember' }
  ];

  constructor() {
    this.loadStations();
    this.loadCalculationConstants();
    
    // Read query parameters to restore selection when switching tabs
    this.route.queryParams.subscribe(params => {
      if (params['station']) {
        this.selectedStation.set(params['station']);
      }
      if (params['year']) {
        const year = parseInt(params['year'], 10);
        if (!isNaN(year)) {
          this.selectedYear.set(year);
        }
      }
      if (params['month']) {
        const month = parseInt(params['month'], 10);
        if (!isNaN(month) && month >= 1 && month <= 12) {
          this.selectedMonth.set(month);
        }
      }
      if (params['kategorie'] && (params['kategorie'] === 'PFK' || params['kategorie'] === 'PHK')) {
        this.selectedKategorie.set(params['kategorie']);
      }
    });
    
    // Auto-load data when station, year, month, or kategorie changes
    effect(() => {
      const station = this.selectedStation();
      const year = this.selectedYear();
      const month = this.selectedMonth();
      const kategorie = this.selectedKategorie();
      
      if (station) {
        this.loadDataForPeriod(station, year, month, kategorie);
      } else {
        this.initializeEmptyEntries();
      }
    });
  }

  loadCalculationConstants() {
    this.api.getCalculationConstants().subscribe({
      next: (response) => {
        if (response.success && response.data) {
          const tagBase = response.data.find(c => c.key === 'pp_ratio_tag_base');
          const nachtBase = response.data.find(c => c.key === 'pp_ratio_nacht_base');
          const schichtTag = response.data.find(c => c.key === 'schicht_stunden_tag');
          const schichtNacht = response.data.find(c => c.key === 'schicht_stunden_nacht');
          const phkAnteilTag = response.data.find(c => c.key === 'phk_anteil_tag_base');
          const phkAnteilNacht = response.data.find(c => c.key === 'phk_anteil_nacht_base');
          
          if (tagBase && tagBase.value) {
            this.ppRatioTagBase.set(tagBase.value);
          }
          if (nachtBase && nachtBase.value) {
            this.ppRatioNachtBase.set(nachtBase.value);
          }
          if (schichtTag && schichtTag.value) {
            this.schichtStundenTag.set(schichtTag.value);
          }
          if (schichtNacht && schichtNacht.value) {
            this.schichtStundenNacht.set(schichtNacht.value);
          }
          if (phkAnteilTag && phkAnteilTag.value) {
            this.phkAnteilTagBase.set(phkAnteilTag.value);
          }
          if (phkAnteilNacht && phkAnteilNacht.value) {
            this.phkAnteilNachtBase.set(phkAnteilNacht.value);
          }
        }
      },
      error: (err) => {
        console.error('Error loading calculation constants:', err);
      }
    });
  }

  onShiftToggle(value: 'tag' | 'nacht') {
    if (value === 'tag') {
      // Preserve current selection when switching to tag tab
      const queryParams: any = {};
      const station = this.selectedStation();
      const year = this.selectedYear();
      const month = this.selectedMonth();
      const kategorie = this.selectedKategorie();
      
      if (station) queryParams.station = station;
      if (year) queryParams.year = year.toString();
      if (month) queryParams.month = month.toString();
      if (kategorie) queryParams.kategorie = kategorie;
      
      this.router.navigate(['/manual-entry'], { queryParams });
    }
  }

  loadStations() {
    this.api.getManualEntryNachtStations().subscribe({
      next: (response) => {
        this.stations.set(response.stations);
      },
      error: (err) => {
        console.error('Error loading stations:', err);
        this.snackBar.open('Fehler beim Laden der Stationen', 'Schließen', { duration: 3000 });
      }
    });
  }

  initializeEmptyEntries() {
    const days = this.daysInMonth();
    const entries: DayEntry[] = [];
    for (let i = 1; i <= days; i++) {
      entries.push({ tag: i, stunden: 0, minuten: 0 });
    }
    this.dayEntries.set(entries);
  }

  loadDataForPeriod(station: string, jahr: number, monat: number, kategorie: 'PFK' | 'PHK') {
    this.loading.set(true);
    
    // Lade tägliche MiNa/MiTa-Werte parallel
    this.api.getDailyMinaMita(station, jahr, monat).subscribe({
      next: (response) => {
        const dailyMap = new Map<number, { mina: number | null; mita: number | null }>();
        response.dailyValues.forEach(item => {
          dailyMap.set(item.tag, { mina: item.mina, mita: item.mita });
        });
        this.dailyMinaMita.set(dailyMap);
        
        // Berechne MiNa-Durchschnitt aus täglichen Werten (Nacht verwendet MiNa)
        let minaSum = 0;
        let minaCount = 0;
        dailyMap.forEach((dayData) => {
          if (dayData && dayData.mina !== null && !isNaN(dayData.mina)) {
            minaSum += dayData.mina;
            minaCount++;
          }
        });
        
        if (minaCount > 0) {
          const minaDurchschnitt = Math.round((minaSum / minaCount) * 100) / 100;
          this.belegteBettenKonstante.set(minaDurchschnitt);
          console.log(`✅ MiNa-Durchschnitt aus täglichen Werten (Nacht) für ${station}: ${minaDurchschnitt} (${minaCount} Tage)`);
        } else {
          console.log(`⚠️ Keine MiNa-Werte für ${station} gefunden. Kein Fallback.`);
          this.belegteBettenKonstante.set(null);
        }
      },
      error: (err) => {
        console.error('Error loading daily MiNa/MiTa values:', err);
        this.dailyMinaMita.set(new Map());
        this.belegteBettenKonstante.set(null);
      }
    });
    
    // Lade Config-Snapshot parallel
    this.loadConfigSnapshot(station, jahr, monat, kategorie);
    
    this.api.getManualEntryNachtData(station, jahr, monat, kategorie).subscribe({
      next: (response) => {
        if (response.data.length > 0) {
          // Lade Durchschnittswerte (Tag=0)
          const durchschnitt = response.data.find(d => d.Tag === 0);
          console.log(`[Nacht Frontend] Durchschnitt gefunden:`, durchschnitt);
          if (durchschnitt && durchschnitt.PHK_Anrechenbar_Stunden !== undefined && durchschnitt.PHK_Anrechenbar_Stunden !== null) {
            console.log(`[Nacht Frontend] Setze durchschnittPhkAnrechenbar auf: ${durchschnitt.PHK_Anrechenbar_Stunden}`);
            this.durchschnittPhkAnrechenbar.set(durchschnitt.PHK_Anrechenbar_Stunden);
          } else {
            console.warn(`[Nacht Frontend] PHK_Anrechenbar_Stunden fehlt oder ist null. Durchschnitt:`, durchschnitt);
            this.durchschnittPhkAnrechenbar.set(null);
          }
          
          // Lade geleistete PHK-Stunden (nur bei PFK-Kategorie)
          if (kategorie === 'PFK' && response.geleistetePhkStunden) {
            this.geleistetePhkStunden.set(response.geleistetePhkStunden);
          } else {
            this.geleistetePhkStunden.set(null);
          }
          
          // Lade PHK-Tageswerte (nur bei PFK-Kategorie)
          if (kategorie === 'PFK' && response.phkTageswerte) {
            this.phkTageswerte.set(response.phkTageswerte);
          } else {
            this.phkTageswerte.set(null);
          }
          
          // Load existing data (filter out Durchschnitt entry with Tag=0)
          const dataEntries = response.data.filter(d => d.Tag > 0);
          const days = this.daysInMonth();
          const entries: DayEntry[] = [];
          
          for (let i = 1; i <= days; i++) {
            const existing = dataEntries.find(d => d.Tag === i);
            if (existing) {
              entries.push({
                tag: i,
                stunden: existing.Stunden || 0,
                minuten: existing.Minuten || 0,
                pfkNormal: existing.PFK_Normal,
                gesamtPfkPhk: existing.Gesamt_PFK_PHK,
                phkEnd: existing.PHK_End,
                phkAnrechenbar: existing.PHK_Anrechenbar_Stunden
              });
            } else {
              entries.push({ tag: i, stunden: 0, minuten: 0 });
            }
          }
          
          this.dayEntries.set(entries);
        } else {
          // No data exists, initialize empty
          this.initializeEmptyEntries();
          this.durchschnittPhkAnrechenbar.set(null);
          this.geleistetePhkStunden.set(null);
          this.phkTageswerte.set(null);
        }
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Error loading data:', err);
        this.initializeEmptyEntries();
        this.durchschnittPhkAnrechenbar.set(null);
        this.geleistetePhkStunden.set(null);
        this.phkTageswerte.set(null);
        this.loading.set(false);
      }
    });
  }

  loadConfigSnapshot(station: string, jahr: number, monat: number, kategorie: 'PFK' | 'PHK') {
    this.loadingConfigSnapshot.set(true);
    this.api.getConfigSnapshotNacht(station, jahr, monat, kategorie).subscribe({
      next: (snapshot) => {
        this.configSnapshot.set(snapshot);
        this.loadingConfigSnapshot.set(false);
      },
      error: (err) => {
        console.error('Error loading config snapshot:', err);
        this.configSnapshot.set(null);
        this.loadingConfigSnapshot.set(false);
      }
    });
  }

  openStationConfigDialog() {
    const station = this.selectedStation();
    const kategorie = this.selectedKategorie();
    
    if (!station) {
      this.snackBar.open('Bitte wählen Sie zuerst eine Station aus', 'Schließen', {
        duration: 3000
      });
      return;
    }

    const dialogRef = this.dialog.open(StationConfigDialogComponent, {
      width: '600px',
      data: {
        station,
        kategorie,
        schicht: 'nacht' as const,
        schichtLabel: 'Nacht'
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result === true) {
        // Config wurde gespeichert, neu laden
        const station = this.selectedStation();
        const year = this.selectedYear();
        const month = this.selectedMonth();
        const kategorie = this.selectedKategorie();
        
        if (station && year && month && kategorie) {
          this.loadConfigSnapshot(station, year, month, kategorie);
        }
      }
    });
  }

  onStationChange(station: string) {
    this.selectedStation.set(station);
    // MiNa-Durchschnitt wird jetzt aus täglichen Werten berechnet (in loadDataForPeriod)
    // Kein separater API-Call mehr nötig
  }

  onYearChange(year: number) {
    this.selectedYear.set(year);
  }

  onMonthChange(month: number) {
    this.selectedMonth.set(month);
  }

  onKategorieChange(kategorie: 'PFK' | 'PHK') {
    this.selectedKategorie.set(kategorie);
  }

  updateEntry(index: number, field: 'stunden' | 'minuten', value: string) {
    const numValue = parseInt(value) || 0;
    
    // Validate
    if (field === 'stunden' && numValue < 0) return;
    if (field === 'minuten' && (numValue < 0 || numValue >= 60)) return;
    
    this.dayEntries.update(entries => {
      const newEntries = [...entries];
      newEntries[index] = {
        ...newEntries[index],
        [field]: numValue
      };
      return newEntries;
    });
  }

  saveData() {
    const station = this.selectedStation();
    if (!station) {
      this.snackBar.open('Bitte wählen Sie eine Station aus', 'Schließen', { duration: 3000 });
      return;
    }

    const jahr = this.selectedYear();
    const monat = this.selectedMonth();
    const kategorie = this.selectedKategorie();
    const entries = this.dayEntries().map(entry => ({
      tag: entry.tag,
      stunden: entry.stunden,
      minuten: entry.minuten
    }));

    this.saving.set(true);

    this.api.saveManualEntryNacht(station, jahr, monat, kategorie, entries).subscribe({
      next: (response) => {
        this.saving.set(false);
        this.snackBar.open('Nachtschicht-Daten erfolgreich gespeichert', 'Schließen', { duration: 2000 });
        // Reload data and config snapshot after save
        this.loadDataForPeriod(station, jahr, monat, kategorie);
      },
      error: (err) => {
        this.saving.set(false);
        console.error('Error saving data:', err);
        this.snackBar.open('Fehler beim Speichern', 'Schließen', { duration: 3000 });
      }
    });
  }

  hasData(): boolean {
    return this.dayEntries().some(entry => entry.stunden > 0 || entry.minuten > 0);
  }

  recomputeData() {
    const station = this.selectedStation();
    if (!station) {
      this.snackBar.open('Bitte wählen Sie eine Station aus', 'Schließen', { duration: 3000 });
      return;
    }

    const jahr = this.selectedYear();
    const monat = this.selectedMonth();
    const kategorie = this.selectedKategorie();

    // Check if data exists
    if (!this.hasData()) {
      this.snackBar.open('Keine Daten vorhanden zum Neuberechnen', 'Schließen', { duration: 3000 });
      return;
    }

    // Get current configuration values for Nacht
    const schichtStunden = this.schichtStundenNacht();
    const ppRatioBase = this.ppRatioNachtBase();
    const phkAnteilBase = this.phkAnteilNachtBase();

    // Open dialog with configuration
    const dialogRef = this.dialog.open(RecomputeConfigDialogComponent, {
      width: '600px',
      data: {
        station: station,
        jahr: jahr,
        monat: monat,
        kategorie: kategorie,
        schicht: 'nacht' as const,
        schicht_stunden: schichtStunden,
        phk_anteil_base: phkAnteilBase,
        pp_ratio_base: ppRatioBase,
        schichtLabel: 'Nacht'
      }
    });

    dialogRef.afterClosed().subscribe((result: any) => {
      if (result && result.confirmed) {
        this.performRecompute(
          station, 
          jahr, 
          monat, 
          kategorie as 'PFK' | 'PHK',
          result.config
        );
      }
    });
  }

  private performRecompute(station: string, jahr: number, monat: number, kategorie: 'PFK' | 'PHK', configOverrides?: { schicht_stunden?: number; phk_anteil_base?: number | null; pp_ratio_base?: number }) {
    this.recomputing.set(true);

    this.api.recomputeManualEntryNacht(station, jahr, monat, kategorie, configOverrides).subscribe({
      next: (response) => {
        this.recomputing.set(false);
        const message = response.updatedEntries > 0
          ? `${response.message} (${response.updatedEntries} Einträge aktualisiert)`
          : response.message;
        this.snackBar.open(message, 'Schließen', { duration: 4000 });
        // Reload data and config snapshot after recompute
        this.loadDataForPeriod(station, jahr, monat, kategorie);
      },
      error: (err) => {
        this.recomputing.set(false);
        console.error('Error recomputing data:', err);
        const errorMessage = err.error?.error || err.message || 'Fehler beim Neuberechnen';
        this.snackBar.open(errorMessage, 'Schließen', { duration: 5000 });
      }
    });
  }

  exportPpugMeldung() {
    const station = this.selectedStation();
    if (!station) {
      this.snackBar.open('Bitte wählen Sie eine Station aus', 'Schließen', { duration: 3000 });
      return;
    }

    const jahr = this.selectedYear();
    this.saving.set(true);

    this.api.exportPpugMeldung(station, jahr).subscribe({
      next: (response) => {
        this.saving.set(false);
        const url = window.URL.createObjectURL(response.blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = response.filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        this.snackBar.open('PPUG Meldung erfolgreich exportiert', 'Schließen', { duration: 2000 });
      },
      error: (err) => {
        this.saving.set(false);
        console.error('Error exporting PPUG Meldung:', err);
        const errorMessage = err.error?.error || err.message || 'Fehler beim Exportieren';
        this.snackBar.open(errorMessage, 'Schließen', { duration: 3000 });
      }
    });
  }

  getMonthName(month: number): string {
    const monthObj = this.availableMonths.find(m => m.value === month);
    return monthObj ? monthObj.label : `Monat ${month}`;
  }

  getTotalHours(): string {
    const entries = this.dayEntries();
    let totalMinutes = 0;
    
    entries.forEach(entry => {
      totalMinutes += (entry.stunden * 60) + entry.minuten;
    });
    
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    
    return `${hours}:${minutes.toString().padStart(2, '0')}`;
  }

  getAverageHoursPerDay(): string {
    const entries = this.dayEntries();
    let totalMinutes = 0;
    let daysWithData = 0;
    
    entries.forEach(entry => {
      const dayMinutes = (entry.stunden * 60) + entry.minuten;
      if (dayMinutes > 0) {
        totalMinutes += dayMinutes;
        daysWithData++;
      }
    });
    
    if (daysWithData === 0) return '0:00';
    
    const avgMinutes = totalMinutes / daysWithData;
    const hours = Math.floor(avgMinutes / 60);
    const minutes = Math.round(avgMinutes % 60);
    
    return `${hours}:${minutes.toString().padStart(2, '0')}`;
  }

  clearAllEntries() {
    const station = this.selectedStation();
    const year = this.selectedYear();
    const month = this.selectedMonth();
    const kategorie = this.selectedKategorie();
    
    if (!station) {
      this.snackBar.open('Bitte wählen Sie eine Station aus', 'Schließen', { duration: 3000 });
      return;
    }
    
    const confirmMessage = `Möchten Sie wirklich alle ${kategorie}-Einträge für ${this.getMonthName(month)} ${year} (${station}) - Nachtschicht löschen?\n\nDiese Aktion kann nicht rückgängig gemacht werden!`;
    
    if (confirm(confirmMessage)) {
      this.saving.set(true);
      
      // Delete data from server
      this.api.deleteManualEntryNacht(station, year, month, kategorie).subscribe({
        next: (response) => {
          this.saving.set(false);
          this.snackBar.open('Alle Einträge wurden gelöscht', 'Schließen', { duration: 2000 });
          
          // Reset local entries
          this.initializeEmptyEntries();
          
          // Clear related data
          this.durchschnittPhkAnrechenbar.set(null);
          this.geleistetePhkStunden.set(null);
          this.phkTageswerte.set(null);
        },
        error: (err) => {
          this.saving.set(false);
          console.error('Error deleting entries:', err);
          const errorMessage = err.error?.error || err.message || 'Fehler beim Löschen';
          this.snackBar.open(errorMessage, 'Schließen', { duration: 3000 });
        }
      });
    }
  }

  resetSingleDay(dayIndex: number) {
    this.dayEntries.update(entries => {
      const newEntries = [...entries];
      newEntries[dayIndex] = {
        ...newEntries[dayIndex],
        stunden: 0,
        minuten: 0
      };
      return newEntries;
    });
  }

  // TrackBy function to prevent focus loss
  trackByTag(index: number, entry: DayEntry): number {
    return entry.tag;
  }

  getMinaForTag(tag: number): string {
    const dailyMap = this.dailyMinaMita();
    const dayData = dailyMap.get(tag);
    if (dayData && dayData.mina !== null) {
      return dayData.mina.toFixed(1);
    }
    return '-';
  }

  getPpugNachPfkForTag(tag: number): string {
    const dailyMap = this.dailyMinaMita();
    const dayData = dailyMap.get(tag);
    if (dayData && dayData.mina !== null) {
      // PpUG nach PFK = MiNa / pp_ratio_nacht_base
      const ppRatioBase = this.ppRatioNachtBase();
      const result = dayData.mina / ppRatioBase;
      return result.toFixed(2);
    }
    return '-';
  }

  getPpugNachPfkInStundenForTag(tag: number): string {
    const dailyMap = this.dailyMinaMita();
    const dayData = dailyMap.get(tag);
    if (dayData && dayData.mina !== null) {
      // PpUG nach PFK in Std. = (MiNa / pp_ratio_nacht_base) × Schichtstunden Nacht
      // = MiNa × Schichtstunden Nacht / pp_ratio_nacht_base
      const ppRatioBase = this.ppRatioNachtBase();
      const schichtStunden = this.schichtStundenNacht();
      const result = (dayData.mina * schichtStunden) / ppRatioBase;
      return result.toFixed(2);
    }
    return '-';
  }

  getPpugErfuelltForTag(entry: DayEntry): string {
    if (this.selectedKategorie() !== 'PFK') {
      return '-';
    }
    
    const dailyMap = this.dailyMinaMita();
    const dayData = dailyMap.get(entry.tag);
    
    if (!dayData || dayData.mina === null) {
      return '-';
    }
    
    // Berechne PpUG nach PFK
    const ppRatioBase = this.ppRatioNachtBase();
    const ppugNachPfk = dayData.mina / ppRatioBase;
    
    // PFK Normal aus entry
    const pfkNormal = entry.pfkNormal;
    
    if (pfkNormal === undefined || pfkNormal === null) {
      return '-';
    }
    
    // Prüfe: PFK Normal >= PpUG nach PFK
    return pfkNormal >= ppugNachPfk ? 'Ja' : 'Nein';
  }

  getPpugErfuelltV2ForTag(entry: DayEntry): string {
    if (this.selectedKategorie() !== 'PFK') {
      return '-';
    }
    
    // Hole Exam. Pflege für diesen Tag
    const examPflegeStr = this.getExamPflegeForTag(entry);
    if (examPflegeStr === '-' || examPflegeStr === null) {
      return '-';
    }
    
    const examPflege = parseFloat(examPflegeStr);
    if (isNaN(examPflege)) {
      return '-';
    }
    
    // Berechne PpUG nach PFK
    const dailyMap = this.dailyMinaMita();
    const dayData = dailyMap.get(entry.tag);
    
    if (!dayData || dayData.mina === null) {
      return '-';
    }
    
    const ppRatioBase = this.ppRatioNachtBase();
    const ppugNachPfk = dayData.mina / ppRatioBase;
    
    // Prüfe: Exam. Pflege >= PpUG nach PFK
    return examPflege >= ppugNachPfk ? 'Ja' : 'Nein';
  }

  getPhkValue(entry: DayEntry, field: 'pfkNormal' | 'gesamtPfkPhk' | 'phkEnd' | 'phkAnrechenbar'): string {
    const value = entry[field];
    if (value === undefined || value === null) {
      return '-';
    }
    return value.toFixed(field === 'phkAnrechenbar' ? 2 : 4);
  }

  getGesamtAnrechenbar(): string | null {
    if (this.selectedKategorie() !== 'PFK' || this.durchschnittPhkAnrechenbar() === null) {
      return null;
    }

    const entries = this.dayEntries();
    let totalMinutes = 0;
    let daysWithData = 0;
    
    entries.forEach(entry => {
      const dayMinutes = (entry.stunden * 60) + entry.minuten;
      if (dayMinutes > 0) {
        totalMinutes += dayMinutes;
        daysWithData++;
      }
    });
    
    if (daysWithData === 0) return null;
    
    const avgMinutesPfk = totalMinutes / daysWithData;
    const avgHoursPfk = avgMinutesPfk / 60;
    
    const phkAnrechenbar = this.durchschnittPhkAnrechenbar() || 0;
    const gesamt = avgHoursPfk + phkAnrechenbar;
    
    const stunden = Math.floor(gesamt);
    const minuten = Math.round((gesamt - stunden) * 60);
    
    return `${stunden}:${minuten.toString().padStart(2, '0')}`;
  }

  getExamPflege(): number | null {
    if (this.selectedKategorie() !== 'PFK') {
      return null;
    }

    const entries = this.dayEntries();
    let totalMinutes = 0;
    let daysWithData = 0;
    
    entries.forEach(entry => {
      const dayMinutes = (entry.stunden * 60) + entry.minuten;
      if (dayMinutes > 0) {
        totalMinutes += dayMinutes;
        daysWithData++;
      }
    });
    
    if (daysWithData === 0) return null;
    
    const avgMinutesPfk = totalMinutes / daysWithData;
    const avgHoursPfk = avgMinutesPfk / 60;
    
    // Berechne durchschnittliche tatsächlich anrechenbare PHK-Stunden (wie im Backend)
    // Verwende phkTageswerte wenn verfügbar, sonst Fallback zu durchschnittPhkAnrechenbar
    const phkTageswerte = this.phkTageswerte();
    let tatsaechlichAnrechenbar = 0;
    
    if (phkTageswerte && phkTageswerte.length > 0) {
      // Berechne tatsächlich anrechenbar pro Tag (wie Backend - nur Tage mit usable > 0)
      const collected: number[] = [];
      
      entries.forEach(entry => {
        const phkAnrechenbar = entry.phkAnrechenbar || 0;
        const tagData = phkTageswerte.find(t => t.tag === entry.tag);
        
        if (tagData) {
          const phkStundenDezimal = tagData.gesamtDezimal;
          // Regel: Wenn PHK-Stunden >= PHK Anrechenbar, dann nimm PHK Anrechenbar, sonst PHK-Stunden
          const usable = phkStundenDezimal >= phkAnrechenbar ? phkAnrechenbar : phkStundenDezimal;
          // Nur Tage mit usable > 0 einbeziehen (wie im Backend)
          if (usable > 0) {
            collected.push(usable);
          }
        }
      });
      
      if (collected.length > 0) {
        tatsaechlichAnrechenbar = collected.reduce((sum, value) => sum + value, 0) / collected.length;
      } else {
        // Fallback zu Durchschnittswert wenn keine Tageswerte verfügbar
        tatsaechlichAnrechenbar = this.durchschnittPhkAnrechenbar() || 0;
      }
    } else {
      // Fallback zu Durchschnittswert wenn keine phkTageswerte geladen
      tatsaechlichAnrechenbar = this.durchschnittPhkAnrechenbar() || 0;
    }
    
    const gesamtAnrechenbar = avgHoursPfk + tatsaechlichAnrechenbar;
    
    const schichtStunden = this.schichtStundenNacht();
    const examPflege = gesamtAnrechenbar / schichtStunden; // Nachtschicht: aus Config (Standard: 8 Stunden, 22-6 Uhr)
    
    return examPflege;
  }

  getExamPflegeFormatted(): string | null {
    const examPflege = this.getExamPflege();
    return examPflege !== null ? examPflege.toFixed(4) : null;
  }

  getPatientenProPflegekraft(): string | null {
    const examPflege = this.getExamPflege();
    if (examPflege === null) return null;
    
    const konstante = this.belegteBettenKonstante();
    if (konstante === null || konstante === 0) return null; // Kein Fallback, null zurückgeben
    
    const patientenProPflegekraft = examPflege / konstante;
    
    return patientenProPflegekraft.toFixed(4);
  }

  getDurchschnittPpugNachPfk(): string | null {
    const dailyMap = this.dailyMinaMita();
    const ppRatioBase = this.ppRatioNachtBase();
    
    if (ppRatioBase === 0) return null;
    
    let sum = 0;
    let count = 0;
    
    // Berechne PpUG nach PFK für alle Tage mit MiNa-Daten
    dailyMap.forEach((dayData, tag) => {
      if (dayData && dayData.mina !== null) {
        const ppugNachPfk = dayData.mina / ppRatioBase;
        sum += ppugNachPfk;
        count++;
      }
    });
    
    if (count === 0) return null;
    
    const durchschnitt = sum / count;
    return durchschnitt.toFixed(2);
  }

  getDurchschnittPfkNormal(): string | null {
    const entries = this.dayEntries();
    
    let sum = 0;
    let count = 0;
    
    // Berechne Durchschnitt von PFK Normal für alle Tage mit Daten
    entries.forEach(entry => {
      if (entry.pfkNormal !== undefined && entry.pfkNormal !== null) {
        sum += entry.pfkNormal;
        count++;
      }
    });
    
    if (count === 0) return null;
    
    const durchschnitt = sum / count;
    return durchschnitt.toFixed(4);
  }

  getDeltaSollIstPflegfachkraft(): number | null {
    if (this.selectedKategorie() !== 'PFK') {
      return null;
    }
    
    const durchschnittPfkNormalStr = this.getDurchschnittPfkNormal();
    const durchschnittPpugNachPfkStr = this.getDurchschnittPpugNachPfk();
    
    if (durchschnittPfkNormalStr === null || durchschnittPpugNachPfkStr === null) {
      return null;
    }
    
    const durchschnittPfkNormal = parseFloat(durchschnittPfkNormalStr);
    const durchschnittPpugNachPfk = parseFloat(durchschnittPpugNachPfkStr);
    
    if (isNaN(durchschnittPfkNormal) || isNaN(durchschnittPpugNachPfk)) {
      return null;
    }
    
    // Delta Soll-Ist Pflegfachkraft = durchschnitt PFK Normal - durchschnitt PpUG nach PFK
    const delta = durchschnittPfkNormal - durchschnittPpugNachPfk;
    return delta;
  }

  getPPRatio(): number | null {
    if (this.selectedKategorie() !== 'PFK') {
      return null;
    }
    
    // Für Nachtschicht: durchschnitt MiNa - durchschnitt PFK Normal
    const dailyMap = this.dailyMinaMita();
    let sum = 0;
    let count = 0;
    
    // Berechne Durchschnitt von MiNa für alle Tage mit Daten
    dailyMap.forEach((dayData, tag) => {
      if (dayData && dayData.mina !== null) {
        sum += dayData.mina;
        count++;
      }
    });
    
    if (count === 0) return null;
    
    const durchschnittMina = sum / count;
    
    const durchschnittPfkNormalStr = this.getDurchschnittPfkNormal();
    if (durchschnittPfkNormalStr === null) {
      return null;
    }
    
    const durchschnittPfkNormal = parseFloat(durchschnittPfkNormalStr);
    if (isNaN(durchschnittPfkNormal)) {
      return null;
    }
    
    // P:P = durchschnitt MiNa : durchschnitt PFK Normal
    if (durchschnittPfkNormal === 0) return null;
    const ppRatio = durchschnittMina / durchschnittPfkNormal;
    return ppRatio;
  }

  getDurchschnittPhkAusstattung(): string | null {
    // PHK-Ausstattung ist identisch mit Durchschnitt tatsächlich anrechenbar
    return this.getDurchschnittTatsaechlichAnrechenbar();
  }

  getDurchschnittTatsaechlichAnrechenbar(): string | null {
    const entries = this.dayEntries();
    const phkTageswerte = this.phkTageswerte();
    const schichtStunden = this.schichtStundenNacht();
    
    if (schichtStunden === 0) return null;
    
    let sum = 0;
    let count = 0;
    
    // Berechne Durchschnitt von "Tatsächlich Anrechenbar" für ALLE Tage (inkl. 0.00)
    // Wie in Excel: Alle Tage werden berücksichtigt, auch wenn sie 0.00 haben
    entries.forEach(entry => {
      // Nur Tage > 0 (nicht der Durchschnitts-Eintrag Tag=0)
      if (entry.tag <= 0) return;
      
      const tagData = phkTageswerte?.find(t => t.tag === entry.tag);
      const phkAnrechenbar = entry.phkAnrechenbar || 0;
      const phkStundenDezimal = tagData?.gesamtDezimal || 0;
      
      // Regel: Wenn PHK-Stunden >= PHK Anrechenbar, dann nimm PHK Anrechenbar, sonst PHK-Stunden
      const tatsaechlichAnrechenbar = phkStundenDezimal >= phkAnrechenbar ? phkAnrechenbar : phkStundenDezimal;
      
      sum += tatsaechlichAnrechenbar;
      count++; // Zähle ALLE Tage, auch wenn tatsaechlichAnrechenbar = 0
    });
    
    if (count === 0) return null;
    
    // Durchschnitt von "Tatsächlich Anrechenbar" in Stunden, dann durch Schichtstunden für Schichtanzahl
    const durchschnittTatsaechlichAnrechenbarHours = sum / count;
    const durchschnittTatsaechlichAnrechenbar = durchschnittTatsaechlichAnrechenbarHours / schichtStunden;
    
    return durchschnittTatsaechlichAnrechenbar.toFixed(4);
  }

  getAnzahlPpugvErfuelltNein(): number | null {
    if (this.selectedKategorie() !== 'PFK') {
      return null;
    }
    
    const entries = this.dayEntries();
    let neinCount = 0;
    
    // Zähle "Nein"-Werte aus der Spalte "PpUG erfüllt"
    entries.forEach(entry => {
      const result = this.getPpugErfuelltForTag(entry);
      if (result === 'Nein') {
        neinCount++;
      }
    });
    
    return neinCount > 0 ? neinCount : null;
  }

  getPpugvErfuelltNeinProzent(): number | null {
    if (this.selectedKategorie() !== 'PFK') {
      return null;
    }
    
    const entries = this.dayEntries();
    let neinCount = 0;
    
    // Zähle "Nein"-Werte aus der zweiten Spalte "PpUGV erfüllt" (V2)
    entries.forEach(entry => {
      const result = this.getPpugErfuelltV2ForTag(entry);
      if (result === 'Nein') {
        neinCount++;
      }
    });
    
    // Berechnung: (31 - Anzahl der NEIN Werte) / 0.31
    const prozent = (31 - neinCount) / 0.31;
    return prozent;
  }

  getGeleistetePhkStundenFormatted(): string | null {
    const geleistetePhk = this.geleistetePhkStunden();
    if (!geleistetePhk) return null;
    
    return `${geleistetePhk.stunden}:${geleistetePhk.minuten.toString().padStart(2, '0')}h`;
  }

  getGeleistetePhkStundenDezimal(): number | null {
    const geleistetePhk = this.geleistetePhkStunden();
    if (!geleistetePhk) return null;
    
    return geleistetePhk.durchschnitt;
  }

  // Berechnet den PHK-Anteil für Nacht
  getPhkAnteil(): number {
    const phkAnteilBase = this.phkAnteilNachtBase() || 10;
    
    // PHK-Anteil = 1 - (Basiswert / 100)
    const phkAnteil = 1 - (phkAnteilBase / 100);
    return phkAnteil;
  }

  // Gibt den PHK-Anteil als Prozent-String zurück (z.B. "90%")
  getPhkAnteilPercent(): string {
    const phkAnteil = this.getPhkAnteil();
    return `${(phkAnteil * 100).toFixed(0)}%`;
  }

  clearAllStationData() {
    const station = this.selectedStation();
    const year = this.selectedYear();
    const month = this.selectedMonth();
    
    if (!station) {
      this.snackBar.open('Bitte wählen Sie eine Station aus', 'Schließen', { duration: 3000 });
      return;
    }
    
    const confirmMessage = `Möchten Sie wirklich ALLE Stunden-Daten (PFK und PHK) für ${this.getMonthName(month)} ${year} (${station}) - Nachtschicht löschen?\n\nDiese Aktion kann nicht rückgängig gemacht werden!`;
    
    if (confirm(confirmMessage)) {
      this.saving.set(true);
      
      // Delete ALL data from server (PFK and PHK) - Nacht
      this.api.deleteManualEntryNacht(station, year, month, 'PFK').subscribe({
        next: (response) => {
          // Also delete PHK
          this.api.deleteManualEntryNacht(station, year, month, 'PHK').subscribe({
            next: (phkResponse) => {
              this.saving.set(false);
              this.snackBar.open('Alle Daten (PFK und PHK) wurden gelöscht', 'Schließen', { duration: 3000 });
              
              // Reset local entries
              this.initializeEmptyEntries();
              
              // Clear related data
              this.durchschnittPhkAnrechenbar.set(null);
              this.geleistetePhkStunden.set(null);
              this.phkTageswerte.set(null);
            },
            error: (err) => {
              this.saving.set(false);
              console.error('Error deleting PHK data:', err);
              const errorMessage = err.error?.error || err.message || 'Fehler beim Löschen';
              this.snackBar.open(errorMessage, 'Schließen', { duration: 3000 });
            }
          });
        },
        error: (err) => {
          this.saving.set(false);
          console.error('Error deleting PFK data:', err);
          const errorMessage = err.error?.error || err.message || 'Fehler beim Löschen';
          this.snackBar.open(errorMessage, 'Schließen', { duration: 3000 });
        }
      });
    }
  }

  clearAllMonthsForStation() {
    const station = this.selectedStation();
    
    if (!station) {
      this.snackBar.open('Bitte wählen Sie eine Station aus', 'Schließen', { duration: 3000 });
      return;
    }
    
    const confirmMessage = `Möchten Sie wirklich ALLE Stunden-Daten (PFK und PHK) für ALLE Monate und Jahre für Station ${station} - Nachtschicht löschen?\n\nDiese Aktion kann nicht rückgängig gemacht werden!`;
    
    if (confirm(confirmMessage)) {
      this.saving.set(true);
      this.snackBar.open('Diese Funktion ist für Nachtschicht noch nicht implementiert. Bitte löschen Sie die Daten manuell pro Monat.', 'Schließen', { duration: 5000 });
      this.saving.set(false);
      // TODO: Implement backend route for deleting all months for a station in nacht
    }
  }

  // File upload methods
  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      // Validate file type
      if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
        this.snackBar.open('Bitte wählen Sie eine Excel-Datei (.xlsx oder .xls)', 'Schließen', { duration: 3000 });
        return;
      }
      this.selectedFile.set(file);
    }
  }

  triggerFileSelect(): void {
    if (this.fileInput) {
      this.fileInput.nativeElement.click();
    }
  }

  clearSelectedFile(): void {
    this.selectedFile.set(null);
    if (this.fileInput) {
      this.fileInput.nativeElement.value = '';
    }
  }

  uploadDienstplan(): void {
    const file = this.selectedFile();
    if (!file) {
      this.snackBar.open('Bitte wählen Sie eine Datei aus', 'Schließen', { duration: 3000 });
      return;
    }

    this.uploading.set(true);

    this.api.uploadDienstplan(file, this.selectedVariant()).subscribe({
      next: (response) => {
        this.uploading.set(false);
        this.snackBar.open('Dienstplan erfolgreich importiert', 'Schließen', { duration: 3000 });

        // Clear selected file
        this.clearSelectedFile();

        // Reload data if station, year, month match
        const station = this.selectedStation();
        const year = this.selectedYear();
        const month = this.selectedMonth();
        const kategorie = this.selectedKategorie();

        if (station && year && month) {
          // Check if uploaded data matches current selection
          const matchingUpload = response.uploaded?.find(u =>
            u.station === station && u.jahr === year && u.monat === month
          );

          if (matchingUpload) {
            // Reload data for current selection
            this.loadDataForPeriod(station, year, month, kategorie);
          }
        }
      },
      error: (err) => {
        this.uploading.set(false);
        console.error('Error uploading Dienstplan:', err);
        const errorMessage = err.error?.error || err.message || 'Fehler beim Hochladen der Datei';
        this.snackBar.open(errorMessage, 'Schließen', { duration: 5000 });
      }
    });
  }

  getPhkStundenForTag(tag: number): string {
    const phkTageswerte = this.phkTageswerte();
    if (!phkTageswerte) return '-';
    
    const tagData = phkTageswerte.find(t => t.tag === tag);
    if (!tagData) return '-';
    
    return `${tagData.stunden}:${tagData.minuten.toString().padStart(2, '0')}h`;
  }

  getTatsaechlichAnrechenbarForTag(entry: DayEntry): string {
    // Finde die PHK-Stunden für diesen Tag
    const phkTageswerte = this.phkTageswerte();
    if (!phkTageswerte) return '-';
    
    const tagData = phkTageswerte.find(t => t.tag === entry.tag);
    if (!tagData) return '-';
    
    // PHK Anrechenbar für diesen Tag
    const phkAnrechenbar = entry.phkAnrechenbar || 0;
    
    // Tatsächliche PHK-Stunden für diesen Tag (in Dezimal)
    const phkStundenDezimal = tagData.gesamtDezimal;
    
    // Regel: Wenn PHK-Stunden >= PHK Anrechenbar, dann nimm PHK Anrechenbar, sonst PHK-Stunden
    const tatsaechlichAnrechenbar = phkStundenDezimal >= phkAnrechenbar ? phkAnrechenbar : phkStundenDezimal;
    
    return tatsaechlichAnrechenbar.toFixed(2) + 'h';
  }

  getGesamteAnrechbareAZForTag(entry: DayEntry): string {
    // Arbeitszeitstunden (in Dezimal umrechnen)
    const arbeitszeitstundenDezimal = entry.stunden + (entry.minuten / 60);
    
    // Tatsächlich anrechnbar für diesen Tag
    const phkTageswerte = this.phkTageswerte();
    if (!phkTageswerte) {
      // Wenn keine PHK-Daten vorhanden, nur Arbeitszeitstunden zurückgeben
      return arbeitszeitstundenDezimal.toFixed(2) + 'h';
    }
    
    const tagData = phkTageswerte.find(t => t.tag === entry.tag);
    if (!tagData) {
      // Wenn keine PHK-Daten für diesen Tag, nur Arbeitszeitstunden zurückgeben
      return arbeitszeitstundenDezimal.toFixed(2) + 'h';
    }
    
    // PHK Anrechenbar für diesen Tag
    const phkAnrechenbar = entry.phkAnrechenbar || 0;
    
    // Tatsächliche PHK-Stunden für diesen Tag (in Dezimal)
    const phkStundenDezimal = tagData.gesamtDezimal;
    
    // Regel: Wenn PHK-Stunden >= PHK Anrechenbar, dann nimm PHK Anrechenbar, sonst PHK-Stunden
    const tatsaechlichAnrechenbar = phkStundenDezimal >= phkAnrechenbar ? phkAnrechenbar : phkStundenDezimal;
    
    // Gesamte anrechbare AZ = Arbeitszeitstunden + Tatsächlich anrechnbar
    const gesamtAnrechbareAZ = arbeitszeitstundenDezimal + tatsaechlichAnrechenbar;
    
    return gesamtAnrechbareAZ.toFixed(2) + 'h';
  }

  getExamPflegeForTag(entry: DayEntry): string {
    // Arbeitszeitstunden (in Dezimal umrechnen)
    const arbeitszeitstundenDezimal = entry.stunden + (entry.minuten / 60);
    
    // Tatsächlich anrechnbar für diesen Tag
    const phkTageswerte = this.phkTageswerte();
    if (!phkTageswerte) {
      // Wenn keine PHK-Daten vorhanden, nur Arbeitszeitstunden verwenden
      const schichtStunden = this.schichtStundenNacht();
      const examPflege = arbeitszeitstundenDezimal / schichtStunden;
      return examPflege.toFixed(4);
    }
    
    const tagData = phkTageswerte.find(t => t.tag === entry.tag);
    if (!tagData) {
      // Wenn keine PHK-Daten für diesen Tag, nur Arbeitszeitstunden verwenden
      const schichtStunden = this.schichtStundenNacht();
      const examPflege = arbeitszeitstundenDezimal / schichtStunden;
      return examPflege.toFixed(4);
    }
    
    // PHK Anrechenbar für diesen Tag
    const phkAnrechenbar = entry.phkAnrechenbar || 0;
    
    // Tatsächliche PHK-Stunden für diesen Tag (in Dezimal)
    const phkStundenDezimal = tagData.gesamtDezimal;
    
    // Regel: Wenn PHK-Stunden >= PHK Anrechenbar, dann nimm PHK Anrechenbar, sonst PHK-Stunden
    const tatsaechlichAnrechenbar = phkStundenDezimal >= phkAnrechenbar ? phkAnrechenbar : phkStundenDezimal;
    
    // Gesamte anrechbare AZ = Arbeitszeitstunden + Tatsächlich anrechnbar
    const gesamtAnrechbareAZ = arbeitszeitstundenDezimal + tatsaechlichAnrechenbar;
    
    // Exam. Pflege = Gesamte anrechb. AZ / Schichtstunden (Nacht: 8 Stunden)
    const schichtStunden = this.schichtStundenNacht();
    const examPflege = gesamtAnrechbareAZ / schichtStunden;
    
    return examPflege.toFixed(4);
  }

  openStatInfoModal(statType: string) {
    const schichtStunden = this.schichtStundenNacht();
    const phkAnteilBase = this.phkAnteilNachtBase() || 10;
    const phkAnteil = 1 - (phkAnteilBase / 100);
    const ppRatioBase = this.ppRatioNachtBase();
    const entries = this.dayEntries();
    const dailyMap = this.dailyMinaMita();
    const belegteBetten = this.belegteBettenKonstante();

    let modalData: any = {};

    switch (statType) {
      case 'gesamt':
        const totalHours = this.getTotalHours();
        modalData = {
          title: 'Gesamt Stunden',
          steps: [
            {
              name: 'Gesamt Stunden',
              formula: `Gesamt = Summe aller eingegebenen Stunden und Minuten`,
              description: `Addiert alle manuell eingegebenen Arbeitsstunden und Minuten für alle Tage des Monats`,
              example: `Wenn Tag 1: 8h 30min, Tag 2: 7h 45min → Gesamt = 16h 15min`
            }
          ],
          dataSource: 'Manuell eingegebene Stunden und Minuten pro Tag'
        };
        break;

      case 'durchschnitt':
        const avgHours = this.getAverageHoursPerDay();
        modalData = {
          title: `Durchschnitt ${this.selectedKategorie()}`,
          steps: [
            {
              name: 'Durchschnitt pro Tag',
              formula: `Durchschnitt = Gesamt Stunden / Anzahl Tage mit Daten`,
              description: `Berechnet den durchschnittlichen Stundenwert pro Tag, wobei nur Tage mit Stunden > 0 berücksichtigt werden`,
              example: `Wenn Gesamt = 160h und 20 Tage mit Daten → Durchschnitt = 8h/Tag`
            }
          ],
          dataSource: 'Gesamt Stunden (berechnet) und Anzahl Tage mit Daten'
        };
        break;

      case 'tageImMonat':
        const days = this.daysInMonth();
        modalData = {
          title: 'Tage im Monat',
          steps: [
            {
              name: 'Tage im Monat',
              formula: `Tage = Anzahl Tage im ausgewählten Monat`,
              description: `Die Anzahl der Tage im ausgewählten Monat (28-31 Tage, abhängig vom Monat)`,
              example: `Januar = 31 Tage, Februar = 28/29 Tage (je nach Jahr)`
            }
          ],
          dataSource: 'Kalenderdaten'
        };
        break;

      case 'phkAnteil':
        modalData = {
          title: '%PHP-Faktor (Nacht)',
          steps: [
            {
              name: '%PHP-Faktor',
              formula: `%PHP-Faktor = 1 - (Basiswert / 100)`,
              description: `Der %PHP-Faktor wird aus einem konfigurierbaren Basiswert berechnet.`,
              example: `1 - (${phkAnteilBase} / 100) = ${phkAnteil.toFixed(4)} (${(phkAnteil * 100).toFixed(0)}%)`
            }
          ],
          constants: [
            { name: '%PHP (Nacht)', value: `${phkAnteilBase}`, unit: 'Zahl' },
            { name: '%PHP-Faktor', value: `${phkAnteil.toFixed(4)}`, unit: `(${(phkAnteil * 100).toFixed(0)}%)` }
          ],
          dataSource: 'Konfigurierbarer Basiswert für Nacht-Schicht'
        };
        break;

      case 'phkAnrechenbar':
        const phkAnrechenbar = this.durchschnittPhkAnrechenbar();
        modalData = {
          title: '⌀ Anrechenbare AZ PHK',
          steps: [
            {
              name: 'Anrechenbare AZ PHK (PHK Anrechenbar)',
              formula: `Anrechenbare AZ PHK (PHK Anrechenbar) = davon PHK (PHK End) × Schichtdauer`,
              description: `Berechnet die anrechenbaren PHK-Stunden basierend auf der davon PHK (PHK End)-Schichtanzahl`,
              example: `Wenn davon PHK (PHK End) = 0.56 und Schichtdauer = ${schichtStunden}h → ${(0.56 * schichtStunden).toFixed(2)}h`
            },
            {
              name: 'davon PHK (PHK End)',
              formula: `davon PHK (PHK End) = Gesamt PFK+PHK - Ergibt PFK (PFK Normal)`,
              description: `Die Differenz zwischen Gesamt-Personal und PFK-Personal`,
              example: `5.56 - 5.0 = 0.56 PHK-Schichten`
            }
          ],
          constants: [
            { name: 'Schichtdauer (Nacht)', value: `${schichtStunden}`, unit: 'Stunden' }
          ],
          dataSource: 'Berechnet aus PFK-Stunden und %PHP-Faktor'
        };
        break;

      case 'gesamtAnrechenbar':
        const gesamtAnrechenbar = this.getGesamtAnrechenbar();
        modalData = {
          title: '⌀ Gesamt Anrechenbar',
          steps: [
            {
              name: 'Gesamt Anrechenbar',
              formula: `Gesamt Anrechenbar = ⌀ PFK-Stunden + ⌀ Tatsächlich Anrechenbar`,
              description: `Summe aus durchschnittlichen PFK-Stunden und durchschnittlichen tatsächlich anrechenbaren PHK-Stunden`,
              example: `Wenn ⌀ PFK = 5.0h und ⌀ Tatsächlich Anrechenbar = 8.5h → Gesamt = 13.5h`
            },
            {
              name: 'Tatsächlich Anrechenbar',
              formula: `Tatsächlich Anrechenbar = min(Geleistete AZ PHK, Anrechenbare AZ PHK (PHK Anrechenbar))`,
              description: `Der kleinere Wert von tatsächlich geleisteten PHK-Stunden und berechneten Anrechenbare AZ PHK (PHK Anrechenbar)`,
              example: `Wenn geleistet: 8.5h, berechnet: 8.96h → tatsächlich: 8.5h`
            }
          ],
          dataSource: 'PFK-Stunden (eingegeben) und PHK-Stunden (aus PHK-Reiter)'
        };
        break;

      case 'examPflege':
        const examPflege = this.getExamPflege();
        modalData = {
          title: 'Exam. Pflege',
          steps: [
            {
              name: 'Exam. Pflege',
              formula: `Exam. Pflege = Gesamt Anrechenbar / Schichtstunden`,
              description: `Berechnet die Anzahl der examinierten Pflegekräfte basierend auf der gesamten anrechenbaren Arbeitszeit`,
              example: `Wenn Gesamt Anrechenbar = 88.5h und Schichtstunden = ${schichtStunden}: 88.5 / ${schichtStunden} = ${examPflege ? examPflege.toFixed(4) : 'N/A'}`
            },
            {
              name: 'Gesamt Anrechenbar',
              formula: `Gesamt Anrechenbar = ⌀ PFK-Stunden + ⌀ Tatsächlich Anrechenbar`,
              description: `Summe aus PFK- und PHK-Stunden`,
              example: `Arbeitszeit + min(Geleistete PHK, PHK Anrechenbar)`
            }
          ],
          constants: [
            { name: 'Schichtstunden (Nacht)', value: `${schichtStunden}`, unit: 'Stunden' }
          ],
          dataSource: 'Gesamt Anrechenbar (berechnet)'
        };
        break;

      case 'patientenProPflegekraft':
        const examPflegeForPatienten = this.getExamPflege();
        const patienten = this.getPatientenProPflegekraft();
        modalData = {
          title: 'Patienten/Pflegekraft',
          steps: [
            {
              name: 'Patienten/Pflegekraft',
              formula: `Patienten/Pflegekraft = Exam. Pflege / MiNa Bestände (MiNa)-Durchschnitt`,
              description: `Berechnet das Verhältnis von Patienten zu Pflegekräften`,
              example: `Wenn Exam. Pflege = ${examPflegeForPatienten ? examPflegeForPatienten.toFixed(4) : 'N/A'} und MiNa Bestände (MiNa) = ${belegteBetten ? belegteBetten.toFixed(2) : 'N/A'} → ${patienten || 'N/A'}`
            },
            {
              name: 'Exam. Pflege',
              formula: `Exam. Pflege = Gesamt Anrechenbar / Schichtstunden`,
              description: `Anzahl examinierter Pflegekräfte`,
              example: `Berechnet aus Gesamt Anrechenbar`
            },
            {
              name: 'MiNa Bestände (MiNa)-Durchschnitt',
              formula: `MiNa Bestände (MiNa) = Durchschnittliche Nachtbelegung`,
              description: `Die mittlere Nachtbelegung aus MiNa/MiTa-Beständen`,
              example: `Wird täglich aus den Bestandsdaten ermittelt`
            }
          ],
          dataSource: 'Exam. Pflege (berechnet) und MiNa Bestände (MiNa) (aus MiNa/MiTa-Beständen)'
        };
        break;

      case 'geleistetePhk':
        const geleistetePhk = this.geleistetePhkStunden();
        modalData = {
          title: '⌀ Geleistete AZ PHK',
          steps: [
            {
              name: 'Geleistete AZ PHK',
              formula: `Geleistete AZ PHK = Durchschnitt der tatsächlich geleisteten PHK-Stunden`,
              description: `Die durchschnittlich von PHK geleisteten Arbeitsstunden, berechnet aus den manuell eingegebenen PHK-Stunden pro Tag`,
              example: `Wird aus den manuell eingegebenen PHK-Stunden pro Tag ermittelt (nur Tage mit Stunden > 0)`
            }
          ],
          dataSource: 'Manuell eingegebene PHK-Stunden (aus PHK-Reiter)'
        };
        break;

      case 'ppugvErfuelltProzent':
        const ppugvProzent = this.getPpugvErfuelltNeinProzent();
        modalData = {
          title: 'PpUG erfüllt %',
          steps: [
            {
              name: 'PpUG erfüllt %',
              formula: `PpUG erfüllt % = (Anzahl Tage mit "Nein" / Gesamt Tage) × 100`,
              description: `Prozentsatz der Tage, an denen das PpUG nicht erfüllt wurde`,
              example: `Wenn 5 von 30 Tagen "Nein" → ${ppugvProzent ? ppugvProzent.toFixed(2) : 'N/A'}%`
            },
            {
              name: 'PpUG erfüllt',
              formula: `PpUG erfüllt = (Exam. Pflege >= PpUG nach PFK) ? 'Ja' : 'Nein'`,
              description: `Prüft täglich, ob die examinierte Pflegekraft-Anzahl ausreicht`,
              example: `Wenn Exam. Pflege >= PpUG nach PFK → 'Ja', sonst 'Nein'`
            }
          ],
          dataSource: 'Tägliche Berechnung von Exam. Pflege und PpUG nach PFK'
        };
        break;

      case 'deltaSollIst':
        const delta = this.getDeltaSollIstPflegfachkraft();
        modalData = {
          title: 'Delta Soll-Ist Pflegfachkraft',
          steps: [
            {
              name: 'Delta Soll-Ist',
              formula: `Delta = ⌀ Ergibt PFK (PFK Normal) - ⌀ PpUG nach PFK`,
              description: `Differenz zwischen tatsächlich vorhandenen PFK-Schichten und benötigten PFK-Schichten`,
              example: `Wenn ⌀ Ergibt PFK (PFK Normal) = 5.0 und ⌀ PpUG nach PFK = 4.5 → Delta = ${delta ? delta.toFixed(4) : 'N/A'}`
            },
            {
              name: '⌀ Ergibt PFK (PFK Normal)',
              formula: `⌀ Ergibt PFK (PFK Normal) = Durchschnitt von Ergibt PFK (PFK Normal) über alle Tage`,
              description: `Durchschnittliche Anzahl PFK-Schichten`,
              example: `Berechnet aus eingegebenen PFK-Stunden`
            },
            {
              name: '⌀ PpUG nach PFK',
              formula: `⌀ PpUG nach PFK = Durchschnitt von (MiNa Bestände (MiNa) / Pp-Ratio)`,
              description: `Durchschnittlicher benötigter Pflegekraft-Bedarf`,
              example: `Berechnet aus täglichen MiNa Bestände (MiNa)-Werten`
            }
          ],
          constants: [
            { name: 'Pp-Ratio Basiswert (Nacht)', value: `${ppRatioBase}`, unit: 'Zahl' }
          ],
          dataSource: 'Ergibt PFK (PFK Normal) (eingegeben) und MiNa Bestände (MiNa) (aus Beständen)'
        };
        break;

      case 'ppRatio':
        const ppRatio = this.getPPRatio();
        modalData = {
          title: 'P:P (Patienten zu Pflegekraft)',
          steps: [
            {
              name: 'P:P',
              formula: `P:P = ⌀ MiNa Bestände (MiNa) / ⌀ Ergibt PFK (PFK Normal)`,
              description: `Verhältnis von durchschnittlicher Nachtbelegung zu durchschnittlicher PFK-Anzahl`,
              example: `Wenn ⌀ MiNa Bestände (MiNa) = 20.0 und ⌀ Ergibt PFK (PFK Normal) = 5.0 → P:P = ${ppRatio ? ppRatio.toFixed(2) : 'N/A'}`
            },
            {
              name: '⌀ MiNa Bestände (MiNa)',
              formula: `⌀ MiNa Bestände (MiNa) = Durchschnitt der täglichen MiNa Bestände (MiNa)-Werte`,
              description: `Durchschnittliche Nachtbelegung`,
              example: `Berechnet aus täglichen MiNa/MiTa-Beständen`
            },
            {
              name: '⌀ Ergibt PFK (PFK Normal)',
              formula: `⌀ Ergibt PFK (PFK Normal) = Durchschnitt von Ergibt PFK (PFK Normal)`,
              description: `Durchschnittliche PFK-Schichtanzahl`,
              example: `Berechnet aus eingegebenen PFK-Stunden`
            }
          ],
          dataSource: 'MiNa Bestände (MiNa) (aus Beständen) und Ergibt PFK (PFK Normal) (eingegeben)'
        };
        break;

      case 'minaDurchschnitt':
        modalData = {
          title: 'MiNa Bestände (MiNa)-Ø Station',
          steps: [
            {
              name: 'MiNa Bestände (MiNa)-Durchschnitt',
              formula: `MiNa Bestände (MiNa)-Ø = Durchschnitt der täglichen MiNa Bestände (MiNa)-Werte`,
              description: `Die mittlere Nachtbelegung (MiNa Bestände (MiNa)) wird aus den MiNa/MiTa-Beständen für jeden Tag des Monats geladen und dann gemittelt`,
              example: `Wird täglich aus den Bestandsdaten ermittelt und dann gemittelt`
            }
          ],
          dataSource: 'MiNa/MiTa-Bestände (täglich aktualisiert)'
        };
        break;

      case 'ppugNachPfkDurchschnitt':
        const ppugNachPfk = this.getDurchschnittPpugNachPfk();
        modalData = {
          title: 'PpUG nach PFK Ø',
          steps: [
            {
              name: 'PpUG nach PFK Durchschnitt',
              formula: `⌀ PpUG nach PFK = Durchschnitt von (MiNa Bestände (MiNa) / Pp-Ratio)`,
              description: `Berechnet den durchschnittlichen benötigten Pflegekraft-Bedarf basierend auf der Nachtbelegung`,
              example: `Für jeden Tag: MiNa Bestände (MiNa) / ${ppRatioBase}, dann Durchschnitt über alle Tage`
            }
          ],
          constants: [
            { name: 'Pp-Ratio Basiswert (Nacht)', value: `${ppRatioBase}`, unit: 'Zahl' }
          ],
          dataSource: 'MiNa Bestände (MiNa) (aus MiNa/MiTa-Beständen)'
        };
        break;

      case 'pfkNormalDurchschnitt':
        const pfkNormal = this.getDurchschnittPfkNormal();
        modalData = {
          title: 'Ergibt PFK (PFK Normal) Ø',
          steps: [
            {
              name: 'Ergibt PFK (PFK Normal) Durchschnitt',
              formula: `⌀ Ergibt PFK (PFK Normal) = Durchschnitt von (PFK-Stunden / Schichtdauer)`,
              description: `Berechnet die durchschnittliche Anzahl der vollen PFK-Schichten`,
              example: `Für jeden Tag: PFK-Stunden / ${schichtStunden}, dann Durchschnitt über alle Tage`
            }
          ],
          constants: [
            { name: 'Schichtdauer (Nacht)', value: `${schichtStunden}`, unit: 'Stunden' }
          ],
          dataSource: 'Manuell eingegebene PFK-Stunden pro Tag'
        };
        break;

      case 'phkAusstattung':
        const phkAusstattung = this.getDurchschnittPhkAusstattung();
        modalData = {
          title: 'PHK-Ausstattung Ø',
          steps: [
            {
              name: 'PHK-Ausstattung',
              formula: `PHK-Ausstattung = ⌀ Tatsächlich Anrechenbar / Schichtstunden`,
              description: `Berechnet die durchschnittliche PHK-Ausstattung basierend auf tatsächlich anrechenbaren PHK-Stunden`,
              example: `Wenn ⌀ Tatsächlich Anrechenbar = 8.5h und Schichtstunden = ${schichtStunden} → ${phkAusstattung || 'N/A'}`
            },
            {
              name: 'Tatsächlich Anrechenbar',
              formula: `Tatsächlich Anrechenbar = min(Geleistete AZ PHK, PHK Anrechenbar)`,
              description: `Der kleinere Wert von geleisteten und berechneten PHK-Stunden`,
              example: `Wenn geleistet: 8.5h, berechnet: 8.96h → tatsächlich: 8.5h`
            }
          ],
          constants: [
            { name: 'Schichtstunden (Nacht)', value: `${schichtStunden}`, unit: 'Stunden' }
          ],
          dataSource: 'Tatsächlich Anrechenbar (berechnet)'
        };
        break;

      case 'ppugvErfuelltNein':
        const anzahlNein = this.getAnzahlPpugvErfuelltNein();
        modalData = {
          title: 'PpUGV erfüllt Nein',
          steps: [
            {
              name: 'Anzahl Tage mit "Nein"',
              formula: `Anzahl = Summe aller Tage mit PpUG erfüllt = 'Nein'`,
              description: `Zählt die Anzahl der Tage im Monat, an denen das PpUG nicht erfüllt wurde`,
              example: `Wenn 5 Tage "Nein" → Anzahl = ${anzahlNein || 'N/A'}`
            },
            {
              name: 'PpUG erfüllt',
              formula: `PpUG erfüllt = (Exam. Pflege >= PpUG nach PFK) ? 'Ja' : 'Nein'`,
              description: `Tägliche Prüfung, ob die examinierte Pflegekraft-Anzahl ausreicht`,
              example: `Wenn Exam. Pflege < PpUG nach PFK → 'Nein'`
            }
          ],
          dataSource: 'Tägliche Berechnung von Exam. Pflege und PpUG nach PFK'
        };
        break;
    }

    if (modalData.title) {
      this.dialog.open(CalculationInfoDialog, {
        width: '600px',
        data: modalData
      });
    }
  }

  openCalculationModal(columnType: string) {
    // Da wir in der Nacht-Komponente sind, ist die Schicht immer 'nacht'
    const schicht = 'nacht';
    const schichtStunden = 8;
    const phkAnteilBase = 10; // Standard-Wert, könnte aus API geladen werden
    const phkAnteil = 1 - (phkAnteilBase / 100);

    let modalData: any = {};

    switch (columnType) {
      case 'pfkNormal':
        modalData = {
          title: 'Ergibt PFK (PFK Normal)',
          steps: [
            {
              name: 'Ergibt PFK (PFK Normal)',
              formula: `Ergibt PFK (PFK Normal) = PFK-Stunden / Schichtdauer`,
              description: `Anzahl der vollen PFK-Schichten`,
              example: `Bei ${schichtStunden} Stunden Schichtdauer: 64 Stunden / ${schichtStunden} = 8.0 Schichten`
            }
          ],
          constants: [
            { name: 'Schichtdauer', value: `${schichtStunden}`, unit: 'Stunden' }
          ]
        };
        break;

      case 'gesamtPfkPhk':
        modalData = {
          title: 'Gesamt PFK+PHK',
          steps: [
            {
              name: '%PHP-Faktor berechnen',
              formula: `%PHP-Faktor = 1 - (Basiswert / 100)`,
              description: `Berechnung des %PHP-Faktors aus dem konfigurierbaren Basiswert`,
              example: `1 - (${phkAnteilBase} / 100) = ${phkAnteil.toFixed(4)} (${(phkAnteil * 100).toFixed(0)}%)`
            },
            {
              name: 'Gesamt PFK+PHK',
              formula: `Gesamt PFK+PHK = Ergibt PFK (PFK Normal) / %PHP-Faktor`,
              description: `Gesamtanzahl Personal (PFK + PHK zusammen)`,
              example: `8.0 / ${phkAnteil.toFixed(4)} = ${(8.0 / phkAnteil).toFixed(2)} Gesamt-Schichten`
            }
          ],
          constants: [
            { name: '%PHP (Nacht)', value: `${phkAnteilBase}`, unit: 'Zahl' },
            { name: '%PHP-Faktor', value: `${phkAnteil.toFixed(4)}`, unit: `(${(phkAnteil * 100).toFixed(0)}%)` }
          ]
        };
        break;

      case 'phkEnd':
        modalData = {
          title: 'davon PHK (PHK End)',
          steps: [
            {
              name: 'davon PHK (PHK End)',
              formula: `davon PHK (PHK End) = Gesamt PFK+PHK - Ergibt PFK (PFK Normal)`,
              description: `Anzahl PHK-Schichten (Differenz zwischen Gesamt-Personal und PFK-Personal)`,
              example: `8.89 - 8.0 = 0.89 PHK-Schichten`
            }
          ]
        };
        break;

      case 'phkAnrechenbar':
        modalData = {
          title: 'Anrechenbare AZ PHK (PHK Anrechenbar)',
          steps: [
            {
              name: 'Anrechenbare AZ PHK (PHK Anrechenbar)',
              formula: `Anrechenbare AZ PHK (PHK Anrechenbar) = davon PHK (PHK End) × Schichtdauer`,
              description: `Anrechenbare PHK-Arbeitsstunden (für Berechnungen)`,
              example: `0.89 × ${schichtStunden} = ${(0.89 * schichtStunden).toFixed(2)} Stunden`
            }
          ],
          constants: [
            { name: 'Schichtdauer', value: `${schichtStunden}`, unit: 'Stunden' }
          ]
        };
        break;

      case 'geleistetePhk':
        modalData = {
          title: 'Geleistete AZ PHK',
          steps: [
            {
              name: 'Geleistete PHK-Stunden',
              formula: `Geleistete AZ PHK = Tatsächlich geleistete PHK-Stunden`,
              description: `Die tatsächlich von PHK geleisteten Arbeitsstunden (aus PHK-Reiter)`,
              example: `Wird aus den manuell eingegebenen PHK-Stunden pro Tag ermittelt`
            }
          ],
          dataSource: 'Manuell eingegebene PHK-Stunden (aus PHK-Reiter)'
        };
        break;

      case 'tatsaechlichAnrechenbar':
        modalData = {
          title: 'Tatsächlich Anrechenbar',
          steps: [
            {
              name: 'Tatsächlich Anrechenbar',
              formula: `Tatsächlich Anrechenbar = min(Geleistete AZ PHK, Anrechenbare AZ PHK (PHK Anrechenbar))`,
              description: `Der kleinere Wert von geleisteten PHK-Stunden und berechneten Anrechenbare AZ PHK (PHK Anrechenbar)`,
              example: `Wenn geleistet: 7.0h, berechnet: 7.12h → tatsächlich: 7.0h`
            }
          ]
        };
        break;

      case 'mina':
        modalData = {
          title: 'MiNa Bestände (MiNa) (Mittlere Nachtbelegung)',
          steps: [
            {
              name: 'MiNa Bestände (MiNa)',
              formula: `MiNa Bestände (MiNa) = Durchschnittliche Nachtbelegung`,
              description: `Die mittlere Nachtbelegung (MiNa Bestände (MiNa)) wird aus den MiNa/MiTa-Beständen für den jeweiligen Tag geladen`,
              example: `Wird täglich aus den Bestandsdaten ermittelt`
            }
          ],
          dataSource: 'MiNa/MiTa-Bestände (täglich aktualisiert)'
        };
        break;

      case 'ppugNachPfk':
        const ppRatioBase = this.ppRatioNachtBase();
        modalData = {
          title: 'PpUG nach PFK',
          steps: [
            {
              name: 'PpUG nach PFK',
              formula: `PpUG nach PFK = MiNa Bestände (MiNa) / Pp-Ratio Basiswert`,
              description: `Berechnet die benötigte Pflegekraft-Anzahl basierend auf der Nachtbelegung`,
              example: `Wenn MiNa Bestände (MiNa) = 20.0 und Pp-Ratio Basis = ${ppRatioBase}, dann: 20.0 / ${ppRatioBase} = ${(20.0 / ppRatioBase).toFixed(2)}`
            }
          ],
          constants: [
            { name: 'Pp-Ratio Basiswert (Nacht)', value: `${ppRatioBase}`, unit: 'Zahl' }
          ],
          dataSource: 'MiNa Bestände (MiNa) (aus MiNa/MiTa-Beständen)'
        };
        break;

      case 'ppugInStunden':
        const ppRatioBase2 = this.ppRatioNachtBase();
        const schichtStunden2 = this.schichtStundenNacht();
        modalData = {
          title: 'PpUG nach PFK in Stunden',
          steps: [
            {
              name: 'PpUG nach PFK in Stunden',
              formula: `PpUG nach PFK in Std. = (MiNa Bestände (MiNa) × Schichtstunden) / Pp-Ratio Basiswert`,
              description: `Umrechnung der benötigten Pflegekraft-Anzahl in Arbeitsstunden`,
              example: `Wenn MiNa Bestände (MiNa) = 20.0, Schichtstunden = ${schichtStunden2}, Pp-Ratio = ${ppRatioBase2}: (20.0 × ${schichtStunden2}) / ${ppRatioBase2} = ${((20.0 * schichtStunden2) / ppRatioBase2).toFixed(2)} Stunden`
            }
          ],
          constants: [
            { name: 'Pp-Ratio Basiswert (Nacht)', value: `${ppRatioBase2}`, unit: 'Zahl' },
            { name: 'Schichtstunden (Nacht)', value: `${schichtStunden2}`, unit: 'Stunden' }
          ],
          dataSource: 'MiNa Bestände (MiNa) (aus MiNa/MiTa-Beständen)'
        };
        break;

      case 'ppugErfuellt':
        const ppRatioBase3 = this.ppRatioNachtBase();
        modalData = {
          title: 'PpUG erfüllt',
          steps: [
            {
              name: 'PpUG erfüllt (Version 1)',
              formula: `PpUG erfüllt = (Ergibt PFK (PFK Normal) >= PpUG nach PFK) ? 'Ja' : 'Nein'`,
              description: `Prüft, ob die vorhandene PFK-Anzahl (Ergibt PFK (PFK Normal)) ausreicht, um den PpUG-Bedarf zu decken`,
              example: `Wenn Ergibt PFK (PFK Normal) = 8.0 und PpUG nach PFK = 7.5 → 'Ja' (erfüllt)`
            },
            {
              name: 'PpUG nach PFK',
              formula: `PpUG nach PFK = MiNa Bestände (MiNa) / Pp-Ratio Basiswert`,
              description: `Berechnet den benötigten Pflegekraft-Bedarf`,
              example: `MiNa Bestände (MiNa) / ${ppRatioBase3}`
            }
          ],
          constants: [
            { name: 'Pp-Ratio Basiswert (Nacht)', value: `${ppRatioBase3}`, unit: 'Zahl' }
          ],
          dataSource: 'Ergibt PFK (PFK Normal) (aus eingegebenen Stunden) und MiNa Bestände (MiNa) (aus Beständen)'
        };
        break;

      case 'gesamteAnrechbareAZ':
        modalData = {
          title: 'Gesamte anrechenbare Arbeitszeit',
          steps: [
            {
              name: 'Gesamte anrechenbare AZ',
              formula: `Gesamte anrechb. AZ = Arbeitszeitstunden + Tatsächlich anrechenbar`,
              description: `Summe aus eingegebenen Arbeitszeitstunden (PFK) und tatsächlich anrechenbaren PHK-Stunden`,
              example: `Wenn Arbeitszeit = 64h und tatsächlich anrechenbar = 7.0h → Gesamt = 71.0h`
            },
            {
              name: 'Tatsächlich anrechenbar',
              formula: `Tatsächlich anrechenbar = min(Geleistete AZ PHK, Anrechenbare AZ PHK (PHK Anrechenbar))`,
              description: `Der kleinere Wert von tatsächlich geleisteten PHK-Stunden und berechneten Anrechenbare AZ PHK (PHK Anrechenbar)`,
              example: `Wenn geleistet: 7.0h, berechnet: 7.12h → tatsächlich: 7.0h`
            }
          ],
          dataSource: 'Eingegebene Arbeitszeitstunden (PFK) und PHK-Stunden (aus PHK-Reiter)'
        };
        break;

      case 'examPflege':
        const schichtStunden3 = this.schichtStundenNacht();
        modalData = {
          title: 'Exam. Pflege (Examinierte Pflege)',
          steps: [
            {
              name: 'Exam. Pflege',
              formula: `Exam. Pflege = Gesamte anrechb. AZ / Schichtstunden`,
              description: `Berechnet die Anzahl der examinierten Pflegekräfte basierend auf der gesamten anrechenbaren Arbeitszeit`,
              example: `Wenn Gesamte anrechb. AZ = 71.0h und Schichtstunden = ${schichtStunden3}: 71.0 / ${schichtStunden3} = ${(71.0 / schichtStunden3).toFixed(4)}`
            },
            {
              name: 'Gesamte anrechb. AZ',
              formula: `Gesamte anrechb. AZ = Arbeitszeitstunden + Tatsächlich anrechenbar`,
              description: `Summe aus PFK- und PHK-Stunden`,
              example: `Arbeitszeit + min(Geleistete PHK, PHK Anrechenbar)`
            }
          ],
          constants: [
            { name: 'Schichtstunden (Nacht)', value: `${schichtStunden3}`, unit: 'Stunden' }
          ],
          dataSource: 'Gesamte anrechenbare Arbeitszeit (berechnet)'
        };
        break;

      case 'ppugErfuelltV2':
        const ppRatioBase4 = this.ppRatioNachtBase();
        modalData = {
          title: 'PpUG erfüllt (Version 2)',
          steps: [
            {
              name: 'PpUG erfüllt (Version 2)',
              formula: `PpUG erfüllt = (Exam. Pflege >= PpUG nach PFK) ? 'Ja' : 'Nein'`,
              description: `Prüft, ob die examinierte Pflegekraft-Anzahl (inkl. PHK-Anteil) ausreicht, um den PpUG-Bedarf zu decken`,
              example: `Wenn Exam. Pflege = 8.9 und PpUG nach PFK = 7.5 → 'Ja' (erfüllt)`
            },
            {
              name: 'Exam. Pflege',
              formula: `Exam. Pflege = Gesamte anrechb. AZ / Schichtstunden`,
              description: `Anzahl examinierter Pflegekräfte (inkl. PHK-Anteil)`,
              example: `Berechnet aus Gesamte anrechb. AZ`
            },
            {
              name: 'PpUG nach PFK',
              formula: `PpUG nach PFK = MiNa Bestände (MiNa) / Pp-Ratio Basiswert`,
              description: `Benötigter Pflegekraft-Bedarf`,
              example: `MiNa Bestände (MiNa) / ${ppRatioBase4}`
            }
          ],
          constants: [
            { name: 'Pp-Ratio Basiswert (Nacht)', value: `${ppRatioBase4}`, unit: 'Zahl' }
          ],
          dataSource: 'Exam. Pflege (berechnet) und MiNa Bestände (MiNa) (aus Beständen)'
        };
        break;
    }

    this.dialog.open(CalculationInfoDialog, {
      width: '600px',
      data: modalData
    });
  }
}

@Component({
  selector: 'calculation-info-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <h2 mat-dialog-title>{{ data.title }}</h2>
    <mat-dialog-content>
      <div class="calculation-steps" *ngFor="let step of data.steps">
        <div class="step-header">
          <mat-icon>calculate</mat-icon>
          <h3>{{ step.name }}</h3>
        </div>
        <div class="formula">{{ step.formula }}</div>
        <p class="description">{{ step.description }}</p>
        <div class="example" *ngIf="step.example">
          <strong>Beispiel:</strong> {{ step.example }}
        </div>
      </div>
      <div class="constants" *ngIf="data.constants && data.constants.length > 0">
        <h4>Konstanten:</h4>
        <div class="constant-item" *ngFor="let constant of data.constants">
          <strong>{{ constant.name }}:</strong> {{ constant.value }} {{ constant.unit }}
        </div>
      </div>
      <div class="data-source" *ngIf="data.dataSource">
        <h4>Datenquelle:</h4>
        <p>{{ data.dataSource }}</p>
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="close()">Schließen</button>
    </mat-dialog-actions>
  `,
  styles: [`
    .calculation-steps {
      margin-bottom: 24px;
    }
    .step-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
    }
    .step-header mat-icon {
      color: #0066cc;
    }
    .step-header h3 {
      margin: 0;
      font-size: 18px;
    }
    .formula {
      background: #f5f5f5;
      padding: 12px;
      border-radius: 4px;
      font-family: 'Courier New', monospace;
      font-size: 14px;
      margin-bottom: 8px;
    }
    .description {
      color: #666;
      margin-bottom: 8px;
    }
    .example {
      background: #e3f2fd;
      padding: 8px 12px;
      border-radius: 4px;
      font-size: 13px;
      margin-top: 8px;
    }
    .constants {
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px solid #e0e0e0;
    }
    .constants h4 {
      margin: 0 0 8px 0;
      font-size: 16px;
    }
    .constant-item {
      margin-bottom: 4px;
      font-size: 14px;
    }
    .data-source {
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px solid #e0e0e0;
    }
    .data-source h4 {
      margin: 0 0 8px 0;
      font-size: 16px;
    }
    .data-source p {
      margin: 0;
      color: #666;
      font-size: 14px;
    }
  `]
})
export class CalculationInfoDialog {
  constructor(
    private dialogRef: MatDialogRef<CalculationInfoDialog>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {}

  close(): void {
    this.dialogRef.close();
  }
}

