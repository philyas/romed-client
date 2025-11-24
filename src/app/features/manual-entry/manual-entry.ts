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
import { Router } from '@angular/router';
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
  belegteBettenKonstante = signal<number>(25); // Default-Wert
  
  // Day entries for the selected month
  dayEntries = signal<DayEntry[]>([]);
  
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

  onShiftToggle(value: 'tag' | 'nacht') {
    if (value === 'nacht') {
      this.router.navigate(['/manual-entry-nacht']);
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
    
    this.api.getManualEntryData(station, jahr, monat, kategorie).subscribe({
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
    
    // Lade MiTa-Durchschnitt für diese Station
    if (station) {
      this.api.getStationMitaAverage(station).subscribe({
        next: (response) => {
          if (response.mitaDurchschnitt !== null) {
            this.belegteBettenKonstante.set(response.mitaDurchschnitt);
            console.log(`✅ MiTa-Durchschnitt für ${station}: ${response.mitaDurchschnitt}`);
          } else {
            console.log(`⚠️ Kein MiTa-Durchschnitt für ${station} gefunden. Verwende Standard: 25`);
            this.belegteBettenKonstante.set(25);
          }
        },
        error: (err) => {
          console.error('Error loading MiTa average:', err);
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
    if (konstante === 0) return 'Division durch 0';
    
    // Patienten pro Pflegekraft = Exam. Pflege / Konstante (MiTa-Durchschnitt)
    const patientenProPflegekraft = examPflege / konstante;
    
    return patientenProPflegekraft.toFixed(4);
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

