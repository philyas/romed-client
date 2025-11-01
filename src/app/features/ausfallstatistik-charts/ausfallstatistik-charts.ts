import { Component, Input, OnInit, OnChanges, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartData, ChartType, registerables } from 'chart.js';
import Chart from 'chart.js/auto';
import { UploadRecord } from '../../core/api';
import { DataInfoPanel, DataInfoItem } from '../data-info-panel/data-info-panel';

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

@Component({
  selector: 'app-ausfallstatistik-charts',
  imports: [
    CommonModule,
    MatCardModule,
    MatChipsModule,
    MatIconModule,
    MatSelectModule,
    MatFormFieldModule,
    BaseChartDirective,
    DataInfoPanel
  ],
  template: `
    <div class="ausfallstatistik-charts">
      <div class="charts-header">
        <div class="header-top">
          <h3>
            <mat-icon>person_off</mat-icon>
            Ausfallstatistik - {{ selectedYearSignal() }}
          </h3>
          <mat-form-field appearance="outline" class="year-selector">
            <mat-label>
              <mat-icon>calendar_today</mat-icon>
              Jahr
            </mat-label>
            <mat-select 
              [value]="selectedYearSignal()" 
              (selectionChange)="onYearChange($event.value)"
              [disabled]="availableYears().length === 0">
              <mat-option 
                *ngFor="let year of availableYears()" 
                [value]="year">
                {{ year }}
              </mat-option>
            </mat-select>
          </mat-form-field>
        </div>
        <p>Soll/Ist-Vergleich nach Kostenstellen mit Lohnartendaten (Krankenstand, Urlaub, Freizeitausgleich)</p>
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
                <mat-icon>timeline</mat-icon>
                Soll/Ist-Vergleich nach Monaten
              </mat-card-title>
              <mat-card-subtitle>Arbeitszeit: Soll vs. Ist (in Stunden)</mat-card-subtitle>
            </mat-card-header>
            <mat-card-content class="chart-content">
              <div class="chart-container">
                <canvas baseChart
                  [data]="sollIstChartData()"
                  [options]="sollIstChartOptions"
                  [type]="'line'">
                </canvas>
              </div>
              <div class="chart-summary">
                <mat-chip-set>
                  <mat-chip>
                    Soll Gesamt: {{ totalSoll() | number:'1.0-0' }}h
                  </mat-chip>
                  <mat-chip>
                    Ist Gesamt: {{ totalIst() | number:'1.0-0' }}h
                  </mat-chip>
                  <mat-chip [class.warning]="erfuellungsgrad() < 95" [class.danger]="erfuellungsgrad() < 90">
                    Erfüllungsgrad: {{ erfuellungsgrad() | number:'1.2-2' }}%
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
              <mat-card-subtitle>KR (Krankenstand), FT (Urlaub/Feiertage), FB (Freizeitausgleich)</mat-card-subtitle>
            </mat-card-header>
            <mat-card-content class="chart-content">
              <div class="chart-container">
                <canvas baseChart
                  [data]="lohnartenChartData()"
                  [options]="lohnartenChartOptions"
                  [type]="'bar'">
                </canvas>
              </div>
              <div class="chart-legend">
                <mat-chip-set>
                  <mat-chip class="la1-chip">
                    <mat-icon>sick</mat-icon>
                    KR (Krankenstand): {{ totalLA1() }}
                  </mat-chip>
                  <mat-chip class="la2-chip">
                    <mat-icon>beach_access</mat-icon>
                    FT (Urlaub/Feiertage): {{ totalLA2() }}
                  </mat-chip>
                  <mat-chip class="la3-chip">
                    <mat-icon>free_breakfast</mat-icon>
                    FB (Freizeitausgleich): {{ totalLA3() }}
                  </mat-chip>
                </mat-chip-set>
              </div>
            </mat-card-content>
          </mat-card>

          <!-- Kostenstellen Top 10 Chart -->
          <mat-card class="chart-card full-width">
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
  @Input() set selectedYear(value: number) {
    this._selectedYear = value;
    this.selectedYearSignal.set(value);
  }
  get selectedYear() {
    return this._selectedYear;
  }

  selectedYearSignal = signal(this.selectedYear);
  
  allData = signal<AusfallstatistikData[]>([]);
  
  availableYears = computed(() => {
    const years = new Set<number>();
    this.allData().forEach(row => {
      if (row.Jahr) {
        years.add(row.Jahr);
      }
    });
    return Array.from(years).sort((a, b) => b - a); // Neueste zuerst
  });

  // Chart options
  sollIstChartOptions: ChartConfiguration['options'] = {
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
            return `${context.dataset.label}: ${context.parsed.y.toFixed(2)} Stunden`;
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: 'Stunden'
        }
      }
    }
  };

  lohnartenChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'top'
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: 'Einheiten'
        }
      }
    }
  };

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
          text: 'Ausfall (Einheiten)'
        }
      }
    },
    indexAxis: 'y'
  };

  ngOnInit() {
    Chart.register(...registerables);
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
  
  // Filter data by selected year for charts
  private getFilteredData(): AusfallstatistikData[] {
    return this.allData().filter(row => row.Jahr === this.selectedYearSignal());
  }

  // Computed values
  sollIstChartData = computed(() => {
    const data = this.getFilteredData();
    const monthlyData = new Map<number, { soll: number; ist: number }>();

    data.forEach(row => {
      if (row.Monat) {
        const month = row.Monat;
        if (!monthlyData.has(month)) {
          monthlyData.set(month, { soll: 0, ist: 0 });
        }
        const monthData = monthlyData.get(month)!;
        monthData.soll += row.Soll_Stunden + (row.Soll_Minuten / 60);
        monthData.ist += row.Ist_Stunden + (row.Ist_Minuten / 60);
      }
    });

    const months = Array.from(monthlyData.keys()).sort((a, b) => a - b);
    const monthNames = ['', 'Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

    return {
      labels: months.map(m => monthNames[m]),
      datasets: [
        {
          label: 'Soll (Stunden)',
          data: months.map(m => monthlyData.get(m)!.soll),
          borderColor: 'rgb(75, 192, 192)',
          backgroundColor: 'rgba(75, 192, 192, 0.2)',
          tension: 0.1
        },
        {
          label: 'Ist (Stunden)',
          data: months.map(m => monthlyData.get(m)!.ist),
          borderColor: 'rgb(255, 99, 132)',
          backgroundColor: 'rgba(255, 99, 132, 0.2)',
          tension: 0.1
        }
      ]
    };
  });

  lohnartenChartData = computed(() => {
    const data = this.getFilteredData();
    const monthlyData = new Map<number, { la1: number; la2: number; la3: number }>();

    data.forEach(row => {
      if (row.Monat) {
        const month = row.Monat;
        if (!monthlyData.has(month)) {
          monthlyData.set(month, { la1: 0, la2: 0, la3: 0 });
        }
        const monthData = monthlyData.get(month)!;
        monthData.la1 += row.LA1_KR_Wert || 0;
        monthData.la2 += row.LA2_FT_Wert || 0;
        monthData.la3 += row.LA3_FB_Wert || 0;
      }
    });

    const months = Array.from(monthlyData.keys()).sort((a, b) => a - b);
    const monthNames = ['', 'Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

    return {
      labels: months.map(m => monthNames[m]),
      datasets: [
        {
          label: 'KR (Krankenstand)',
          data: months.map(m => monthlyData.get(m)!.la1),
          backgroundColor: 'rgba(255, 99, 132, 0.6)'
        },
        {
          label: 'FT (Urlaub/Feiertage)',
          data: months.map(m => monthlyData.get(m)!.la2),
          backgroundColor: 'rgba(54, 162, 235, 0.6)'
        },
        {
          label: 'FB (Freizeitausgleich)',
          data: months.map(m => monthlyData.get(m)!.la3),
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
      labels: sorted.map(([kst]) => kst),
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
}
