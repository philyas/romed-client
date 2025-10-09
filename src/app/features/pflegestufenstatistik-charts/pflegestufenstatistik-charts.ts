import { Component, Input, OnInit, OnChanges, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartData } from 'chart.js';
import { UploadRecord } from '../../core/api';

interface PflegestufenData {
  Station: string;
  'T.-Patienten': number;
  'Einstufungen absolut': number;
  'Pfl.bedarf Minuten': number;
  Standort: string;
  Monat: number;
  Jahr: number;
}

@Component({
  selector: 'app-pflegestufenstatistik-charts',
  imports: [
    CommonModule,
    MatCardModule,
    MatChipsModule,
    MatIconModule,
    MatSelectModule,
    MatFormFieldModule,
    BaseChartDirective
  ],
  template: `
    <div class="pflegestufenstatistik-charts">
      <div class="charts-header">
        <div class="header-top">
          <h3>
            <mat-icon>medical_services</mat-icon>
            Pflegestufen PPR - {{ selectedStandort() }} ({{ selectedMonth() }}/{{ selectedYear() }})
          </h3>
          <div class="selectors">
            <mat-form-field appearance="outline" class="selector">
              <mat-label>
                <mat-icon>location_on</mat-icon>
                Standort
              </mat-label>
              <mat-select 
                [value]="selectedStandort()" 
                (selectionChange)="onStandortChange($event.value)">
                <mat-option *ngFor="let standort of availableStandorte()" [value]="standort">
                  {{ standort }}
                </mat-option>
              </mat-select>
            </mat-form-field>
            
            <mat-form-field appearance="outline" class="selector">
              <mat-label>
                <mat-icon>calendar_month</mat-icon>
                Monat
              </mat-label>
              <mat-select 
                [value]="selectedMonth()" 
                (selectionChange)="onMonthChange($event.value)">
                <mat-option *ngFor="let month of availableMonths()" [value]="month">
                  {{ getMonthName(month) }}
                </mat-option>
              </mat-select>
            </mat-form-field>
          </div>
        </div>
        <p>PPR-Pflegestufen: Pflegebedarf in Minuten pro Station</p>
      </div>

      <!-- Charts Container -->
      <div class="charts-container">
        <div class="charts-grid">
          <!-- Pflegebedarf Chart -->
          <mat-card class="metric-card">
            <mat-card-header class="metric-header pflegebedarf-header">
              <mat-card-title>
                <mat-icon>timer</mat-icon>
                Pflegebedarf in Minuten
              </mat-card-title>
              <mat-card-subtitle>Pro Station - {{ selectedStandort() }}</mat-card-subtitle>
            </mat-card-header>
            <mat-card-content class="chart-content">
              <div class="chart-container">
                <canvas baseChart
                  [data]="getPflegebedarfChartData()"
                  [options]="getPflegebedarfChartOptions()"
                  [type]="'bar'">
                </canvas>
              </div>
              <div class="chart-info">
                <mat-chip-set>
                  <mat-chip class="info-chip">
                    Gesamt: {{ getTotalPflegebedarf() | number:'1.0-0' }} Min
                  </mat-chip>
                  <mat-chip class="info-chip">
                    Stationen: {{ getFilteredData().length }}
                  </mat-chip>
                </mat-chip-set>
              </div>
            </mat-card-content>
          </mat-card>

          <!-- Einstufungen Chart -->
          <mat-card class="metric-card">
            <mat-card-header class="metric-header einstufungen-header">
              <mat-card-title>
                <mat-icon>assessment</mat-icon>
                Einstufungen absolut
              </mat-card-title>
              <mat-card-subtitle>Pro Station - {{ selectedStandort() }}</mat-card-subtitle>
            </mat-card-header>
            <mat-card-content class="chart-content">
              <div class="chart-container">
                <canvas baseChart
                  [data]="getEinstufungenChartData()"
                  [options]="getEinstufungenChartOptions()"
                  [type]="'bar'">
                </canvas>
              </div>
              <div class="chart-info">
                <mat-chip-set>
                  <mat-chip class="info-chip">
                    Gesamt: {{ getTotalEinstufungen() | number:'1.0-0' }}
                  </mat-chip>
                  <mat-chip class="info-chip">
                    Ø pro Station: {{ getAverageEinstufungen() | number:'1.0-0' }}
                  </mat-chip>
                </mat-chip-set>
              </div>
            </mat-card-content>
          </mat-card>

        </div>
      </div>
    </div>
  `,
  styleUrl: './pflegestufenstatistik-charts.scss'
})
export class PflegestufenstatistikCharts implements OnInit, OnChanges {
  @Input() uploads: UploadRecord[] = [];
  
  selectedStandort = signal<string>('BAB');
  selectedMonth = signal<number>(new Date().getMonth() + 1);
  selectedYear = signal<number>(new Date().getFullYear());
  
  pflegestufenData = signal<PflegestufenData[]>([]);
  
  availableStandorte = computed(() => {
    const standorte = new Set<string>();
    this.pflegestufenData().forEach(d => standorte.add(d.Standort));
    return Array.from(standorte).sort();
  });
  
  availableMonths = computed(() => {
    const months = new Set<number>();
    this.pflegestufenData()
      .filter(d => d.Standort === this.selectedStandort())
      .forEach(d => months.add(d.Monat));
    return Array.from(months).sort((a, b) => a - b);
  });

  ngOnInit() {
    this.loadData();
  }

  ngOnChanges() {
    this.loadData();
  }

  private loadData() {
    const pflegeUploads = this.uploads.filter(u => u.schemaId === 'pflegestufenstatistik');
    if (pflegeUploads.length === 0) {
      this.pflegestufenData.set([]);
      return;
    }

    const allData: PflegestufenData[] = [];
    pflegeUploads.forEach(upload => {
      upload.files.forEach(file => {
        if (file.values && Array.isArray(file.values)) {
          allData.push(...file.values as unknown as PflegestufenData[]);
        }
      });
    });

    this.pflegestufenData.set(allData);
    
    // Set default selections
    if (this.availableStandorte().length > 0 && !this.availableStandorte().includes(this.selectedStandort())) {
      this.selectedStandort.set(this.availableStandorte()[0]);
    }
    
    if (this.availableMonths().length > 0 && !this.availableMonths().includes(this.selectedMonth())) {
      this.selectedMonth.set(this.availableMonths()[0]);
    }
  }

  getFilteredData(): PflegestufenData[] {
    return this.pflegestufenData().filter(d => 
      d.Standort === this.selectedStandort() && 
      d.Monat === this.selectedMonth()
    );
  }

  onStandortChange(standort: string) {
    this.selectedStandort.set(standort);
    // Update month if current month not available for new standort
    if (this.availableMonths().length > 0 && !this.availableMonths().includes(this.selectedMonth())) {
      this.selectedMonth.set(this.availableMonths()[0]);
    }
  }

  onMonthChange(month: number) {
    this.selectedMonth.set(month);
  }

  getMonthName(month: number): string {
    const months = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 
                   'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
    return months[month - 1] || `Monat ${month}`;
  }

  // Chart Data
  getPflegebedarfChartData(): ChartData<'bar'> {
    const data = this.getFilteredData().sort((a, b) => 
      b['Pfl.bedarf Minuten'] - a['Pfl.bedarf Minuten']
    );
    
    return {
      labels: data.map(d => d.Station),
      datasets: [{
        label: 'Pflegebedarf (Minuten)',
        data: data.map(d => d['Pfl.bedarf Minuten']),
        backgroundColor: 'rgba(33, 150, 243, 0.7)',
        borderColor: 'rgba(33, 150, 243, 1)',
        borderWidth: 2
      }]
    };
  }

  getEinstufungenChartData(): ChartData<'bar'> {
    const data = this.getFilteredData().sort((a, b) => 
      b['Einstufungen absolut'] - a['Einstufungen absolut']
    );
    
    return {
      labels: data.map(d => d.Station),
      datasets: [{
        label: 'Einstufungen absolut',
        data: data.map(d => d['Einstufungen absolut']),
        backgroundColor: 'rgba(76, 175, 80, 0.7)',
        borderColor: 'rgba(76, 175, 80, 1)',
        borderWidth: 2
      }]
    };
  }

  // Chart Options
  getPflegebedarfChartOptions(): ChartConfiguration['options'] {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        title: {
          display: false
        },
        tooltip: {
          callbacks: {
            label: (context) => {
              return `Pflegebedarf: ${context.parsed.y.toLocaleString('de-DE')} Min`;
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'Minuten'
          }
        }
      }
    };
  }

  getEinstufungenChartOptions(): ChartConfiguration['options'] {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        title: {
          display: false
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'Anzahl'
          }
        }
      }
    };
  }

  // Totals
  getTotalPflegebedarf(): number {
    return this.getFilteredData().reduce((sum, d) => sum + d['Pfl.bedarf Minuten'], 0);
  }

  getTotalEinstufungen(): number {
    return this.getFilteredData().reduce((sum, d) => sum + d['Einstufungen absolut'], 0);
  }

  getAverageEinstufungen(): number {
    const data = this.getFilteredData();
    return data.length > 0 ? this.getTotalEinstufungen() / data.length : 0;
  }
}

