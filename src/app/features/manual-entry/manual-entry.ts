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
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Api } from '../../core/api';
import { Router, ActivatedRoute } from '@angular/router';
import { MatButtonToggleModule } from '@angular/material/button-toggle';

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
  selector: 'app-manual-entry',
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
    MatDividerModule,
    MatTooltipModule
  ],
  templateUrl: './manual-entry.html',
  styleUrl: './manual-entry.scss'
})
export class ManualEntry {
  private api = inject(Api);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private snackBar = inject(MatSnackBar);
  private dialog = inject(MatDialog);

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
  selectedFile = signal<File | null>(null);
  selectedVariant = signal<'2026' | 'legacy'>('legacy');
  
  // Konstante für Patienten-Berechnung (Mitternachtsstatistik Tag / Belegte Betten)
  belegteBettenKonstante = signal<number | null>(null); // Kein Fallback mehr
  
  // P:P Werte aus calculation rules
  ppRatioTagBase = signal<number>(10); // Default: 10
  ppRatioNachtBase = signal<number>(20); // Default: 20
  
  // Schichtstunden aus calculation rules
  schichtStundenTag = signal<number>(16); // Default: 16
  schichtStundenNacht = signal<number>(8); // Default: 8
  
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
        }
      },
      error: (err) => {
        console.error('Error loading calculation constants:', err);
      }
    });
  }

  onShiftToggle(value: 'tag' | 'nacht') {
    if (value === 'nacht') {
      // Preserve current selection when switching to nacht tab
      const queryParams: any = {};
      const station = this.selectedStation();
      const year = this.selectedYear();
      const month = this.selectedMonth();
      const kategorie = this.selectedKategorie();
      
      if (station) queryParams.station = station;
      if (year) queryParams.year = year.toString();
      if (month) queryParams.month = month.toString();
      if (kategorie) queryParams.kategorie = kategorie;
      
      this.router.navigate(['/manual-entry-nacht'], { queryParams });
    }
  }

  loadStations() {
    this.api.getManualEntryStations().subscribe({
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
        
        // Berechne MiTa-Durchschnitt aus täglichen Werten
        let mitaSum = 0;
        let mitaCount = 0;
        dailyMap.forEach((dayData) => {
          if (dayData && dayData.mita !== null && !isNaN(dayData.mita)) {
            mitaSum += dayData.mita;
            mitaCount++;
          }
        });
        
        if (mitaCount > 0) {
          const mitaDurchschnitt = Math.round((mitaSum / mitaCount) * 100) / 100;
          this.belegteBettenKonstante.set(mitaDurchschnitt);
          console.log(`✅ MiTa-Durchschnitt aus täglichen Werten für ${station}: ${mitaDurchschnitt} (${mitaCount} Tage)`);
        } else {
          console.log(`⚠️ Keine MiTa-Werte für ${station} gefunden. Kein Fallback.`);
          this.belegteBettenKonstante.set(null);
        }
      },
      error: (err) => {
        console.error('Error loading daily MiNa/MiTa values:', err);
        this.dailyMinaMita.set(new Map());
        this.belegteBettenKonstante.set(null);
      }
    });
    
    this.api.getManualEntryData(station, jahr, monat, kategorie, 'tag').subscribe({
      next: (response) => {
        if (response.data.length > 0) {
          // Lade Durchschnittswerte (Tag=0)
          const durchschnitt = response.data.find(d => d.Tag === 0);
          if (durchschnitt && durchschnitt.PHK_Anrechenbar_Stunden !== undefined) {
            this.durchschnittPhkAnrechenbar.set(durchschnitt.PHK_Anrechenbar_Stunden);
          } else {
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

  onStationChange(station: string) {
    this.selectedStation.set(station);
    // MiTa-Durchschnitt wird jetzt aus täglichen Werten berechnet (in loadDataForPeriod)
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

    this.api.saveManualEntry(station, jahr, monat, kategorie, entries).subscribe({
      next: (response) => {
        this.saving.set(false);
        this.snackBar.open('Daten erfolgreich gespeichert', 'Schließen', { duration: 2000 });
      },
      error: (err) => {
        this.saving.set(false);
        console.error('Error saving data:', err);
        this.snackBar.open('Fehler beim Speichern', 'Schließen', { duration: 3000 });
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
    
    const confirmMessage = `Möchten Sie wirklich alle ${kategorie}-Einträge für ${this.getMonthName(month)} ${year} (${station}) löschen?\n\nDiese Aktion kann nicht rückgängig gemacht werden!`;
    
    if (confirm(confirmMessage)) {
      this.saving.set(true);
      
      // Delete data from server
      this.api.deleteManualEntry(station, year, month, kategorie).subscribe({
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

  clearAllStationData() {
    const station = this.selectedStation();
    const year = this.selectedYear();
    const month = this.selectedMonth();
    
    if (!station) {
      this.snackBar.open('Bitte wählen Sie eine Station aus', 'Schließen', { duration: 3000 });
      return;
    }
    
    const confirmMessage = `Möchten Sie wirklich ALLE Stunden-Daten (PFK und PHK) für ${this.getMonthName(month)} ${year} (${station}) löschen?\n\nDiese Aktion kann nicht rückgängig gemacht werden!`;
    
    if (confirm(confirmMessage)) {
      this.saving.set(true);
      
      // Delete ALL data from server (PFK and PHK)
      this.api.deleteAllManualEntry(station, year, month).subscribe({
        next: (response) => {
          this.saving.set(false);
          this.snackBar.open(response.message || `Alle Daten für ${station} wurden gelöscht`, 'Schließen', { duration: 3000 });
          
          // Reset local entries
          this.initializeEmptyEntries();
          
          // Clear related data
          this.durchschnittPhkAnrechenbar.set(null);
          this.geleistetePhkStunden.set(null);
          this.phkTageswerte.set(null);
        },
        error: (err) => {
          this.saving.set(false);
          console.error('Error deleting all station data:', err);
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
    
    const confirmMessage = `Möchten Sie wirklich ALLE Stunden-Daten (PFK und PHK) für ALLE Monate und Jahre für Station ${station} löschen?\n\nDiese Aktion kann nicht rückgängig gemacht werden!`;
    
    if (confirm(confirmMessage)) {
      this.saving.set(true);
      
      // Delete ALL data from server for this station (all months and years)
      this.api.deleteAllManualEntryForStation(station).subscribe({
        next: (response) => {
          this.saving.set(false);
          this.snackBar.open(response.message || `Alle Daten für Station ${station} wurden gelöscht`, 'Schließen', { duration: 3000 });
          
          // Reset local entries
          this.initializeEmptyEntries();
          
          // Clear related data
          this.durchschnittPhkAnrechenbar.set(null);
          this.geleistetePhkStunden.set(null);
          this.phkTageswerte.set(null);
        },
        error: (err) => {
          this.saving.set(false);
          console.error('Error deleting all station data:', err);
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

  getPhkValue(entry: DayEntry, field: 'pfkNormal' | 'gesamtPfkPhk' | 'phkEnd' | 'phkAnrechenbar'): string {
    const value = entry[field];
    if (value === undefined || value === null) {
      return '-';
    }
    return value.toFixed(field === 'phkAnrechenbar' ? 2 : 4);
  }

  getGesamtAnrechenbar(): string | null {
    if (this.selectedKategorie() !== 'PFK' || this.phkTageswerte() === null) {
      return null;
    }

    // Durchschnitt PFK in Stunden umrechnen
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
    
    // Berechne durchschnittliche tatsächlich anrechenbare PHK-Stunden
    const phkTageswerte = this.phkTageswerte();
    let totalTatsaechlichAnrechenbar = 0;
    let daysWithPhkData = 0;
    
    entries.forEach(entry => {
      const phkAnrechenbar = entry.phkAnrechenbar || 0;
      const tagData = phkTageswerte?.find(t => t.tag === entry.tag);
      
      if (tagData) {
        const phkStundenDezimal = tagData.gesamtDezimal;
        // Regel: Wenn PHK-Stunden >= PHK Anrechenbar, dann nimm PHK Anrechenbar, sonst PHK-Stunden
        const tatsaechlichAnrechenbar = phkStundenDezimal >= phkAnrechenbar ? phkAnrechenbar : phkStundenDezimal;
        totalTatsaechlichAnrechenbar += tatsaechlichAnrechenbar;
        daysWithPhkData++;
      }
    });
    
    if (daysWithPhkData === 0) return null;
    
    const avgTatsaechlichAnrechenbar = totalTatsaechlichAnrechenbar / daysWithPhkData;
    const gesamt = avgHoursPfk + avgTatsaechlichAnrechenbar;
    
    // Konvertiere zurück zu Stunden:Minuten
    const stunden = Math.floor(gesamt);
    const minuten = Math.round((gesamt - stunden) * 60);
    
    return `${stunden}:${minuten.toString().padStart(2, '0')}`;
  }

  getExamPflege(): number | null {
    if (this.selectedKategorie() !== 'PFK' || this.phkTageswerte() === null) {
      return null;
    }

    // Durchschnitt PFK in Stunden umrechnen
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
    
    // Berechne durchschnittliche tatsächlich anrechenbare PHK-Stunden
    const phkTageswerte = this.phkTageswerte();
    let totalTatsaechlichAnrechenbar = 0;
    let daysWithPhkData = 0;
    
    entries.forEach(entry => {
      const phkAnrechenbar = entry.phkAnrechenbar || 0;
      const tagData = phkTageswerte?.find(t => t.tag === entry.tag);
      
      if (tagData) {
        const phkStundenDezimal = tagData.gesamtDezimal;
        // Regel: Wenn PHK-Stunden >= PHK Anrechenbar, dann nimm PHK Anrechenbar, sonst PHK-Stunden
        const tatsaechlichAnrechenbar = phkStundenDezimal >= phkAnrechenbar ? phkAnrechenbar : phkStundenDezimal;
        totalTatsaechlichAnrechenbar += tatsaechlichAnrechenbar;
        daysWithPhkData++;
      }
    });
    
    if (daysWithPhkData === 0) return null;
    
    const avgTatsaechlichAnrechenbar = totalTatsaechlichAnrechenbar / daysWithPhkData;
    const gesamtAnrechenbar = avgHoursPfk + avgTatsaechlichAnrechenbar;
    
    // Exam. Pflege = Gesamt Anrechenbar / 16
    const examPflege = gesamtAnrechenbar / 16;
    
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
    
    // Patienten pro Pflegekraft = Exam. Pflege / Konstante (MiTa-Durchschnitt)
    const patientenProPflegekraft = examPflege / konstante;
    
    return patientenProPflegekraft.toFixed(4);
  }

  getDurchschnittPpugNachPfk(): string | null {
    const dailyMap = this.dailyMinaMita();
    const ppRatioBase = this.ppRatioTagBase();
    
    if (ppRatioBase === 0) return null;
    
    let sum = 0;
    let count = 0;
    
    // Berechne PpUG nach PFK für alle Tage mit MiTa-Daten
    dailyMap.forEach((dayData, tag) => {
      if (dayData && dayData.mita !== null) {
        const ppugNachPfk = dayData.mita / ppRatioBase;
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

  getDurchschnittPhkAusstattung(): string | null {
    const entries = this.dayEntries();
    const phkTageswerte = this.phkTageswerte();
    const schichtStunden = this.schichtStundenTag();
    
    if (!phkTageswerte || schichtStunden === 0) return null;
    
    let sum = 0;
    let count = 0;
    
    // Berechne Durchschnitt von "Tatsächlich Anrechenbar" für alle Tage mit Daten
    entries.forEach(entry => {
      const tagData = phkTageswerte.find(t => t.tag === entry.tag);
      if (tagData) {
        const phkAnrechenbar = entry.phkAnrechenbar || 0;
        const phkStundenDezimal = tagData.gesamtDezimal;
        
        // Regel: Wenn PHK-Stunden >= PHK Anrechenbar, dann nimm PHK Anrechenbar, sonst PHK-Stunden
        const tatsaechlichAnrechenbar = phkStundenDezimal >= phkAnrechenbar ? phkAnrechenbar : phkStundenDezimal;
        
        sum += tatsaechlichAnrechenbar;
        count++;
      }
    });
    
    if (count === 0) return null;
    
    // Durchschnitt von "Tatsächlich Anrechenbar" durch Schichtstunden
    const durchschnittTatsaechlichAnrechenbar = sum / count;
    const phkAusstattung = durchschnittTatsaechlichAnrechenbar / schichtStunden;
    
    return phkAusstattung.toFixed(4);
  }

  getAnzahlPpugvErfuelltNein(): number | null {
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

  getMitaForTag(tag: number): string {
    const dailyMap = this.dailyMinaMita();
    const dayData = dailyMap.get(tag);
    if (dayData && dayData.mita !== null) {
      return dayData.mita.toFixed(1);
    }
    return '-';
  }

  getPpugNachPfkForTag(tag: number): string {
    const dailyMap = this.dailyMinaMita();
    const dayData = dailyMap.get(tag);
    if (dayData && dayData.mita !== null) {
      // PpUG nach PFK = MiTa / pp_ratio_tag_base
      const ppRatioBase = this.ppRatioTagBase();
      const result = dayData.mita / ppRatioBase;
      return result.toFixed(2);
    }
    return '-';
  }

  getPpugNachPfkInStundenForTag(tag: number): string {
    const dailyMap = this.dailyMinaMita();
    const dayData = dailyMap.get(tag);
    if (dayData && dayData.mita !== null) {
      // PpUG nach PFK in Std. = (MiTa / pp_ratio_tag_base) × Schichtstunden Tag
      // = MiTa × Schichtstunden Tag / pp_ratio_tag_base
      const ppRatioBase = this.ppRatioTagBase();
      const schichtStunden = this.schichtStundenTag();
      const result = (dayData.mita * schichtStunden) / ppRatioBase;
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
    
    if (!dayData || dayData.mita === null) {
      return '-';
    }
    
    // Berechne PpUG nach PFK
    const ppRatioBase = this.ppRatioTagBase();
    const ppugNachPfk = dayData.mita / ppRatioBase;
    
    // PFK Normal aus entry
    const pfkNormal = entry.pfkNormal;
    
    if (pfkNormal === undefined || pfkNormal === null) {
      return '-';
    }
    
    // Prüfe: PFK Normal >= PpUG nach PFK
    return pfkNormal >= ppugNachPfk ? 'Ja' : 'Nein';
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
      const schichtStunden = this.schichtStundenTag();
      const examPflege = arbeitszeitstundenDezimal / schichtStunden;
      return examPflege.toFixed(4);
    }
    
    const tagData = phkTageswerte.find(t => t.tag === entry.tag);
    if (!tagData) {
      // Wenn keine PHK-Daten für diesen Tag, nur Arbeitszeitstunden verwenden
      const schichtStunden = this.schichtStundenTag();
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
    
    // Exam. Pflege = Gesamte anrechb. AZ / Schichtstunden (Tag: 16 Stunden)
    const schichtStunden = this.schichtStundenTag();
    const examPflege = gesamtAnrechbareAZ / schichtStunden;
    
    return examPflege.toFixed(4);
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
    
    if (!dayData || dayData.mita === null) {
      return '-';
    }
    
    const ppRatioBase = this.ppRatioTagBase();
    const ppugNachPfk = dayData.mita / ppRatioBase;
    
    // Prüfe: Exam. Pflege >= PpUG nach PFK
    return examPflege >= ppugNachPfk ? 'Ja' : 'Nein';
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
        this.dialog.open(DienstplanUploadSuccessDialog, {
          width: '450px',
          disableClose: false,
          data: {
            message: response.message || 'Dienstplan erfolgreich importiert',
            totalEntries: response.totalEntries,
            uploads: response.uploaded
          }
        });

        // Clear selected file
        this.clearSelectedFile();

        // Reload data if station, year, month match
        const station = this.selectedStation();
        const year = this.selectedYear();
        const month = this.selectedMonth();
        const kategorie = this.selectedKategorie();

        if (station && year && month) {
          // Check if uploaded data matches current selection
          const matchingUpload = response.uploaded.find(u =>
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

  openCalculationModal(columnType: string) {
    // Da wir in der Tag-Komponente sind, ist die Schicht immer 'tag'
    const schicht = 'tag';
    const schichtStunden = 16;
    const phkAnteilBase = 10; // Standard-Wert, könnte aus API geladen werden
    const phkAnteil = 1 - (1 / phkAnteilBase);

    let modalData: any = {};

    switch (columnType) {
      case 'pfkNormal':
        modalData = {
          title: 'PFK Normal',
          steps: [
            {
              name: 'PFK Normal',
              formula: `PFK Normal = PFK-Stunden / Schichtdauer`,
              description: `Anzahl der vollen PFK-Schichten`,
              example: `Bei ${schichtStunden} Stunden Schichtdauer: 80 Stunden / ${schichtStunden} = 5.0 Schichten`
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
              name: 'PHK-Anteil berechnen',
              formula: `PHK-Anteil = 1 - (1 / Basiswert)`,
              description: `Berechnung des PHK-Anteils aus dem konfigurierbaren Basiswert`,
              example: `1 - (1 / ${phkAnteilBase}) = ${phkAnteil.toFixed(4)} (${(phkAnteil * 100).toFixed(0)}%)`
            },
            {
              name: 'Gesamt PFK+PHK',
              formula: `Gesamt PFK+PHK = PFK Normal / PHK-Anteil`,
              description: `Gesamtanzahl Personal (PFK + PHK zusammen)`,
              example: `5.0 / ${phkAnteil.toFixed(4)} = 5.56 Gesamt-Schichten`
            }
          ],
          constants: [
            { name: 'PHK-Anteil Basiswert', value: `${phkAnteilBase}`, unit: 'Zahl' },
            { name: 'PHK-Anteil', value: `${phkAnteil.toFixed(4)}`, unit: `(${(phkAnteil * 100).toFixed(0)}%)` }
          ]
        };
        break;

      case 'phkEnd':
        modalData = {
          title: 'PHK End',
          steps: [
            {
              name: 'PHK End',
              formula: `PHK End = Gesamt PFK+PHK - PFK Normal`,
              description: `Anzahl PHK-Schichten (Differenz zwischen Gesamt-Personal und PFK-Personal)`,
              example: `5.56 - 5.0 = 0.56 PHK-Schichten`
            }
          ]
        };
        break;

      case 'phkAnrechenbar':
        modalData = {
          title: 'PHK Anrechenbar',
          steps: [
            {
              name: 'PHK Anrechenbar',
              formula: `PHK Anrechenbar = PHK End × Schichtdauer`,
              description: `Anrechenbare PHK-Arbeitsstunden (für Berechnungen)`,
              example: `0.56 × ${schichtStunden} = ${(0.56 * schichtStunden).toFixed(2)} Stunden`
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
          ]
        };
        break;

      case 'tatsaechlichAnrechenbar':
        modalData = {
          title: 'Tatsächlich Anrechenbar',
          steps: [
            {
              name: 'Tatsächlich Anrechenbar',
              formula: `Tatsächlich Anrechenbar = min(Geleistete AZ PHK, PHK Anrechenbar)`,
              description: `Der kleinere Wert von geleisteten PHK-Stunden und berechneten PHK Anrechenbar`,
              example: `Wenn geleistet: 8.5h, berechnet: 8.96h → tatsächlich: 8.5h`
            }
          ]
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
  selector: 'dienstplan-upload-success-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <div class="dialog-container">
      <div class="dialog-header">
        <mat-icon>check_circle</mat-icon>
        <h2>Upload erfolgreich</h2>
      </div>
      <p class="dialog-message">{{ data.message }}</p>

      <div class="dialog-summary" *ngIf="data.totalEntries !== undefined && data.totalEntries !== null">
        <div class="summary-item">
          <mat-icon>summarize</mat-icon>
          <span>{{ data.totalEntries }} Einträge verarbeitet</span>
        </div>
      </div>
    </div>

    <div mat-dialog-actions align="end">
      <button mat-raised-button color="primary" (click)="close()">Schließen</button>
    </div>
  `,
  styles: [`
    .dialog-container {
      display: flex;
      flex-direction: column;
      gap: 16px;
      padding: 8px 4px;
    }

    .dialog-header {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .dialog-header mat-icon {
      color: #4caf50;
      font-size: 36px;
      width: 36px;
      height: 36px;
    }

    .dialog-header h2 {
      margin: 0;
      font-size: 22px;
      font-weight: 600;
    }

    .dialog-message {
      margin: 0;
      font-size: 15px;
      line-height: 1.5;
      color: #333;
    }

    .dialog-summary {
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 14px 12px;
      background: #f3f9f4;
      border-radius: 10px;
      border: 1px solid rgba(76, 175, 80, 0.2);
    }

    .summary-item {
      display: flex;
      align-items: center;
      gap: 10px;
      color: #2e7d32;
      font-weight: 500;
    }

    .summary-item mat-icon {
      font-size: 22px;
      width: 22px;
      height: 22px;
    }

  `]
})
export class DienstplanUploadSuccessDialog {
  constructor(
    private dialogRef: MatDialogRef<DienstplanUploadSuccessDialog>,
    @Inject(MAT_DIALOG_DATA) public data: {
      message: string;
      totalEntries?: number;
      uploads?: Array<{ station: string; jahr: number; monat: number }>;
    }
  ) {}

  close(): void {
    this.dialogRef.close();
  }
}

@Component({
  selector: 'app-calculation-info-dialog',
  template: `
    <div mat-dialog-title style="display: flex; align-items: center; gap: 8px;">
      <mat-icon>calculate</mat-icon>
      <span>Berechnungsformel: {{ data.title }}</span>
    </div>
    <mat-dialog-content>
      <div class="calculation-info">
        <div class="formula-section" *ngFor="let step of data.steps; let i = index">
          <div class="step-number">Schritt {{ i + 1 }}</div>
          <div class="formula">
            <strong>{{ step.name }}:</strong>
            <code>{{ step.formula }}</code>
          </div>
          <div class="description" *ngIf="step.description">
            {{ step.description }}
          </div>
          <div class="example" *ngIf="step.example">
            <em>Beispiel:</em> {{ step.example }}
          </div>
        </div>
        <div class="constants-section" *ngIf="data.constants && data.constants.length > 0">
          <mat-divider></mat-divider>
          <h3>Verwendete Konstanten:</h3>
          <ul>
            <li *ngFor="let constant of data.constants">
              <strong>{{ constant.name }}:</strong> {{ constant.value }}<span *ngIf="constant.unit"> {{ constant.unit }}</span>
            </li>
          </ul>
        </div>
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="close()">Schließen</button>
    </mat-dialog-actions>
  `,
  styles: [`
    .calculation-info {
      padding: 16px;
    }
    .formula-section {
      margin-bottom: 24px;
    }
    .step-number {
      font-weight: bold;
      color: #1976d2;
      margin-bottom: 8px;
    }
    .formula {
      margin: 8px 0;
      padding: 12px;
      background: #f5f5f5;
      border-radius: 4px;
    }
    code {
      display: block;
      margin-top: 4px;
      font-family: 'Courier New', monospace;
      font-size: 14px;
      color: #d32f2f;
    }
    .description {
      margin-top: 8px;
      color: #666;
    }
    .example {
      margin-top: 8px;
      padding: 8px;
      background: #e3f2fd;
      border-left: 3px solid #1976d2;
      font-size: 0.9em;
    }
    .constants-section {
      margin-top: 24px;
    }
    .constants-section h3 {
      margin-top: 16px;
      margin-bottom: 8px;
    }
    .constants-section ul {
      margin: 0;
      padding-left: 20px;
    }
    .constants-section li {
      margin: 4px 0;
    }
    h2 mat-dialog-title {
      display: flex;
      align-items: center;
      gap: 8px;
    }
  `],
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatDividerModule
  ],
  standalone: true
})
export class CalculationInfoDialog {
  constructor(
    private dialogRef: MatDialogRef<CalculationInfoDialog>,
    @Inject(MAT_DIALOG_DATA) public data: {
      title: string;
      steps: Array<{
        name: string;
        formula: string;
        description?: string;
        example?: string;
      }>;
      constants?: Array<{
        name: string;
        value: string | number;
        unit?: string;
      }>;
    }
  ) {}

  close(): void {
    this.dialogRef.close();
  }
}

