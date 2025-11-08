import { Component, Input, OnInit, OnChanges, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartData, ChartType, registerables } from 'chart.js';
import Chart from 'chart.js/auto';
import { firstValueFrom } from 'rxjs';
import { Api, UploadRecord } from '../../core/api';
import { DataInfoPanel, DataInfoItem } from '../data-info-panel/data-info-panel';
import { ComparisonDialogComponent, ComparisonMetricConfig, ComparisonSeries } from '../shared/comparison-dialog/comparison-dialog.component';
import { SearchableSelectComponent } from '../shared/searchable-select/searchable-select.component';

interface AusfallstatistikData {
  Kostenstelle: string;
  KSt: string;
  EA: string;
  PersNr: string;
  Soll_Stunden: number;
  Soll_Minuten: number;
  Soll_TotalMinutes: number;
  Ist_Stunden: number;
  Ist_Minuten: number;
  Ist_TotalMinutes: number;
  Ist_Prozent: number | null;
  LA1_KR_Wert: number | null;
  LA1_KR_Prozent: number | null;
  LA2_FT_Wert: number | null;
  LA2_FT_Prozent: number | null;
  LA3_FB_Wert: number | null;
  LA3_FB_Prozent: number | null;
  Monat: number | null;
  Jahr: number | null;
}

interface KostenstellenMappingItem {
  kostenstelle: string;
  stations?: string[];
  standorte?: string[];
  standortnummer?: number | string | null;
  ik?: number | string | null;
  paediatrie?: string | null;
}

@Component({
  selector: 'app-ausfallstatistik-charts',
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatChipsModule,
    MatIconModule,
    MatButtonToggleModule,
    MatTooltipModule,
    BaseChartDirective,
    DataInfoPanel,
    SearchableSelectComponent
  ],
  template: `
    <div class="ausfallstatistik-charts">
      <div class="charts-header">
        <div class="header-top">
          <h3>
            <mat-icon>person_off</mat-icon>
            Ausfallstatistik - {{ selectedYearSignal() }}
          </h3>
          <div class="selectors">
            <app-searchable-select
              class="selector"
              label="Kostenstelle"
              icon="domain"
              [options]="availableKostenstellen()"
              [value]="selectedKostenstelle()"
              [includeAllOption]="true"
              [allValue]="'all'"
              [allLabel]="allKostenstellenLabel"
              [displayWith]="kostenstelleDisplayName"
              (valueChange)="onKostenstelleChange($event)"
            ></app-searchable-select>
            
            <app-searchable-select
              class="selector"
              label="Jahr"
              icon="calendar_today"
              [options]="availableYearOptions()"
              [value]="selectedYearSignal().toString()"
              [clearable]="false"
              [disabled]="availableYearOptions().length === 0"
              (valueChange)="onYearSelect($event)"
            ></app-searchable-select>
            <button
              mat-stroked-button
              color="primary"
              class="comparison-button"
              (click)="openComparisonDialog($event)"
              [disabled]="comparisonSeries().length === 0"
              matTooltip="Vergleichen Sie bis zu vier Kostenstellen über die Monate">
              <mat-icon>compare</mat-icon>
              Vergleich
            </button>
          </div>
        </div>
        <p>Soll/Ist-Vergleich nach Kostenstellen mit Lohnartendaten (Krankenstand, Urlaub, Sonstige Ausfälle)</p>
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
          <!-- Soll/Ist Vergleich Chart -->
          <mat-card class="chart-card">
            <mat-card-header class="chart-header">
              <mat-card-title>
                <mat-icon>bar_chart</mat-icon>
                Soll/Ist-Vergleich nach Monaten
              </mat-card-title>
              <mat-card-subtitle>
                {{ selectedKostenstelleLabel() }} - 
                Arbeitszeit: Soll vs. Ist 
                <span *ngIf="!showPercentage()">(in Stunden)</span>
                <span *ngIf="showPercentage()">(in Prozent)</span>
              </mat-card-subtitle>
            </mat-card-header>
            <mat-card-content class="chart-content">
              <div class="chart-toggle">
                <mat-button-toggle-group 
                  [value]="showPercentage() ? 'percent' : 'hours'"
                  (change)="onToggleChange($event.value === 'percent')"
                  appearance="legacy">
                  <mat-button-toggle value="hours">
                    <mat-icon>schedule</mat-icon>
                    Stunden
                  </mat-button-toggle>
                  <mat-button-toggle value="percent">
                    <mat-icon>percent</mat-icon>
                    Prozent
                  </mat-button-toggle>
                </mat-button-toggle-group>
              </div>
              <div class="chart-container">
                <canvas baseChart
                  [data]="sollIstChartData()"
                  [options]="sollIstChartOptions()"
                  [type]="'bar'">
                </canvas>
              </div>
              <div class="chart-summary">
                <mat-chip-set>
                  <mat-chip *ngIf="!showPercentage()">
                    Soll Gesamt: {{ totalSoll() | number:'1.0-0' }}h
                  </mat-chip>
                  <mat-chip *ngIf="!showPercentage()">
                    Ist Gesamt: {{ totalIst() | number:'1.0-0' }}h
                  </mat-chip>
                  <mat-chip [class.warning]="erfuellungsgrad() < 95" [class.danger]="erfuellungsgrad() < 90">
                    Abdeckungsgrad: {{ erfuellungsgrad() | number:'1.2-2' }}%
                  </mat-chip>
                </mat-chip-set>
              </div>
            </mat-card-content>
          </mat-card>

          <!-- Lohnarten Chart -->
          <mat-card class="chart-card">
            <mat-card-header class="chart-header">
              <mat-card-title>
                <mat-icon>pie_chart</mat-icon>
                Lohnarten nach Monaten
              </mat-card-title>
              <mat-card-subtitle>
                {{ selectedKostenstelleLabel() }} - 
                K / U. / Sonstige Ausfälle
                <span *ngIf="!showLohnartenPercentage()">(h)</span>
                <span *ngIf="showLohnartenPercentage()">(in Prozent)</span>
              </mat-card-subtitle>
            </mat-card-header>
            <mat-card-content class="chart-content">
              <div class="chart-toggle">
                <mat-button-toggle-group 
                  [value]="showLohnartenPercentage() ? 'percent' : 'units'"
                  (change)="onLohnartenToggleChange($event.value === 'percent')"
                  appearance="legacy">
                  <mat-button-toggle value="units">
                    <mat-icon>schedule</mat-icon>
                    Stunden
                  </mat-button-toggle>
                  <mat-button-toggle value="percent">
                    <mat-icon>percent</mat-icon>
                    Prozent
                  </mat-button-toggle>
                </mat-button-toggle-group>
              </div>
              <div class="chart-container">
                <canvas baseChart
                  [data]="lohnartenChartData()"
                  [options]="lohnartenChartOptions()"
                  [type]="'bar'">
                </canvas>
              </div>
              <div class="chart-legend">
                <mat-chip-set>
                  <mat-chip class="la1-chip">
                    <mat-icon>sick</mat-icon>
                    K (Krankenstand): {{ totalLA1() }}
                  </mat-chip>
                  <mat-chip class="la2-chip">
                    <mat-icon>beach_access</mat-icon>
                    U. (Urlaub/Feiertage): {{ totalLA2() }}
                  </mat-chip>
                  <mat-chip class="la3-chip">
                    <mat-icon>free_breakfast</mat-icon>
                    Sonstige Ausfälle: {{ totalLA3() }}
                  </mat-chip>
                </mat-chip-set>
              </div>
            </mat-card-content>
          </mat-card>

          <!-- Kostenstellen Top 10 Chart (nur wenn "Alle" ausgewählt) -->
          <mat-card class="chart-card full-width" *ngIf="selectedKostenstelle() === 'all'">
            <mat-card-header class="chart-header">
              <mat-card-title>
                <mat-icon>bar_chart</mat-icon>
                Top 10 Kostenstellen nach Ausfall
              </mat-card-title>
              <mat-card-subtitle>Kostenstellen mit höchstem Ausfall (LA1 + LA2 + LA3)</mat-card-subtitle>
            </mat-card-header>
            <mat-card-content class="chart-content">
              <div class="chart-container">
                <canvas baseChart
                  [data]="topKostenstellenChartData()"
                  [options]="topKostenstellenChartOptions"
                  [type]="'bar'">
                </canvas>
              </div>
            </mat-card-content>
          </mat-card>
        </div>
      </div>
    </div>
  `,
  styleUrl: './ausfallstatistik-charts.scss'
})
export class AusfallstatistikCharts implements OnInit, OnChanges {
  @Input() uploads: UploadRecord[] = [];
  private _selectedYear = new Date().getFullYear();
  private api = inject(Api);
  private dialog = inject(MatDialog);
  @Input() set selectedYear(value: number) {
    this._selectedYear = value;
    this.selectedYearSignal.set(value);
  }
  get selectedYear() {
    return this._selectedYear;
  }

  selectedYearSignal = signal(this.selectedYear);
  selectedKostenstelle = signal<string>('all');
  readonly allKostenstellenLabel = 'Alle Kostenstellen';
  readonly kostenstelleDisplayName = (value: string) => this.formatKostenstelleLabel(value);
  availableYearOptions = computed(() => this.availableYears().map(year => year.toString()));
  showPercentage = signal<boolean>(false);
  showLohnartenPercentage = signal<boolean>(false);
  kostenstellenMapping = signal<Record<string, KostenstellenMappingItem>>({});
  
  allData = signal<AusfallstatistikData[]>([]);
  selectedKostenstelleLabel = computed(() => {
    const current = this.selectedKostenstelle();
    if (current === 'all') {
      return 'Alle Kostenstellen';
    }
    return this.formatKostenstelleLabel(current);
  });
  
  availableYears = computed(() => {
    const years = new Set<number>();
    this.allData().forEach(row => {
      if (row.Jahr) {
        years.add(row.Jahr);
      }
    });
    return Array.from(years).sort((a, b) => b - a); // Neueste zuerst
  });

  availableKostenstellen = computed(() => {
    const kostenstellen = new Set<string>();
    this.allData().forEach(row => {
      const kst = row.Kostenstelle || row.KSt || '';
      if (kst && kst !== '') {
        kostenstellen.add(kst);
      }
    });
    // Sort by Kostenstellen (numeric or alphabetical)
    return Array.from(kostenstellen).sort((a, b) => {
      // Try numeric sort first, fallback to alphabetical
      const numA = parseInt(a);
      const numB = parseInt(b);
      if (!isNaN(numA) && !isNaN(numB)) {
        return numA - numB;
      }
      return a.localeCompare(b);
    });
  });

  comparisonSeries = computed<ComparisonSeries[]>(() => this.buildComparisonSeries());

  // Chart options (computed to react to showPercentage)
  sollIstChartOptions = computed<ChartConfiguration['options']>(() => {
    const isPercentage = this.showPercentage();
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'top'
        },
        tooltip: {
          callbacks: {
            label: (context) => {
              if (isPercentage) {
                return `${context.dataset.label}: ${context.parsed.y.toFixed(2)}%`;
              } else {
                return `${context.dataset.label}: ${context.parsed.y.toFixed(2)} Stunden`;
              }
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: isPercentage ? 'Prozent (%)' : 'Stunden'
          }
        }
      }
    };
  });

  lohnartenChartOptions = computed<ChartConfiguration['options']>(() => {
    const isPercentage = this.showLohnartenPercentage();
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'top'
        },
        tooltip: {
          callbacks: {
            label: (context) => {
              if (isPercentage) {
                return `${context.dataset.label}: ${context.parsed.y.toFixed(2)}%`;
              } else {
                return `${context.dataset.label}: ${context.parsed.y.toFixed(2)}`;
              }
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: isPercentage ? 'Prozent (%)' : 'Stunden'
          }
        }
      }
    };
  });

  topKostenstellenChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      }
    },
    scales: {
      x: {
        ticks: {
          maxRotation: 45,
          minRotation: 45
        }
      },
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: 'Ausfall (Stunden)'
        }
      }
    },
    indexAxis: 'y'
  };

  ngOnInit() {
    Chart.register(...registerables);
    void this.loadKostenstellenMapping();
    this.processData();
  }

  ngOnChanges() {
    this.selectedYearSignal.set(this.selectedYear);
    this.processData();
  }

  onYearChange(year: number) {
    this.selectedYearSignal.set(year);
    this.processData();
  }

  onYearSelect(year: string) {
    const parsed = Number.parseInt(year, 10);
    if (!Number.isNaN(parsed)) {
      this.onYearChange(parsed);
    }
  }

  onKostenstelleChange(kostenstelle: string) {
    this.selectedKostenstelle.set(kostenstelle);
  }

  onToggleChange(showPercentage: boolean) {
    this.showPercentage.set(showPercentage);
  }

  onLohnartenToggleChange(showPercentage: boolean) {
    this.showLohnartenPercentage.set(showPercentage);
  }

  openComparisonDialog(event?: MouseEvent) {
    event?.stopPropagation();

    const series = this.comparisonSeries();
    if (!series.length) {
      return;
    }

    const metrics: ComparisonMetricConfig[] = [
      {
        key: 'soll',
        label: 'Soll-Stunden',
        unit: 'h',
        chartTitle: 'Soll-Stunden',
        decimals: 1
      },
      {
        key: 'ist',
        label: 'Ist-Stunden',
        unit: 'h',
        chartTitle: 'Ist-Stunden',
        decimals: 1
      },
      {
        key: 'abdeckungsgrad',
        label: 'Abdeckungsgrad',
        unit: '%',
        chartTitle: 'Abdeckungsgrad',
        decimals: 1
      },
      {
        key: 'la1',
        label: 'K (Krankenstand)',
        unit: 'h',
        chartTitle: 'Krankenstand (LA1)',
        decimals: 1
      },
      {
        key: 'la2',
        label: 'U. (Urlaub/Feiertage)',
        unit: 'h',
        chartTitle: 'Urlaub/Feiertage (LA2)',
        decimals: 1
      },
      {
        key: 'la3',
        label: 'Sonstige Ausfälle',
        unit: 'h',
        chartTitle: 'Sonstige Ausfälle (LA3)',
        decimals: 1
      }
    ];

    this.dialog.open(ComparisonDialogComponent, {
      width: '1100px',
      maxWidth: '95vw',
      data: {
        title: `Ausfallstatistik – Vergleich (${this.selectedYearSignal()})`,
        subtitle: 'Soll/Ist sowie Lohnartenkennzahlen im Kostenstellenvergleich',
        selectionLabel: 'Kostenstellen',
        metrics,
        series
      }
    });
  }

  private buildComparisonSeries(): ComparisonSeries[] {
    const data = this.allData();
    if (data.length === 0) {
      return [];
    }

    const targetYear = this.selectedYearSignal();

    type MonthAggregate = {
      soll: number;
      ist: number;
      la1: number;
      la2: number;
      la3: number;
    };

    const createAggregate = (): MonthAggregate => ({
      soll: 0,
      ist: 0,
      la1: 0,
      la2: 0,
      la3: 0
    });

    const costCenterMap = new Map<string, Map<number, MonthAggregate>>();
    const aggregatedMap = new Map<number, MonthAggregate>();

    data.forEach(row => {
      if (!row || row.Jahr !== targetYear || !row.Monat) {
        return;
      }

      const month = Number(row.Monat);
      if (!month || month < 1 || month > 12) {
        return;
      }

      const rawKey = String(row.Kostenstelle || row.KSt || '').trim();
      if (!rawKey) {
        return;
      }

      if (!costCenterMap.has(rawKey)) {
        costCenterMap.set(rawKey, new Map());
      }
      const monthMap = costCenterMap.get(rawKey)!;
      if (!monthMap.has(month)) {
        monthMap.set(month, createAggregate());
      }
      if (!aggregatedMap.has(month)) {
        aggregatedMap.set(month, createAggregate());
      }

      const monthAggregate = monthMap.get(month)!;
      const aggregatedAggregate = aggregatedMap.get(month)!;
      const soll = (row.Soll_Stunden || 0) + ((row.Soll_Minuten || 0) / 60);
      const ist = (row.Ist_Stunden || 0) + ((row.Ist_Minuten || 0) / 60);
      const la1 = row.LA1_KR_Wert || 0;
      const la2 = row.LA2_FT_Wert || 0;
      const la3 = row.LA3_FB_Wert || 0;

      monthAggregate.soll += soll;
      monthAggregate.ist += ist;
      monthAggregate.la1 += la1;
      monthAggregate.la2 += la2;
      monthAggregate.la3 += la3;

      aggregatedAggregate.soll += soll;
      aggregatedAggregate.ist += ist;
      aggregatedAggregate.la1 += la1;
      aggregatedAggregate.la2 += la2;
      aggregatedAggregate.la3 += la3;
    });

    const months = Array.from({ length: 12 }, (_, index) => index + 1);
    const series: ComparisonSeries[] = [];

    const buildSeries = (id: string, label: string, monthMap: Map<number, MonthAggregate>) => {
      const monthlyData = months.map(month => {
        const values = monthMap.get(month) ?? createAggregate();
        return {
          month,
          metrics: {
            soll: values.soll,
            ist: values.ist,
            abdeckungsgrad: values.soll > 0 ? (values.ist / values.soll) * 100 : null,
            la1: values.la1,
            la2: values.la2,
            la3: values.la3
          }
        };
      });

      series.push({
        id,
        label,
        monthlyData
      });
    };

    if (aggregatedMap.size > 0) {
      buildSeries('all', 'Alle Kostenstellen', aggregatedMap);
    }

    const sortedKeys = Array.from(costCenterMap.keys()).sort((a, b) => {
      const numA = parseInt(a, 10);
      const numB = parseInt(b, 10);
      if (!isNaN(numA) && !isNaN(numB)) {
        return numA - numB;
      }
      return a.localeCompare(b);
    });

    sortedKeys.forEach(key => {
      const monthMap = costCenterMap.get(key);
      if (!monthMap) {
        return;
      }
      buildSeries(key, this.formatKostenstelleLabel(key), monthMap);
    });

    return series;
  }
  private processData() {
    const data: AusfallstatistikData[] = [];

    // Collect all data from uploads for ausfallstatistik schema
    this.uploads
      .filter(upload => upload.schemaId === 'ausfallstatistik')
      .forEach(upload => {
        upload.files.forEach(file => {
          if (file.values) {
            file.values.forEach((value: any) => {
              // Add all data first (for availableYears calculation)
              data.push(value as AusfallstatistikData);
            });
          }
        });
      });

    this.allData.set(data);
    
    // Set default year if available years exist and current selection is not in list
    const years = this.availableYears();
    if (years.length > 0 && !years.includes(this.selectedYearSignal())) {
      this.selectedYearSignal.set(years[0]); // Set to newest year
    }
  }

  private async loadKostenstellenMapping() {
    try {
      const response = await firstValueFrom(this.api.getKostenstellenMapping());
      const map: Record<string, KostenstellenMappingItem> = {};
      const data = Array.isArray(response?.data) ? response.data : [];
      data.forEach((item: any) => {
        if (!item || !item.kostenstelle) {
          return;
        }
        map[item.kostenstelle] = {
          kostenstelle: item.kostenstelle,
          stations: Array.isArray(item.stations) ? item.stations : [],
          standorte: Array.isArray(item.standorte) ? item.standorte : [],
          standortnummer: item.standortnummer ?? null,
          ik: item.ik ?? null,
          paediatrie: item.paediatrie ?? null
        };
      });
      this.kostenstellenMapping.set(map);
    } catch (error) {
      console.error('Fehler beim Laden des Kostenstellen-Mappings', error);
      this.kostenstellenMapping.set({});
    }
  }
  
  // Filter data by selected year and kostenstelle for charts
  private getFilteredData(): AusfallstatistikData[] {
    let filtered = this.allData().filter(row => row.Jahr === this.selectedYearSignal());
    
    // Filter by kostenstelle if not "all"
    const selectedKST = this.selectedKostenstelle();
    if (selectedKST !== 'all') {
      filtered = filtered.filter(row => {
        const kst = row.Kostenstelle || row.KSt || '';
        return kst === selectedKST;
      });
    }
    
    // Sort by Kostenstelle
    return filtered.sort((a, b) => {
      const kstA = a.Kostenstelle || a.KSt || '';
      const kstB = b.Kostenstelle || b.KSt || '';
      // Try numeric sort first, fallback to alphabetical
      const numA = parseInt(kstA);
      const numB = parseInt(kstB);
      if (!isNaN(numA) && !isNaN(numB)) {
        return numA - numB;
      }
      return kstA.localeCompare(kstB);
    });
  }

  // Computed values
  sollIstChartData = computed(() => {
    const data = this.getFilteredData();
    const monthlyData = new Map<number, { soll: number; ist: number; sollPercent: number; istPercent: number }>();

    data.forEach(row => {
      if (row.Monat) {
        const month = row.Monat;
        if (!monthlyData.has(month)) {
          monthlyData.set(month, { soll: 0, ist: 0, sollPercent: 0, istPercent: 0 });
        }
        const monthData = monthlyData.get(month)!;
        const sollHours = row.Soll_Stunden + (row.Soll_Minuten / 60);
        const istHours = row.Ist_Stunden + (row.Ist_Minuten / 60);
        monthData.soll += sollHours;
        monthData.ist += istHours;
        
        // Calculate percentage: (Ist / Soll) * 100
        if (sollHours > 0) {
          monthData.istPercent += (istHours / sollHours) * 100;
        }
      }
    });

    // Average percentage across all rows for each month
    const months = Array.from(monthlyData.keys()).sort((a, b) => a - b);
    months.forEach(month => {
      const monthData = monthlyData.get(month)!;
      if (monthData.soll > 0) {
        monthData.istPercent = (monthData.ist / monthData.soll) * 100;
      }
      monthData.sollPercent = 100; // Soll is always 100% as reference
    });

    const monthNames = ['', 'Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
    const isPercentage = this.showPercentage();

    return {
      labels: months.map(m => monthNames[m]),
      datasets: [
        {
          label: isPercentage ? 'Soll (%)' : 'Soll (Stunden)',
          data: months.map(m => {
            const monthData = monthlyData.get(m)!;
            return isPercentage ? monthData.sollPercent : monthData.soll;
          }),
          borderColor: 'rgb(75, 192, 192)',
          backgroundColor: 'rgba(75, 192, 192, 0.2)',
          tension: 0.1
        },
        {
          label: isPercentage ? 'Ist (%)' : 'Ist (Stunden)',
          data: months.map(m => {
            const monthData = monthlyData.get(m)!;
            return isPercentage ? monthData.istPercent : monthData.ist;
          }),
          borderColor: 'rgb(255, 99, 132)',
          backgroundColor: 'rgba(255, 99, 132, 0.2)',
          tension: 0.1
        }
      ]
    };
  });

  lohnartenChartData = computed(() => {
    const data = this.getFilteredData();
    const monthlyData = new Map<number, { 
      la1: number; la2: number; la3: number;
      la1Percent: number; la2Percent: number; la3Percent: number;
    }>();
    const isPercentage = this.showLohnartenPercentage();

    data.forEach(row => {
      if (row.Monat) {
        const month = row.Monat;
        if (!monthlyData.has(month)) {
          monthlyData.set(month, { 
            la1: 0, la2: 0, la3: 0,
            la1Percent: 0, la2Percent: 0, la3Percent: 0
          });
        }
        const monthData = monthlyData.get(month)!;
        
        if (isPercentage) {
          // Use percentage values if available
          monthData.la1Percent += row.LA1_KR_Prozent || 0;
          monthData.la2Percent += row.LA2_FT_Prozent || 0;
          monthData.la3Percent += row.LA3_FB_Prozent || 0;
        } else {
          // Use absolute values
          monthData.la1 += row.LA1_KR_Wert || 0;
          monthData.la2 += row.LA2_FT_Wert || 0;
          monthData.la3 += row.LA3_FB_Wert || 0;
        }
      }
    });

    const months = Array.from(monthlyData.keys()).sort((a, b) => a - b);
    const monthNames = ['', 'Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

    // Calculate averages for percentage mode
    if (isPercentage) {
      const rowCounts = new Map<number, number>();
      data.forEach(row => {
        if (row.Monat) {
          rowCounts.set(row.Monat, (rowCounts.get(row.Monat) || 0) + 1);
        }
      });
      
      months.forEach(month => {
        const count = rowCounts.get(month) || 1;
        const monthData = monthlyData.get(month)!;
        monthData.la1Percent = monthData.la1Percent / count;
        monthData.la2Percent = monthData.la2Percent / count;
        monthData.la3Percent = monthData.la3Percent / count;
      });
    }

    return {
      labels: months.map(m => monthNames[m]),
      datasets: [
        {
          label: isPercentage ? 'K (Krankenstand) (%)' : 'K (Krankenstand)',
          data: months.map(m => {
            const monthData = monthlyData.get(m)!;
            return isPercentage ? monthData.la1Percent : monthData.la1;
          }),
          backgroundColor: 'rgba(255, 99, 132, 0.6)'
        },
        {
          label: isPercentage ? 'U. (Urlaub/Feiertage) (%)' : 'U. (Urlaub/Feiertage)',
          data: months.map(m => {
            const monthData = monthlyData.get(m)!;
            return isPercentage ? monthData.la2Percent : monthData.la2;
          }),
          backgroundColor: 'rgba(54, 162, 235, 0.6)'
        },
        {
          label: isPercentage ? 'Sonstige Ausfälle (%)' : 'Sonstige Ausfälle',
          data: months.map(m => {
            const monthData = monthlyData.get(m)!;
            return isPercentage ? monthData.la3Percent : monthData.la3;
          }),
          backgroundColor: 'rgba(255, 206, 86, 0.6)'
        }
      ]
    };
  });

  topKostenstellenChartData = computed(() => {
    const data = this.getFilteredData();
    const kostenstelleData = new Map<string, number>();

    data.forEach(row => {
      const total = (row.LA1_KR_Wert || 0) + (row.LA2_FT_Wert || 0) + (row.LA3_FB_Wert || 0);
      if (total > 0) {
        const key = row.Kostenstelle || row.KSt || 'Unknown';
        kostenstelleData.set(key, (kostenstelleData.get(key) || 0) + total);
      }
    });

    // Sort by total and get top 10
    const sorted = Array.from(kostenstelleData.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    return {
      labels: sorted.map(([kst]) => this.formatKostenstelleLabel(kst)),
      datasets: [
        {
          label: 'Gesamtausfall',
          data: sorted.map(([, total]) => total),
          backgroundColor: 'rgba(153, 102, 255, 0.6)'
        }
      ]
    };
  });

  totalSoll = computed(() => {
    return this.getFilteredData().reduce((sum, row) => 
      sum + row.Soll_Stunden + (row.Soll_Minuten / 60), 0);
  });

  totalIst = computed(() => {
    return this.getFilteredData().reduce((sum, row) => 
      sum + row.Ist_Stunden + (row.Ist_Minuten / 60), 0);
  });

  erfuellungsgrad = computed(() => {
    const soll = this.totalSoll();
    return soll > 0 ? (this.totalIst() / soll) * 100 : 0;
  });

  totalLA1 = computed(() => {
    return this.getFilteredData().reduce((sum, row) => sum + (row.LA1_KR_Wert || 0), 0);
  });

  totalLA2 = computed(() => {
    return this.getFilteredData().reduce((sum, row) => sum + (row.LA2_FT_Wert || 0), 0);
  });

  totalLA3 = computed(() => {
    return this.getFilteredData().reduce((sum, row) => sum + (row.LA3_FB_Wert || 0), 0);
  });

  dataInfoItems = computed(() => {
    const items: DataInfoItem[] = [];
    
    // Collect upload information for ausfallstatistik schema
    this.uploads
      .filter(upload => upload.schemaId === 'ausfallstatistik')
      .forEach(upload => {
        upload.files.forEach(file => {
          // Extract year and month from file data or filename
          let dataYear: number | undefined;
          let dataMonth: string | undefined;
          
          if (file.values && file.values.length > 0) {
            const firstRow = file.values[0] as any;
            dataYear = firstRow.Jahr || undefined;
            if (firstRow.Monat) {
              const monthNames = ['', 'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 
                                 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
              dataMonth = monthNames[firstRow.Monat] || undefined;
            }
          }

          items.push({
            fileName: file.originalName || 'Unbekannt',
            uploadDate: upload.createdAt,
            dataMonth: dataMonth,
            dataYear: dataYear,
            recordCount: file.values?.length || 0,
            status: 'success',
            rawData: file.values || [],
            schemaColumns: ['Kostenstelle', 'KSt', 'EA', 'PersNr', 'Soll_Stunden', 'Ist_Stunden', 
                           'Ist_Prozent', 'LA1_KR_Wert', 'LA2_FT_Wert', 'LA3_FB_Wert', 'Monat', 'Jahr']
          });
        });
      });

    return items;
  });

  formatKostenstelleLabel(kst: string): string {
    if (!kst || kst === 'all') {
      return 'Alle Kostenstellen';
    }

    const mapping = this.kostenstellenMapping();
    const entry = mapping[kst];
    if (!entry) {
      return kst;
    }

    const code = entry.kostenstelle ?? kst;
    const stations = Array.isArray(entry.stations) ? entry.stations.filter(Boolean) : [];
    const stationWithCode = stations.find(station => station.includes(code));
    const primaryStation = stationWithCode ?? stations[0] ?? code;
    const stationLabel = primaryStation.includes(code) ? primaryStation : `${code} - ${primaryStation}`;

    const standorte = Array.isArray(entry.standorte) ? entry.standorte.filter(Boolean) : [];
    const uniqueStandorte = Array.from(new Set(standorte));

    if (uniqueStandorte.length > 0) {
      return `${stationLabel} · ${uniqueStandorte.join(' / ')}`;
    }

    return stationLabel || code;
  }
}
