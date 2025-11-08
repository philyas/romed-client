import { CommonModule } from '@angular/common';
import { Component, Inject, OnInit, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxChange, MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialogModule, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { BaseChartDirective } from 'ng2-charts';
import { Chart, ChartConfiguration, ChartData, registerables } from 'chart.js';

interface MonthlyStationData {
  month: number;
  pflegetage: number;
  stationsauslastung: number;
  verweildauer: number;
  betten?: number;
}

interface StationComparisonData {
  stationName: string;
  monthlyData: MonthlyStationData[];
}

interface MitternachtsstatistikComparisonDialogData {
  location: string;
  locationName: string;
  stations: StationComparisonData[];
}

type MetricKey = 'pflegetage' | 'stationsauslastung' | 'verweildauer';

interface MetricConfig {
  key: MetricKey;
  label: string;
  unit?: string;
  tooltipLabel: string;
  valueFormatter: (value: number | null) => string;
}

interface TableRow {
  month: number;
  label: string;
  values: Record<string, number | null>;
}

@Component({
  selector: 'app-mitternachtsstatistik-comparison-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatCheckboxModule,
    MatDividerModule,
    MatTabsModule,
    BaseChartDirective
  ],
  template: `
    <h2 mat-dialog-title>
      <mat-icon>compare</mat-icon>
      Mitternachtsstatistik – Vergleich ({{ data.locationName }})
    </h2>

    <mat-dialog-content>
      <p class="dialog-description">
        Wählen Sie bis zu vier Stationen aus, um deren Mitternachtskennzahlen über die Monate zu vergleichen.
      </p>

      <div class="station-selection">
        <div class="selection-header">
          <mat-icon>meeting_room</mat-icon>
          <span>Stationen</span>
          <span class="selection-count">{{ selectedStations().length }} / 4</span>
        </div>
        <mat-divider></mat-divider>

        <div class="selection-grid">
          <mat-checkbox
            class="station-option"
            *ngFor="let station of availableStations()"
            [checked]="isStationSelected(station)"
            (change)="toggleStation(station, $event)"
            [disabled]="isSelectionLimitReached() && !isStationSelected(station)">
            {{ station }}
          </mat-checkbox>
        </div>

        <div class="selection-hint" *ngIf="isSelectionLimitReached()">
          <mat-icon>info</mat-icon>
          Maximale Anzahl erreicht. Entfernen Sie eine Station, um eine andere auszuwählen.
        </div>
      </div>

      <div class="comparison-content" *ngIf="chartReady(); else emptyState">
        <mat-tab-group>
          <mat-tab *ngFor="let metric of metrics" [label]="metric.label">
            <ng-template matTabContent>
              <div class="metric-content">
                <div class="chart-wrapper">
                  <canvas baseChart
                    [type]="'line'"
                    [data]="chartData()[metric.key]"
                    [options]="chartOptions[metric.key]">
                  </canvas>
                </div>

                <div class="table-wrapper" *ngIf="tableRows()[metric.key].length > 0">
                  <table class="comparison-table">
                    <thead>
                      <tr>
                        <th>Monat</th>
                        <th *ngFor="let station of selectedStations()">{{ station }}</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr *ngFor="let row of tableRows()[metric.key]">
                        <td>{{ row.label }}</td>
                        <td *ngFor="let station of selectedStations()">
                          {{ formatMetricValue(metric.key, row.values[station]) }}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </ng-template>
          </mat-tab>
        </mat-tab-group>
      </div>

      <ng-template #emptyState>
        <div class="empty-state">
          <mat-icon>playlist_add</mat-icon>
          <p>Bitte wählen Sie mindestens eine Station aus, um den Vergleich zu starten.</p>
        </div>
      </ng-template>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>
        <mat-icon>close</mat-icon>
        Schließen
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    :host {
      display: block;
      max-width: 1100px;
    }

    mat-dialog-content {
      max-height: 70vh;
      overflow: visible;
    }

    .dialog-description {
      margin-bottom: 16px;
      color: rgba(0, 0, 0, 0.7);
    }

    .station-selection {
      margin-bottom: 24px;
      border: 1px solid rgba(0, 0, 0, 0.08);
      border-radius: 8px;
      padding: 16px;
      background: #fafafa;
    }

    .selection-header {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 600;
      margin-bottom: 12px;
    }

    .selection-header mat-icon {
      color: #1976d2;
    }

    .selection-count {
      margin-left: auto;
      font-size: 13px;
      color: rgba(0, 0, 0, 0.6);
    }

    .selection-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
      gap: 8px 12px;
      margin-top: 12px;
    }

    .station-option {
      padding: 4px 8px;
      border-radius: 4px;
    }

    .station-option.mat-mdc-checkbox-checked {
      background: rgba(25, 118, 210, 0.06);
    }

    .selection-hint {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 12px;
      font-size: 13px;
      color: rgba(0, 0, 0, 0.6);
    }

    .selection-hint mat-icon {
      font-size: 18px;
      height: 18px;
      width: 18px;
      color: #ff9800;
    }

    .comparison-content {
      display: flex;
      flex-direction: column;
      gap: 24px;
    }

    .metric-content {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .chart-wrapper {
      min-height: 320px;
      border: 1px solid rgba(0, 0, 0, 0.08);
      border-radius: 8px;
      padding: 16px;
      background: white;
    }

    .table-wrapper {
      overflow-x: auto;
      border: 1px solid rgba(0, 0, 0, 0.08);
      border-radius: 8px;
      background: white;
    }

    .comparison-table {
      width: 100%;
      border-collapse: collapse;
    }

    .comparison-table th,
    .comparison-table td {
      padding: 12px 16px;
      text-align: left;
      border-bottom: 1px solid rgba(0, 0, 0, 0.06);
      white-space: nowrap;
    }

    .comparison-table th {
      background: #f5f5f5;
      font-weight: 600;
    }

    .comparison-table tbody tr:hover {
      background: rgba(25, 118, 210, 0.06);
      transition: background-color 0.2s ease;
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 12px;
      padding: 40px 16px;
      color: rgba(0, 0, 0, 0.6);
      text-align: center;
    }

    .empty-state mat-icon {
      font-size: 48px;
      height: 48px;
      width: 48px;
      color: #b0bec5;
    }

    @media (max-width: 768px) {
      :host {
        max-width: 100%;
      }

      .selection-grid {
        grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
      }
    }
  `]
})
export class MitternachtsstatistikComparisonDialogComponent implements OnInit {
  readonly metrics: MetricConfig[] = [
    {
      key: 'pflegetage',
      label: 'Pflegetage',
      tooltipLabel: 'Pflegetage',
      valueFormatter: (value) => value === null ? '–' : `${value.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
    },
    {
      key: 'stationsauslastung',
      label: 'Stationsauslastung (%)',
      tooltipLabel: 'Stationsauslastung',
      valueFormatter: (value) => value === null ? '–' : `${value.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`
    },
    {
      key: 'verweildauer',
      label: 'Verweildauer (VD.inkl.)',
      tooltipLabel: 'Verweildauer',
      valueFormatter: (value) => value === null ? '–' : `${value.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Tage`
    }
  ];

  availableStations = signal<string[]>([]);
  selectedStations = signal<string[]>([]);
  chartData = signal<Record<MetricKey, ChartData<'line'>>>({
    pflegetage: { labels: [], datasets: [] },
    stationsauslastung: { labels: [], datasets: [] },
    verweildauer: { labels: [], datasets: [] }
  });
  tableRows = signal<Record<MetricKey, TableRow[]>>({
    pflegetage: [],
    stationsauslastung: [],
    verweildauer: []
  });

  readonly chartOptions: Record<MetricKey, ChartConfiguration['options']> = {
    pflegetage: this.buildChartOptions('Pflegetage', ''),
    stationsauslastung: this.buildChartOptions('Stationsauslastung', '%'),
    verweildauer: this.buildChartOptions('Verweildauer (VD.inkl.)', 'Tage')
  };

  private readonly monthLabels = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
  private readonly colorPalette = ['#1976d2', '#ef6c00', '#7b1fa2', '#00897b', '#c2185b', '#6d4c41', '#0097a7'];
  private readonly stationMonthMap = new Map<string, Map<number, MonthlyStationData>>();
  private monthOrder: number[] = [];

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: MitternachtsstatistikComparisonDialogData
  ) {
    Chart.register(...registerables);
  }

  ngOnInit(): void {
    this.availableStations.set(this.data.stations.map(station => station.stationName));
    this.buildStationMonthLookup();
    this.buildMonthOrder();
    this.selectDefaultStations();
    this.updateOutputs();
  }

  isStationSelected(station: string): boolean {
    return this.selectedStations().includes(station);
  }

  toggleStation(station: string, event: MatCheckboxChange) {
    const checked = event.checked;
    const current = new Set(this.selectedStations());

    if (checked) {
      if (current.size >= 4) {
        event.source.checked = false;
        return;
      }
      current.add(station);
    } else {
      current.delete(station);
    }

    const ordered = this.availableStations().filter(name => current.has(name));
    this.selectedStations.set(ordered);
    this.updateOutputs();
  }

  isSelectionLimitReached(): boolean {
    return this.selectedStations().length >= 4;
  }

  chartReady(): boolean {
    return this.selectedStations().length > 0 && this.monthOrder.length > 0;
  }

  formatMetricValue(metric: MetricKey, value: number | null): string {
    const config = this.metrics.find(m => m.key === metric);
    return config ? config.valueFormatter(value) : value?.toString() ?? '–';
  }

  private selectDefaultStations() {
    const defaultSelection = this.availableStations().slice(0, Math.min(4, Math.max(1, this.availableStations().length >= 2 ? 2 : 1)));
    this.selectedStations.set(defaultSelection);
  }

  private updateOutputs() {
    const chartData: Record<MetricKey, ChartData<'line'>> = {
      pflegetage: this.buildChartData('pflegetage'),
      stationsauslastung: this.buildChartData('stationsauslastung'),
      verweildauer: this.buildChartData('verweildauer')
    };

    const tables: Record<MetricKey, TableRow[]> = {
      pflegetage: this.buildTableRows('pflegetage'),
      stationsauslastung: this.buildTableRows('stationsauslastung'),
      verweildauer: this.buildTableRows('verweildauer')
    };

    this.chartData.set(chartData);
    this.tableRows.set(tables);
  }

  private buildMonthOrder() {
    const months = new Set<number>();

    this.data.stations.forEach(station => {
      station.monthlyData.forEach(entry => {
        if (entry && entry.month >= 1 && entry.month <= 12) {
          months.add(entry.month);
        }
      });
    });

    if (months.size === 0) {
      this.monthOrder = Array.from({ length: 12 }, (_, i) => i + 1);
    } else {
      this.monthOrder = Array.from(months).sort((a, b) => a - b);
    }
  }

  private buildStationMonthLookup() {
    this.stationMonthMap.clear();

    this.data.stations.forEach(station => {
      const monthMap = new Map<number, MonthlyStationData>();
      station.monthlyData.forEach(entry => {
        if (entry && entry.month >= 1 && entry.month <= 12) {
          monthMap.set(entry.month, entry);
        }
      });
      this.stationMonthMap.set(station.stationName, monthMap);
    });
  }

  private buildChartData(metric: MetricKey): ChartData<'line'> {
    const selected = this.selectedStations();
    const labels = this.monthOrder.map(month => this.monthLabels[Math.max(0, month - 1)]);

    const datasets = selected.map((station, index) => {
      const monthMap = this.stationMonthMap.get(station) ?? new Map();
      return {
        label: station,
        data: this.monthOrder.map(month => {
          const entry = monthMap.get(month);
          if (!entry) {
            return null;
          }
          const value = entry[metric];
          if (value === undefined || value === null) {
            return null;
          }
          if (metric === 'stationsauslastung') {
            return Number(value.toFixed(1));
          }
          if (metric === 'verweildauer') {
            return Number(value.toFixed(2));
          }
          return Number(value.toFixed(0));
        }),
        borderColor: this.colorPalette[index % this.colorPalette.length],
        backgroundColor: this.toRgba(this.colorPalette[index % this.colorPalette.length], 0.25),
        fill: false,
        tension: 0.3,
        pointRadius: 4,
        pointHoverRadius: 6
      };
    });

    return { labels, datasets };
  }

  private buildTableRows(metric: MetricKey): TableRow[] {
    const selected = this.selectedStations();

    return this.monthOrder.map(month => {
      const label = this.monthLabels[Math.max(0, month - 1)];
      const values: Record<string, number | null> = {};

      selected.forEach(station => {
        const monthMap = this.stationMonthMap.get(station);
        if (!monthMap) {
          values[station] = null;
          return;
        }
        const entry = monthMap.get(month);
        values[station] = entry ? entry[metric] ?? null : null;
      });

      return { month, label, values };
    });
  }

  private buildChartOptions(title: string, unit: string): ChartConfiguration['options'] {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
          labels: {
            usePointStyle: true,
            padding: 12
          }
        },
        tooltip: {
          mode: 'index',
          intersect: false,
          callbacks: {
            label: (context) => {
              const label = context.dataset.label ?? '';
              const value = context.parsed.y;
              if (value === null || value === undefined) {
                return `${label}: –`;
              }
              if (unit === '%') {
                return `${label}: ${value.toFixed(1)} %`;
              }
              if (unit === 'Tage') {
                return `${label}: ${value.toFixed(2)} Tage`;
              }
              return `${label}: ${value.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
            }
          }
        },
        title: {
          display: true,
          text: title
        }
      },
      interaction: {
        mode: 'nearest',
        axis: 'x',
        intersect: false
      },
      scales: {
        x: {
          title: {
            display: true,
            text: 'Monat'
          }
        },
        y: {
          title: {
            display: true,
            text: unit ? unit : title
          },
          beginAtZero: true
        }
      }
    };
  }

  private toRgba(hex: string, alpha: number): string {
    const sanitized = hex.replace('#', '');
    const bigint = parseInt(sanitized, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
}


