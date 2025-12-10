import { Component, Input, OnInit, OnChanges, signal, computed, inject, SimpleChanges, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatDialog } from '@angular/material/dialog';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartData, ChartType, registerables } from 'chart.js';
import { UploadRecord, SchemaStatistics } from '../../core/api';
import { DataInfoPanel, DataInfoItem } from '../data-info-panel/data-info-panel';
import { ComparisonDialogComponent, ComparisonMetricConfig, ComparisonSeries } from '../shared/comparison-dialog/comparison-dialog.component';
import { SearchableSelectComponent } from '../shared/searchable-select/searchable-select.component';

// Register Chart.js components
import Chart from 'chart.js/auto';

interface MonthlyData {
  [standort: string]: {
    [station: string]: {
      [typ: string]: {
        [zeitraum: string]: number;
      };
    };
  };
}

interface COChartData {
  schemaId: string;
  schemaName: string;
  description: string;
  columns: string[];
  uploads: UploadRecord[];
  totalRows: number;
  latestUploadDate: string;
  availableColumns: string[];
  monthlyData: { [month: number]: MonthlyData };
}

@Component({
  selector: 'app-co-charts',
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatChipsModule,
    MatIconModule,
    MatTooltipModule,
    MatButtonToggleModule,
    BaseChartDirective,
    DataInfoPanel,
    SearchableSelectComponent
  ],
  template: `
    <div class="co-charts">
      <div class="charts-header">
        <div class="header-top">
          <h3>
            <mat-icon>timeline</mat-icon>
            Aufnahmen und Entlassungen - {{ selectedYear }}
          </h3>
          <div class="header-actions">
            <app-searchable-select
              class="location-selector"
              label="Standort"
              icon="location_on"
              [options]="standortOptions"
              [value]="selectedStandort()"
              [displayWith]="standortDisplayName"
              (valueChange)="onStandortChange($event)"
            ></app-searchable-select>

            <app-searchable-select
              class="station-selector"
              label="Station"
              icon="business"
              [options]="stationOptions()"
              [value]="selectedStation()"
              [displayWith]="stationDisplayName"
              (valueChange)="onStationChange($event)"
            ></app-searchable-select>

            <button
              mat-stroked-button
              color="primary"
              class="comparison-button"
              (click)="openComparisonDialog($event)"
              [disabled]="comparisonSeries().length <= 1"
              matTooltip="Vergleichen Sie bis zu vier Standorte über alle Monate">
              <mat-icon>compare</mat-icon>
              Vergleich
            </button>
          </div>
        </div>
        <p>Zwei separate Charts: Entlassungen und Aufnahmen nach Zeitfenstern (vor/nach 11 Uhr)</p>
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
          <!-- ENTLASSUNGEN CHART - Nur Entlassungsdaten -->
          <div class="flip-card" [class.flipped]="flippedCards()['entlassungen']" (click)="toggleFlip('entlassungen')">
            <div class="flip-card-inner">
              <div class="flip-card-front">
                <mat-card class="metric-card entlassungen-card">
                  <mat-card-header class="metric-header entlassungen-header">
                    <mat-card-title>
                      <mat-icon>output</mat-icon>
                      Entlassungen
                      <span class="flip-hint-text">Klicken zum Umdrehen</span>
                      <mat-icon class="flip-icon">flip</mat-icon>
                    </mat-card-title>
                    <mat-card-subtitle>Nur Entlassungsdaten</mat-card-subtitle>
                  </mat-card-header>
                  <mat-card-content class="chart-content">
                    <div class="chart-toggle" (click)="$event.stopPropagation()">
                      <mat-button-toggle-group 
                        [value]="showEntlassungenPercentage() ? 'percent' : 'count'"
                        (change)="onEntlassungenToggleChange($event.value === 'percent')"
                        appearance="legacy"
                        class="entlassungen-toggle">
                        <mat-button-toggle value="count">
                          <mat-icon>numbers</mat-icon>
                          Anzahl
                        </mat-button-toggle>
                        <mat-button-toggle value="percent">
                          <mat-icon>percent</mat-icon>
                          Prozent
                        </mat-button-toggle>
                      </mat-button-toggle-group>
                    </div>
                    <div class="chart-container">
                      <div class="chart-loading-overlay" *ngIf="chartLoading()">
                        <div class="loading-bar"></div>
                        <p>Daten werden geladen…</p>
                      </div>
                      <canvas baseChart
                        [data]="entlassungenChartData()"
                        [options]="entlassungenChartOptions()"
                        [type]="'bar'">
                      </canvas>
                    </div>
                    <div class="chart-info">
                      <mat-chip-set>
                        <mat-chip class="entlassungen-chip-vor" *ngIf="!showEntlassungenPercentage()">
                          Vor 11h: {{ calculateTotal('entlassungen', 'vor') | number:'1.0-0' }}
                        </mat-chip>
                        <mat-chip class="entlassungen-chip-vor" *ngIf="showEntlassungenPercentage()">
                          Vor 11h: {{ calculatePercentage('entlassungen', 'vor') | number:'1.1-1' }}%
                        </mat-chip>
                        <mat-chip class="entlassungen-chip-nach" *ngIf="!showEntlassungenPercentage()">
                          Nach 11h: {{ calculateTotal('entlassungen', 'nach') | number:'1.0-0' }}
                        </mat-chip>
                        <mat-chip class="entlassungen-chip-nach" *ngIf="showEntlassungenPercentage()">
                          Nach 11h: {{ calculatePercentage('entlassungen', 'nach') | number:'1.1-1' }}%
                        </mat-chip>
                      </mat-chip-set>
                      <div class="total-badge entlassungen-total" *ngIf="!showEntlassungenPercentage()">
                        Gesamt: {{ calculateTotal('entlassungen', 'vor') + calculateTotal('entlassungen', 'nach') | number:'1.0-0' }}
                      </div>
                    </div>
                  </mat-card-content>
                </mat-card>
              </div>
              <div class="flip-card-back">
                <mat-card class="metric-card">
                  <mat-card-header class="metric-header entlassungen-header">
                    <mat-card-title>
                      Entlassungen Details
                      <mat-icon class="flip-icon">flip</mat-icon>
                    </mat-card-title>
                  </mat-card-header>
                  <mat-card-content class="data-content">
                    <div class="data-summary">
                      <h4>Standort-Übersicht - Entlassungen</h4>
                      <div class="standort-grid">
                        <div *ngFor="let standort of getAvailableStandorte()" class="standort-item">
                          <div class="standort-name">{{ standortNames[standort] || standort }}</div>
                          <div class="standort-stats">
                            <span class="stat-label">Vor 11h:</span>
                            <span class="stat-value">{{ getStandortTotal(standort, 'entlassungen', 'vor') }} ({{ getStandortPercentage(standort, 'entlassungen', 'vor') | number:'1.1-1' }}%)</span>
                          </div>
                          <div class="standort-stats">
                            <span class="stat-label">Nach 11h:</span>
                            <span class="stat-value">{{ getStandortTotal(standort, 'entlassungen', 'nach') }} ({{ getStandortPercentage(standort, 'entlassungen', 'nach') | number:'1.1-1' }}%)</span>
                          </div>
                          <div class="standort-total">
                            Gesamt: {{ getStandortTotal(standort, 'entlassungen', 'vor') + getStandortTotal(standort, 'entlassungen', 'nach') }}
                          </div>
                        </div>
                      </div>
                    </div>
                  </mat-card-content>
                </mat-card>
              </div>
            </div>
          </div>

          <!-- AUFNAHMEN CHART - Nur Aufnahmendaten -->
          <div class="flip-card" [class.flipped]="flippedCards()['aufnahmen']" (click)="toggleFlip('aufnahmen')">
            <div class="flip-card-inner">
              <div class="flip-card-front">
                <mat-card class="metric-card aufnahmen-card">
                  <mat-card-header class="metric-header aufnahmen-header">
                    <mat-card-title>
                      <mat-icon>input</mat-icon>
                      Aufnahmen
                      <span class="flip-hint-text">Klicken zum Umdrehen</span>
                      <mat-icon class="flip-icon">flip</mat-icon>
                    </mat-card-title>
                    <mat-card-subtitle>Nur Aufnahmendaten</mat-card-subtitle>
                  </mat-card-header>
                  <mat-card-content class="chart-content">
                    <div class="chart-toggle" (click)="$event.stopPropagation()">
                      <mat-button-toggle-group 
                        [value]="showAufnahmenPercentage() ? 'percent' : 'count'"
                        (change)="onAufnahmenToggleChange($event.value === 'percent')"
                        appearance="legacy"
                        class="aufnahmen-toggle">
                        <mat-button-toggle value="count">
                          <mat-icon>numbers</mat-icon>
                          Anzahl
                        </mat-button-toggle>
                        <mat-button-toggle value="percent">
                          <mat-icon>percent</mat-icon>
                          Prozent
                        </mat-button-toggle>
                      </mat-button-toggle-group>
                    </div>
                    <div class="chart-container">
                      <div class="chart-loading-overlay" *ngIf="chartLoading()">
                        <div class="loading-bar"></div>
                        <p>Daten werden geladen…</p>
                      </div>
                      <canvas baseChart
                        [data]="aufnahmenChartData()"
                        [options]="aufnahmenChartOptions()"
                        [type]="'bar'">
                      </canvas>
                    </div>
                    <div class="chart-info">
                      <mat-chip-set>
                        <mat-chip class="aufnahmen-chip-vor" *ngIf="!showAufnahmenPercentage()">
                          Vor 11h: {{ calculateTotal('aufnahmen', 'vor') | number:'1.0-0' }}
                        </mat-chip>
                        <mat-chip class="aufnahmen-chip-vor" *ngIf="showAufnahmenPercentage()">
                          Vor 11h: {{ calculatePercentage('aufnahmen', 'vor') | number:'1.1-1' }}%
                        </mat-chip>
                        <mat-chip class="aufnahmen-chip-nach" *ngIf="!showAufnahmenPercentage()">
                          Nach 11h: {{ calculateTotal('aufnahmen', 'nach') | number:'1.0-0' }}
                        </mat-chip>
                        <mat-chip class="aufnahmen-chip-nach" *ngIf="showAufnahmenPercentage()">
                          Nach 11h: {{ calculatePercentage('aufnahmen', 'nach') | number:'1.1-1' }}%
                        </mat-chip>
                      </mat-chip-set>
                      <div class="total-badge aufnahmen-total" *ngIf="!showAufnahmenPercentage()">
                        Gesamt: {{ calculateTotal('aufnahmen', 'vor') + calculateTotal('aufnahmen', 'nach') | number:'1.0-0' }}
                      </div>
                    </div>
                  </mat-card-content>
                </mat-card>
              </div>
              <div class="flip-card-back">
                <mat-card class="metric-card">
                  <mat-card-header class="metric-header aufnahmen-header">
                    <mat-card-title>
                      Aufnahmen Details
                      <mat-icon class="flip-icon">flip</mat-icon>
                    </mat-card-title>
                  </mat-card-header>
                  <mat-card-content class="data-content">
                    <div class="data-summary">
                      <h4>Standort-Übersicht - Aufnahmen</h4>
                      <div class="standort-grid">
                        <div *ngFor="let standort of getAvailableStandorte()" class="standort-item">
                          <div class="standort-name">{{ standortNames[standort] || standort }}</div>
                          <div class="standort-stats">
                            <span class="stat-label">Vor 11h:</span>
                            <span class="stat-value">{{ getStandortTotal(standort, 'aufnahmen', 'vor') }} ({{ getStandortPercentage(standort, 'aufnahmen', 'vor') | number:'1.1-1' }}%)</span>
                          </div>
                          <div class="standort-stats">
                            <span class="stat-label">Nach 11h:</span>
                            <span class="stat-value">{{ getStandortTotal(standort, 'aufnahmen', 'nach') }} ({{ getStandortPercentage(standort, 'aufnahmen', 'nach') | number:'1.1-1' }}%)</span>
                          </div>
                          <div class="standort-total">
                            Gesamt: {{ getStandortTotal(standort, 'aufnahmen', 'vor') + getStandortTotal(standort, 'aufnahmen', 'nach') }}
                          </div>
                        </div>
                      </div>
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
  styleUrl: './co-charts.scss'
})
export class COCharts implements OnInit, OnChanges {
  @Input() uploads: UploadRecord[] = [];
  @Input() statistics: SchemaStatistics[] = [];
  @Input() schemaId: string = '';
  @Input() selectedYear: number = new Date().getFullYear();

  chartData = signal<COChartData | null>(null);
  selectedStandort = signal<string>('AIB');
  selectedStation = signal<string | null>(null);
  flippedCards = signal<{ [key: string]: boolean }>({});
  dataInfoItems = signal<DataInfoItem[]>([]);
  chartLoading = signal<boolean>(true);
  showEntlassungenPercentage = signal<boolean>(false);
  showAufnahmenPercentage = signal<boolean>(false);
  private selectedYearState = signal<number>(this.selectedYear);
  private readonly monthLabels = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'] as const;
  private dialog = inject(MatDialog);

  // Standort-Mapping: AIB = BAB
  standortNames: { [key: string]: string } = {
    'AIB': 'BAB',
    'PRI': 'PRI',
    'ROS': 'ROS',
    'WAS': 'WAS'
  };
  readonly standortOptions = ['AIB', 'PRI', 'ROS', 'WAS'] as const;
  readonly standortDisplayName = (value: string) => this.standortNames[value] || value;
  readonly stationDisplayName = (value: string | null) => value || 'Alle Stationen';
  
  // Helper: Convert AIB to BAB for data lookup (AIB and BAB are the same)
  private getDataStandort(standort: string): string {
    return standort === 'AIB' ? 'BAB' : standort;
  }

  ngOnInit() {
    Chart.register(...registerables);
    this.processChartData();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['selectedYear'] && changes['selectedYear'].currentValue !== undefined) {
      this.selectedYearState.set(this.selectedYear);
    }

    if (changes['uploads'] || changes['statistics'] || changes['schemaId']) {
      this.processChartData();
    }
  }

  private processChartData() {
    this.chartLoading.set(true);
    if (!this.schemaId || this.uploads.length === 0) {
      this.chartLoading.set(false);
      return;
    }

    // Find schema statistics
    const schemaStat = this.statistics.find(s => s.schemaId === this.schemaId);
    if (!schemaStat) {
      this.chartLoading.set(false);
      return;
    }

    // Get uploads for this schema
    const schemaUploads = this.uploads.filter(upload => upload.schemaId === this.schemaId);
    if (schemaUploads.length === 0) {
      this.chartLoading.set(false);
      return;
    }

    // Sort uploads by date
    schemaUploads.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    // Get available columns from the first upload with data
    const firstUploadWithData = schemaUploads.find(upload => 
      upload.files.some(file => file.values && file.values.length > 0)
    );
    
    const availableColumns = firstUploadWithData ? 
      Object.keys(firstUploadWithData.files[0]?.values?.[0] || {}) : [];

    // Calculate total rows
    const totalRows = schemaUploads.reduce((sum, upload) => {
      return sum + upload.files.reduce((fileSum, file) => {
        return fileSum + (file.values?.length || 0);
      }, 0);
    }, 0);

    const latestUpload = schemaUploads[schemaUploads.length - 1];

    const chartData: COChartData = {
      schemaId: this.schemaId,
      schemaName: schemaStat.schemaName,
      description: schemaStat.description,
      columns: schemaStat.columns,
      uploads: schemaUploads,
      totalRows,
      latestUploadDate: latestUpload.createdAt,
      availableColumns,
      monthlyData: {}
    };

    this.chartData.set(chartData);
    this.parseCOData();
    this.prepareDataInfoItems();
  }

  private parseCOData() {
    const data = this.chartData();
    if (!data) return;

    // Initialize monthly data structure
    const monthlyData: { [month: number]: MonthlyData } = {};
    for (let i = 1; i <= 12; i++) {
      monthlyData[i] = {};
    }

    // Process the latest upload (since data gets overwritten monthly)
    const latestUpload = data.uploads[data.uploads.length - 1];
    if (!latestUpload) return;

    latestUpload.files.forEach(file => {
      if (file.values && Array.isArray(file.values)) {
        file.values.forEach((row) => {
          // Parse the row structure for CO data
          // Use Standort if available, otherwise fall back to Haus
          const standort = (row['Standort'] as string) || (row['Haus'] as string);
          const typ = row['Typ'] as string;
          const zeitraum = row['Zeitraum'] as string;

          const station = row['Station'] as string;
          
          if (standort && typ && zeitraum) {
            // Map months (1-12) to their values
            const months = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 
                           'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
            
            months.forEach((monthName, index) => {
              const monthNum = index + 1;
              const value = Number(row[monthName]);
              
              if (!isNaN(value) && value !== null && value !== undefined) {
                // Initialize structure if needed
                if (!monthlyData[monthNum][standort]) {
                  monthlyData[monthNum][standort] = {};
                }
                const stationKey = station || 'UNKNOWN';
                if (!monthlyData[monthNum][standort][stationKey]) {
                  monthlyData[monthNum][standort][stationKey] = {};
                }
                if (!monthlyData[monthNum][standort][stationKey][typ]) {
                  monthlyData[monthNum][standort][stationKey][typ] = {};
                }
                // Store values per station
                const existingValue = monthlyData[monthNum][standort][stationKey][typ][zeitraum] || 0;
                monthlyData[monthNum][standort][stationKey][typ][zeitraum] = existingValue + value;
              }
            });
          }
        });
      }
    });

    // Update the chart data
    data.monthlyData = monthlyData;
    this.chartData.set(data);
  }

  onStandortChange(standort: string) {
    this.chartLoading.set(true);
    this.selectedStandort.set(standort);
    // Reset station selection when standort changes
    this.selectedStation.set(null);
  }

  onStationChange(station: string | null) {
    this.chartLoading.set(true);
    this.selectedStation.set(station);
  }

  stationOptions = computed<string[]>(() => {
    const data = this.chartData();
    if (!data || !data.monthlyData) return [];
    
    const standort = this.selectedStandort();
    const dataStandort = this.getDataStandort(standort); // AIB -> BAB
    const stations = new Set<string>();
    
    for (let month = 1; month <= 12; month++) {
      const monthData = data.monthlyData[month]?.[dataStandort];
      if (monthData) {
        Object.keys(monthData).forEach(station => {
          if (station !== 'UNKNOWN') {
            stations.add(station);
          }
        });
      }
    }
    
    return Array.from(stations).sort();
  });

  toggleFlip(cardType: string) {
    const current = this.flippedCards();
    this.flippedCards.set({
      ...current,
      [cardType]: !current[cardType]
    });
  }

  onEntlassungenToggleChange(showPercentage: boolean) {
    this.showEntlassungenPercentage.set(showPercentage);
  }

  onAufnahmenToggleChange(showPercentage: boolean) {
    this.showAufnahmenPercentage.set(showPercentage);
  }

  entlassungenChartData = computed<ChartData<'bar'>>(() => {
    const data = this.chartData();
    if (!data || !data.monthlyData) {
      return { labels: [], datasets: [] };
    }

    const months = [...this.monthLabels];
    const selectedStandort = this.selectedStandort();
    const dataStandort = this.getDataStandort(selectedStandort); // AIB -> BAB
    const selectedStation = this.selectedStation();
    const showPercentage = this.showEntlassungenPercentage();
    const datasets: ChartData<'bar'>['datasets'] = [];
    
    const vor11: number[] = [];
    const nach11: number[] = [];

    for (let month = 1; month <= 12; month++) {
      const monthData = data.monthlyData[month]?.[dataStandort];
      let vor11Value = 0;
      let nach11Value = 0;
      
      if (selectedStation && monthData?.[selectedStation]) {
        // Filter by specific station
        const stationData = monthData[selectedStation]['Entlassungen'];
        vor11Value = stationData?.['vor 11 Uhr'] || 0;
        nach11Value = stationData?.['nach 11 Uhr'] || 0;
      } else {
        // Aggregate all stations for this standort
        Object.values(monthData || {}).forEach((stationData: any) => {
          const entlassungen = stationData['Entlassungen'];
          if (entlassungen) {
            vor11Value += entlassungen['vor 11 Uhr'] || 0;
            nach11Value += entlassungen['nach 11 Uhr'] || 0;
          }
        });
      }
      
      if (showPercentage) {
        const total = vor11Value + nach11Value;
        vor11.push(total > 0 ? (vor11Value / total) * 100 : 0);
        nach11.push(total > 0 ? (nach11Value / total) * 100 : 0);
      } else {
        vor11.push(vor11Value);
        nach11.push(nach11Value);
      }
    }

    const stationLabel = selectedStation ? ` - ${selectedStation}` : '';
    const unitLabel = showPercentage ? ' (%)' : '';
    datasets.push({
      label: `${this.standortNames[selectedStandort] || selectedStandort}${stationLabel} - vor 11 Uhr${unitLabel}`,
      data: vor11,
      backgroundColor: '#FF6B6B',
      borderColor: '#FF6B6B',
      borderWidth: 1
    });

    datasets.push({
      label: `${this.standortNames[selectedStandort] || selectedStandort}${stationLabel} - nach 11 Uhr${unitLabel}`,
      data: nach11,
      backgroundColor: '#FF8E8E',
      borderColor: '#FF8E8E',
      borderWidth: 1
    });

    return { labels: months, datasets };
  });

  aufnahmenChartData = computed<ChartData<'bar'>>(() => {
    const data = this.chartData();
    if (!data || !data.monthlyData) {
      return { labels: [], datasets: [] };
    }

    const months = [...this.monthLabels];
    const selectedStandort = this.selectedStandort();
    const dataStandort = this.getDataStandort(selectedStandort); // AIB -> BAB
    const selectedStation = this.selectedStation();
    const showPercentage = this.showAufnahmenPercentage();
    const datasets: ChartData<'bar'>['datasets'] = [];
    const vor11: number[] = [];
    const nach11: number[] = [];

    for (let month = 1; month <= 12; month++) {
      const monthData = data.monthlyData[month]?.[dataStandort];
      let vor11Value = 0;
      let nach11Value = 0;
      
      if (selectedStation && monthData?.[selectedStation]) {
        // Filter by specific station
        const stationData = monthData[selectedStation]['Aufnahmen'];
        vor11Value = stationData?.['vor 11 Uhr'] || 0;
        nach11Value = stationData?.['nach 11 Uhr'] || 0;
      } else {
        // Aggregate all stations for this standort
        Object.values(monthData || {}).forEach((stationData: any) => {
          const aufnahmen = stationData['Aufnahmen'];
          if (aufnahmen) {
            vor11Value += aufnahmen['vor 11 Uhr'] || 0;
            nach11Value += aufnahmen['nach 11 Uhr'] || 0;
          }
        });
      }
      
      if (showPercentage) {
        const total = vor11Value + nach11Value;
        vor11.push(total > 0 ? (vor11Value / total) * 100 : 0);
        nach11.push(total > 0 ? (nach11Value / total) * 100 : 0);
      } else {
        vor11.push(vor11Value);
        nach11.push(nach11Value);
      }
    }

    const stationLabel = selectedStation ? ` - ${selectedStation}` : '';
    const unitLabel = showPercentage ? ' (%)' : '';
    datasets.push({
      label: `${this.standortNames[selectedStandort] || selectedStandort}${stationLabel} - vor 11 Uhr${unitLabel}`,
      data: vor11,
      backgroundColor: '#4ECDC4',
      borderColor: '#4ECDC4',
      borderWidth: 1
    });

    datasets.push({
      label: `${this.standortNames[selectedStandort] || selectedStandort}${stationLabel} - nach 11 Uhr${unitLabel}`,
      data: nach11,
      backgroundColor: '#7EDDD8',
      borderColor: '#7EDDD8',
      borderWidth: 1
    });

    return { labels: months, datasets };
  });

  entlassungenChartOptions = computed<ChartConfiguration['options']>(() => {
    const showPercentage = this.showEntlassungenPercentage();
    return this.buildChartOptions('Entlassungen', showPercentage ? 'Prozent (%)' : 'Anzahl Entlassungen', showPercentage);
  });

  aufnahmenChartOptions = computed<ChartConfiguration['options']>(() => {
    const showPercentage = this.showAufnahmenPercentage();
    return this.buildChartOptions('Aufnahmen', showPercentage ? 'Prozent (%)' : 'Anzahl Aufnahmen', showPercentage);
  });
  private readonly chartReadyEffect = effect(() => {
    this.entlassungenChartData();
    this.aufnahmenChartData();
    queueMicrotask(() => this.chartLoading.set(false));
  }, { allowSignalWrites: true });

  comparisonSeries = computed<ComparisonSeries[]>(() => {
    const data = this.chartData();
    if (!data || !data.monthlyData) {
      return [];
    }

    const standorteSet = new Set<string>();
    for (let month = 1; month <= 12; month++) {
      const monthData = data.monthlyData[month];
      if (!monthData) continue;
      Object.keys(monthData).forEach(standort => {
        // Convert BAB to AIB for display (they are the same)
        const displayStandort = standort === 'BAB' ? 'AIB' : standort;
        standorteSet.add(displayStandort);
      });
    }

    return Array.from(standorteSet).sort().map(displayStandort => {
      // Convert AIB back to BAB for data lookup
      const dataStandort = displayStandort === 'AIB' ? 'BAB' : displayStandort;
      
      // Aggregate all stations for comparison
      return {
        id: displayStandort,
        label: this.standortNames[displayStandort] || displayStandort,
        monthlyData: Array.from({ length: 12 }, (_, index) => {
          const month = index + 1;
          const monthData = data.monthlyData[month]?.[dataStandort] || {};
          
          let entlassungenVor11 = 0;
          let entlassungenNach11 = 0;
          let aufnahmenVor11 = 0;
          let aufnahmenNach11 = 0;
          
          Object.values(monthData).forEach((stationData: any) => {
            const entlassungen = stationData['Entlassungen'] || {};
            const aufnahmen = stationData['Aufnahmen'] || {};
            entlassungenVor11 += entlassungen['vor 11 Uhr'] || 0;
            entlassungenNach11 += entlassungen['nach 11 Uhr'] || 0;
            aufnahmenVor11 += aufnahmen['vor 11 Uhr'] || 0;
            aufnahmenNach11 += aufnahmen['nach 11 Uhr'] || 0;
          });
          
          return {
            month,
            metrics: {
              entlassungenVor11: this.toNumberOrNull(entlassungenVor11),
              entlassungenNach11: this.toNumberOrNull(entlassungenNach11),
              aufnahmenVor11: this.toNumberOrNull(aufnahmenVor11),
              aufnahmenNach11: this.toNumberOrNull(aufnahmenNach11)
            }
          };
        })
      };
    });
  });

  private readonly comparisonMetrics: ComparisonMetricConfig[] = [
    {
      key: 'entlassungenVor11',
      label: 'Entlassungen vor 11 Uhr',
      chartTitle: 'Entlassungen vor 11 Uhr',
      decimals: 0,
      valueFormatter: value => value === null ? '–' : value.toLocaleString('de-DE')
    },
    {
      key: 'entlassungenNach11',
      label: 'Entlassungen nach 11 Uhr',
      chartTitle: 'Entlassungen nach 11 Uhr',
      decimals: 0,
      valueFormatter: value => value === null ? '–' : value.toLocaleString('de-DE')
    },
    {
      key: 'aufnahmenVor11',
      label: 'Aufnahmen vor 11 Uhr',
      chartTitle: 'Aufnahmen vor 11 Uhr',
      decimals: 0,
      valueFormatter: value => value === null ? '–' : value.toLocaleString('de-DE')
    },
    {
      key: 'aufnahmenNach11',
      label: 'Aufnahmen nach 11 Uhr',
      chartTitle: 'Aufnahmen nach 11 Uhr',
      decimals: 0,
      valueFormatter: value => value === null ? '–' : value.toLocaleString('de-DE')
    }
  ];

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
        title: 'CO-Aufnahmen & Entlassungen – Vergleich',
        subtitle: `Jahr ${this.selectedYear}`,
        selectionLabel: 'Standorte',
        selectionLimit: 4,
        metrics: this.comparisonMetrics,
        series,
        monthLabels: ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']
      }
    });
  }

  private toNumberOrNull(value: unknown): number | null {
    const num = Number(value);
    return isNaN(num) ? null : num;
  }

  private buildChartOptions(title: string, yLabel: string, isPercentage: boolean = false): ChartConfiguration['options'] {
    const selectedStandort = this.selectedStandort();
    const standortText = ` - ${this.standortNames[selectedStandort] || selectedStandort}`;
    const year = this.selectedYearState();

    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: {
          display: true,
          text: `${title} ${year}${standortText}`
        },
        legend: {
          display: true
        },
        tooltip: {
          callbacks: {
            label: (context) => {
              if (isPercentage) {
                return `${context.dataset.label}: ${context.parsed.y.toFixed(2)}%`;
              } else {
                return `${context.dataset.label}: ${context.parsed.y.toFixed(0)}`;
              }
            }
          }
        }
      },
      scales: {
        x: {
          display: true,
          title: {
            display: true,
            text: 'Monat'
          }
        },
        y: {
          display: true,
          title: {
            display: true,
            text: yLabel
          },
          beginAtZero: true,
          max: isPercentage ? 100 : undefined
        }
      }
    };
  }

  calculateTotal(type: 'entlassungen' | 'aufnahmen', zeit: 'vor' | 'nach'): number {
    const data = this.chartData();
    if (!data || !data.monthlyData) return 0;

    const standort = this.selectedStandort();
    const dataStandort = this.getDataStandort(standort); // AIB -> BAB
    const selectedStation = this.selectedStation();
    let total = 0;

    for (let month = 1; month <= 12; month++) {
      const monthData = data.monthlyData[month]?.[dataStandort];
      const zeitKey = zeit === 'vor' ? 'vor 11 Uhr' : 'nach 11 Uhr';
      const typKey = type === 'entlassungen' ? 'Entlassungen' : 'Aufnahmen';
      
      if (selectedStation && monthData?.[selectedStation]) {
        // Filter by specific station
        const stationData = monthData[selectedStation][typKey];
        total += stationData?.[zeitKey] || 0;
      } else {
        // Aggregate all stations
        Object.values(monthData || {}).forEach((stationData: any) => {
          const typData = stationData[typKey];
          if (typData) {
            total += typData[zeitKey] || 0;
          }
        });
      }
    }

    return total;
  }

  calculatePercentage(type: 'entlassungen' | 'aufnahmen', zeit: 'vor' | 'nach'): number {
    const vorTotal = this.calculateTotal(type, 'vor');
    const nachTotal = this.calculateTotal(type, 'nach');
    const gesamt = vorTotal + nachTotal;
    
    if (gesamt === 0) return 0;
    
    const zeitTotal = zeit === 'vor' ? vorTotal : nachTotal;
    return (zeitTotal / gesamt) * 100;
  }

  getAvailableStandorte(): string[] {
    const data = this.chartData();
    if (!data || !data.monthlyData) return [];
    
    const standorte = new Set<string>();
    for (let month = 1; month <= 12; month++) {
      Object.keys(data.monthlyData[month] || {}).forEach(standort => {
        // Convert BAB to AIB for display (they are the same)
        const displayStandort = standort === 'BAB' ? 'AIB' : standort;
        standorte.add(displayStandort);
      });
    }
    
    return Array.from(standorte).sort();
  }

  getStandortTotal(standort: string, type: 'entlassungen' | 'aufnahmen', zeit: 'vor' | 'nach'): number {
    const data = this.chartData();
    if (!data || !data.monthlyData) return 0;

    let total = 0;
    const dataStandort = this.getDataStandort(standort); // AIB -> BAB
    const typKey = type === 'entlassungen' ? 'Entlassungen' : 'Aufnahmen';
    const zeitKey = zeit === 'vor' ? 'vor 11 Uhr' : 'nach 11 Uhr';
    
    for (let month = 1; month <= 12; month++) {
      const monthData = data.monthlyData[month]?.[dataStandort];
      if (monthData) {
        // Aggregate all stations for this standort
        Object.values(monthData).forEach((stationData: any) => {
          const typData = stationData[typKey];
          if (typData) {
            total += typData[zeitKey] || 0;
          }
        });
      }
    }

    return total;
  }

  getStandortPercentage(standort: string, type: 'entlassungen' | 'aufnahmen', zeit: 'vor' | 'nach'): number {
    const vorTotal = this.getStandortTotal(standort, type, 'vor');
    const nachTotal = this.getStandortTotal(standort, type, 'nach');
    const gesamt = vorTotal + nachTotal;
    
    if (gesamt === 0) return 0;
    
    const zeitTotal = zeit === 'vor' ? vorTotal : nachTotal;
    return (zeitTotal / gesamt) * 100;
  }

  private prepareDataInfoItems() {
    const data = this.chartData();
    if (!data || !data.uploads) {
      this.dataInfoItems.set([]);
      return;
    }

    const items: DataInfoItem[] = data.uploads.map(upload => {
      let totalRecords = 0;
      
      // Count total records across all files
      upload.files.forEach(file => {
        if (file.values) {
          totalRecords += file.values.length;
        }
      });

      // Extract month from upload (if available)
      let dataMonth = '';
      if (upload.month) {
        const monthNames = ['', 'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 
                           'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
        const monthNum = parseInt(upload.month);
        dataMonth = monthNames[monthNum] || upload.month;
      }

      // Collect all raw data
      const allRawData: any[] = [];
      upload.files.forEach(file => {
        if (file.values) {
          allRawData.push(...file.values);
        }
      });

      // Build fileName from all files - show actual filenames, not schema name
      const fileNames = upload.files
        .map(f => f.originalName || f.storedName || 'Unbekannte Datei')
        .filter(name => name && name !== 'Unbekannte Datei');
      
      const fileName = fileNames.length > 0 
        ? (fileNames.length === 1 ? fileNames[0] : fileNames.join(', '))
        : `Upload ${upload.uploadId.substring(0, 8)}`;

      return {
        fileName: fileName,
        uploadDate: upload.createdAt,
        dataMonth,
        dataYear: this.selectedYear,
        recordCount: totalRecords,
        status: 'success' as const,
        rawData: allRawData,
        fileCount: upload.files.length
      };
    });

    this.dataInfoItems.set(items);
  }
}
