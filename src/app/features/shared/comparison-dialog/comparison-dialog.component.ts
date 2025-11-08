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

export interface ComparisonMetricConfig {
  key: string;
  label: string;
  unit?: string;
  chartTitle?: string;
  decimals?: number;
  valueFormatter?: (value: number | null) => string;
}

export interface ComparisonMonthlyData {
  month: number;
  metrics: Record<string, number | null>;
}

export interface ComparisonSeries {
  id: string;
  label: string;
  monthlyData: ComparisonMonthlyData[];
}

export interface ComparisonDialogData {
  title: string;
  subtitle?: string;
  selectionLabel?: string;
  selectionLimit?: number;
  metrics: ComparisonMetricConfig[];
  series: ComparisonSeries[];
  monthLabels?: string[];
}

interface TableRow {
  month: number;
  label: string;
  values: Record<string, number | null>;
}

type MetricKey = string;

@Component({
  selector: 'app-comparison-dialog',
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
      {{ data.title }}
    </h2>

    <mat-dialog-content>
      <p class="dialog-subtitle" *ngIf="data.subtitle">{{ data.subtitle }}</p>
      <p class="dialog-description">
        Wählen Sie bis zu {{ selectionLimit }} {{ data.selectionLabel || 'Einheiten' }}, um ihre Kennzahlen über die Monate zu vergleichen.
      </p>

      <div class="selection-card">
        <div class="selection-header">
          <mat-icon>layers</mat-icon>
          <span>{{ data.selectionLabel || 'Einheiten' }}</span>
          <span class="selection-count">{{ selectedIds().length }} / {{ selectionLimit }}</span>
        </div>
        <mat-divider></mat-divider>

        <div class="selection-grid">
          <mat-checkbox
            class="selection-option"
            *ngFor="let series of availableSeries()"
            [checked]="isSelected(series.id)"
            (change)="toggleSelection(series.id, $event)"
            [disabled]="isLimitReached() && !isSelected(series.id)">
            {{ series.label }}
          </mat-checkbox>
        </div>

        <div class="selection-hint" *ngIf="isLimitReached()">
          <mat-icon>info</mat-icon>
          Maximale Anzahl erreicht. Entfernen Sie eine Auswahl, um eine andere hinzuzufügen.
        </div>
      </div>

      <div *ngIf="chartReady(); else emptyState" class="comparison-content">
        <mat-tab-group>
          <mat-tab *ngFor="let metric of data.metrics" [label]="metric.label">
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
                        <th *ngFor="let series of selectedIds()">{{ getLabel(series) }}</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr *ngFor="let row of tableRows()[metric.key]">
                        <td>{{ row.label }}</td>
                        <td *ngFor="let series of selectedIds()">
                          {{ formatMetricValue(metric, row.values[series]) }}
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
          <p>Bitte wählen Sie mindestens eine Einheit aus, um den Vergleich zu starten.</p>
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

    .dialog-subtitle {
      margin: 0 0 4px 0;
      font-weight: 600;
      color: rgba(0, 0, 0, 0.7);
    }

    .dialog-description {
      margin-bottom: 16px;
      color: rgba(0, 0, 0, 0.7);
    }

    .selection-card {
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
      grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
      gap: 8px 12px;
      margin-top: 12px;
    }

    .selection-option {
      padding: 4px 8px;
      border-radius: 4px;
    }

    .selection-option.mat-mdc-checkbox-checked {
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
        grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
      }
    }
  `]
})
export class ComparisonDialogComponent implements OnInit {
  readonly selectionLimit: number;

  availableSeries = signal<ComparisonSeries[]>([]);
  selectedIds = signal<string[]>([]);
  chartData = signal<Record<MetricKey, ChartData<'line'>>>({});
  tableRows = signal<Record<MetricKey, TableRow[]>>({});

  readonly chartOptions: Record<MetricKey, ChartConfiguration['options']> = {};

  private readonly defaultMonthLabels: string[];
  private readonly colorPalette = ['#1976d2', '#ef6c00', '#7b1fa2', '#00897b', '#c2185b', '#6d4c41', '#0097a7', '#3949ab', '#43a047', '#f4511e'];
  private readonly seriesMap = new Map<string, ComparisonSeries>();
  private monthOrder: number[] = [];

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: ComparisonDialogData
  ) {
    Chart.register(...registerables);
    this.selectionLimit = (this.data.selectionLimit && this.data.selectionLimit > 0) ? this.data.selectionLimit : 4;
    this.defaultMonthLabels = this.data.monthLabels ?? ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
  }

  ngOnInit(): void {
    this.availableSeries.set(this.data.series);
    this.data.series.forEach(series => this.seriesMap.set(series.id, series));
    this.buildMonthOrder();
    this.initializeSelection();
    this.initializeChartOptions();
    this.updateOutputs();
  }

  isSelected(id: string): boolean {
    return this.selectedIds().includes(id);
  }

  toggleSelection(id: string, event: MatCheckboxChange) {
    const checked = event.checked;
    const current = new Set(this.selectedIds());

    if (checked) {
      if (current.size >= this.selectionLimit) {
        event.source.checked = false;
        return;
      }
      current.add(id);
    } else {
      current.delete(id);
    }

    const ordered = this.availableSeries().map(series => series.id).filter(seriesId => current.has(seriesId));
    this.selectedIds.set(ordered);
    this.updateOutputs();
  }

  isLimitReached(): boolean {
    return this.selectedIds().length >= this.selectionLimit;
  }

  chartReady(): boolean {
    return this.selectedIds().length > 0 && this.monthOrder.length > 0;
  }

  getLabel(id: string): string {
    return this.seriesMap.get(id)?.label ?? id;
  }

  formatMetricValue(config: ComparisonMetricConfig, value: number | null): string {
    if (config.valueFormatter) {
      return config.valueFormatter(value);
    }
    if (value === null || value === undefined) {
      return '–';
    }

    const decimals = config.decimals ?? (config.unit === '%' ? 1 : config.unit === 'Tage' ? 2 : 0);
    const formatted = value.toLocaleString('de-DE', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    return config.unit ? `${formatted}${config.unit === '%' ? ' %' : ` ${config.unit}`}` : formatted;
  }

  private initializeSelection() {
    const defaultSelection = this.availableSeries()
      .slice(0, Math.min(this.selectionLimit, Math.max(1, this.availableSeries().length >= 2 ? 2 : 1)))
      .map(series => series.id);
    this.selectedIds.set(defaultSelection);
  }

  private initializeChartOptions() {
    this.data.metrics.forEach(metric => {
      this.chartOptions[metric.key] = this.buildChartOptions(metric);
    });
  }

  private updateOutputs() {
    const charts: Record<MetricKey, ChartData<'line'>> = {};
    const tables: Record<MetricKey, TableRow[]> = {};

    this.data.metrics.forEach(metric => {
      charts[metric.key] = this.buildChartData(metric.key);
      tables[metric.key] = this.buildTableRows(metric.key);
    });

    this.chartData.set(charts);
    this.tableRows.set(tables);
  }

  private buildMonthOrder() {
    const months = new Set<number>();

    this.data.series.forEach(series => {
      series.monthlyData.forEach(entry => {
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

  private buildChartData(metricKey: MetricKey): ChartData<'line'> {
    const labels = this.monthOrder.map(month => this.defaultMonthLabels[Math.max(0, month - 1)]);

    const datasets = this.selectedIds().map((seriesId, index) => {
      const series = this.seriesMap.get(seriesId);
      const data = this.monthOrder.map(month => {
        const entry = series?.monthlyData.find(item => item.month === month);
        const value = entry?.metrics?.[metricKey];
        if (value === undefined || value === null) {
          return null;
        }
        const config = this.data.metrics.find(metric => metric.key === metricKey);
        const decimals = config?.decimals ?? (config?.unit === '%' ? 1 : config?.unit === 'Tage' ? 2 : 2);
        return Number(Number(value).toFixed(decimals));
      });

      return {
        label: series?.label ?? seriesId,
        data,
        borderColor: this.colorPalette[index % this.colorPalette.length],
        backgroundColor: this.toRgba(this.colorPalette[index % this.colorPalette.length], 0.2),
        fill: false,
        tension: 0.3,
        pointRadius: 4,
        pointHoverRadius: 6
      };
    });

    return { labels, datasets };
  }

  private buildTableRows(metricKey: MetricKey): TableRow[] {
    return this.monthOrder.map(month => {
      const label = this.defaultMonthLabels[Math.max(0, month - 1)];
      const values: Record<string, number | null> = {};

      this.selectedIds().forEach(seriesId => {
        const series = this.seriesMap.get(seriesId);
        const entry = series?.monthlyData.find(item => item.month === month);
        const value = entry?.metrics?.[metricKey];
        values[seriesId] = (value === undefined ? null : value);
      });

      return { month, label, values };
    });
  }

  private buildChartOptions(metric: ComparisonMetricConfig): ChartConfiguration['options'] {
    const decimals = metric.decimals ?? (metric.unit === '%' ? 1 : metric.unit === 'Tage' ? 2 : 0);

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
              const formatted = value.toLocaleString('de-DE', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
              if (metric.unit === '%') {
                return `${label}: ${formatted} %`;
              }
              if (metric.unit) {
                return `${label}: ${formatted} ${metric.unit}`;
              }
              return `${label}: ${formatted}`;
            }
          }
        },
        title: {
          display: !!metric.chartTitle,
          text: metric.chartTitle ?? ''
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
          beginAtZero: true,
          title: {
            display: !!metric.unit,
            text: metric.unit ?? metric.label
          }
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


