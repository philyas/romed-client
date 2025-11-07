import { Component, Input, signal, effect, Inject, OnInit, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogModule, MatDialog, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTableModule } from '@angular/material/table';
import { BaseChartDirective } from 'ng2-charts';
import { Chart, ChartConfiguration, ChartData, registerables } from 'chart.js';

interface ChartDataPoint {
  month: number;
  year: number;
  minaAverage: number;
  mitaAverage: number;
  totalStations: number;
  totalDays: number;
  stationDetails?: any[]; // Store the raw station data for detailed view
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
    MatTabsModule,
    MatTableModule,
    BaseChartDirective
  ],
  template: `
    <div class="flip-card" [class.flipped]="isFlipped()" (click)="toggleFlip()">
      <div class="flip-card-inner">
        <!-- Front side: Chart -->
        <div class="flip-card-front">
          <mat-card class="chart-card">
            <mat-card-header>
              <mat-card-title>
                <mat-icon>show_chart</mat-icon>
                MiNa/MiTa Durchschnitte über Zeit
                <span class="flip-hint-text">Klicken zum Umdrehen</span>
                <mat-icon class="flip-icon">flip</mat-icon>
              </mat-card-title>
              <mat-card-subtitle>
                {{ selectedStation === 'all' ? 'Monatlicher Vergleich aller Stationen' : 'Station: ' + selectedStation }}
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
        </div>
        
        <!-- Back side: Tabs with data -->
        <div class="flip-card-back">
          <mat-card class="chart-card">
            <mat-card-header>
              <mat-card-title>
                <mat-icon>table_chart</mat-icon>
                MiNa/MiTa Detaildaten
                <mat-icon class="flip-icon">flip</mat-icon>
              </mat-card-title>
            </mat-card-header>
            
            <mat-card-content>
              <mat-tab-group (click)="$event.stopPropagation()" class="data-tabs">
                <mat-tab label="🌙 MiNa (Mitternacht)">
                  <div class="tab-content">
                    <div class="table-container">
                      <table mat-table [dataSource]="getMinaTableData()">
                        <ng-container matColumnDef="month">
                          <th mat-header-cell *matHeaderCellDef>Monat</th>
                          <td mat-cell *matCellDef="let row">{{ row.month }}</td>
                        </ng-container>
                        <ng-container matColumnDef="value">
                          <th mat-header-cell *matHeaderCellDef>MiNa Durchschnitt</th>
                          <td mat-cell *matCellDef="let row">{{ row.value | number:'1.2-2' }}</td>
                        </ng-container>
                        <ng-container matColumnDef="stations">
                          <th mat-header-cell *matHeaderCellDef>Stationen</th>
                          <td mat-cell *matCellDef="let row">{{ row.stations }}</td>
                        </ng-container>
                        <tr mat-header-row *matHeaderRowDef="['month', 'value', 'stations']"></tr>
                        <tr mat-row *matRowDef="let row; columns: ['month', 'value', 'stations']"></tr>
                      </table>
                    </div>
                  </div>
                </mat-tab>
                <mat-tab label="☀️ MiTa (Mittag)">
                  <div class="tab-content">
                    <div class="table-container">
                      <table mat-table [dataSource]="getMitaTableData()">
                        <ng-container matColumnDef="month">
                          <th mat-header-cell *matHeaderCellDef>Monat</th>
                          <td mat-cell *matCellDef="let row">{{ row.month }}</td>
                        </ng-container>
                        <ng-container matColumnDef="value">
                          <th mat-header-cell *matHeaderCellDef>MiTa Durchschnitt</th>
                          <td mat-cell *matCellDef="let row">{{ row.value | number:'1.2-2' }}</td>
                        </ng-container>
                        <ng-container matColumnDef="stations">
                          <th mat-header-cell *matHeaderCellDef>Stationen</th>
                          <td mat-cell *matCellDef="let row">{{ row.stations }}</td>
                        </ng-container>
                        <tr mat-header-row *matHeaderRowDef="['month', 'value', 'stations']"></tr>
                        <tr mat-row *matRowDef="let row; columns: ['month', 'value', 'stations']"></tr>
                      </table>
                    </div>
                  </div>
                </mat-tab>
              </mat-tab-group>
            </mat-card-content>
          </mat-card>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .flip-card {
      perspective: 1000px;
      cursor: pointer;
      height: 500px;
      transition: transform 0.2s ease;
      
      &:hover {
        transform: scale(1.01);
        
        .chart-card {
          box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15) !important;
        }
        
        .flip-icon {
          animation: flipHint 0.6s ease-in-out;
        }
        
        .flip-hint-text {
          opacity: 1;
        }
      }
    }

    .flip-card-inner {
      position: relative;
      width: 100%;
      height: 100%;
      transition: transform 0.6s;
      transform-style: preserve-3d;
    }

    .flip-card.flipped .flip-card-inner {
      transform: rotateY(180deg);
    }

    .flip-card-front,
    .flip-card-back {
      position: absolute;
      width: 100%;
      height: 100%;
      backface-visibility: hidden;
      -webkit-backface-visibility: hidden;
    }

    .flip-card-back {
      transform: rotateY(180deg);
    }

    .chart-card {
      margin: 20px 0;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      height: 100%;
      display: flex;
      flex-direction: column;
    }

    mat-card-header {
      margin-bottom: 20px;
      background: linear-gradient(135deg, #1976d2 0%, #1565c0 100%);
      color: white;
      padding: 16px;
    }

    mat-card-title {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      font-size: 18px;
      font-weight: 600;
      color: white;
      margin: 0;
    }

    mat-card-subtitle {
      color: rgba(255, 255, 255, 0.9);
      margin: 4px 0 0 0;
      font-size: 13px;
    }

    .flip-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
      opacity: 0.9;
      transition: transform 0.3s ease;
    }
    
    .flip-hint-text {
      position: absolute;
      right: 50px;
      color: rgba(255, 255, 255, 0.85);
      font-size: 0.7rem;
      opacity: 0.7;
      transition: opacity 0.3s ease;
      pointer-events: none;
      white-space: nowrap;
    }
    
    @keyframes flipHint {
      0%, 100% { transform: rotateY(0deg); }
      50% { transform: rotateY(15deg); }
    }

    mat-card-content {
      flex: 1;
      overflow: hidden;
      padding: 16px !important;
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

    .data-tabs {
      height: 100%;
    }

    .data-tabs ::ng-deep .mat-mdc-tab-body-wrapper {
      flex: 1;
      overflow: hidden;
    }

    .data-tabs ::ng-deep .mat-mdc-tab-labels {
      background: #f5f5f5;
    }

    .data-tabs ::ng-deep .mat-mdc-tab {
      font-weight: 500;
    }

    .data-tabs ::ng-deep .mat-mdc-tab.mat-mdc-tab-active {
      background: white;
    }

    .tab-content {
      padding: 16px;
      height: 100%;
    }

    .table-container {
      max-height: 350px;
      overflow-y: auto;
      overflow-x: auto;
      border: 1px solid #e0e0e0;
      border-radius: 4px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }

    .table-container::-webkit-scrollbar {
      width: 8px;
      height: 8px;
    }

    .table-container::-webkit-scrollbar-track {
      background: #f1f1f1;
      border-radius: 4px;
    }

    .table-container::-webkit-scrollbar-thumb {
      background: #888;
      border-radius: 4px;
    }

    .table-container::-webkit-scrollbar-thumb:hover {
      background: #555;
    }

    .table-container table {
      width: 100%;
      border-collapse: collapse;
    }

    .table-container th {
      background: #1976d2;
      color: white;
      font-weight: 600;
      position: sticky;
      top: 0;
      z-index: 10;
      padding: 12px 16px;
      text-align: left;
      border-bottom: 2px solid #1565c0;
    }

    .table-container td {
      padding: 12px 16px;
      text-align: left;
      border-bottom: 1px solid #e0e0e0;
    }

    .table-container tbody tr:nth-child(even) {
      background: #fafafa;
    }

    .table-container tbody tr:hover {
      background: #e3f2fd;
      transition: background-color 0.2s ease;
    }

    @media (max-width: 768px) {
      .flip-card {
        height: auto;
        min-height: 500px;
      }

      .table-container {
        max-height: 300px;
      }
    }
  `]
})
export class MinaMitaChart implements OnInit, OnChanges {
  @Input() uploads: any[] = [];
  @Input() selectedStation: string = 'all';
  
  chartData = signal<ChartDataPoint[]>([]);
  chartOptions: ChartConfiguration['options'] = {};
  isFlipped = signal<boolean>(false);

  private readonly monthLabels = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
  private readonly monthLabelsFull = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

  constructor(private dialog: MatDialog) {
    effect(() => {
      this.processChartData();
    });
  }

  toggleFlip(event?: Event) {
    if (event) {
      event.stopPropagation();
    }
    this.isFlipped.set(!this.isFlipped());
  }

  ngOnInit() {
    Chart.register(...registerables);
    this.setupChartOptions();
    this.processChartData();
  }

  ngOnChanges() {
    this.processChartData();
  }

  private setupChartOptions() {
    this.chartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: {
          display: true,
          text: this.selectedStation === 'all' 
            ? 'MiNa vs MiTa Durchschnitte (Alle Stationen)' 
            : `MiNa vs MiTa Durchschnitte - ${this.selectedStation}`,
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
        totalDays: 0,
        stationDetails: []
      });
    }

    // Process all uploads and populate the corresponding months
    minaMinaUploads.forEach(upload => {
      if (upload.files && upload.files.length > 0) {
        const file = upload.files[0];
        
        // Check if we have pre-calculated monthlyAverages
        if ((file as any).metadata && (file as any).monthlyAverages) {
          const metadata = (file as any).metadata;
          let averages = (file as any).monthlyAverages;

          // Filter by selected station if not 'all'
          if (this.selectedStation !== 'all') {
            averages = averages.filter((row: any) => row.Station === this.selectedStation);
          }

          const grouped = new Map<string, {
            month: number;
            year: number;
            totalMiNa: number;
            totalMiTa: number;
            totalDays: number;
            stationDetails: any[];
          }>();

          averages.forEach((row: any) => {
            const monthNumber = Number(row.Monat ?? metadata.month);
            const yearNumber = Number(row.Jahr ?? metadata.year ?? currentYear);

            if (!monthNumber || monthNumber < 1 || monthNumber > 12) {
              return;
            }

            const key = `${yearNumber}-${monthNumber}`;
            if (!grouped.has(key)) {
              grouped.set(key, {
                month: monthNumber,
                year: yearNumber,
                totalMiNa: 0,
                totalMiTa: 0,
                totalDays: 0,
                stationDetails: []
              });
            }

            const group = grouped.get(key)!;
            const normalizedRow = {
              ...row,
              Jahr: yearNumber,
              Monat: monthNumber,
              MiNa_Durchschnitt: Number(row.MiNa_Durchschnitt) || 0,
              MiTa_Durchschnitt: Number(row.MiTa_Durchschnitt) || 0,
              Anzahl_Tage: Number(row.Anzahl_Tage) || 0
            };

            group.totalMiNa += normalizedRow.MiNa_Durchschnitt;
            group.totalMiTa += normalizedRow.MiTa_Durchschnitt;
            group.totalDays = Math.max(group.totalDays, normalizedRow.Anzahl_Tage);
            group.stationDetails.push(normalizedRow);
          });

          grouped.forEach(group => {
            if (group.month >= 1 && group.month <= 12) {
              const monthIndex = group.month - 1;
              monthlyData[monthIndex] = {
                month: group.month,
                year: group.year,
                minaAverage: group.totalMiNa,
                mitaAverage: group.totalMiTa,
                totalStations: group.stationDetails.length,
                totalDays: group.totalDays || metadata.totalDays || 0,
                stationDetails: group.stationDetails
              };
            }
          });
        } 
        // Fallback: Calculate from raw values if monthlyAverages not available
        else if ((file as any).values && Array.isArray((file as any).values)) {
          const values = (file as any).values;
          
          // Try to extract month from upload date or filename FIRST
          // Filename format: "CO PpUGV MiNa_MiTa-Bestände RoMed_2025-08-31.xlsx"
          let targetMonthNumber = new Date(upload.createdAt).getMonth() + 1;
          let targetYearNumber = new Date(upload.createdAt).getFullYear();
          
          // Try to extract from first file if available
          if (upload.files && upload.files.length > 0) {
            const filename = upload.files[0].originalName || '';
            const dateMatch = filename.match(/(\d{4})-(\d{2})/);
            if (dateMatch) {
              targetYearNumber = parseInt(dateMatch[1]);
              targetMonthNumber = parseInt(dateMatch[2]);
            }
          }
          
          console.log(`Processing data for ${targetYearNumber}-${targetMonthNumber.toString().padStart(2, '0')}`);
          
          // Helper function to convert Excel date to JS date
          const excelDateToJSDate = (excelDate: number): Date => {
            const excelEpoch = new Date(1900, 0, 1);
            return new Date(excelEpoch.getTime() + (excelDate - 2) * 86400000);
          };
          
          // Group by station and calculate averages (ONLY for the target month)
          const stationGroups: { [key: string]: { minaSum: number, mitaSum: number, count: number, station: string, haus: string } } = {};
          
          values.forEach((row: any) => {
            if (!row.Station || !row.Datum) return;
            
            // Convert Excel date to JS date and check if it's in the target month
            const jsDate = excelDateToJSDate(row.Datum);
            const rowMonth = jsDate.getMonth() + 1;
            const rowYear = jsDate.getFullYear();
            
            // Skip if not in target month/year
            if (rowYear !== targetYearNumber || rowMonth !== targetMonthNumber) {
              return;
            }
            
            // Filter by selected station if not 'all'
            if (this.selectedStation !== 'all' && row.Station !== this.selectedStation) {
              return;
            }
            
            const key = row.Station;
            if (!stationGroups[key]) {
              stationGroups[key] = {
                station: row.Station,
                haus: row.Haus,
                minaSum: 0,
                mitaSum: 0,
                count: 0
              };
            }
            
            stationGroups[key].minaSum += Number(row.MiNa_Bestand) || 0;
            stationGroups[key].mitaSum += Number(row.MiTa_Bestand) || 0;
            stationGroups[key].count++;
          });
          
          // Calculate totals
          let totalMiNa = 0;
          let totalMiTa = 0;
          const stationCount = Object.keys(stationGroups).length;
          const stationDetails: any[] = [];
          
          Object.values(stationGroups).forEach(group => {
            const minaAvg = group.count > 0 ? group.minaSum / group.count : 0;
            const mitaAvg = group.count > 0 ? group.mitaSum / group.count : 0;
            
            totalMiNa += minaAvg;
            totalMiTa += mitaAvg;
            
            stationDetails.push({
              Haus: group.haus,
              Station: group.station,
              MiNa_Durchschnitt: minaAvg,
              MiTa_Durchschnitt: mitaAvg,
              Anzahl_Tage: group.count
            });
          });
          
          console.log(`Found ${stationCount} stations with data in month ${targetMonthNumber}`);
          
          if (targetMonthNumber >= 1 && targetMonthNumber <= 12 && stationCount > 0) {
            const monthIndex = targetMonthNumber - 1;
            monthlyData[monthIndex] = {
              month: targetMonthNumber,
              year: targetYearNumber,
              minaAverage: totalMiNa,
              mitaAverage: totalMiTa,
              totalStations: stationCount,
              totalDays: stationCount > 0 ? Math.round(Object.values(stationGroups)[0].count) : 0,
              stationDetails: stationDetails
            };
          }
        }
      }
    });

    this.chartData.set(monthlyData);
    
    // Update chart title dynamically
    if (this.chartOptions && this.chartOptions.plugins && this.chartOptions.plugins.title) {
      this.chartOptions.plugins.title.text = this.selectedStation === 'all' 
        ? 'MiNa vs MiTa Durchschnitte (Alle Stationen)' 
        : `MiNa vs MiTa Durchschnitte - ${this.selectedStation}`;
    }
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

  getMinaTableData() {
    const data = this.chartData();
    return data.map((point, index) => ({
      month: this.monthLabelsFull[index],
      value: point.minaAverage,
      stations: point.totalStations
    }));
  }

  getMitaTableData() {
    const data = this.chartData();
    return data.map((point, index) => ({
      month: this.monthLabelsFull[index],
      value: point.mitaAverage,
      stations: point.totalStations
    }));
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
