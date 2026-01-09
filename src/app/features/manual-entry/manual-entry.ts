import { Component, inject, signal, computed, effect, ViewChild, ElementRef, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormControl } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialogModule, MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatTabsModule } from '@angular/material/tabs';
import { Api } from '../../core/api';
import { Router, ActivatedRoute } from '@angular/router';
import { RecomputeConfigDialogComponent } from './recompute-config-dialog.component';
import { UploadConfigDialogComponent } from './upload-config-dialog.component';
import { StationConfigDialogComponent } from './station-config-dialog.component';
import { DienstplanPreviewDialogComponent, DienstplanPreviewData } from './dienstplan-preview-dialog.component';

interface DayEntry {
  tag: number;
  stunden: number;
  minuten: number;
  pausen_stunden?: number;
  pausen_minuten?: number;
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
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatSelectModule,
    MatAutocompleteModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatDialogModule,
    MatDividerModule,
    MatTooltipModule,
    MatTabsModule
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
  stationSearchTerm = signal<string>('');
  isEditingStation = signal<boolean>(false);
  
  // Filtered stations for autocomplete
  filteredStations = computed(() => {
    const term = this.stationSearchTerm().trim().toLowerCase();
    const allStations = this.stations();
    
    if (!term) {
      return allStations;
    }
    
    return allStations.filter(station => 
      station.toLowerCase().includes(term)
    );
  });
  
  // Computed input value - shows search term when editing, otherwise shows selected station
  stationInputValue = computed(() => {
    if (this.isEditingStation() || this.stationSearchTerm()) {
      return this.stationSearchTerm();
    }
    return this.selectedStation();
  });
  selectedYear = signal<number>(new Date().getFullYear());
  selectedMonth = signal<number>(new Date().getMonth() + 1);
  selectedKategorie = signal<'PFK' | 'PHK'>('PFK');
  selectedShift = signal<'tag' | 'nacht'>('tag');
  isShifting = signal<boolean>(false);
  loading = signal<boolean>(false);
  saving = signal<boolean>(false);
  uploading = signal<boolean>(false);
  recomputing = signal<boolean>(false);
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
  
  // Station Config (für Pausenzeiten)
  stationConfig = signal<{
    pausen_aktiviert: boolean;
    pausen_stunden: number;
    pausen_minuten: number;
  } | null>(null);
  
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


  loadStations() {
    const apiCall = this.selectedShift() === 'tag'
      ? this.api.getManualEntryStations()
      : this.api.getManualEntryNachtStations();

    apiCall.subscribe({
      next: (response) => {
        this.stations.set(response.stations);
        // Sync selectedStation if it's still valid
        const currentStation = this.selectedStation();
        if (currentStation && !response.stations.includes(currentStation)) {
          // Station not available in new shift, clear it
          this.selectedStation.set('');
          this.stationSearchTerm.set('');
          this.isEditingStation.set(false);
        }
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
    const pausenConfig = this.stationConfig();
    
    for (let i = 1; i <= days; i++) {
      const pausenStunden = pausenConfig && pausenConfig.pausen_aktiviert ? pausenConfig.pausen_stunden : 0;
      const pausenMinuten = pausenConfig && pausenConfig.pausen_aktiviert ? pausenConfig.pausen_minuten : 0;
      entries.push({ 
        tag: i, 
        stunden: 0, 
        minuten: 0,
        pausen_stunden: pausenStunden,
        pausen_minuten: pausenMinuten
      });
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
        
        // Berechne Durchschnitt je nach Schicht: Tag = MiTa, Nacht = MiNa
        const schicht = this.selectedShift();
        let sum = 0;
        let count = 0;
        dailyMap.forEach((dayData) => {
          const value = schicht === 'tag' ? dayData.mita : dayData.mina;
          if (value !== null && !isNaN(value)) {
            sum += value;
            count++;
          }
        });
        
        if (count > 0) {
          const durchschnitt = Math.round((sum / count) * 100) / 100;
          this.belegteBettenKonstante.set(durchschnitt);
          const wertName = schicht === 'tag' ? 'MiTa' : 'MiNa';
          console.log(`✅ ${wertName}-Durchschnitt aus täglichen Werten für ${station}: ${durchschnitt} (${count} Tage)`);
        } else {
          const wertName = schicht === 'tag' ? 'MiTa' : 'MiNa';
          console.log(`⚠️ Keine ${wertName}-Werte für ${station} gefunden. Kein Fallback.`);
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
    
    // Lade Stationskonfiguration für Pausenzeiten (muss vor dem Laden der Daten geladen werden)
    this.loadStationConfigForPausenzeiten(station, kategorie).then(() => {
      this.loadManualEntryData(station, jahr, monat, kategorie);
    });
  }

  loadManualEntryData(station: string, jahr: number, monat: number, kategorie: 'PFK' | 'PHK') {
    this.api.getManualEntryData(station, jahr, monat, kategorie, this.selectedShift()).subscribe({
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
          
          // Get station config for pausenzeiten
          const pausenConfig = this.stationConfig();
          
          for (let i = 1; i <= days; i++) {
            const existing = dataEntries.find(d => d.Tag === i);
            if (existing) {
              const gesamtStunden = existing.Stunden || 0;
              const gesamtMinuten = existing.Minuten || 0;
              
              // Wenn Pausenzeiten aktiviert sind, teile Gesamtzeit auf
              let normaleStunden = gesamtStunden;
              let normaleMinuten = gesamtMinuten;
              let pausenStunden = 0;
              let pausenMinuten = 0;
              
              if (pausenConfig && pausenConfig.pausen_aktiviert) {
                // Gesamtzeit in Minuten
                const gesamtTotalMinutes = (gesamtStunden * 60) + gesamtMinuten;
                // Pausenzeit in Minuten
                const pausenTotalMinutes = (pausenConfig.pausen_stunden * 60) + pausenConfig.pausen_minuten;
                
                // Normale Zeit = Gesamtzeit - Pausenzeit
                const normaleTotalMinutes = Math.max(0, gesamtTotalMinutes - pausenTotalMinutes);
                normaleStunden = Math.floor(normaleTotalMinutes / 60);
                normaleMinuten = normaleTotalMinutes % 60;
                
                // Pausenzeit (kann vom Benutzer überschrieben werden)
                pausenStunden = pausenConfig.pausen_stunden;
                pausenMinuten = pausenConfig.pausen_minuten;
              }
              
              entries.push({
                tag: i,
                stunden: normaleStunden,
                minuten: normaleMinuten,
                pausen_stunden: pausenStunden,
                pausen_minuten: pausenMinuten,
                pfkNormal: existing.PFK_Normal,
                gesamtPfkPhk: existing.Gesamt_PFK_PHK,
                phkEnd: existing.PHK_End,
                phkAnrechenbar: existing.PHK_Anrechenbar_Stunden
              });
            } else {
              // Initialize with default pausenzeiten if enabled
              const pausenStunden = pausenConfig && pausenConfig.pausen_aktiviert ? pausenConfig.pausen_stunden : 0;
              const pausenMinuten = pausenConfig && pausenConfig.pausen_aktiviert ? pausenConfig.pausen_minuten : 0;
              entries.push({ 
                tag: i, 
                stunden: 0, 
                minuten: 0,
                pausen_stunden: pausenStunden,
                pausen_minuten: pausenMinuten
              });
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
        // Reset shifting state after data is loaded
        if (this.isShifting()) {
          setTimeout(() => {
            this.isShifting.set(false);
          }, 200);
        }
      },
      error: (err) => {
        console.error('Error loading data:', err);
        this.initializeEmptyEntries();
        this.durchschnittPhkAnrechenbar.set(null);
        this.geleistetePhkStunden.set(null);
        this.phkTageswerte.set(null);
        this.loading.set(false);
        // Reset shifting state even on error
        if (this.isShifting()) {
          setTimeout(() => {
            this.isShifting.set(false);
          }, 200);
        }
      }
    });
  }

  loadStationConfigForPausenzeiten(station: string, kategorie: 'PFK' | 'PHK'): Promise<void> {
    return new Promise((resolve) => {
      const apiCall = this.selectedShift() === 'tag'
        ? this.api.getStationConfig(station, kategorie, 'tag')
        : this.api.getStationConfigNacht(station, kategorie);
      
      apiCall.subscribe({
        next: (config) => {
          this.stationConfig.set({
            pausen_aktiviert: config.pausen_aktiviert || false,
            pausen_stunden: config.pausen_stunden || 0,
            pausen_minuten: config.pausen_minuten || 0
          });
          resolve();
        },
        error: (err) => {
          console.error('Error loading station config for pausenzeiten:', err);
          this.stationConfig.set({
            pausen_aktiviert: false,
            pausen_stunden: 0,
            pausen_minuten: 0
          });
          resolve(); // Resolve auch bei Fehler, damit die Daten trotzdem geladen werden
        }
      });
    });
  }

  loadConfigSnapshot(station: string, jahr: number, monat: number, kategorie: 'PFK' | 'PHK') {
    this.loadingConfigSnapshot.set(true);
    this.api.getConfigSnapshot(station, jahr, monat, kategorie, this.selectedShift()).subscribe({
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
    const schicht = this.selectedShift();
    
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
        schicht: schicht as 'tag' | 'nacht',
        schichtLabel: schicht === 'tag' ? 'Tag' : 'Nacht'
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

  onStationChange(station: string | null) {
    if (station) {
      this.selectedStation.set(station);
      this.stationSearchTerm.set('');
      this.isEditingStation.set(false);
    } else {
      this.selectedStation.set('');
      this.stationSearchTerm.set('');
      this.isEditingStation.set(false);
    }
    // MiTa-Durchschnitt wird jetzt aus täglichen Werten berechnet (in loadDataForPeriod)
    // Kein separater API-Call mehr nötig
  }
  
  onStationInput(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    if (!this.isEditingStation()) {
      this.isEditingStation.set(true);
    }
    this.stationSearchTerm.set(value);
  }
  
  onStationInputFocus() {
    // Clear search term to show all stations when focusing
    if (!this.isEditingStation()) {
      this.stationSearchTerm.set('');
    }
  }
  
  onStationInputBlur() {
    // Reset editing state
    this.isEditingStation.set(false);
    
    // If there's a search term, check if it matches a station
    const searchTerm = this.stationSearchTerm();
    const currentStations = this.stations();
    
    if (searchTerm && currentStations.includes(searchTerm)) {
      // Valid input, select it
      this.selectedStation.set(searchTerm);
      this.stationSearchTerm.set('');
    } else if (searchTerm && !currentStations.includes(searchTerm)) {
      // Invalid input, restore previous selection or clear
      if (this.selectedStation()) {
        this.stationSearchTerm.set('');
      } else {
        this.selectedStation.set('');
        this.stationSearchTerm.set('');
      }
    } else {
      // No search term, keep current selection
      this.stationSearchTerm.set('');
    }
  }
  
  displayStation(station: string | null): string {
    return station || '';
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

  toggleShift() {
    const newShift = this.selectedShift() === 'tag' ? 'nacht' : 'tag';
    this.isShifting.set(true);
    // Small delay to show the transition animation
    setTimeout(() => {
      this.onShiftChange(newShift);
      // isShifting will be reset in loadManualEntryData when data is loaded
    }, 150);
  }

  onShiftChange(shift: 'tag' | 'nacht') {
    const previousStation = this.selectedStation();
    this.selectedShift.set(shift);
    // Set loading to show transition
    this.loading.set(true);

    // Load stations for the new shift first
    this.loadStations();

    // Check if the previously selected station is available in the new shift
    // We'll check this asynchronously after stations are loaded
    if (previousStation) {
      // Small delay to ensure stations are loaded
      setTimeout(() => {
        const currentStations = this.stations();
        if (currentStations.includes(previousStation)) {
          // Station is available in new shift, keep it selected
          this.selectedStation.set(previousStation);
          this.stationSearchTerm.set('');
          this.isEditingStation.set(false);
          // Reload data for the station in the new shift
          this.loadDataForPeriod(previousStation, this.selectedYear(), this.selectedMonth(), this.selectedKategorie());
        } else {
          // Station not available, reset selection
          this.selectedStation.set('');
          this.stationSearchTerm.set('');
          this.isEditingStation.set(false);
          this.dayEntries.set([]);
          this.loading.set(false);
          // Reset shifting state when done
          setTimeout(() => {
            this.isShifting.set(false);
          }, 200);
        }
      }, 100);
    } else {
      this.selectedStation.set('');
      this.stationSearchTerm.set('');
      this.isEditingStation.set(false);
      this.dayEntries.set([]);
      this.loading.set(false);
      // Reset shifting state when done
      setTimeout(() => {
        this.isShifting.set(false);
      }, 200);
    }
  }

  updateEntry(index: number, field: 'stunden' | 'minuten' | 'pausen_stunden' | 'pausen_minuten', value: string) {
    const numValue = parseInt(value) || 0;
    
    // Validate
    if (field === 'stunden' && numValue < 0) return;
    if (field === 'minuten' && (numValue < 0 || numValue >= 60)) return;
    if (field === 'pausen_stunden' && numValue < 0) return;
    if (field === 'pausen_minuten' && (numValue < 0 || numValue >= 60)) return;
    
    this.dayEntries.update(entries => {
      const newEntries = [...entries];
      newEntries[index] = {
        ...newEntries[index],
        [field]: numValue
      };
      return newEntries;
    });
  }
  
  // Berechne Gesamtzeit für einen Eintrag
  getGesamtzeit(entry: DayEntry): { stunden: number; minuten: number } {
    const normaleTotalMinutes = (entry.stunden * 60) + entry.minuten;
    const pausenTotalMinutes = ((entry.pausen_stunden || 0) * 60) + (entry.pausen_minuten || 0);
    const gesamtTotalMinutes = normaleTotalMinutes + pausenTotalMinutes;
    return {
      stunden: Math.floor(gesamtTotalMinutes / 60),
      minuten: gesamtTotalMinutes % 60
    };
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
    const schicht = this.selectedShift();
    
    // Berechne Gesamtzeit für jeden Eintrag (normale Zeit + Pausenzeit)
    const entries = this.dayEntries().map(entry => {
      const gesamtzeit = this.getGesamtzeit(entry);
      return {
        tag: entry.tag,
        stunden: gesamtzeit.stunden,
        minuten: gesamtzeit.minuten
      };
    });

    this.saving.set(true);

    this.api.saveManualEntry(station, jahr, monat, kategorie, schicht, entries).subscribe({
      next: (response) => {
        this.saving.set(false);
        this.snackBar.open('Daten erfolgreich gespeichert', 'Schließen', { duration: 2000 });
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
    return this.dayEntries().some(entry => {
      const gesamtzeit = this.getGesamtzeit(entry);
      return gesamtzeit.stunden > 0 || gesamtzeit.minuten > 0;
    });
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

    // Get current configuration values for current shift
    const schicht = this.selectedShift();
    const schichtStunden = schicht === 'tag' ? this.schichtStundenTag() : this.schichtStundenNacht();
    const ppRatioBase = schicht === 'tag' ? this.ppRatioTagBase() : this.ppRatioNachtBase();
    const phkAnteilBase = schicht === 'tag' ? this.phkAnteilTagBase() : this.phkAnteilNachtBase();

    // Open dialog with configuration
    const dialogRef = this.dialog.open(RecomputeConfigDialogComponent, {
      width: '600px',
      data: {
        station: station,
        jahr: jahr,
        monat: monat,
        kategorie: kategorie,
        schicht: schicht as 'tag' | 'nacht',
        schicht_stunden: schichtStunden,
        phk_anteil_base: phkAnteilBase,
        pp_ratio_base: ppRatioBase,
        schichtLabel: schicht === 'tag' ? 'Tag' : 'Nacht'
      }
    });

    dialogRef.afterClosed().subscribe((result: any) => {
      if (result && result.confirmed) {
        this.performRecompute(
          station, 
          jahr, 
          monat, 
          kategorie as 'PFK' | 'PHK', 
          schicht,
          result.config
        );
      }
    });
  }

  private performRecompute(station: string, jahr: number, monat: number, kategorie: 'PFK' | 'PHK', schicht: 'tag' | 'nacht', configOverrides?: { schicht_stunden?: number; phk_anteil_base?: number | null; pp_ratio_base?: number }) {
    this.recomputing.set(true);

    const body: any = {
      station,
      jahr,
      monat,
      kategorie,
      schicht
    };

    // Add config overrides if provided
    if (configOverrides) {
      if (configOverrides.schicht_stunden !== undefined) {
        body.schicht_stunden = configOverrides.schicht_stunden;
      }
      if (configOverrides.phk_anteil_base !== undefined && configOverrides.phk_anteil_base !== null) {
        body.phk_anteil_base = configOverrides.phk_anteil_base;
      }
      if (configOverrides.pp_ratio_base !== undefined) {
        body.pp_ratio_base = configOverrides.pp_ratio_base;
      }
    }

    this.api.recomputeManualEntry(station, jahr, monat, kategorie, schicht, configOverrides).subscribe({
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
        // Create download link
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
      const gesamtzeit = this.getGesamtzeit(entry);
      totalMinutes += (gesamtzeit.stunden * 60) + gesamtzeit.minuten;
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
      const gesamtzeit = this.getGesamtzeit(entry);
      const dayMinutes = (gesamtzeit.stunden * 60) + gesamtzeit.minuten;
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
      const gesamtzeit = this.getGesamtzeit(entry);
      const dayMinutes = (gesamtzeit.stunden * 60) + gesamtzeit.minuten;
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
    
    // Berechne durchschnittliche tatsächlich anrechenbare PHK-Stunden (wie Backend - nur Tage mit usable > 0)
    const phkTageswerte = this.phkTageswerte();
    let tatsaechlichAnrechenbar = 0;
    const collected: number[] = [];
    
    entries.forEach(entry => {
      const phkAnrechenbar = entry.phkAnrechenbar || 0;
      const tagData = phkTageswerte?.find(t => t.tag === entry.tag);
      
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
      // Fallback zu Durchschnittswert wenn keine Tageswerte verfügbar (wie im Backend)
      tatsaechlichAnrechenbar = this.durchschnittPhkAnrechenbar() || 0;
    }
    
    const avgTatsaechlichAnrechenbar = tatsaechlichAnrechenbar;
    const gesamtAnrechenbar = avgHoursPfk + avgTatsaechlichAnrechenbar;
    
    const schicht = this.selectedShift();
    const schichtStunden = schicht === 'tag' ? this.schichtStundenTag() : this.schichtStundenNacht();
    // Exam. Pflege = Gesamt Anrechenbar / Schichtstunden (Tag: 16h, Nacht: 8h)
    const examPflege = gesamtAnrechenbar / schichtStunden;
    
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
    const schicht = this.selectedShift();
    const ppRatioBase = schicht === 'tag' ? this.ppRatioTagBase() : this.ppRatioNachtBase();
    
    if (ppRatioBase === 0) return null;
    
    let sum = 0;
    let count = 0;
    
    // Berechne PpUG nach PFK für alle Tage mit MiTa/MiNa-Daten
    dailyMap.forEach((dayData, tag) => {
      // Tag = MiTa, Nacht = MiNa
      const value = schicht === 'tag' ? dayData.mita : dayData.mina;
      if (value !== null && !isNaN(value)) {
        const ppugNachPfk = value / ppRatioBase;
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
    
    const schicht = this.selectedShift();
    // Tag = MiTa, Nacht = MiNa
    const dailyMap = this.dailyMinaMita();
    let sum = 0;
    let count = 0;
    
    // Berechne Durchschnitt von MiTa/MiNa für alle Tage mit Daten
    dailyMap.forEach((dayData, tag) => {
      const value = schicht === 'tag' ? dayData.mita : dayData.mina;
      if (value !== null && !isNaN(value)) {
        sum += value;
        count++;
      }
    });
    
    if (count === 0) return null;
    
    const durchschnittMi = sum / count;
    
    const durchschnittPfkNormalStr = this.getDurchschnittPfkNormal();
    if (durchschnittPfkNormalStr === null) {
      return null;
    }
    
    const durchschnittPfkNormal = parseFloat(durchschnittPfkNormalStr);
    if (isNaN(durchschnittPfkNormal)) {
      return null;
    }
    
    // P:P = durchschnitt MiTa/MiNa : durchschnitt PFK Normal
    if (durchschnittPfkNormal === 0) return null;
    const ppRatio = durchschnittMi / durchschnittPfkNormal;
    return ppRatio;
  }

  getDurchschnittPhkAusstattung(): string | null {
    // PHK-Ausstattung ist identisch mit Durchschnitt tatsächlich anrechenbar
    return this.getDurchschnittTatsaechlichAnrechenbar();
  }

  getDurchschnittTatsaechlichAnrechenbar(): string | null {
    const entries = this.dayEntries();
    const phkTageswerte = this.phkTageswerte();
    const schicht = this.selectedShift();
    const schichtStunden = schicht === 'tag' ? this.schichtStundenTag() : this.schichtStundenNacht();
    
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

  // Berechnet den PHK-Anteil basierend auf der aktuellen Schicht
  getPhkAnteil(): number {
    const schicht = this.selectedShift();
    const phkAnteilBase = schicht === 'tag' 
      ? (this.phkAnteilTagBase() || 10) 
      : (this.phkAnteilNachtBase() || 10);
    
    // PHK-Anteil = 1 - (Basiswert / 100)
    const phkAnteil = 1 - (phkAnteilBase / 100);
    return phkAnteil;
  }

  // Gibt den PHK-Anteil als Prozent-String zurück (z.B. "90%")
  getPhkAnteilPercent(): string {
    const phkAnteil = this.getPhkAnteil();
    return `${(phkAnteil * 100).toFixed(0)}%`;
  }

  getMitaForTag(tag: number): string {
    const dailyMap = this.dailyMinaMita();
    const dayData = dailyMap.get(tag);
    if (!dayData) return '-';
    
    // Tag = MiTa, Nacht = MiNa
    const schicht = this.selectedShift();
    const value = schicht === 'tag' ? dayData.mita : dayData.mina;
    
    if (value !== null && !isNaN(value)) {
      return value.toFixed(1);
    }
    return '-';
  }

  getPpugNachPfkForTag(tag: number): string {
    const dailyMap = this.dailyMinaMita();
    const dayData = dailyMap.get(tag);
    if (!dayData) return '-';
    
    const schicht = this.selectedShift();
    // Tag = MiTa, Nacht = MiNa
    const value = schicht === 'tag' ? dayData.mita : dayData.mina;
    const ppRatioBase = schicht === 'tag' ? this.ppRatioTagBase() : this.ppRatioNachtBase();
    
    if (value !== null && !isNaN(value) && ppRatioBase > 0) {
      // PpUG nach PFK = MiTa/MiNa / pp_ratio_base
      const result = value / ppRatioBase;
      return result.toFixed(2);
    }
    return '-';
  }

  getPpugNachPfkInStundenForTag(tag: number): string {
    const dailyMap = this.dailyMinaMita();
    const dayData = dailyMap.get(tag);
    if (!dayData) return '-';
    
    const schicht = this.selectedShift();
    // Tag = MiTa, Nacht = MiNa
    const value = schicht === 'tag' ? dayData.mita : dayData.mina;
    const ppRatioBase = schicht === 'tag' ? this.ppRatioTagBase() : this.ppRatioNachtBase();
    const schichtStunden = schicht === 'tag' ? this.schichtStundenTag() : this.schichtStundenNacht();
    
    if (value !== null && !isNaN(value) && ppRatioBase > 0) {
      // PpUG nach PFK in Std. = (MiTa/MiNa / pp_ratio_base) × Schichtstunden
      // = MiTa/MiNa × Schichtstunden / pp_ratio_base
      const result = (value * schichtStunden) / ppRatioBase;
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
    
    if (!dayData) {
      return '-';
    }
    
    const schicht = this.selectedShift();
    // Tag = MiTa, Nacht = MiNa
    const value = schicht === 'tag' ? dayData.mita : dayData.mina;
    const ppRatioBase = schicht === 'tag' ? this.ppRatioTagBase() : this.ppRatioNachtBase();
    
    if (value === null || isNaN(value) || ppRatioBase === 0) {
      return '-';
    }
    
    // Berechne PpUG nach PFK
    const ppugNachPfk = value / ppRatioBase;
    
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
    // Verwende Gesamtzeit (normale Zeit + Pausenzeit)
    const gesamtzeit = this.getGesamtzeit(entry);
    const arbeitszeitstundenDezimal = gesamtzeit.stunden + (gesamtzeit.minuten / 60);
    
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
    // Verwende Gesamtzeit (normale Zeit + Pausenzeit)
    const gesamtzeit = this.getGesamtzeit(entry);
    const arbeitszeitstundenDezimal = gesamtzeit.stunden + (gesamtzeit.minuten / 60);
    
    const schicht = this.selectedShift();
    const schichtStunden = schicht === 'tag' ? this.schichtStundenTag() : this.schichtStundenNacht();
    
    // Tatsächlich anrechnbar für diesen Tag
    const phkTageswerte = this.phkTageswerte();
    if (!phkTageswerte) {
      // Wenn keine PHK-Daten vorhanden, nur Arbeitszeitstunden verwenden
      const examPflege = arbeitszeitstundenDezimal / schichtStunden;
      return examPflege.toFixed(4);
    }
    
    const tagData = phkTageswerte.find(t => t.tag === entry.tag);
    if (!tagData) {
      // Wenn keine PHK-Daten für diesen Tag, nur Arbeitszeitstunden verwenden
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
    
    // Exam. Pflege = Gesamte anrechb. AZ / Schichtstunden (Tag: 16h, Nacht: 8h)
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
    
    if (!dayData) {
      return '-';
    }
    
    const schicht = this.selectedShift();
    // Tag = MiTa, Nacht = MiNa
    const value = schicht === 'tag' ? dayData.mita : dayData.mina;
    
    if (value === null || isNaN(value)) {
      return '-';
    }
    
    const ppRatioBase = schicht === 'tag' ? this.ppRatioTagBase() : this.ppRatioNachtBase();
    const ppugNachPfk = value / ppRatioBase;
    
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

    // Show preview first to detect station and show configuration
    this.uploading.set(true);
    
    this.api.previewDienstplan(file, this.selectedVariant()).subscribe({
      next: (response) => {
        this.uploading.set(false);
        
        if (response.success && response.preview) {
          // Open preview dialog with detected stations and configurations
          const dialogRef = this.dialog.open(DienstplanPreviewDialogComponent, {
            width: '900px',
            maxWidth: '90vw',
            maxHeight: '90vh',
            data: {
              file: file,
              variant: this.selectedVariant(),
              preview: response.preview
            } as DienstplanPreviewData
          });

          dialogRef.afterClosed().subscribe((result: any) => {
            if (result && result.confirmed) {
              // The backend will automatically load the correct configuration for each station
              // during upload, so we don't need to pass config overrides here.
              // The preview dialog is mainly for showing the detected stations and their configurations.
              this.performUpload(file);
            }
          });
        } else {
          this.snackBar.open('Fehler beim Laden der Vorschau', 'Schließen', { duration: 3000 });
        }
      },
      error: (err) => {
        this.uploading.set(false);
        console.error('Error loading preview:', err);
        const errorMessage = err.error?.error || err.message || 'Fehler beim Laden der Vorschau';
        this.snackBar.open(errorMessage, 'Schließen', { duration: 5000 });
      }
    });
  }

  private performUpload(file: File, configOverrides?: { schicht_stunden?: number; phk_anteil_base?: number | null; pp_ratio_base?: number }): void {
    this.uploading.set(true);

    this.api.uploadDienstplan(file, this.selectedVariant(), configOverrides).subscribe({
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

  openStatInfoModal(statType: string) {
    const schicht = this.selectedShift();
    const schichtStunden = schicht === 'tag' ? this.schichtStundenTag() : this.schichtStundenNacht();
    const phkAnteilBase = schicht === 'tag' ? (this.phkAnteilTagBase() || 10) : (this.phkAnteilNachtBase() || 10);
    const phkAnteil = 1 - (phkAnteilBase / 100);
    const ppRatioBase = schicht === 'tag' ? this.ppRatioTagBase() : this.ppRatioNachtBase();
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
          title: `%PHP-Faktor (${schicht === 'tag' ? 'Tag' : 'Nacht'})`,
          steps: [
            {
              name: '%PHP-Faktor',
              formula: `%PHP-Faktor = 1 - (Basiswert / 100)`,
              description: `Der %PHP-Faktor wird aus einem konfigurierbaren Basiswert berechnet.`,
              example: `1 - (${phkAnteilBase} / 100) = ${phkAnteil.toFixed(4)} (${(phkAnteil * 100).toFixed(0)}%)`
            }
          ],
          constants: [
            { name: `%PHP (${schicht === 'tag' ? 'Tag' : 'Nacht'})`, value: `${phkAnteilBase}`, unit: 'Zahl' },
            { name: '%PHP-Faktor', value: `${phkAnteil.toFixed(4)}`, unit: `(${(phkAnteil * 100).toFixed(0)}%)` }
          ],
          dataSource: `Konfigurierbarer Basiswert für ${schicht === 'tag' ? 'Tag' : 'Nacht'}-Schicht`
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
            { name: `Schichtdauer (${schicht === 'tag' ? 'Tag' : 'Nacht'})`, value: `${schichtStunden}`, unit: 'Stunden' }
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
            { name: `Schichtstunden (${schicht === 'tag' ? 'Tag' : 'Nacht'})`, value: `${schichtStunden}`, unit: 'Stunden' }
          ],
          dataSource: 'Gesamt Anrechenbar (berechnet)'
        };
        break;

      case 'patientenProPflegekraft':
        const examPflegeForPatienten = this.getExamPflege();
        const patienten = this.getPatientenProPflegekraft();
        const bestandName = schicht === 'tag' ? 'MiTa Bestände (MiTa)' : 'MiNa Bestände (MiNa)';
        modalData = {
          title: 'Patienten/Pflegekraft',
          steps: [
            {
              name: 'Patienten/Pflegekraft',
              formula: `Patienten/Pflegekraft = Exam. Pflege / ${bestandName}-Durchschnitt`,
              description: `Berechnet das Verhältnis von Patienten zu Pflegekräften`,
              example: `Wenn Exam. Pflege = ${examPflegeForPatienten ? examPflegeForPatienten.toFixed(4) : 'N/A'} und ${bestandName} = ${belegteBetten ? belegteBetten.toFixed(2) : 'N/A'} → ${patienten || 'N/A'}`
            },
            {
              name: 'Exam. Pflege',
              formula: `Exam. Pflege = Gesamt Anrechenbar / Schichtstunden`,
              description: `Anzahl examinierter Pflegekräfte`,
              example: `Berechnet aus Gesamt Anrechenbar`
            },
            {
              name: `${bestandName}-Durchschnitt`,
              formula: `${bestandName} = Durchschnittliche Tagesbelegung`,
              description: `Die mittlere Tagesbelegung aus MiNa/MiTa-Beständen`,
              example: `Wird täglich aus den Bestandsdaten ermittelt`
            }
          ],
          dataSource: `Exam. Pflege (berechnet) und ${bestandName} (aus MiNa/MiTa-Beständen)`
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
        const bestandNameDelta = schicht === 'tag' ? 'MiTa Bestände (MiTa)' : 'MiNa Bestände (MiNa)';
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
              formula: `⌀ PpUG nach PFK = Durchschnitt von (${bestandNameDelta} / Pp-Ratio)`,
              description: `Durchschnittlicher benötigter Pflegekraft-Bedarf`,
              example: `Berechnet aus täglichen ${bestandNameDelta}-Werten`
            }
          ],
          constants: [
            { name: `P:P-Ratio Basiswert (${schicht === 'tag' ? 'Tag' : 'Nacht'})`, value: `${ppRatioBase}`, unit: 'Zahl' }
          ],
          dataSource: `Ergibt PFK (PFK Normal) (eingegeben) und ${bestandNameDelta} (aus Beständen)`
        };
        break;

      case 'ppRatio':
        const ppRatio = this.getPPRatio();
        const bestandName7 = schicht === 'tag' ? 'MiTa Bestände (MiTa)' : 'MiNa Bestände (MiNa)';
        modalData = {
          title: 'P:P (Patienten zu Pflegekraft)',
          steps: [
            {
              name: 'P:P',
              formula: `P:P = ⌀ ${bestandName7} / ⌀ Ergibt PFK (PFK Normal)`,
              description: `Verhältnis von durchschnittlicher Tagesbelegung zu durchschnittlicher PFK-Anzahl`,
              example: `Wenn ⌀ ${bestandName7} = 20.0 und ⌀ Ergibt PFK (PFK Normal) = 5.0 → P:P = ${ppRatio ? ppRatio.toFixed(2) : 'N/A'}`
            },
            {
              name: `⌀ ${bestandName7}`,
              formula: `⌀ ${bestandName7} = Durchschnitt der täglichen ${bestandName7}-Werte`,
              description: `Durchschnittliche Tagesbelegung`,
              example: `Berechnet aus täglichen MiNa/MiTa-Beständen`
            },
            {
              name: '⌀ Ergibt PFK (PFK Normal)',
              formula: `⌀ Ergibt PFK (PFK Normal) = Durchschnitt von Ergibt PFK (PFK Normal)`,
              description: `Durchschnittliche PFK-Schichtanzahl`,
              example: `Berechnet aus eingegebenen PFK-Stunden`
            }
          ],
          dataSource: `${bestandName7} (aus Beständen) und Ergibt PFK (PFK Normal) (eingegeben)`
        };
        break;

      case 'mitaDurchschnitt':
        const bestandName8 = schicht === 'tag' ? 'MiTa Bestände (MiTa)' : 'MiNa Bestände (MiNa)';
        modalData = {
          title: `${bestandName8}-Ø Station`,
          steps: [
            {
              name: `${bestandName8}-Durchschnitt`,
              formula: `${bestandName8}-Ø = Durchschnitt der täglichen ${bestandName8}-Werte`,
              description: `Die mittlere Tagesbelegung (${bestandName8}) wird aus den MiNa/MiTa-Beständen für jeden Tag des Monats geladen und dann gemittelt`,
              example: `Wird täglich aus den Bestandsdaten ermittelt und dann gemittelt`
            }
          ],
          dataSource: 'MiNa/MiTa-Bestände (täglich aktualisiert)'
        };
        break;

      case 'ppugNachPfkDurchschnitt':
        const ppugNachPfk = this.getDurchschnittPpugNachPfk();
        const bestandNamePpug = schicht === 'tag' ? 'MiTa Bestände (MiTa)' : 'MiNa Bestände (MiNa)';
        modalData = {
          title: 'PpUG nach PFK Ø',
          steps: [
            {
              name: 'PpUG nach PFK Durchschnitt',
              formula: `⌀ PpUG nach PFK = Durchschnitt von (${bestandNamePpug} / P:P-Ratio)`,
              description: `Berechnet den durchschnittlichen benötigten Pflegekraft-Bedarf basierend auf der ${schicht === 'tag' ? 'Tages' : 'Nacht'}belegung`,
              example: `Für jeden Tag: ${bestandNamePpug} / ${ppRatioBase}, dann Durchschnitt über alle Tage`
            }
          ],
          constants: [
            { name: `P:P-Ratio Basiswert (${schicht === 'tag' ? 'Tag' : 'Nacht'})`, value: `${ppRatioBase}`, unit: 'Zahl' }
          ],
          dataSource: `${bestandNamePpug} (aus MiNa/MiTa-Beständen)`
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
            { name: `Schichtdauer (${schicht === 'tag' ? 'Tag' : 'Nacht'})`, value: `${schichtStunden}`, unit: 'Stunden' }
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
            { name: `Schichtstunden (${schicht === 'tag' ? 'Tag' : 'Nacht'})`, value: `${schichtStunden}`, unit: 'Stunden' }
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
    const schicht = this.selectedShift();
    const schichtStunden = schicht === 'tag' ? this.schichtStundenTag() : this.schichtStundenNacht();
    const phkAnteilBase = schicht === 'tag' ? (this.phkAnteilTagBase() || 10) : (this.phkAnteilNachtBase() || 10);
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
              example: `Bei ${schichtStunden} Stunden Schichtdauer: 80 Stunden / ${schichtStunden} = 5.0 Schichten`
            }
          ],
          constants: [
            { name: `Schichtdauer (${schicht === 'tag' ? 'Tag' : 'Nacht'})`, value: `${schichtStunden}`, unit: 'Stunden' }
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
              example: `5.0 / ${phkAnteil.toFixed(4)} = 5.56 Gesamt-Schichten`
            }
          ],
          constants: [
            { name: `%PHP (${schicht === 'tag' ? 'Tag' : 'Nacht'})`, value: `${phkAnteilBase}`, unit: 'Zahl' },
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
              example: `5.56 - 5.0 = 0.56 PHK-Schichten`
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
              example: `0.56 × ${schichtStunden} = ${(0.56 * schichtStunden).toFixed(2)} Stunden`
            }
          ],
          constants: [
            { name: `Schichtdauer (${schicht === 'tag' ? 'Tag' : 'Nacht'})`, value: `${schichtStunden}`, unit: 'Stunden' }
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
              formula: `Tatsächlich Anrechenbar = min(Geleistete AZ PHK, Anrechenbare AZ PHK (PHK Anrechenbar))`,
              description: `Der kleinere Wert von geleisteten PHK-Stunden und berechneten Anrechenbare AZ PHK (PHK Anrechenbar)`,
              example: `Wenn geleistet: 8.5h, berechnet: 8.96h → tatsächlich: 8.5h`
            }
          ]
        };
        break;

      case 'mita':
        const bestandName2 = schicht === 'tag' ? 'MiTa Bestände (MiTa)' : 'MiNa Bestände (MiNa)';
        modalData = {
          title: `${bestandName2} (Mittlere Tagesbelegung)`,
          steps: [
            {
              name: bestandName2,
              formula: `${bestandName2} = Durchschnittliche Tagesbelegung`,
              description: `Die mittlere Tagesbelegung (${bestandName2}) wird aus den MiNa/MiTa-Beständen für den jeweiligen Tag geladen`,
              example: `Wird täglich aus den Bestandsdaten ermittelt`
            }
          ],
          dataSource: 'MiNa/MiTa-Bestände (täglich aktualisiert)'
        };
        break;

      case 'ppugNachPfk':
        const bestandName3 = schicht === 'tag' ? 'MiTa Bestände (MiTa)' : 'MiNa Bestände (MiNa)';
        const ppRatioBasePpug = schicht === 'tag' ? this.ppRatioTagBase() : this.ppRatioNachtBase();
        modalData = {
          title: 'PpUG nach PFK',
          steps: [
            {
              name: 'PpUG nach PFK',
              formula: `PpUG nach PFK = ${bestandName3} / Pp-Ratio Basiswert`,
              description: `Berechnet die benötigte Pflegekraft-Anzahl basierend auf der Tagesbelegung`,
              example: `Wenn ${bestandName3} = 20.0 und Pp-Ratio Basis = ${ppRatioBasePpug}, dann: 20.0 / ${ppRatioBasePpug} = ${(20.0 / ppRatioBasePpug).toFixed(2)}`
            }
          ],
          constants: [
            { name: `Pp-Ratio Basiswert (${schicht === 'tag' ? 'Tag' : 'Nacht'})`, value: `${ppRatioBasePpug}`, unit: 'Zahl' }
          ],
          dataSource: `${bestandName3} (aus MiNa/MiTa-Beständen)`
        };
        break;

      case 'ppugInStunden':
        const bestandName4 = schicht === 'tag' ? 'MiTa Bestände (MiTa)' : 'MiNa Bestände (MiNa)';
        const ppRatioBaseStunden = schicht === 'tag' ? this.ppRatioTagBase() : this.ppRatioNachtBase();
        modalData = {
          title: 'PpUG nach PFK in Stunden',
          steps: [
            {
              name: 'PpUG nach PFK in Stunden',
              formula: `PpUG nach PFK in Std. = (${bestandName4} × Schichtstunden) / Pp-Ratio Basiswert`,
              description: `Umrechnung der benötigten Pflegekraft-Anzahl in Arbeitsstunden`,
              example: `Wenn ${bestandName4} = 20.0, Schichtstunden = ${schichtStunden}, Pp-Ratio = ${ppRatioBaseStunden}: (20.0 × ${schichtStunden}) / ${ppRatioBaseStunden} = ${((20.0 * schichtStunden) / ppRatioBaseStunden).toFixed(2)} Stunden`
            }
          ],
          constants: [
            { name: `Pp-Ratio Basiswert (${schicht === 'tag' ? 'Tag' : 'Nacht'})`, value: `${ppRatioBaseStunden}`, unit: 'Zahl' },
            { name: `Schichtstunden (${schicht === 'tag' ? 'Tag' : 'Nacht'})`, value: `${schichtStunden}`, unit: 'Stunden' }
          ],
          dataSource: `${bestandName4} (aus MiNa/MiTa-Beständen)`
        };
        break;

      case 'ppugErfuellt':
        const bestandName5 = schicht === 'tag' ? 'MiTa Bestände (MiTa)' : 'MiNa Bestände (MiNa)';
        const ppRatioBaseErfuellt = schicht === 'tag' ? this.ppRatioTagBase() : this.ppRatioNachtBase();
        modalData = {
          title: 'PpUG erfüllt',
          steps: [
            {
              name: 'PpUG erfüllt (Version 1)',
              formula: `PpUG erfüllt = (Ergibt PFK (PFK Normal) >= PpUG nach PFK) ? 'Ja' : 'Nein'`,
              description: `Prüft, ob die vorhandene PFK-Anzahl (Ergibt PFK (PFK Normal)) ausreicht, um den PpUG-Bedarf zu decken`,
              example: `Wenn Ergibt PFK (PFK Normal) = 5.0 und PpUG nach PFK = 4.5 → 'Ja' (erfüllt)`
            },
            {
              name: 'PpUG nach PFK',
              formula: `PpUG nach PFK = ${bestandName5} / Pp-Ratio Basiswert`,
              description: `Berechnet den benötigten Pflegekraft-Bedarf`,
              example: `${bestandName5} / ${ppRatioBaseErfuellt}`
            }
          ],
          constants: [
            { name: `Pp-Ratio Basiswert (${schicht === 'tag' ? 'Tag' : 'Nacht'})`, value: `${ppRatioBaseErfuellt}`, unit: 'Zahl' }
          ],
          dataSource: `Ergibt PFK (PFK Normal) (aus eingegebenen Stunden) und ${bestandName5} (aus Beständen)`
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
              example: `Wenn Arbeitszeit = 80h und tatsächlich anrechenbar = 8.5h → Gesamt = 88.5h`
            },
            {
              name: 'Tatsächlich anrechenbar',
              formula: `Tatsächlich anrechenbar = min(Geleistete AZ PHK, Anrechenbare AZ PHK (PHK Anrechenbar))`,
              description: `Der kleinere Wert von tatsächlich geleisteten PHK-Stunden und berechneten Anrechenbare AZ PHK (PHK Anrechenbar)`,
              example: `Wenn geleistet: 8.5h, berechnet: 8.96h → tatsächlich: 8.5h`
            }
          ],
          dataSource: 'Eingegebene Arbeitszeitstunden (PFK) und PHK-Stunden (aus PHK-Reiter)'
        };
        break;

      case 'examPflege':
        modalData = {
          title: 'Exam. Pflege (Examinierte Pflege)',
          steps: [
            {
              name: 'Exam. Pflege',
              formula: `Exam. Pflege = Gesamte anrechb. AZ / Schichtstunden`,
              description: `Berechnet die Anzahl der examinierten Pflegekräfte basierend auf der gesamten anrechenbaren Arbeitszeit`,
              example: `Wenn Gesamte anrechb. AZ = 88.5h und Schichtstunden = ${schichtStunden}: 88.5 / ${schichtStunden} = ${(88.5 / schichtStunden).toFixed(4)}`
            },
            {
              name: 'Gesamte anrechb. AZ',
              formula: `Gesamte anrechb. AZ = Arbeitszeitstunden + Tatsächlich anrechenbar`,
              description: `Summe aus PFK- und PHK-Stunden`,
              example: `Arbeitszeit + min(Geleistete PHK, PHK Anrechenbar)`
            }
          ],
          constants: [
            { name: `Schichtstunden (${schicht === 'tag' ? 'Tag' : 'Nacht'})`, value: `${schichtStunden}`, unit: 'Stunden' }
          ],
          dataSource: 'Gesamte anrechenbare Arbeitszeit (berechnet)'
        };
        break;

      case 'ppugErfuelltV2':
        const bestandName6 = schicht === 'tag' ? 'MiTa Bestände (MiTa)' : 'MiNa Bestände (MiNa)';
        const ppRatioBaseV2 = schicht === 'tag' ? this.ppRatioTagBase() : this.ppRatioNachtBase();
        modalData = {
          title: 'PpUG erfüllt (Version 2)',
          steps: [
            {
              name: 'PpUG erfüllt (Version 2)',
              formula: `PpUG erfüllt = (Exam. Pflege >= PpUG nach PFK) ? 'Ja' : 'Nein'`,
              description: `Prüft, ob die examinierte Pflegekraft-Anzahl (inkl. PHK-Anteil) ausreicht, um den PpUG-Bedarf zu decken`,
              example: `Wenn Exam. Pflege = 5.5 und PpUG nach PFK = 4.5 → 'Ja' (erfüllt)`
            },
            {
              name: 'Exam. Pflege',
              formula: `Exam. Pflege = Gesamte anrechb. AZ / Schichtstunden`,
              description: `Anzahl examinierter Pflegekräfte (inkl. PHK-Anteil)`,
              example: `Berechnet aus Gesamte anrechb. AZ`
            },
            {
              name: 'PpUG nach PFK',
              formula: `PpUG nach PFK = ${bestandName6} / Pp-Ratio Basiswert`,
              description: `Benötigter Pflegekraft-Bedarf`,
              example: `${bestandName6} / ${ppRatioBaseV2}`
            }
          ],
          constants: [
            { name: `Pp-Ratio Basiswert (${schicht === 'tag' ? 'Tag' : 'Nacht'})`, value: `${ppRatioBaseV2}`, unit: 'Zahl' }
          ],
          dataSource: `Exam. Pflege (berechnet) und ${bestandName6} (aus Beständen)`
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

