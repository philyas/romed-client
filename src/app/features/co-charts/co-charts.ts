import { Component, Input, OnInit, OnChanges, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartData, ChartType, registerables } from 'chart.js';
import { UploadRecord, SchemaStatistics } from '../../core/api';
import { DataInfoPanel, DataInfoItem } from '../data-info-panel/data-info-panel';
import { ComparisonDialogComponent, ComparisonMetricConfig, ComparisonSeries } from '../shared/comparison-dialog/comparison-dialog.component';

// Register Chart.js components
import Chart from 'chart.js/auto';

interface MonthlyData {
  [standort: string]: {
    [typ: string]: {
      [zeitraum: string]: number;
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
    MatSelectModule,
    MatFormFieldModule,
    MatTooltipModule,
    BaseChartDirective,
    DataInfoPanel
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
            <mat-form-field appearance="outline" class="location-selector">
              <mat-label>
                <mat-icon>location_on</mat-icon>
                Standort
              </mat-label>
              <mat-select 
                [value]="selectedStandort()" 
                (selectionChange)="onStandortChange($event.value)">
                <mat-option value="AIB">BAB</mat-option>
                <mat-option value="PRI">PRI</mat-option>
                <mat-option value="ROS">ROS</mat-option>
                <mat-option value="WAS">WAS</mat-option>
              </mat-select>
            </mat-form-field>

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
                    <div class="chart-container">
                      <canvas baseChart
                        [data]="getEntlassungenChartData()"
                        [options]="getChartOptions('Entlassungen', 'Anzahl Entlassungen', 'entlassungen')"
                        [type]="'bar'">
                      </canvas>
                    </div>
                    <div class="chart-info">
                      <mat-chip-set>
                        <mat-chip class="entlassungen-chip-vor">
                          Vor 11h: {{ calculateTotal('entlassungen', 'vor') | number:'1.0-0' }}
                        </mat-chip>
                        <mat-chip class="entlassungen-chip-nach">
                          Nach 11h: {{ calculateTotal('entlassungen', 'nach') | number:'1.0-0' }}
                        </mat-chip>
                      </mat-chip-set>
                      <div class="total-badge entlassungen-total">
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
                            <span class="stat-value">{{ getStandortTotal(standort, 'entlassungen', 'vor') }}</span>
                          </div>
                          <div class="standort-stats">
                            <span class="stat-label">Nach 11h:</span>
                            <span class="stat-value">{{ getStandortTotal(standort, 'entlassungen', 'nach') }}</span>
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
                    <div class="chart-container">
                      <canvas baseChart
                        [data]="getAufnahmenChartData()"
                        [options]="getChartOptions('Aufnahmen', 'Anzahl Aufnahmen', 'aufnahmen')"
                        [type]="'bar'">
                      </canvas>
                    </div>
                    <div class="chart-info">
                      <mat-chip-set>
                        <mat-chip class="aufnahmen-chip-vor">
                          Vor 11h: {{ calculateTotal('aufnahmen', 'vor') | number:'1.0-0' }}
                        </mat-chip>
                        <mat-chip class="aufnahmen-chip-nach">
                          Nach 11h: {{ calculateTotal('aufnahmen', 'nach') | number:'1.0-0' }}
                        </mat-chip>
                      </mat-chip-set>
                      <div class="total-badge aufnahmen-total">
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
                            <span class="stat-value">{{ getStandortTotal(standort, 'aufnahmen', 'vor') }}</span>
                          </div>
                          <div class="standort-stats">
                            <span class="stat-label">Nach 11h:</span>
                            <span class="stat-value">{{ getStandortTotal(standort, 'aufnahmen', 'nach') }}</span>
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
  flippedCards = signal<{ [key: string]: boolean }>({});
  dataInfoItems = signal<DataInfoItem[]>([]);
  private dialog = inject(MatDialog);

  // Standort-Mapping: AIB = BAB
  standortNames: { [key: string]: string } = {
    'AIB': 'BAB',
    'PRI': 'PRI',
    'ROS': 'ROS',
    'WAS': 'WAS'
  };

  ngOnInit() {
    Chart.register(...registerables);
    this.processChartData();
  }

  ngOnChanges() {
    this.processChartData();
  }

  private processChartData() {
    if (!this.schemaId || this.uploads.length === 0) return;

    // Find schema statistics
    const schemaStat = this.statistics.find(s => s.schemaId === this.schemaId);
    if (!schemaStat) return;

    // Get uploads for this schema
    const schemaUploads = this.uploads.filter(upload => upload.schemaId === this.schemaId);
    if (schemaUploads.length === 0) return;

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
          const haus = row['Haus'] as string;
          const typ = row['Typ'] as string;
          const zeitraum = row['Zeitraum'] as string;

          if (haus && typ && zeitraum) {
            // Map months (1-12) to their values
            const months = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 
                           'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
            
            months.forEach((monthName, index) => {
              const monthNum = index + 1;
              const value = Number(row[monthName]);
              
              if (!isNaN(value) && value !== null && value !== undefined) {
                // Initialize structure if needed
                if (!monthlyData[monthNum][haus]) {
                  monthlyData[monthNum][haus] = {};
                }
                if (!monthlyData[monthNum][haus][typ]) {
                  monthlyData[monthNum][haus][typ] = {};
                }
                monthlyData[monthNum][haus][typ][zeitraum] = value;
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
    this.selectedStandort.set(standort);
  }

  toggleFlip(cardType: string) {
    const current = this.flippedCards();
    this.flippedCards.set({
      ...current,
      [cardType]: !current[cardType]
    });
  }

  getEntlassungenChartData(): ChartData<'bar'> {
    const data = this.chartData();
    if (!data || !data.monthlyData) {
      return { labels: [], datasets: [] };
    }

    const months = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
    const standorte = [this.selectedStandort()];
    
    const datasets: any[] = [];
    standorte.forEach(standort => {
      const vor11: number[] = [];
      const nach11: number[] = [];

      for (let month = 1; month <= 12; month++) {
        const monthData = data.monthlyData[month]?.[standort]?.['Entlassungen'];
        vor11.push(monthData?.['vor 11 Uhr'] || 0);
        nach11.push(monthData?.['nach 11 Uhr'] || 0);
      }

      datasets.push({
        label: `${this.standortNames[standort] || standort} - vor 11 Uhr`,
        data: vor11,
        backgroundColor: '#FF6B6B',
        borderColor: '#FF6B6B',
        borderWidth: 1
      });

      datasets.push({
        label: `${this.standortNames[standort] || standort} - nach 11 Uhr`,
        data: nach11,
        backgroundColor: '#FF8E8E',
        borderColor: '#FF8E8E',
        borderWidth: 1
      });
    });

    return { labels: months, datasets };
  }

  getAufnahmenChartData(): ChartData<'bar'> {
    const data = this.chartData();
    if (!data || !data.monthlyData) {
      return { labels: [], datasets: [] };
    }

    const months = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
    const standorte = [this.selectedStandort()];
    
    const datasets: any[] = [];
    standorte.forEach(standort => {
      const vor11: number[] = [];
      const nach11: number[] = [];

      for (let month = 1; month <= 12; month++) {
        const monthData = data.monthlyData[month]?.[standort]?.['Aufnahmen'];
        vor11.push(monthData?.['vor 11 Uhr'] || 0);
        nach11.push(monthData?.['nach 11 Uhr'] || 0);
      }

      datasets.push({
        label: `${this.standortNames[standort] || standort} - vor 11 Uhr`,
        data: vor11,
        backgroundColor: '#4ECDC4',
        borderColor: '#4ECDC4',
        borderWidth: 1
      });

      datasets.push({
        label: `${this.standortNames[standort] || standort} - nach 11 Uhr`,
        data: nach11,
        backgroundColor: '#7EDDD8',
        borderColor: '#7EDDD8',
        borderWidth: 1
      });
    });

    return { labels: months, datasets };
  }

  comparisonSeries = computed<ComparisonSeries[]>(() => {
    const data = this.chartData();
    if (!data || !data.monthlyData) {
      return [];
    }

    const standorteSet = new Set<string>();
    for (let month = 1; month <= 12; month++) {
      const monthData = data.monthlyData[month];
      if (!monthData) continue;
      Object.keys(monthData).forEach(standort => standorteSet.add(standort));
    }

    return Array.from(standorteSet).sort().map(standort => ({
      id: standort,
      label: this.standortNames[standort] || standort,
      monthlyData: Array.from({ length: 12 }, (_, index) => {
        const month = index + 1;
        const entlassungen = data.monthlyData[month]?.[standort]?.['Entlassungen'] || {};
        const aufnahmen = data.monthlyData[month]?.[standort]?.['Aufnahmen'] || {};
        return {
          month,
          metrics: {
            entlassungenVor11: this.toNumberOrNull(entlassungen['vor 11 Uhr']),
            entlassungenNach11: this.toNumberOrNull(entlassungen['nach 11 Uhr']),
            aufnahmenVor11: this.toNumberOrNull(aufnahmen['vor 11 Uhr']),
            aufnahmenNach11: this.toNumberOrNull(aufnahmen['nach 11 Uhr'])
          }
        };
      })
    }));
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

  getChartOptions(title: string, yLabel: string, type: string): ChartConfiguration['options'] {
    const selectedStandort = this.selectedStandort();
    const standortText = ` - ${this.standortNames[selectedStandort] || selectedStandort}`;
    
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: {
          display: true,
          text: `${title} ${this.selectedYear}${standortText}`
        },
        legend: {
          display: true
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
          beginAtZero: true
        }
      }
    };
  }

  calculateTotal(type: 'entlassungen' | 'aufnahmen', zeit: 'vor' | 'nach'): number {
    const data = this.chartData();
    if (!data || !data.monthlyData) return 0;

    const standort = this.selectedStandort();
    let total = 0;

    for (let month = 1; month <= 12; month++) {
      const monthData = data.monthlyData[month]?.[standort]?.[type === 'entlassungen' ? 'Entlassungen' : 'Aufnahmen'];
      const zeitKey = zeit === 'vor' ? 'vor 11 Uhr' : 'nach 11 Uhr';
      total += monthData?.[zeitKey] || 0;
    }

    return total;
  }

  getAvailableStandorte(): string[] {
    const data = this.chartData();
    if (!data || !data.monthlyData) return [];
    
    const standorte = new Set<string>();
    for (let month = 1; month <= 12; month++) {
      Object.keys(data.monthlyData[month] || {}).forEach(standort => {
        standorte.add(standort);
      });
    }
    
    return Array.from(standorte).sort();
  }

  getStandortTotal(standort: string, type: 'entlassungen' | 'aufnahmen', zeit: 'vor' | 'nach'): number {
    const data = this.chartData();
    if (!data || !data.monthlyData) return 0;

    let total = 0;
    for (let month = 1; month <= 12; month++) {
      const monthData = data.monthlyData[month]?.[standort]?.[type === 'entlassungen' ? 'Entlassungen' : 'Aufnahmen'];
      const zeitKey = zeit === 'vor' ? 'vor 11 Uhr' : 'nach 11 Uhr';
      total += monthData?.[zeitKey] || 0;
    }

    return total;
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

      return {
        fileName: upload.files.map(f => f.originalName).join(', ') || `Upload ${upload.uploadId.substring(0, 8)}`,
        uploadDate: upload.createdAt,
        dataMonth,
        dataYear: this.selectedYear,
        recordCount: totalRecords,
        status: 'success' as const,
        rawData: allRawData
      };
    });

    this.dataInfoItems.set(items);
  }
}
