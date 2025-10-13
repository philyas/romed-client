import { Component, inject, signal, computed, effect } from '@angular/core';
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
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { Api } from '../../core/api';

interface DayEntry {
  tag: number;
  stunden: number;
  minuten: number;
  pfkNormal?: number;
  gesamtPfkPhk?: number;
  phkEnd?: number;
  phkAnrechenbar?: number;
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
    MatDialogModule
  ],
  templateUrl: './manual-entry-nacht.html',
  styleUrl: './manual-entry-nacht.scss'
})
export class ManualEntryNacht {
  private api = inject(Api);
  private snackBar = inject(MatSnackBar);
  private dialog = inject(MatDialog);

  // State
  stations = signal<string[]>([]);
  selectedStation = signal<string>('');
  selectedYear = signal<number>(new Date().getFullYear());
  selectedMonth = signal<number>(new Date().getMonth() + 1);
  selectedKategorie = signal<'PFK' | 'PHK'>('PFK');
  loading = signal<boolean>(false);
  saving = signal<boolean>(false);
  
  // Konstante für Patienten-Berechnung (MiNa-Durchschnitt für Nacht)
  belegteBettenKonstante = signal<number>(25); // Default-Wert
  
  // Day entries for the selected month
  dayEntries = signal<DayEntry[]>([]);
  
  // Durchschnittswerte (aus Backend Tag=0)
  durchschnittPhkAnrechenbar = signal<number | null>(null);
  
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
    
    this.api.getManualEntryNachtData(station, jahr, monat, kategorie).subscribe({
      next: (response) => {
        if (response.data.length > 0) {
          // Lade Durchschnittswerte (Tag=0)
          const durchschnitt = response.data.find(d => d.Tag === 0);
          if (durchschnitt && durchschnitt.PHK_Anrechenbar_Stunden !== undefined) {
            this.durchschnittPhkAnrechenbar.set(durchschnitt.PHK_Anrechenbar_Stunden);
          } else {
            this.durchschnittPhkAnrechenbar.set(null);
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
        }
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Error loading data:', err);
        this.initializeEmptyEntries();
        this.durchschnittPhkAnrechenbar.set(null);
        this.loading.set(false);
      }
    });
  }

  onStationChange(station: string) {
    this.selectedStation.set(station);
    
    // Lade MiNa-Durchschnitt für diese Station (Nacht verwendet MiNa)
    if (station) {
      this.api.getStationMinaAverage(station).subscribe({
        next: (response) => {
          if (response.minaDurchschnitt !== null) {
            this.belegteBettenKonstante.set(response.minaDurchschnitt);
            console.log(`✅ MiNa-Durchschnitt (Nacht) für ${station}: ${response.minaDurchschnitt}`);
          } else {
            console.log(`⚠️ Kein MiNa-Durchschnitt für ${station} gefunden. Verwende Standard: 25`);
            this.belegteBettenKonstante.set(25);
          }
        },
        error: (err) => {
          console.error('Error loading MiNa average:', err);
          this.belegteBettenKonstante.set(25); // Fallback
        }
      });
    }
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
    if (confirm('Möchten Sie wirklich alle Einträge für diesen Monat löschen?')) {
      this.initializeEmptyEntries();
      this.saveData();
    }
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
    const gesamtAnrechenbar = avgHoursPfk + phkAnrechenbar;
    
    const examPflege = gesamtAnrechenbar / 8; // Nachtschicht: 8 Stunden (22-6 Uhr)
    
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
    if (konstante === 0) return 'Division durch 0';
    
    const patientenProPflegekraft = examPflege / konstante;
    
    return patientenProPflegekraft.toFixed(4);
  }
}

