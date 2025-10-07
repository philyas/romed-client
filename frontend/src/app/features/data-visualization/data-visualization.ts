import { Component, Input, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatExpansionModule } from '@angular/material/expansion';
import { BaseChartDirective } from 'ng2-charts';
import {
  ChartConfiguration,
  ChartData,
  ChartType,
  CategoryScale,
  LinearScale,
  BarController,
  LineController,
  PieController,
  DoughnutController,
  BarElement,
  LineElement,
  PointElement,
  ArcElement
} from 'chart.js';
import { Chart } from 'chart.js';

// Register Chart.js components
Chart.register(
  CategoryScale,
  LinearScale,
  BarController,
  BarElement,
  LineController,
  LineElement,
  PointElement,
  PieController,
  ArcElement,
  DoughnutController
);

export interface SchemaData {
  schemaId: string;
  schemaName: string;
  description: string;
  columns: string[];
  data: Record<string, unknown>[];
}

@Component({
  selector: 'app-data-visualization',
  imports: [
    CommonModule,
    MatCardModule,
    MatTabsModule,
    MatTableModule,
    MatChipsModule,
    MatIconModule,
    MatButtonModule,
    MatExpansionModule,
    BaseChartDirective
  ],
  template: `
    <mat-card class="visualization-card" *ngIf="schemaData">
      <mat-card-header class="card-header">
        <div class="header-content">
        <mat-card-title>{{ schemaData.schemaName }}</mat-card-title>
        <mat-card-subtitle>{{ schemaData.description }}</mat-card-subtitle>
        </div>
        <mat-chip-set class="header-chips">
          <mat-chip>{{ schemaData.data.length || 0 }} Zeilen</mat-chip>
          <mat-chip>{{ schemaData.columns.length || 0 }} Spalten</mat-chip>
        </mat-chip-set>
      </mat-card-header>

      <mat-card-content class="card-content">
        <mat-tab-group>
          <!-- Tabellarische Darstellung -->
          <mat-tab label="Tabelle">
            <div class="tab-content">
              <div class="table-container">
                <table mat-table [dataSource]="tableData" class="data-table">
                  <ng-container *ngFor="let column of schemaData?.columns || []" [matColumnDef]="column">
                    <th mat-header-cell *matHeaderCellDef>{{ column }}</th>
                    <td mat-cell *matCellDef="let row">
                      <span class="cell-value">{{ formatCellValue(row[column]) }}</span>
                    </td>
                  </ng-container>
                  
                  <tr mat-header-row *matHeaderRowDef="schemaData?.columns || []"></tr>
                  <tr mat-row *matRowDef="let row; columns: schemaData?.columns || []"></tr>
                </table>
              </div>
            </div>
          </mat-tab>

          <!-- Graphische Darstellung -->
          <mat-tab label="Diagramme">
            <div class="tab-content">
              <div class="charts-container">
                <!-- Numerische Spalten -->
                <div *ngFor="let chart of numericCharts" class="chart-section">
                  <h4>{{ chart.title }}</h4>
                  <div class="chart-wrapper">
                    <canvas baseChart
                      [data]="chart.data"
                      [options]="chart.options"
                      [type]="chart.type">
                    </canvas>
                  </div>
                </div>

                <!-- Kategorische Spalten -->
                <div *ngFor="let chart of categoricalCharts" class="chart-section">
                  <h4>{{ chart.title }}</h4>
                  <div class="chart-wrapper">
                    <canvas baseChart
                      [data]="chart.data"
                      [options]="chart.options"
                      [type]="chart.type">
                    </canvas>
                  </div>
                </div>

                <!-- Zeitreihen -->
                <div *ngFor="let chart of timeSeriesCharts" class="chart-section">
                  <h4>{{ chart.title }}</h4>
                  <div class="chart-wrapper">
                    <canvas baseChart
                      [data]="chart.data"
                      [options]="chart.options"
                      [type]="chart.type">
                    </canvas>
                  </div>
                </div>

                <!-- Keine Diagramme verfügbar -->
                <div *ngIf="numericCharts.length === 0 && categoricalCharts.length === 0 && timeSeriesCharts.length === 0" class="no-charts-message">
                  <p>Keine Diagramme verfügbar. Überprüfen Sie, ob die Daten numerische oder kategorische Spalten enthalten.</p>
                </div>
              </div>
            </div>
          </mat-tab>

          <!-- Datenanalyse -->
          <mat-tab label="Analyse">
            <div class="tab-content">
              <div class="analysis-container">
                <div class="analysis-grid">
                  <div class="analysis-card" *ngFor="let stat of dataStatistics">
                    <h4>{{ stat.title }}</h4>
                    <div class="stat-value">{{ stat.value }}</div>
                    <div class="stat-description">{{ stat.description }}</div>
                  </div>
                </div>
              </div>
            </div>
          </mat-tab>
        </mat-tab-group>
      </mat-card-content>
    </mat-card>
  `,
  styleUrl: './data-visualization.scss'
})
export class DataVisualization {
  @Input() schemaData!: SchemaData | null;

  get tableData() {
    return this.schemaData?.data || [];
  }
  
  get numericCharts() {
    return this.schemaData ? this.generateNumericCharts() : [];
  }

  get categoricalCharts() {
    return this.schemaData ? this.generateCategoricalCharts() : [];
  }

  get timeSeriesCharts() {
    return this.schemaData ? this.generateTimeSeriesCharts() : [];
  }

  get dataStatistics() {
    return this.schemaData ? this.generateDataStatistics() : [];
  }

  formatCellValue(value: unknown): string {
    if (value === null || value === undefined) return '-';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  }

  private generateNumericCharts() {
    const data = this.schemaData?.data || [];
    const columns = this.schemaData?.columns || [];
    const charts: any[] = [];

    // Finde numerische Spalten
    const numericColumns = columns.filter(col => {
      const values = data.map(row => row[col]).filter(v => v !== null && v !== undefined);
      return values.length > 0 && values.every(v => !isNaN(Number(v)));
    });

    numericColumns.forEach(column => {
      const values = data.map(row => Number(row[column])).filter(v => !isNaN(v));
      
      if (values.length > 0) {
        // Histogramm
        const histogram = this.createHistogram(values, column);
        if (histogram) {
          charts.push({
            title: `Verteilung: ${column}`,
            type: 'bar' as ChartType,
            data: histogram.data,
            options: histogram.options
          });
        }

        // Box Plot (als Balkendiagramm dargestellt)
        const boxPlot = this.createBoxPlot(values, column);
        if (boxPlot) {
          charts.push({
            title: `Box Plot: ${column}`,
            type: 'bar' as ChartType,
            data: boxPlot.data,
            options: boxPlot.options
          });
        }
      }
    });

    return charts;
  }

  private generateCategoricalCharts() {
    const data = this.schemaData?.data || [];
    const columns = this.schemaData?.columns || [];
    const charts: any[] = [];

    // Finde kategorische Spalten
    const categoricalColumns = columns.filter(col => {
      const values = data.map(row => row[col]).filter(v => v !== null && v !== undefined);
      return values.length > 0 && values.every(v => typeof v === 'string' || typeof v === 'number');
    });

    categoricalColumns.forEach(column => {
      const values = data.map(row => String(row[column])).filter(v => v && v !== 'null' && v !== 'undefined');
      
      if (values.length > 0) {
        // Pie Chart für Top 10 Werte
        const pieChart = this.createPieChart(values, column);
        if (pieChart) {
          charts.push({
            title: `Verteilung: ${column}`,
            type: 'pie' as ChartType,
            data: pieChart.data,
            options: pieChart.options
          });
        }

        // Bar Chart für Top 15 Werte
        const barChart = this.createBarChart(values, column);
        if (barChart) {
          charts.push({
            title: `Häufigkeiten: ${column}`,
            type: 'bar' as ChartType,
            data: barChart.data,
            options: barChart.options
          });
        }
      }
    });

    return charts;
  }

  private generateTimeSeriesCharts() {
    const data = this.schemaData?.data || [];
    const columns = this.schemaData?.columns || [];
    const charts: any[] = [];

    // Suche nach Datum-Spalten
    const dateColumns = columns.filter(col => {
      const values = data.map(row => row[col]).filter(v => v !== null && v !== undefined);
      return values.some(v => this.isDateValue(v));
    });

    dateColumns.forEach(dateColumn => {
      // Finde numerische Spalten für Zeitreihen
      const numericColumns = columns.filter(col => {
        if (col === dateColumn) return false;
        const values = data.map(row => row[col]).filter(v => v !== null && v !== undefined);
        return values.length > 0 && values.every(v => !isNaN(Number(v)));
      });

      numericColumns.forEach(numericColumn => {
        const timeSeries = this.createTimeSeries(data, dateColumn, numericColumn);
        if (timeSeries) {
          charts.push({
            title: `${numericColumn} über Zeit`,
            type: 'line' as ChartType,
            data: timeSeries.data,
            options: timeSeries.options
          });
        }
      });
    });

    return charts;
  }

  private generateDataStatistics() {
    const data = this.schemaData?.data || [];
    const columns = this.schemaData?.columns || [];
    const stats: any[] = [];

    stats.push({
      title: 'Gesamtzeilen',
      value: data.length,
      description: 'Anzahl der Datensätze'
    });

    stats.push({
      title: 'Spalten',
      value: columns.length,
      description: 'Anzahl der Attribute'
    });

    // Numerische Statistiken
    const numericColumns = columns.filter(col => {
      const values = data.map(row => row[col]).filter(v => v !== null && v !== undefined);
      return values.length > 0 && values.every(v => !isNaN(Number(v)));
    });

    stats.push({
      title: 'Numerische Spalten',
      value: numericColumns.length,
      description: 'Spalten mit Zahlenwerten'
    });

    // Fehlende Werte
    const missingValues = data.reduce((total, row) => {
      return total + columns.filter(col => row[col] === null || row[col] === undefined).length;
    }, 0);

    stats.push({
      title: 'Fehlende Werte',
      value: missingValues,
      description: 'Null/Undefined Einträge'
    });

    return stats;
  }

  private createHistogram(values: number[], column: string) {
    if (values.length === 0) {
      return null;
    }

    const min = Math.min(...values);
    const max = Math.max(...values);
    const bins = Math.min(10, Math.max(1, Math.ceil(Math.sqrt(values.length))));
    const binSize = max === min ? 1 : (max - min) / bins;
    
    const binsData = Array(bins).fill(0);
    const labels = [];
    
    for (let i = 0; i < bins; i++) {
      const binStart = min + i * binSize;
      const binEnd = min + (i + 1) * binSize;
      labels.push(`${binStart.toFixed(1)}-${binEnd.toFixed(1)}`);
      
      values.forEach(value => {
        if (value >= binStart && (i === bins - 1 ? value <= binEnd : value < binEnd)) {
          binsData[i]++;
        }
      });
    }

    return {
      data: {
        labels,
        datasets: [{
          label: column,
          data: binsData,
          backgroundColor: 'rgba(54, 162, 235, 0.6)',
          borderColor: 'rgba(54, 162, 235, 1)',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        plugins: {
          title: {
            display: true,
            text: `Histogramm: ${column}`
          }
        },
        scales: {
          y: {
            beginAtZero: true
          }
        }
      }
    };
  }

  private createBoxPlot(values: number[], column: string) {
    if (values.length === 0) {
      return null;
    }

    const sorted = [...values].sort((a, b) => a - b);
    const q1 = this.percentile(sorted, 25);
    const median = this.percentile(sorted, 50);
    const q3 = this.percentile(sorted, 75);
    const min = Math.min(...values);
    const max = Math.max(...values);

    return {
      data: {
        labels: ['Min', 'Q1', 'Median', 'Q3', 'Max'],
        datasets: [{
          label: column,
          data: [min, q1, median, q3, max],
          backgroundColor: 'rgba(255, 99, 132, 0.6)',
          borderColor: 'rgba(255, 99, 132, 1)',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        plugins: {
          title: {
            display: true,
            text: `Box Plot: ${column}`
          }
        },
        scales: {
          y: {
            beginAtZero: true
          }
        }
      }
    };
  }

  private createPieChart(values: string[], column: string) {
    if (values.length === 0) {
      return null;
    }

    const counts = this.countValues(values);
    const topValues = Object.entries(counts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10);

    return {
      data: {
        labels: topValues.map(([label]) => label),
        datasets: [{
          data: topValues.map(([,count]) => count),
          backgroundColor: [
            '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF',
            '#FF9F40', '#FF6384', '#C9CBCF', '#4BC0C0', '#FF6384'
          ]
        }]
      },
      options: {
        responsive: true,
        plugins: {
          title: {
            display: true,
            text: `Top 10 Werte: ${column}`
          },
          legend: {
            position: 'bottom'
          }
        }
      }
    };
  }

  private createBarChart(values: string[], column: string) {
    if (values.length === 0) {
      return null;
    }

    const counts = this.countValues(values);
    const topValues = Object.entries(counts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 15);

    return {
      data: {
        labels: topValues.map(([label]) => label),
        datasets: [{
          label: 'Anzahl',
          data: topValues.map(([,count]) => count),
          backgroundColor: 'rgba(75, 192, 192, 0.6)',
          borderColor: 'rgba(75, 192, 192, 1)',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        plugins: {
          title: {
            display: true,
            text: `Häufigkeiten: ${column}`
          }
        },
        scales: {
          y: {
            beginAtZero: true
          }
        }
      }
    };
  }

  private createTimeSeries(data: Record<string, unknown>[], dateColumn: string, valueColumn: string) {
    const timeData = data
      .map(row => ({
        date: this.parseDate(row[dateColumn]),
        value: Number(row[valueColumn])
      }))
      .filter(item => item.date && !isNaN(item.value))
      .sort((a, b) => a.date!.getTime() - b.date!.getTime());

    if (timeData.length === 0) return null;

    return {
      data: {
        labels: timeData.map(item => item.date!.toLocaleDateString()),
        datasets: [{
          label: valueColumn,
          data: timeData.map(item => item.value),
          borderColor: 'rgba(54, 162, 235, 1)',
          backgroundColor: 'rgba(54, 162, 235, 0.1)',
          tension: 0.1
        }]
      },
      options: {
        responsive: true,
        plugins: {
          title: {
            display: true,
            text: `${valueColumn} über Zeit`
          }
        },
        scales: {
          y: {
            beginAtZero: true
          }
        }
      }
    };
  }

  private countValues(values: string[]): Record<string, number> {
    return values.reduce((counts, value) => {
      counts[value] = (counts[value] || 0) + 1;
      return counts;
    }, {} as Record<string, number>);
  }

  private percentile(sorted: number[], p: number): number {
    const index = (p / 100) * (sorted.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index % 1;
    
    if (upper >= sorted.length) return sorted[sorted.length - 1];
    return sorted[lower] * (1 - weight) + sorted[upper] * weight;
  }

  private isDateValue(value: unknown): boolean {
    if (typeof value === 'string') {
      return !isNaN(Date.parse(value));
    }
    return value instanceof Date;
  }

  private parseDate(value: unknown): Date | null {
    if (value instanceof Date) return value;
    if (typeof value === 'string') {
      const parsed = new Date(value);
      return isNaN(parsed.getTime()) ? null : parsed;
    }
    return null;
  }
}
