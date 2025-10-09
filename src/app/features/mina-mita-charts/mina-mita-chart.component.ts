import { Component, Input, signal, effect, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogModule, MatDialog, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { BaseChartDirective } from 'ng2-charts';
import { Chart, ChartConfiguration, ChartData, registerables } from 'chart.js';

interface ChartDataPoint {
  month: number;
  year: number;
  minaAverage: number;
  mitaAverage: number;
  totalStations: number;
  totalDays: number;
}

@Component({
  selector: 'app-mina-mita-chart',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatDialogModule,
    BaseChartDirective
  ],
  template: `
    <mat-card class="chart-card">
      <mat-card-header>
        <mat-card-title>
          <mat-icon>show_chart</mat-icon>
          MiNa/MiTa Durchschnitte über Zeit
        </mat-card-title>
        <mat-card-subtitle>
          Monatlicher Vergleich aller Stationen
        </mat-card-subtitle>
      </mat-card-header>
      
      <mat-card-content>
        <div class="chart-container" *ngIf="hasData()">
          <canvas baseChart
            [data]="getChartData()"
            [options]="chartOptions"
            [type]="'line'">
          </canvas>
        </div>
        
        <div class="no-data" *ngIf="!hasData()">
          <mat-icon>info</mat-icon>
          <p>Keine Chart-Daten verfügbar</p>
          <p class="hint">Laden Sie PpUGV MiNa/MiTa-Bestände Dateien hoch, um die monatliche Entwicklung zu sehen.</p>
        </div>
      </mat-card-content>
    </mat-card>
  `,
  styles: [`
    .chart-card {
      margin: 20px 0;
    }

    mat-card-header {
      margin-bottom: 20px;
    }

    mat-card-title {
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 20px;
      font-weight: 600;
    }

    .chart-container {
      width: 100%;
      height: 400px;
      position: relative;
    }

    .no-data {
      text-align: center;
      padding: 40px;
      color: #999;
    }

    .no-data mat-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      color: #ccc;
    }

    .no-data p {
      margin: 8px 0;
    }

    .no-data .hint {
      font-size: 13px;
      color: #999;
    }
  `]
})
export class MinaMitaChart implements OnInit {
  @Input() uploads: any[] = [];
  
  chartData = signal<ChartDataPoint[]>([]);
  chartOptions: ChartConfiguration['options'] = {};

  private readonly monthLabels = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

  constructor(private dialog: MatDialog) {
    effect(() => {
      this.processChartData();
    });
  }

  ngOnInit() {
    Chart.register(...registerables);
    this.setupChartOptions();
    this.processChartData();
  }

  private setupChartOptions() {
    this.chartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: {
          display: true,
          text: 'MiNa vs MiTa Durchschnitte',
          font: {
            size: 16,
            weight: 'bold'
          },
          padding: 20
        },
        legend: {
          display: true,
          position: 'top',
          labels: {
            font: {
              size: 12
            },
            usePointStyle: true,
            padding: 15
          }
        },
        tooltip: {
          mode: 'index',
          intersect: false,
          callbacks: {
            label: (context) => {
              const label = context.dataset.label || '';
              const value = context.parsed.y.toFixed(2);
              return `${label}: ${value} Patienten`;
            }
          }
        }
      },
      scales: {
        x: {
          display: true,
          title: {
            display: true,
            text: 'Monate',
            font: {
              size: 14,
              weight: 'bold'
            }
          },
          grid: {
            display: true,
            color: 'rgba(0, 0, 0, 0.05)'
          },
          ticks: {
            font: {
              size: 11
            }
          }
        },
        y: {
          display: true,
          title: {
            display: true,
            text: 'Durchschnittliche Patienten',
            font: {
              size: 14,
              weight: 'bold'
            }
          },
          grid: {
            display: true,
            color: 'rgba(0, 0, 0, 0.05)'
          },
          beginAtZero: false,
          ticks: {
            font: {
              size: 11
            },
            callback: (value) => {
              return value.toLocaleString('de-DE', { maximumFractionDigits: 0 });
            }
          }
        }
      },
      interaction: {
        mode: 'nearest',
        axis: 'x',
        intersect: false
      }
    };
  }

  private processChartData() {
    const minaMinaUploads = this.uploads.filter(u => u.schemaId === 'ppugv_bestaende');
    
    if (minaMinaUploads.length === 0) {
      this.chartData.set([]);
      return;
    }

    // Initialize all 12 months with zero values
    const monthlyData: ChartDataPoint[] = [];
    const currentYear = new Date().getFullYear();
    
    for (let month = 1; month <= 12; month++) {
      monthlyData.push({
        month,
        year: currentYear,
        minaAverage: 0,
        mitaAverage: 0,
        totalStations: 0,
        totalDays: 0
      });
    }

    // Process all uploads and populate the corresponding months
    minaMinaUploads.forEach(upload => {
      if (upload.files && upload.files.length > 0) {
        const file = upload.files[0];
        
        if ((file as any).metadata && (file as any).monthlyAverages) {
          const metadata = (file as any).metadata;
          const averages = (file as any).monthlyAverages;
          
          const monthNumber = metadata.month;
          const yearNumber = metadata.year || currentYear;
          
          if (monthNumber >= 1 && monthNumber <= 12) {
            // Calculate total averages for the month
            const totalMiNa = averages.reduce((sum: number, row: any) => sum + (row.MiNa_Durchschnitt || 0), 0);
            const totalMiTa = averages.reduce((sum: number, row: any) => sum + (row.MiTa_Durchschnitt || 0), 0);
            
            // Update the corresponding month
            const monthIndex = monthNumber - 1;
            monthlyData[monthIndex] = {
              month: monthNumber,
              year: yearNumber,
              minaAverage: totalMiNa,
              mitaAverage: totalMiTa,
              totalStations: metadata.totalStations || 0,
              totalDays: metadata.totalDays || 0
            };
          }
        }
      }
    });

    this.chartData.set(monthlyData);
  }

  getChartData(): ChartData<'line'> {
    const data = this.chartData();
    
    return {
      labels: this.monthLabels,
      datasets: [
        {
          data: data.map(point => point.minaAverage),
          label: '🌙 MiNa (Mitternacht)',
          borderColor: '#1976d2',
          backgroundColor: 'rgba(25, 118, 210, 0.1)',
          fill: true,
          tension: 0.4,
          pointRadius: 5,
          pointHoverRadius: 7,
          pointBackgroundColor: '#1976d2',
          pointBorderColor: '#fff',
          pointBorderWidth: 2
        },
        {
          data: data.map(point => point.mitaAverage),
          label: '☀️ MiTa (Mittag)',
          borderColor: '#ff9800',
          backgroundColor: 'rgba(255, 152, 0, 0.1)',
          fill: true,
          tension: 0.4,
          pointRadius: 5,
          pointHoverRadius: 7,
          pointBackgroundColor: '#ff9800',
          pointBorderColor: '#fff',
          pointBorderWidth: 2
        }
      ]
    };
  }

  hasData(): boolean {
    const data = this.chartData();
    // Check if there's at least one month with non-zero data
    return data.some(point => point.minaAverage > 0 || point.mitaAverage > 0);
  }

  padMonth(month: number): string {
    return month.toString().padStart(2, '0');
  }
}

// Detail Dialog Component
@Component({
  selector: 'mina-mita-detail-dialog',
  template: `
    <h2 mat-dialog-title>
      <mat-icon>info</mat-icon>
      Detailansicht {{ data.year }}-{{ padMonth(data.month) }}
    </h2>
    
    <mat-dialog-content>
      <div class="detail-info">
        <div class="summary-stats">
          <h3>Gesamtübersicht</h3>
          <div class="stat-grid">
            <div class="stat-item">
              <span class="label">🌙 MiNa Durchschnitt:</span>
              <span class="value">{{ data.minaAverage.toFixed(2) }} Patienten</span>
            </div>
            <div class="stat-item">
              <span class="label">☀️ MiTa Durchschnitt:</span>
              <span class="value">{{ data.mitaAverage.toFixed(2) }} Patienten</span>
            </div>
            <div class="stat-item">
              <span class="label">📊 Differenz:</span>
              <span class="value" [class.positive]="data.mitaAverage > data.minaAverage"
                                [class.negative]="data.mitaAverage < data.minaAverage">
                {{ (data.mitaAverage - data.minaAverage).toFixed(2) }} Patienten
              </span>
            </div>
            <div class="stat-item">
              <span class="label">🏥 Stationen:</span>
              <span class="value">{{ data.totalStations }}</span>
            </div>
            <div class="stat-item">
              <span class="label">📅 Tage:</span>
              <span class="value">{{ data.totalDays }}</span>
            </div>
          </div>
        </div>
        
        <div class="station-details" *ngIf="stationDetails.length > 0">
          <h3>Top 10 Stationen (MiNa-Durchschnitt)</h3>
          <div class="station-list">
            <div class="station-item" *ngFor="let station of stationDetails.slice(0, 10)">
              <div class="station-info">
                <span class="station-name">{{ station.Station }}</span>
                <span class="station-haus">({{ station.Haus }})</span>
              </div>
              <div class="station-values">
                <span class="mina-value">{{ station.MiNa_Durchschnitt.toFixed(1) }}</span>
                <span class="mita-value">{{ station.MiTa_Durchschnitt.toFixed(1) }}</span>
                <span class="diff-value" [class.positive]="station.MiTa_Durchschnitt > station.MiNa_Durchschnitt"
                                       [class.negative]="station.MiTa_Durchschnitt < station.MiNa_Durchschnitt">
                  {{ (station.MiTa_Durchschnitt - station.MiNa_Durchschnitt).toFixed(1) }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </mat-dialog-content>
    
    <mat-dialog-actions align="end">
      <button mat-button (click)="onClose()">Schließen</button>
    </mat-dialog-actions>
  `,
  styles: [`
    mat-dialog-title {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    
    .detail-info {
      display: flex;
      flex-direction: column;
      gap: 24px;
    }
    
    .summary-stats h3,
    .station-details h3 {
      margin-bottom: 16px;
      font-size: 16px;
      font-weight: 600;
    }
    
    .stat-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }
    
    .stat-item {
      display: flex;
      justify-content: space-between;
      padding: 12px;
      background: #f5f5f5;
      border-radius: 6px;
    }
    
    .stat-item .label {
      font-weight: 500;
      color: #666;
    }
    
    .stat-item .value {
      font-weight: 600;
      color: #1976d2;
    }
    
    .stat-item .value.positive {
      color: #4caf50;
    }
    
    .stat-item .value.negative {
      color: #f44336;
    }
    
    .station-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
      max-height: 300px;
      overflow-y: auto;
    }
    
    .station-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px;
      background: #fafafa;
      border-radius: 6px;
      border-left: 3px solid #1976d2;
    }
    
    .station-info {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    
    .station-name {
      font-weight: 600;
      font-size: 14px;
    }
    
    .station-haus {
      color: #666;
      font-size: 12px;
    }
    
    .station-values {
      display: flex;
      gap: 16px;
      font-size: 14px;
      font-weight: 600;
    }
    
    .mina-value {
      color: #1976d2;
    }
    
    .mita-value {
      color: #ff9800;
    }
    
    .diff-value.positive {
      color: #4caf50;
    }
    
    .diff-value.negative {
      color: #f44336;
    }
  `],
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule]
})
export class MinaMitaDetailDialog {
  stationDetails: any[] = [];

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {
    // Extract station details from uploads
    const upload = data.uploads.find((u: any) => u.schemaId === 'ppugv_bestaende');
    if (upload && upload.files && upload.files.length > 0) {
      const file = upload.files[0];
      if ((file as any).monthlyAverages) {
        this.stationDetails = [...(file as any).monthlyAverages]
          .sort((a: any, b: any) => b.MiNa_Durchschnitt - a.MiNa_Durchschnitt);
      }
    }
  }

  padMonth(month: number): string {
    return month.toString().padStart(2, '0');
  }

  onClose() {
    // Dialog will be closed automatically
  }
}
