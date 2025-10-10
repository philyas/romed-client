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
import { DataInfoPanel, DataInfoItem } from '../data-info-panel/data-info-panel';

interface SaldenZeitkontenData {
  Berufsgruppe: string;
  Fkt: string;
  KST: string;
  Beschreibung: string;
  Monat: number;
  Jahr: number;
  Summe: number;
}

@Component({
  selector: 'app-salden-zeitkonten-charts',
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
    <div class="salden-zeitkonten-charts">
      <div class="charts-header">
        <div class="header-top">
          <h3>
            <mat-icon>schedule</mat-icon>
            Salden Zeitkonten - Mehrarbeitszeit Pflegedienst
          </h3>
          <div class="selectors">
            <mat-form-field appearance="outline" class="selector">
              <mat-label>
                <mat-icon>domain</mat-icon>
                Kostenstelle
              </mat-label>
              <mat-select 
                [value]="selectedKST()" 
                (selectionChange)="onKSTChange($event.value)">
                <mat-option value="all">Alle Kostenstellen</mat-option>
                <mat-option *ngFor="let kst of availableKST()" [value]="kst.KST">
                  {{ kst.Beschreibung }}
                </mat-option>
              </mat-select>
            </mat-form-field>
            
            <mat-form-field appearance="outline" class="selector" *ngIf="availableYears().length > 1">
              <mat-label>
                <mat-icon>calendar_today</mat-icon>
                Jahr
              </mat-label>
              <mat-select 
                [value]="selectedYear()" 
                (selectionChange)="onYearChange($event.value)">
                <mat-option *ngFor="let year of availableYears()" [value]="year">
                  {{ year }}
                </mat-option>
              </mat-select>
            </mat-form-field>
          </div>
        </div>
        <p>Mehrarbeitszeit (Überstunden + Arbeitszeitkonto) in Stunden - {{ selectedBereich() }}</p>
      </div>

      <!-- Data Info Panel -->
      <app-data-info-panel 
        *ngIf="dataInfoItems().length > 0"
        [dataItems]="dataInfoItems()"
        [expandedByDefault]="false">
      </app-data-info-panel>

      <!-- Charts Container -->
      <div class="charts-container" *ngIf="hasData()">
        <div class="charts-grid">
          
          <!-- Monatsverlauf Chart -->
          <div class="flip-card" [class.flipped]="flippedCards()['monatsverlauf']" (click)="toggleFlip('monatsverlauf')">
            <div class="flip-card-inner">
              <div class="flip-card-front">
                <mat-card class="metric-card">
                  <mat-card-header class="metric-header monatsverlauf-header">
                    <mat-card-title>
                      <mat-icon>trending_up</mat-icon>
                      Monatsverlauf Mehrarbeitszeit
                      <span class="flip-hint-text">Klicken zum Umdrehen</span>
                      <mat-icon class="flip-icon">flip</mat-icon>
                    </mat-card-title>
                    <mat-card-subtitle>
                      {{ selectedKST() === 'all' ? 'Alle Kostenstellen' : selectedKSTName() }} - {{ selectedYear() }}
                    </mat-card-subtitle>
                  </mat-card-header>
                  <mat-card-content class="chart-content">
                    <canvas
                      baseChart
                      [data]="monatsverlaufChartData()"
                      [options]="lineChartOptions"
                      [type]="'line'">
                    </canvas>
                  </mat-card-content>
                </mat-card>
              </div>
              <div class="flip-card-back">
                <mat-card class="metric-card">
                  <mat-card-header>
                    <mat-card-title>
                      <mat-icon>info</mat-icon>
                      Informationen
                    </mat-card-title>
                  </mat-card-header>
                  <mat-card-content class="info-content">
                    <h4>Monatsverlauf</h4>
                    <p>Zeigt die Entwicklung der Mehrarbeitszeit über die Monate des Jahres {{ selectedYear() }}.</p>
                    <ul>
                      <li><strong>Y-Achse:</strong> Mehrarbeitszeit in Stunden</li>
                      <li><strong>X-Achse:</strong> Monate</li>
                      <li><strong>Datenquelle:</strong> Salden Zeitkonten {{ selectedBereich() }}</li>
                    </ul>
                    <div class="stats">
                      <div class="stat-item">
                        <span class="stat-label">Durchschnitt:</span>
                        <span class="stat-value">{{ monatsverlaufStats().average.toFixed(2) }} Std</span>
                      </div>
                      <div class="stat-item">
                        <span class="stat-label">Maximum:</span>
                        <span class="stat-value">{{ monatsverlaufStats().max.toFixed(2) }} Std</span>
                      </div>
                      <div class="stat-item">
                        <span class="stat-label">Minimum:</span>
                        <span class="stat-value">{{ monatsverlaufStats().min.toFixed(2) }} Std</span>
                      </div>
                    </div>
                  </mat-card-content>
                </mat-card>
              </div>
            </div>
          </div>

          <!-- Kostenstellenvergleich Chart (nur wenn "Alle" ausgewählt) -->
          <div class="flip-card" 
               *ngIf="selectedKST() === 'all'" 
               [class.flipped]="flippedCards()['vergleich']" 
               (click)="toggleFlip('vergleich')">
            <div class="flip-card-inner">
              <div class="flip-card-front">
                <mat-card class="metric-card">
                  <mat-card-header class="metric-header vergleich-header">
                    <mat-card-title>
                      <mat-icon>compare_arrows</mat-icon>
                      Kostenstellenvergleich
                      <span class="flip-hint-text">Klicken zum Umdrehen</span>
                      <mat-icon class="flip-icon">flip</mat-icon>
                    </mat-card-title>
                    <mat-card-subtitle>
                      Top 10 Kostenstellen - Gesamt {{ selectedYear() }}
                    </mat-card-subtitle>
                  </mat-card-header>
                  <mat-card-content class="chart-content">
                    <canvas
                      baseChart
                      [data]="vergleichChartData()"
                      [options]="barChartOptions"
                      [type]="'bar'">
                    </canvas>
                  </mat-card-content>
                </mat-card>
              </div>
              <div class="flip-card-back">
                <mat-card class="metric-card">
                  <mat-card-header>
                    <mat-card-title>
                      <mat-icon>info</mat-icon>
                      Informationen
                    </mat-card-title>
                  </mat-card-header>
                  <mat-card-content class="info-content">
                    <h4>Kostenstellenvergleich</h4>
                    <p>Vergleicht die Mehrarbeitszeit über alle Kostenstellen des Pflegedienstes.</p>
                    <ul>
                      <li><strong>Top 10:</strong> Kostenstellen mit höchster Mehrarbeitszeit</li>
                      <li><strong>Summe:</strong> Gesamte Mehrarbeitszeit über alle Monate</li>
                    </ul>
                    <div class="stats">
                      <div class="stat-item">
                        <span class="stat-label">Gesamtsumme:</span>
                        <span class="stat-value">{{ vergleichStats().total.toFixed(2) }} Std</span>
                      </div>
                      <div class="stat-item">
                        <span class="stat-label">Höchste KST:</span>
                        <span class="stat-value">{{ vergleichStats().maxKST }}</span>
                      </div>
                    </div>
                  </mat-card-content>
                </mat-card>
              </div>
            </div>
          </div>

        </div>
      </div>

      <!-- No Data Message -->
      <div class="no-data" *ngIf="!hasData()">
        <mat-icon>info</mat-icon>
        <p>Keine Daten für die ausgewählten Filter verfügbar.</p>
      </div>
    </div>
  `,
  styles: [`
    .salden-zeitkonten-charts {
      padding: 24px;
    }

    .charts-header {
      margin-bottom: 24px;
    }

    .header-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
      flex-wrap: wrap;
      gap: 16px;
    }

    .header-top h3 {
      margin: 0;
      font-size: 24px;
      font-weight: 500;
      color: #1976d2;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .header-top h3 mat-icon {
      font-size: 28px;
      width: 28px;
      height: 28px;
    }

    .charts-header p {
      margin: 0;
      color: #666;
      font-size: 14px;
    }

    .selectors {
      display: flex;
      gap: 16px;
      flex-wrap: wrap;
    }

    .selector {
      min-width: 250px;
    }

    .selector mat-label {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .charts-container {
      margin-top: 24px;
    }

    .charts-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(600px, 1fr));
      gap: 24px;
    }

    @media (max-width: 1400px) {
      .charts-grid {
        grid-template-columns: 1fr;
      }
    }

    .flip-card {
      perspective: 1000px;
      min-height: 450px;
      cursor: pointer;
      transition: transform 0.2s ease;
    }

    .flip-card:hover {
      transform: translateY(-4px);
    }

    .flip-card-inner {
      position: relative;
      width: 100%;
      height: 100%;
      min-height: 450px;
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

    .metric-card {
      height: 100%;
      display: flex;
      flex-direction: column;
    }

    .metric-header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 16px;
      border-radius: 4px 4px 0 0;
    }

    .monatsverlauf-header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    }

    .vergleich-header {
      background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
    }

    .metric-header mat-card-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 18px;
      margin: 0;
      color: white;
    }

    .metric-header mat-card-subtitle {
      color: rgba(255, 255, 255, 0.9);
      margin: 4px 0 0 0;
    }

    .flip-hint-text {
      margin-left: auto;
      font-size: 12px;
      opacity: 0.8;
    }

    .flip-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
    }

    .chart-content {
      flex: 1;
      padding: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .chart-content canvas {
      max-height: 350px;
    }

    .info-content {
      padding: 24px;
    }

    .info-content h4 {
      margin: 0 0 12px 0;
      color: #1976d2;
    }

    .info-content p {
      margin: 0 0 16px 0;
      color: #666;
      line-height: 1.6;
    }

    .info-content ul {
      margin: 0 0 24px 0;
      padding-left: 20px;
      color: #666;
      line-height: 1.8;
    }

    .stats {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 16px;
      background: #f5f5f5;
      border-radius: 8px;
    }

    .stat-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .stat-label {
      font-weight: 500;
      color: #666;
    }

    .stat-value {
      font-size: 18px;
      font-weight: 600;
      color: #1976d2;
    }

    .no-data {
      text-align: center;
      padding: 48px 24px;
      color: #999;
    }

    .no-data mat-icon {
      font-size: 64px;
      width: 64px;
      height: 64px;
      color: #ddd;
      margin-bottom: 16px;
    }

    .no-data p {
      margin: 0;
      font-size: 16px;
    }
  `]
})
export class SaldenZeitkontenCharts implements OnInit, OnChanges {
  @Input() uploads: UploadRecord[] = [];

  // Signals
  selectedKST = signal<string>('all');
  selectedYear = signal<number>(new Date().getFullYear());
  flippedCards = signal<Record<string, boolean>>({});

  // Computed data
  saldenData = computed(() => {
    const saldenUploads = this.uploads.filter(u => u.schemaId === 'salden_zeitkonten');
    if (saldenUploads.length === 0) return [];
    
    const allData: SaldenZeitkontenData[] = [];
    saldenUploads.forEach(upload => {
      upload.files.forEach(file => {
        if (file.values && Array.isArray(file.values)) {
          allData.push(...file.values as unknown as SaldenZeitkontenData[]);
        }
      });
    });
    
    return allData;
  });

  selectedBereich = computed(() => {
    const data = this.saldenData();
    if (data.length === 0) return '';
    
    // Extract Bereich from first upload filename
    const saldenUploads = this.uploads.filter(u => u.schemaId === 'salden_zeitkonten');
    if (saldenUploads.length > 0 && saldenUploads[0].files.length > 0) {
      const filename = saldenUploads[0].files[0].originalName || '';
      const match = filename.match(/AIB-PD|PRI-PD|ROS-PD|WAS-PD/);
      return match ? match[0] : '';
    }
    
    return '';
  });

  availableKST = computed(() => {
    const data = this.saldenData();
    const kstMap = new Map<string, { KST: string; Beschreibung: string }>();
    
    data.forEach(row => {
      if (!kstMap.has(row.KST)) {
        kstMap.set(row.KST, {
          KST: row.KST,
          Beschreibung: row.Beschreibung
        });
      }
    });
    
    return Array.from(kstMap.values()).sort((a, b) => a.KST.localeCompare(b.KST));
  });

  availableYears = computed(() => {
    const data = this.saldenData();
    const years = new Set(data.map(row => row.Jahr));
    return Array.from(years).sort((a, b) => b - a);
  });

  selectedKSTName = computed(() => {
    const kst = this.availableKST().find(k => k.KST === this.selectedKST());
    return kst ? kst.Beschreibung : '';
  });

  filteredData = computed(() => {
    const data = this.saldenData();
    const kst = this.selectedKST();
    const year = this.selectedYear();
    
    let filtered = data.filter(row => row.Jahr === year);
    
    if (kst !== 'all') {
      filtered = filtered.filter(row => row.KST === kst);
    }
    
    return filtered;
  });

  hasData = computed(() => this.filteredData().length > 0);

  // Data Info Items
  dataInfoItems = computed(() => {
    const saldenUploads = this.uploads.filter(u => u.schemaId === 'salden_zeitkonten');
    if (saldenUploads.length === 0) return [];

    const items: DataInfoItem[] = [];

    saldenUploads.forEach(upload => {
      upload.files.forEach(file => {
        const recordCount = Array.isArray(file.values) ? file.values.length : 0;
        
        // Extract month and year from filename or data
        let dataMonth: string | undefined;
        let dataYear: number | undefined;
        const filename = file.originalName || '';
        const monthMatch = filename.match(/(\d{2})-(\d{4})/);
        if (monthMatch) {
          dataMonth = monthMatch[1];
          dataYear = parseInt(monthMatch[2]);
        }

        items.push({
          fileName: file.originalName || 'Unbekannt',
          uploadDate: upload.createdAt,
          dataMonth,
          dataYear,
          recordCount,
          status: file.error ? 'error' : 'success',
          rawData: file.values as any[],
          schemaColumns: undefined
        });
      });
    });

    return items;
  });

  // Chart Options
  lineChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: {
        display: true,
        position: 'top'
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            return `${context.dataset.label}: ${context.parsed.y.toFixed(2)} Std`;
          }
        }
      }
    },
    scales: {
      x: {
        grid: {
          display: false
        }
      },
      y: {
        beginAtZero: true,
        ticks: {
          callback: (value) => `${value} Std`
        }
      }
    }
  };

  barChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: true,
    indexAxis: 'y',
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            return `${context.parsed.x.toFixed(2)} Std`;
          }
        }
      }
    },
    scales: {
      x: {
        beginAtZero: true,
        ticks: {
          callback: (value) => `${value} Std`
        }
      },
      y: {
        grid: {
          display: false
        }
      }
    }
  };

  // Monatsverlauf Chart Data
  monatsverlaufChartData = computed<ChartData<'line'>>(() => {
    const data = this.filteredData();
    const monthNames = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
    
    // Group by month
    const monthlyData = new Map<number, number>();
    data.forEach(row => {
      const current = monthlyData.get(row.Monat) || 0;
      monthlyData.set(row.Monat, current + row.Summe);
    });
    
    // Sort by month
    const sortedMonths = Array.from(monthlyData.keys()).sort((a, b) => a - b);
    const labels = sortedMonths.map(m => monthNames[m - 1]);
    const values = sortedMonths.map(m => monthlyData.get(m) || 0);
    
    return {
      labels,
      datasets: [{
        label: 'Mehrarbeitszeit (Stunden)',
        data: values,
        borderColor: '#667eea',
        backgroundColor: 'rgba(102, 126, 234, 0.1)',
        borderWidth: 2,
        fill: true,
        tension: 0.4
      }]
    };
  });

  monatsverlaufStats = computed(() => {
    const data = this.monatsverlaufChartData();
    const values = data.datasets[0].data as number[];
    
    return {
      average: values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0,
      max: values.length > 0 ? Math.max(...values) : 0,
      min: values.length > 0 ? Math.min(...values) : 0
    };
  });

  // Vergleich Chart Data
  vergleichChartData = computed<ChartData<'bar'>>(() => {
    const data = this.filteredData();
    
    // Group by KST
    const kstData = new Map<string, { beschreibung: string; summe: number }>();
    data.forEach(row => {
      const current = kstData.get(row.KST) || { beschreibung: row.Beschreibung, summe: 0 };
      current.summe += row.Summe;
      kstData.set(row.KST, current);
    });
    
    // Sort by summe and take top 10
    const sorted = Array.from(kstData.entries())
      .sort((a, b) => b[1].summe - a[1].summe)
      .slice(0, 10);
    
    const labels = sorted.map(([kst, data]) => data.beschreibung);
    const values = sorted.map(([kst, data]) => data.summe);
    
    return {
      labels,
      datasets: [{
        label: 'Mehrarbeitszeit (Stunden)',
        data: values,
        backgroundColor: 'rgba(245, 87, 108, 0.6)',
        borderColor: '#f5576c',
        borderWidth: 1
      }]
    };
  });

  vergleichStats = computed(() => {
    const data = this.vergleichChartData();
    const values = data.datasets[0].data as number[];
    const labels = data.labels as string[];
    
    const total = values.reduce((a, b) => a + b, 0);
    const maxIndex = values.indexOf(Math.max(...values));
    
    return {
      total,
      maxKST: labels[maxIndex] || '-'
    };
  });

  ngOnInit() {
    // Set initial year if available
    const years = this.availableYears();
    if (years.length > 0) {
      this.selectedYear.set(years[0]);
    }
  }

  ngOnChanges() {
    // Reset selection if not available
    const years = this.availableYears();
    if (years.length > 0 && !years.includes(this.selectedYear())) {
      this.selectedYear.set(years[0]);
    }
  }

  onKSTChange(kst: string) {
    this.selectedKST.set(kst);
  }

  onYearChange(year: number) {
    this.selectedYear.set(year);
  }

  toggleFlip(cardName: string) {
    const current = this.flippedCards();
    this.flippedCards.set({
      ...current,
      [cardName]: !current[cardName]
    });
  }
}

