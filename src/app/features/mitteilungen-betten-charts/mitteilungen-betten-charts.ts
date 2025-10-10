import { Component, Input, computed, effect, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartData, ChartOptions, ChartType } from 'chart.js';
import { ResultsResponse } from '../../core/api';

interface BettenData {
  IK: string;
  Standort: string;
  Station: string;
  Jahr: number;
  Bettenanzahl: number;
}

@Component({
  selector: 'app-mitteilungen-betten-charts',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatChipsModule, MatIconModule, BaseChartDirective],
  template: `
    <mat-card class="chart-card" id="mitteilungen_betten">
      <mat-card-header>
        <mat-card-title class="chart-title">
          <mat-icon>hotel</mat-icon>
          Aufgestellte Betten nach Standort
        </mat-card-title>
      </mat-card-header>
      
      <mat-card-content>
        @if (hasData()) {
          <div class="year-selector">
            <label>Jahr:</label>
            <mat-chip-listbox [value]="selectedYear()" (change)="onYearChange($event)">
              @for (year of availableYears(); track year) {
                <mat-chip-option [value]="year">{{ year }}</mat-chip-option>
              }
            </mat-chip-listbox>
          </div>

          <div class="charts-container">
            <!-- Bar Chart: Betten pro Standort -->
            <div class="chart-wrapper">
              <h3>Betten pro Standort ({{ selectedYear() }})</h3>
              @if (barChartData().datasets[0].data.length > 0) {
                <canvas baseChart
                  [data]="barChartData()"
                  [options]="barChartOptions"
                  [type]="'bar'">
                </canvas>
              }
            </div>

            <!-- Pie Chart: Verteilung der Betten -->
            <div class="chart-wrapper">
              <h3>Verteilung der Betten ({{ selectedYear() }})</h3>
              @if (pieChartData().datasets[0].data.length > 0) {
                <canvas baseChart
                  [data]="pieChartData()"
                  [options]="pieChartOptions"
                  [type]="'pie'">
                </canvas>
              }
            </div>
          </div>

          <!-- Tabelle: Details pro Standort -->
          <div class="table-container">
            <h3>Details pro Standort ({{ selectedYear() }})</h3>
            <table class="data-table">
              <thead>
                <tr>
                  <th>Standort</th>
                  <th>Anzahl Stationen</th>
                  <th>Gesamt Betten</th>
                  <th>Ø Betten pro Station</th>
                </tr>
              </thead>
              <tbody>
                @for (summary of standortSummaries(); track summary.standort) {
                  <tr>
                    <td><strong>{{ summary.standort }}</strong></td>
                    <td>{{ summary.stationCount }}</td>
                    <td>{{ summary.totalBetten }}</td>
                    <td>{{ summary.avgBetten }}</td>
                  </tr>
                }
              </tbody>
              <tfoot>
                <tr>
                  <td><strong>Gesamt</strong></td>
                  <td>{{ totalStations() }}</td>
                  <td>{{ totalBetten() }}</td>
                  <td>{{ avgBettenPerStation() }}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <!-- Details pro Station -->
          <div class="details-container">
            <h3>Stationen nach Standort ({{ selectedYear() }})</h3>
            @for (standort of standorte(); track standort) {
              <div class="standort-section">
                <h4>{{ standort }}</h4>
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>Station</th>
                      <th>Bettenanzahl</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (entry of getStationsByStandort(standort); track entry.Station) {
                      <tr>
                        <td>{{ entry.Station }}</td>
                        <td>{{ entry.Bettenanzahl }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            }
          </div>
        } @else {
          <div class="no-data">
            <mat-icon>info</mat-icon>
            <p>Keine Bettendaten verfügbar. Bitte laden Sie Mitteilungen gem. § 5 PpUGV Dateien hoch.</p>
          </div>
        }
      </mat-card-content>
    </mat-card>
  `,
  styles: [`
    .chart-card {
      margin: 20px 0;
      padding: 20px;
    }

    .chart-title {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 24px;
      margin-bottom: 20px;
    }

    .year-selector {
      margin-bottom: 20px;
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .charts-container {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }

    .chart-wrapper {
      padding: 15px;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
    }

    .chart-wrapper h3 {
      margin-top: 0;
      margin-bottom: 15px;
      color: #333;
    }

    .table-container {
      margin: 30px 0;
    }

    .data-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
    }

    .data-table th,
    .data-table td {
      padding: 12px;
      text-align: left;
      border-bottom: 1px solid #e0e0e0;
    }

    .data-table th {
      background-color: #f5f5f5;
      font-weight: 600;
    }

    .data-table tbody tr:hover {
      background-color: #f9f9f9;
    }

    .data-table tfoot {
      background-color: #f5f5f5;
      font-weight: 600;
    }

    .details-container {
      margin-top: 30px;
    }

    .standort-section {
      margin-bottom: 30px;
      padding: 15px;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
    }

    .standort-section h4 {
      margin-top: 0;
      margin-bottom: 15px;
      color: #1976d2;
    }

    .no-data {
      text-align: center;
      padding: 40px;
      color: #666;
    }

    .no-data mat-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      color: #999;
    }
  `]
})
export class MitteilungenBettenCharts {
  @Input() data!: ResultsResponse | null;
  @Input() selectedYearInput?: number;
  
  selectedYear = signal<number>(new Date().getFullYear());
  
  constructor() {
    // Update selected year when input changes
    effect(() => {
      if (this.selectedYearInput) {
        this.selectedYear.set(this.selectedYearInput);
      }
    });
  }

  // Extract all Betten data
  bettenData = computed(() => {
    const uploads = this.data?.uploads || [];
    const bettenUploads = uploads.filter(u => u.schemaId === 'mitteilungen_betten');
    
    const allData: BettenData[] = [];
    bettenUploads.forEach(upload => {
      upload.files.forEach(file => {
        if (file.values) {
          file.values.forEach((value: any) => {
            allData.push({
              IK: value.IK || '',
              Standort: value.Standort || '',
              Station: value.Station || '',
              Jahr: value.Jahr || new Date().getFullYear(),
              Bettenanzahl: value.Bettenanzahl || 0
            });
          });
        }
      });
    });
    
    return allData;
  });

  // Check if we have data
  hasData = computed(() => this.bettenData().length > 0);

  // Get available years
  availableYears = computed(() => {
    const years = new Set(this.bettenData().map(d => d.Jahr));
    return Array.from(years).sort((a, b) => b - a);
  });

  // Filter data by selected year
  filteredData = computed(() => {
    return this.bettenData().filter(d => d.Jahr === this.selectedYear());
  });

  // Get unique standorte
  standorte = computed(() => {
    const standorte = new Set(this.filteredData().map(d => d.Standort));
    return Array.from(standorte).sort();
  });

  // Calculate summaries per Standort
  standortSummaries = computed(() => {
    const data = this.filteredData();
    const summaries: { standort: string; stationCount: number; totalBetten: number; avgBetten: string }[] = [];
    
    this.standorte().forEach(standort => {
      const standortData = data.filter(d => d.Standort === standort);
      const totalBetten = standortData.reduce((sum, d) => sum + d.Bettenanzahl, 0);
      const stationCount = standortData.length;
      const avgBetten = stationCount > 0 ? (totalBetten / stationCount).toFixed(1) : '0';
      
      summaries.push({
        standort,
        stationCount,
        totalBetten,
        avgBetten
      });
    });
    
    return summaries;
  });

  // Total statistics
  totalStations = computed(() => this.filteredData().length);
  totalBetten = computed(() => this.filteredData().reduce((sum, d) => sum + d.Bettenanzahl, 0));
  avgBettenPerStation = computed(() => {
    const total = this.totalBetten();
    const count = this.totalStations();
    return count > 0 ? (total / count).toFixed(1) : '0';
  });

  // Bar Chart Data
  barChartData = computed<ChartData<'bar'>>(() => {
    const summaries = this.standortSummaries();
    return {
      labels: summaries.map(s => s.standort),
      datasets: [{
        label: 'Anzahl Betten',
        data: summaries.map(s => s.totalBetten),
        backgroundColor: ['#1976d2', '#388e3c', '#d32f2f', '#f57c00'],
        borderColor: ['#1565c0', '#2e7d32', '#c62828', '#e65100'],
        borderWidth: 1
      }]
    };
  });

  barChartOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            return `${context.parsed.y} Betten`;
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: 'Anzahl Betten'
        }
      }
    }
  };

  // Pie Chart Data
  pieChartData = computed<ChartData<'pie'>>(() => {
    const summaries = this.standortSummaries();
    return {
      labels: summaries.map(s => s.standort),
      datasets: [{
        data: summaries.map(s => s.totalBetten),
        backgroundColor: ['#1976d2', '#388e3c', '#d32f2f', '#f57c00'],
        borderColor: '#fff',
        borderWidth: 2
      }]
    };
  });

  pieChartOptions: ChartOptions<'pie'> = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: {
        position: 'right'
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const label = context.label || '';
            const value = context.parsed || 0;
            const total = context.dataset.data.reduce((sum, val) => sum + (val as number), 0);
            const percentage = ((value / total) * 100).toFixed(1);
            return `${label}: ${value} Betten (${percentage}%)`;
          }
        }
      }
    }
  };

  onYearChange(event: any) {
    this.selectedYear.set(event.value);
  }

  getStationsByStandort(standort: string): BettenData[] {
    return this.filteredData()
      .filter(d => d.Standort === standort)
      .sort((a, b) => a.Station.localeCompare(b.Station));
  }
}

