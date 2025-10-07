import { Component, Input, OnInit, OnChanges, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTabsModule } from '@angular/material/tabs';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartData, ChartType, registerables } from 'chart.js';
import { UploadRecord, SchemaStatistics } from '../../core/api';

// Register Chart.js components
import Chart from 'chart.js/auto';

interface ChartDataPoint {
  date: string;
  value: number;
  uploadId: string;
}

interface SchemaChartData {
  schemaId: string;
  schemaName: string;
  description: string;
  columns: string[];
  uploads: UploadRecord[];
  totalRows: number;
  latestUploadDate: string;
  chartData: ChartDataPoint[];
  availableColumns: string[];
  monthlyData: { [month: number]: number };
}

@Component({
  selector: 'app-schema-chart',
  imports: [
    CommonModule,
    MatCardModule,
    MatChipsModule,
    MatIconModule,
    MatButtonModule,
    MatTabsModule,
    MatSelectModule,
    MatFormFieldModule,
    BaseChartDirective
  ],
  template: `
    <div class="schema-chart">
      <mat-card class="chart-card">
        <mat-card-header class="chart-header">
          <mat-card-title>{{ chartData()?.schemaName }}</mat-card-title>
          <mat-card-subtitle>{{ chartData()?.description }}</mat-card-subtitle>
        </mat-card-header>

        <mat-card-content class="chart-content">
          <mat-tab-group class="chart-tabs">
            <!-- Monthly Overview Tab -->
            <mat-tab label="12-Monats-Verlauf">
              <div class="tab-content">
                <div class="chart-container">
                  <canvas baseChart
                    [data]="monthlyChartData"
                    [options]="monthlyChartOptions"
                    [type]="monthlyChartType">
                  </canvas>
                </div>
              </div>
            </mat-tab>

            <!-- Data Table Tab -->
            <mat-tab label="Datenübersicht">
              <div class="tab-content">
                <div class="data-summary">
                  <h4>Upload-Zusammenfassung</h4>
                  <div class="summary-grid">
                    <div *ngFor="let upload of chartData()?.uploads; let i = index" class="summary-item">
                      <div class="summary-date">{{ upload.createdAt | date:'dd.MM.yyyy HH:mm' }}</div>
                      <div class="summary-files">{{ upload.files.length }} Datei(en)</div>
                      <div class="summary-rows">
                        {{ getTotalRows(upload) }} Zeilen
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </mat-tab>
          </mat-tab-group>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styleUrl: './schema-chart.scss'
})
export class SchemaChart implements OnInit, OnChanges {
  @Input() uploads: UploadRecord[] = [];
  @Input() statistics: SchemaStatistics[] = [];
  @Input() schemaId: string = '';
  @Input() selectedYear: number = new Date().getFullYear();
  @Input() selectedStation: string = 'all';

  chartData = signal<SchemaChartData | null>(null);

  // Chart.js configurations

  // Monthly chart data
  monthlyChartData: ChartData<'line'> = {
    labels: ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'],
    datasets: []
  };

  monthlyChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      title: {
        display: true,
        text: '12-Monats-Verlauf'
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
          text: 'Wert'
        }
      }
    }
  };

  monthlyChartType: ChartType = 'line';

  ngOnInit() {
    // Register Chart.js components
    Chart.register(...registerables);
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

        const chartData: SchemaChartData = {
          schemaId: this.schemaId,
          schemaName: schemaStat.schemaName,
          description: schemaStat.description,
          columns: schemaStat.columns,
          uploads: schemaUploads,
          totalRows,
          latestUploadDate: latestUpload.createdAt,
          chartData: [],
          availableColumns,
          monthlyData: {}
        };

    this.chartData.set(chartData);

    // Update monthly chart with first available column
    if (availableColumns.length > 0) {
      this.updateMonthlyChart();
    }
  }


  getTotalRows(upload: UploadRecord): number {
    return upload.files.reduce((sum, file) => {
      return sum + (file.values?.length || 0);
    }, 0);
  }


  ngOnChanges() {
    this.processChartData();
    this.updateMonthlyChart();
  }

  updateMonthlyChart() {
    const data = this.chartData();
    if (!data || !data.availableColumns || data.availableColumns.length === 0) return;
    
    // Find first numeric column (skip text columns like "Station")
    let selectedColumn = data.availableColumns[0];
    
    // For Mitternachtsstatistik, prefer "Pflegetage"
    if (data.schemaId === 'mitternachtsstatistik' && data.availableColumns.includes('Pflegetage')) {
      selectedColumn = 'Pflegetage';
    } else {
      // Find first numeric column by testing first row
      const firstUpload = data.uploads[0];
      const firstRow = firstUpload?.files?.[0]?.values?.[0];
      if (firstRow) {
        for (const col of data.availableColumns) {
          const value = firstRow[col];
          if (typeof value === 'number' || (!isNaN(Number(value)) && value !== null && value !== '')) {
            selectedColumn = col;
            break;
          }
        }
      }
    }

    // Initialize monthly data
    const monthlyData: { [month: number]: { sum: number; count: number } } = {};
    for (let i = 1; i <= 12; i++) {
      monthlyData[i] = { sum: 0, count: 0 };
    }

    // Process uploads
    data.uploads.forEach(upload => {
      // Get month from upload.month (e.g., "09-2025" or "9") or fallback to createdAt
      let month: number;
      let year: number;
      
      if (upload.month) {
        // Parse month from upload data
        if (upload.month.includes('-')) {
          const [monthStr, yearStr] = upload.month.split('-');
          month = parseInt(monthStr);
          year = parseInt(yearStr);
        } else {
          month = parseInt(upload.month);
          year = this.selectedYear;
        }
      } else {
        // Fallback to upload date
        const uploadDate = new Date(upload.createdAt);
        month = uploadDate.getMonth() + 1; // 1-12
        year = uploadDate.getFullYear();
      }

      // Filter by selected year
      if (year !== this.selectedYear) return;

      upload.files.forEach(file => {
        if (file.values && Array.isArray(file.values)) {
          file.values.forEach(row => {
            // Filter by station if specified
            if (this.selectedStation !== 'all' && row['Station'] !== this.selectedStation) {
              return;
            }
            
            const value = Number(row[selectedColumn]);
            if (!isNaN(value) && value !== null) {
              monthlyData[month].sum += value;
              monthlyData[month].count++;
            }
          });
        }
      });
    });

    // Calculate averages and prepare chart data
    const monthlyValues: number[] = [];
    for (let i = 1; i <= 12; i++) {
      const monthData = monthlyData[i];
      const avgValue = monthData.count > 0 ? monthData.sum / monthData.count : 0;
      monthlyValues.push(avgValue);
    }

    // Update monthly chart
    this.monthlyChartData = {
      labels: ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'],
      datasets: [
        {
          data: monthlyValues,
          label: `${selectedColumn} (${this.selectedYear})`,
          borderColor: '#1976d2',
          backgroundColor: 'rgba(25, 118, 210, 0.1)',
          fill: true,
          tension: 0.4
        }
      ]
    };

    // Update chart title
    const stationText = this.selectedStation !== 'all' ? ` (Station: ${this.selectedStation})` : '';
    const currentOptions = this.monthlyChartOptions;
    this.monthlyChartOptions = {
      ...currentOptions,
      plugins: {
        ...currentOptions?.plugins,
        title: {
          display: true,
          text: `12-Monats-Verlauf ${this.selectedYear} - ${selectedColumn}${stationText}`
        }
      }
    };
  }
}
