import { Component, Input, OnInit, OnChanges, signal, computed, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartData } from 'chart.js';
import { UploadRecord } from '../../core/api';
import { DataInfoPanel, DataInfoItem } from '../data-info-panel/data-info-panel';
import { ComparisonDialogComponent, ComparisonMetricConfig, ComparisonSeries } from '../shared/comparison-dialog/comparison-dialog.component';
import { SearchableSelectComponent } from '../shared/searchable-select/searchable-select.component';

interface PflegestufenData {
  Station: string;
  Kategorie: string;
  'T.-Patienten': number;
  'Einstufungen absolut': number;
  'Pfl.bedarf Minuten': number;
  Standort: string;
  Monat: number;
  Jahr: number;
}

@Component({
  selector: 'app-pflegestufenstatistik-charts',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatChipsModule,
    MatIconModule,
    MatTooltipModule,
    BaseChartDirective,
    DataInfoPanel,
    SearchableSelectComponent
  ],
  template: `
    <div class="pflegestufenstatistik-charts">
      <div class="charts-header">
        <div class="header-top">
          <h3>
            <mat-icon>medical_services</mat-icon>
            Pflegestufen PPR - {{ selectedStandort() }} ({{ selectedYear() }})
          </h3>
          <div class="selectors">
            <app-searchable-select
              class="selector"
              label="Jahr"
              icon="calendar_month"
              [options]="yearOptions()"
              [value]="selectedYear().toString()"
              (valueChange)="onYearChange($event)">
            </app-searchable-select>

            <app-searchable-select
              class="selector"
              label="Standort"
              icon="location_on"
              [options]="availableStandorte()"
              [value]="selectedStandort()"
              (valueChange)="onStandortChange($event)"
            ></app-searchable-select>
            
            <app-searchable-select
              class="selector"
              label="Station"
              icon="business"
              [options]="availableStations()"
              [value]="selectedStation()"
              (valueChange)="onStationChange($event)"
            ></app-searchable-select>
            <button
              mat-stroked-button
              color="primary"
              class="comparison-button"
              (click)="openComparisonDialog($event)"
              [disabled]="comparisonSeries().length <= 1"
              matTooltip="Vergleichen Sie bis zu vier Stationen für diesen Standort">
              <mat-icon>compare</mat-icon>
              Vergleich
            </button>
          </div>
        </div>
        <p>PPR-Pflegestufen: Pflegebedarf und Altersgruppen im Jahresverlauf</p>
      </div>

      <!-- Data Info Panel -->
      <app-data-info-panel 
        *ngIf="dataInfoItems().length > 0"
        [dataItems]="dataInfoItems()"
        [expandedByDefault]="false">
      </app-data-info-panel>

      <!-- Charts Container -->
      <div class="charts-container">
        <div class="charts-grid">
          <!-- Altersgruppen Vergleich Chart -->
          <div class="flip-card full-width" [class.flipped]="flippedCards()['altersgruppen']" (click)="toggleFlip('altersgruppen')">
            <div class="flip-card-inner">
              <div class="flip-card-front">
                <mat-card class="metric-card">
                  <mat-card-header class="metric-header altersgruppen-header">
                    <mat-card-title>
                      <mat-icon>bar_chart</mat-icon>
                      Vergleich Altersgruppen (A1-A4, KA1-KA4, PICU/NICU + ohne Einstufung)
                      <span class="flip-hint-text">Klicken zum Umdrehen</span>
                      <mat-icon class="flip-icon">flip</mat-icon>
                    </mat-card-title>
                    <mat-card-subtitle>{{ selectedStation() === 'Alle' ? 'Alle Stationen' : selectedStation() }} - {{ selectedStandort() }} (Alle Monate)</mat-card-subtitle>
                  </mat-card-header>
                  <mat-card-content class="chart-content">
                    <div class="chart-container">
                      <div class="chart-loading-overlay" *ngIf="chartLoading()">
                        <div class="loading-bar"></div>
                        <p>Daten werden geladen…</p>
                      </div>
                      <canvas baseChart
                        [data]="altersgruppenChartData()"
                        [options]="altersgruppenChartOptions"
                        [type]="'bar'">
                      </canvas>
                    </div>
                    <div class="chart-info">
                      <mat-chip-set>
                        <mat-chip class="info-chip a1-chip">A1: {{ getAltersgruppeTotal('A1') }}</mat-chip>
                        <mat-chip class="info-chip a2-chip">A2: {{ getAltersgruppeTotal('A2') }}</mat-chip>
                        <mat-chip class="info-chip a3-chip">A3: {{ getAltersgruppeTotal('A3') }}</mat-chip>
                        <mat-chip class="info-chip a4-chip">A4: {{ getAltersgruppeTotal('A4') }}</mat-chip>
                        <mat-chip class="info-chip ka1-chip">KA1: {{ getAltersgruppeTotal('KA1') }}</mat-chip>
                        <mat-chip class="info-chip ka2-chip">KA2: {{ getAltersgruppeTotal('KA2') }}</mat-chip>
                        <mat-chip class="info-chip ka3-chip">KA3: {{ getAltersgruppeTotal('KA3') }}</mat-chip>
                        <mat-chip class="info-chip ka4-chip">KA4: {{ getAltersgruppeTotal('KA4') }}</mat-chip>
                        <mat-chip class="info-chip picu-chip">PICU: {{ getAltersgruppeTotal('PICU') }}</mat-chip>
                        <mat-chip class="info-chip nicu-chip">NICU: {{ getAltersgruppeTotal('NICU') }}</mat-chip>
                        <mat-chip class="info-chip ohne-chip">ohne: {{ getAltersgruppeTotal('ohne') }}</mat-chip>
                      </mat-chip-set>
                    </div>
                  </mat-card-content>
                </mat-card>
              </div>
              <div class="flip-card-back">
                <mat-card class="metric-card">
                  <mat-card-header class="metric-header altersgruppen-header">
                    <mat-card-title>
                      Altersgruppen Details
                      <mat-icon class="flip-icon">flip</mat-icon>
                    </mat-card-title>
                  </mat-card-header>
                  <mat-card-content class="data-content">
                    <div class="data-table-container">
                      <table class="data-table">
                        <thead>
                          <tr>
                            <th>Altersgruppe</th>
                            <th>Einstufungen absolut</th>
                            <th>Anteil</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td class="station-cell">A1</td>
                            <td class="number-cell">{{ getAltersgruppeTotal('A1') }}</td>
                            <td class="number-cell">{{ getAltersgruppePercentage('A1') }}%</td>
                          </tr>
                          <tr>
                            <td class="station-cell">A2</td>
                            <td class="number-cell">{{ getAltersgruppeTotal('A2') }}</td>
                            <td class="number-cell">{{ getAltersgruppePercentage('A2') }}%</td>
                          </tr>
                          <tr>
                            <td class="station-cell">A3</td>
                            <td class="number-cell">{{ getAltersgruppeTotal('A3') }}</td>
                            <td class="number-cell">{{ getAltersgruppePercentage('A3') }}%</td>
                          </tr>
                          <tr>
                            <td class="station-cell">A4</td>
                            <td class="number-cell">{{ getAltersgruppeTotal('A4') }}</td>
                            <td class="number-cell">{{ getAltersgruppePercentage('A4') }}%</td>
                          </tr>
                          <tr>
                            <td class="station-cell">ohne Einstufung</td>
                            <td class="number-cell">{{ getAltersgruppeTotal('ohne') }}</td>
                            <td class="number-cell">{{ getAltersgruppePercentage('ohne') }}%</td>
                          </tr>
                          <tr>
                            <td class="station-cell">KA1</td>
                            <td class="number-cell">{{ getAltersgruppeTotal('KA1') }}</td>
                            <td class="number-cell">{{ getAltersgruppePercentage('KA1') }}%</td>
                          </tr>
                          <tr>
                            <td class="station-cell">KA2</td>
                            <td class="number-cell">{{ getAltersgruppeTotal('KA2') }}</td>
                            <td class="number-cell">{{ getAltersgruppePercentage('KA2') }}%</td>
                          </tr>
                          <tr>
                            <td class="station-cell">KA3</td>
                            <td class="number-cell">{{ getAltersgruppeTotal('KA3') }}</td>
                            <td class="number-cell">{{ getAltersgruppePercentage('KA3') }}%</td>
                          </tr>
                          <tr>
                            <td class="station-cell">KA4</td>
                            <td class="number-cell">{{ getAltersgruppeTotal('KA4') }}</td>
                            <td class="number-cell">{{ getAltersgruppePercentage('KA4') }}%</td>
                          </tr>
                          <tr>
                            <td class="station-cell">PICU</td>
                            <td class="number-cell">{{ getAltersgruppeTotal('PICU') }}</td>
                            <td class="number-cell">{{ getAltersgruppePercentage('PICU') }}%</td>
                          </tr>
                          <tr>
                            <td class="station-cell">NICU</td>
                            <td class="number-cell">{{ getAltersgruppeTotal('NICU') }}</td>
                            <td class="number-cell">{{ getAltersgruppePercentage('NICU') }}%</td>
                          </tr>
                          <tr class="total-row">
                            <td><strong>Gesamt</strong></td>
                            <td class="number-cell"><strong>{{ getTotalEinstufungenForAltersgruppen() }}</strong></td>
                            <td class="number-cell"><strong>100%</strong></td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </mat-card-content>
                </mat-card>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  `,
  styleUrl: './pflegestufenstatistik-charts.scss'
})
export class PflegestufenstatistikCharts implements OnInit, OnChanges {
  @Input() uploads: UploadRecord[] = [];
  
  selectedStandort = signal<string>('BAB');
  selectedStation = signal<string>('Alle');
  selectedYear = signal<number>(new Date().getFullYear());
  availableYears = signal<number[]>([]);
  yearOptions = computed<string[]>(() => this.availableYears().map((y: number) => y.toString()));
  
  pflegestufenData = signal<PflegestufenData[]>([]);
  flippedCards = signal<{ [key: string]: boolean }>({});
  dataInfoItems = signal<DataInfoItem[]>([]);
  chartLoading = signal<boolean>(true);
  private dialog = inject(MatDialog);
  
  availableStandorte = computed(() => {
    const standorte = new Set<string>();
    this.filterByYear(this.pflegestufenData()).forEach(d => standorte.add(d.Standort));
    return Array.from(standorte).sort();
  });
  
  availableStations = computed(() => {
    const stations = new Set<string>();
    stations.add('Alle'); // Add "All stations" option
    this.filterByYear(this.pflegestufenData())
      .filter(d => d.Standort === this.selectedStandort() && d.Kategorie === 'Gesamt')
      .forEach(d => stations.add(d.Station));
    return Array.from(stations).sort();
  });

  altersgruppenChartData = computed<ChartData<'bar'>>(() => {
    const allMonthsData = this.pflegestufenData().filter(d =>
      d.Standort === this.selectedStandort() &&
      d.Kategorie !== 'Gesamt' &&
      (this.selectedStation() === 'Alle' || d.Station === this.selectedStation())
    );

    const monthData: Record<number, { A1: number; A2: number; A3: number; A4: number; KA1: number; KA2: number; KA3: number; KA4: number; PICU: number; NICU: number; ohne: number }> = {};
    for (let i = 1; i <= 12; i++) {
      monthData[i] = { A1: 0, A2: 0, A3: 0, A4: 0, KA1: 0, KA2: 0, KA3: 0, KA4: 0, PICU: 0, NICU: 0, ohne: 0 };
    }

    allMonthsData.forEach(row => {
      const monat = row.Monat;
      const kategorie = row.Kategorie;
      if (!kategorie || !monat || monat < 1 || monat > 12) return;

      const kategorieUpper = kategorie.toUpperCase();
      if (kategorie.startsWith('A1')) monthData[monat].A1 += row['Einstufungen absolut'];
      else if (kategorie.startsWith('A2')) monthData[monat].A2 += row['Einstufungen absolut'];
      else if (kategorie.startsWith('A3')) monthData[monat].A3 += row['Einstufungen absolut'];
      else if (kategorie.startsWith('A4')) monthData[monat].A4 += row['Einstufungen absolut'];
      else if (kategorie.startsWith('KA1')) monthData[monat].KA1 += row['Einstufungen absolut'];
      else if (kategorie.startsWith('KA2')) monthData[monat].KA2 += row['Einstufungen absolut'];
      else if (kategorie.startsWith('KA3')) monthData[monat].KA3 += row['Einstufungen absolut'];
      else if (kategorie.startsWith('KA4')) monthData[monat].KA4 += row['Einstufungen absolut'];
      else if (kategorieUpper.includes('PICU')) monthData[monat].PICU += row['Einstufungen absolut'];
      else if (kategorieUpper.includes('NICU')) monthData[monat].NICU += row['Einstufungen absolut'];
      else if (kategorie.toLowerCase().includes('ohne einstufung')) monthData[monat].ohne += row['Einstufungen absolut'];
    });

    const months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    const labels = months.map(m => this.getMonthName(m));

    return {
      labels,
      datasets: [
        {
          label: 'A1',
          data: months.map(m => monthData[m].A1),
          backgroundColor: 'rgba(33, 150, 243, 0.7)',
          borderColor: 'rgba(33, 150, 243, 1)',
          borderWidth: 2
        },
        {
          label: 'A2',
          data: months.map(m => monthData[m].A2),
          backgroundColor: 'rgba(76, 175, 80, 0.7)',
          borderColor: 'rgba(76, 175, 80, 1)',
          borderWidth: 2
        },
        {
          label: 'A3',
          data: months.map(m => monthData[m].A3),
          backgroundColor: 'rgba(255, 152, 0, 0.7)',
          borderColor: 'rgba(255, 152, 0, 1)',
          borderWidth: 2
        },
        {
          label: 'A4',
          data: months.map(m => monthData[m].A4),
          backgroundColor: 'rgba(156, 39, 176, 0.7)',
          borderColor: 'rgba(156, 39, 176, 1)',
          borderWidth: 2
        },
        {
          label: 'ohne Einstufung',
          data: months.map(m => monthData[m].ohne),
          backgroundColor: 'rgba(244, 67, 54, 0.7)',
          borderColor: 'rgba(244, 67, 54, 1)',
          borderWidth: 2
        },
        {
          label: 'KA1',
          data: months.map(m => monthData[m].KA1),
          backgroundColor: 'rgba(0, 188, 212, 0.7)',
          borderColor: 'rgba(0, 188, 212, 1)',
          borderWidth: 2
        },
        {
          label: 'KA2',
          data: months.map(m => monthData[m].KA2),
          backgroundColor: 'rgba(233, 30, 99, 0.7)',
          borderColor: 'rgba(233, 30, 99, 1)',
          borderWidth: 2
        },
        {
          label: 'KA3',
          data: months.map(m => monthData[m].KA3),
          backgroundColor: 'rgba(255, 235, 59, 0.7)',
          borderColor: 'rgba(255, 235, 59, 1)',
          borderWidth: 2
        },
        {
          label: 'KA4',
          data: months.map(m => monthData[m].KA4),
          backgroundColor: 'rgba(141, 110, 99, 0.7)',
          borderColor: 'rgba(141, 110, 99, 1)',
          borderWidth: 2
        },
        {
          label: 'PICU',
          data: months.map(m => monthData[m].PICU),
          backgroundColor: 'rgba(63, 81, 181, 0.7)',
          borderColor: 'rgba(63, 81, 181, 1)',
          borderWidth: 2
        },
        {
          label: 'NICU',
          data: months.map(m => monthData[m].NICU),
          backgroundColor: 'rgba(205, 220, 57, 0.7)',
          borderColor: 'rgba(205, 220, 57, 1)',
          borderWidth: 2
        }
      ]
    };
  });
  readonly altersgruppenChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'top',
        labels: {
          usePointStyle: true,
          padding: 15
        }
      },
      title: { display: false },
      tooltip: {
        mode: 'index',
        intersect: false,
        callbacks: {
          label: (context) => {
            return `${context.dataset.label}: ${context.parsed.y.toLocaleString('de-DE')}`;
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: 'Einstufungen absolut'
        }
      },
      x: {
        title: {
          display: true,
          text: 'Monat'
        }
      }
    }
  };
  private readonly chartReadyEffect = effect(() => {
    this.altersgruppenChartData();
    queueMicrotask(() => this.chartLoading.set(false));
  }, { allowSignalWrites: true });
  comparisonSeries = computed<ComparisonSeries[]>(() => {
    const standort = this.selectedStandort();
    if (!standort) {
      return [];
    }

    const data = this.pflegestufenData().filter(d => 
      d.Standort === standort &&
      d.Kategorie === 'Gesamt'
    );

    const stationSet = new Set<string>();
    data.forEach(row => {
      if (row.Station && row.Station.trim().length > 0) {
        stationSet.add(row.Station.trim());
      }
    });

    return Array.from(stationSet).sort().map(station => ({
      id: station,
      label: station,
      monthlyData: Array.from({ length: 12 }, (_, index) => {
        const month = index + 1;
        const monthlyRows = data.filter(row => row.Station === station && row.Monat === month);

        if (monthlyRows.length === 0) {
          return {
            month,
            metrics: {
              patienten: null,
              einstufungen: null,
              pflegebedarf: null
            }
          };
        }

        const patientenSum = monthlyRows.reduce((sum, row) => sum + this.toNumber(row['T.-Patienten']), 0);
        const einstufungenSum = monthlyRows.reduce((sum, row) => sum + this.toNumber(row['Einstufungen absolut']), 0);
        const pflegebedarfSum = monthlyRows.reduce((sum, row) => sum + this.toNumber(row['Pfl.bedarf Minuten']), 0);

        return {
          month,
          metrics: {
            patienten: patientenSum,
            einstufungen: einstufungenSum,
            pflegebedarf: pflegebedarfSum
          }
        };
      })
    }));
  });

  private readonly comparisonMetrics: ComparisonMetricConfig[] = [
    {
      key: 'patienten',
      label: 'Tagespatienten',
      chartTitle: 'Tagespatienten',
      decimals: 0,
      valueFormatter: value => value === null ? '–' : value.toLocaleString('de-DE')
    },
    {
      key: 'einstufungen',
      label: 'Einstufungen absolut',
      chartTitle: 'Einstufungen absolut',
      decimals: 0,
      valueFormatter: value => value === null ? '–' : value.toLocaleString('de-DE')
    },
    {
      key: 'pflegebedarf',
      label: 'Pflegebedarf (Minuten)',
      chartTitle: 'Pflegebedarf (Minuten)',
      decimals: 0,
      valueFormatter: value => value === null ? '–' : value.toLocaleString('de-DE')
    }
  ];

  ngOnInit() {
    this.loadData();
  }

  ngOnChanges() {
    this.loadData();
  }

  private loadData() {
    this.chartLoading.set(true);
    const pflegeUploads = this.uploads.filter(u => u.schemaId === 'pflegestufenstatistik');
    if (pflegeUploads.length === 0) {
      this.pflegestufenData.set([]);
      this.dataInfoItems.set([]);
      this.availableYears.set([]);
      this.chartLoading.set(false);
      return;
    }

    // Prepare data info items
    this.prepareDataInfoItems(pflegeUploads);

    const allData: PflegestufenData[] = [];
    const years = new Set<number>();
    pflegeUploads.forEach(upload => {
      if ((upload as any).availableYears && Array.isArray((upload as any).availableYears)) {
        (upload as any).availableYears.forEach((y: any) => {
          const num = Number(y);
          if (!Number.isNaN(num)) years.add(num);
        });
      }
      upload.files.forEach(file => {
        if (file.values && Array.isArray(file.values)) {
          const vals = file.values as unknown as PflegestufenData[];
          vals.forEach(v => {
            if (typeof v.Jahr === 'number' && !Number.isNaN(v.Jahr)) years.add(v.Jahr);
          });
          allData.push(...vals);
        }
      });
    });

    const sortedYears = Array.from(years).sort((a, b) => b - a);
    this.availableYears.set(sortedYears);
    if (sortedYears.length > 0) {
      if (!this.selectedYear() || !sortedYears.includes(this.selectedYear())) {
        this.selectedYear.set(sortedYears[0]);
      }
    }

    this.pflegestufenData.set(allData);
    
    // Set default selections
    if (this.availableStandorte().length > 0 && !this.availableStandorte().includes(this.selectedStandort())) {
      this.selectedStandort.set(this.availableStandorte()[0]);
    }
    this.chartLoading.set(false);
  }

  private filterByYear(data: PflegestufenData[]): PflegestufenData[] {
    const year = this.selectedYear();
    if (!year) return data;
    return data.filter(d => d.Jahr === year);
  }

  getFilteredData(): PflegestufenData[] {
    const byYear = this.filterByYear(this.pflegestufenData());
    const filtered = byYear.filter(d => 
      d.Standort === this.selectedStandort() && 
      d.Kategorie === 'Gesamt' // Only show "Gesamt" rows for overview charts
    );

    // Apply station filter if not "Alle"
    if (this.selectedStation() !== 'Alle') {
      return filtered.filter(d => d.Station === this.selectedStation());
    }
    return filtered;
  }

  getDetailedData(): PflegestufenData[] {
    const byYear = this.filterByYear(this.pflegestufenData());
    const filtered = byYear.filter(d => 
      d.Standort === this.selectedStandort() && 
      d.Kategorie !== 'Gesamt' // Exclude "Gesamt" rows for detailed view
    );

    // Apply station filter if not "Alle"
    if (this.selectedStation() !== 'Alle') {
      return filtered.filter(d => d.Station === this.selectedStation());
    }
    return filtered;
  }

  onStandortChange(standort: string) {
    this.chartLoading.set(true);
    this.selectedStandort.set(standort);
    // Reset station to "Alle"
    this.selectedStation.set('Alle');
  }

  onStationChange(station: string) {
    this.chartLoading.set(true);
    this.selectedStation.set(station);
  }

  onYearChange(yearString: string) {
    const year = parseInt(yearString, 10);
    if (!Number.isNaN(year)) {
      this.chartLoading.set(true);
      this.selectedYear.set(year);
    }
  }

  openComparisonDialog(event?: MouseEvent) {
    event?.stopPropagation();
    const series = this.comparisonSeries();
    if (series.length <= 1) {
      return;
    }

    this.dialog.open(ComparisonDialogComponent, {
      width: '1100px',
      maxWidth: '95vw',
      data: {
        title: `Pflegestufen – Vergleich (${this.selectedStandort()})`,
        subtitle: `Jahr ${this.selectedYear()}`,
        selectionLabel: 'Stationen',
        selectionLimit: 4,
        metrics: this.comparisonMetrics,
        series,
        monthLabels: ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']
      }
    });
  }

  private toNumber(value: unknown): number {
    const num = Number(value);
    return isNaN(num) ? 0 : num;
  }

  toggleFlip(cardType: string) {
    const current = this.flippedCards();
    this.flippedCards.set({
      ...current,
      [cardType]: !current[cardType]
    });
  }

  getMonthName(month: number): string {
    const months = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 
                   'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
    return months[month - 1] || `Monat ${month}`;
  }

  getAltersgruppeTotal(gruppe: string): number {
    // Get data for ALL months (not filtered by selectedMonth)
    const allMonthsData = this.pflegestufenData().filter(d => 
      d.Standort === this.selectedStandort() &&
      d.Kategorie !== 'Gesamt' &&
      (this.selectedStation() === 'Alle' || d.Station === this.selectedStation())
    );
    
    let total = 0;
    
    allMonthsData.forEach(row => {
      const kategorie = row.Kategorie;
      if (!kategorie) return;
      
      const kategorieUpper = kategorie.toUpperCase();
      if (gruppe === 'A1' && kategorie.startsWith('A1')) total += row['Einstufungen absolut'];
      else if (gruppe === 'A2' && kategorie.startsWith('A2')) total += row['Einstufungen absolut'];
      else if (gruppe === 'A3' && kategorie.startsWith('A3')) total += row['Einstufungen absolut'];
      else if (gruppe === 'A4' && kategorie.startsWith('A4')) total += row['Einstufungen absolut'];
      else if (gruppe === 'KA1' && kategorie.startsWith('KA1')) total += row['Einstufungen absolut'];
      else if (gruppe === 'KA2' && kategorie.startsWith('KA2')) total += row['Einstufungen absolut'];
      else if (gruppe === 'KA3' && kategorie.startsWith('KA3')) total += row['Einstufungen absolut'];
      else if (gruppe === 'KA4' && kategorie.startsWith('KA4')) total += row['Einstufungen absolut'];
      else if (gruppe === 'PICU' && kategorieUpper.includes('PICU')) total += row['Einstufungen absolut'];
      else if (gruppe === 'NICU' && kategorieUpper.includes('NICU')) total += row['Einstufungen absolut'];
      else if (gruppe === 'ohne' && kategorie.toLowerCase().includes('ohne einstufung')) total += row['Einstufungen absolut'];
    });
    
    return total;
  }

  getAltersgruppePercentage(gruppe: string): string {
    const total = this.getTotalEinstufungenForAltersgruppen();
    if (total === 0) return '0.0';
    const gruppeTotal = this.getAltersgruppeTotal(gruppe);
    return ((gruppeTotal / total) * 100).toFixed(1);
  }

  getTotalEinstufungenForAltersgruppen(): number {
    // Get data for ALL months (not filtered by selectedMonth)
    const allMonthsData = this.pflegestufenData().filter(d => 
      d.Standort === this.selectedStandort() &&
      d.Kategorie !== 'Gesamt' &&
      (this.selectedStation() === 'Alle' || d.Station === this.selectedStation())
    );
    
    return allMonthsData.reduce((sum, d) => sum + d['Einstufungen absolut'], 0);
  }

  private prepareDataInfoItems(uploads: UploadRecord[]) {
    const items: DataInfoItem[] = [];
    
    uploads.forEach(upload => {
      upload.files.forEach(file => {
        let totalRecords = 0;
        
        // Count records
        if (file.values) {
          totalRecords = file.values.length;
        }

        // Extract month and year from file values
        let dataMonth = '';
        let dataYear: number | undefined;
        if (file.values && file.values.length > 0) {
          const firstRow = file.values[0] as any;
          if (firstRow.Monat) {
            const monthNames = ['', 'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 
                               'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
            const monthNum = parseInt(String(firstRow.Monat));
            dataMonth = monthNames[monthNum] || String(firstRow.Monat);
          }
          if (firstRow.Jahr) {
            dataYear = parseInt(String(firstRow.Jahr));
          }
        }

        // Extract location/standort
        let location = '';
        if (file.values && file.values.length > 0) {
          const firstRow = file.values[0] as any;
          if (firstRow.Standort) {
            location = String(firstRow.Standort);
          }
        }

        // Build fileName with fallback
        const fileName = file.originalName || file.storedName || 'Unbekannte Datei';

        items.push({
          fileName: fileName,
          uploadDate: upload.createdAt,
          dataMonth,
          dataYear,
          recordCount: totalRecords,
          status: 'success' as const,
          location,
          rawData: file.values || []
        });
      });
    });

    this.dataInfoItems.set(items);
  }
}

