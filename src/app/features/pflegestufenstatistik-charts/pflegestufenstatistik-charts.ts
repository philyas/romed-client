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

interface PflegestufenData {
  Station: string;
  Kategorie: string;
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
    BaseChartDirective,
    DataInfoPanel
  ],
  template: `
    <div class="pflegestufenstatistik-charts">
      <div class="charts-header">
        <div class="header-top">
          <h3>
            <mat-icon>medical_services</mat-icon>
            Pflegestufen PPR - {{ selectedStandort() }} ({{ selectedYear() }})
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
                <mat-icon>business</mat-icon>
                Station
              </mat-label>
              <mat-select 
                [value]="selectedStation()" 
                (selectionChange)="onStationChange($event.value)">
                <mat-option *ngFor="let station of availableStations()" [value]="station">
                  {{ station }}
                </mat-option>
              </mat-select>
            </mat-form-field>
          </div>
        </div>
        <p>PPR-Pflegestufen: Pflegebedarf und Altersgruppen im Jahresverlauf</p>
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
          <!-- Altersgruppen Vergleich Chart -->
          <div class="flip-card full-width" [class.flipped]="flippedCards()['altersgruppen']" (click)="toggleFlip('altersgruppen')">
            <div class="flip-card-inner">
              <div class="flip-card-front">
                <mat-card class="metric-card">
                  <mat-card-header class="metric-header altersgruppen-header">
                    <mat-card-title>
                      <mat-icon>bar_chart</mat-icon>
                      Vergleich Altersgruppen (A1-A4 + ohne Einstufung)
                      <span class="flip-hint-text">Klicken zum Umdrehen</span>
                      <mat-icon class="flip-icon">flip</mat-icon>
                    </mat-card-title>
                    <mat-card-subtitle>{{ selectedStation() === 'Alle' ? 'Alle Stationen' : selectedStation() }} - {{ selectedStandort() }} (Alle Monate)</mat-card-subtitle>
                  </mat-card-header>
                  <mat-card-content class="chart-content">
                    <div class="chart-container">
                      <canvas baseChart
                        [data]="getAltersgruppenChartData()"
                        [options]="getAltersgruppenChartOptions()"
                        [type]="'bar'">
                      </canvas>
                    </div>
                    <div class="chart-info">
                      <mat-chip-set>
                        <mat-chip class="info-chip a1-chip">A1: {{ getAltersgruppeTotal('A1') }}</mat-chip>
                        <mat-chip class="info-chip a2-chip">A2: {{ getAltersgruppeTotal('A2') }}</mat-chip>
                        <mat-chip class="info-chip a3-chip">A3: {{ getAltersgruppeTotal('A3') }}</mat-chip>
                        <mat-chip class="info-chip a4-chip">A4: {{ getAltersgruppeTotal('A4') }}</mat-chip>
                        <mat-chip class="info-chip ohne-chip">ohne: {{ getAltersgruppeTotal('ohne') }}</mat-chip>
                      </mat-chip-set>
                    </div>
                  </mat-card-content>
                </mat-card>
              </div>
              <div class="flip-card-back">
                <mat-card class="metric-card">
                  <mat-card-header class="metric-header altersgruppen-header">
                    <mat-card-title>
                      Altersgruppen Details
                      <mat-icon class="flip-icon">flip</mat-icon>
                    </mat-card-title>
                  </mat-card-header>
                  <mat-card-content class="data-content">
                    <div class="data-table-container">
                      <table class="data-table">
                        <thead>
                          <tr>
                            <th>Altersgruppe</th>
                            <th>Einstufungen absolut</th>
                            <th>Anteil</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td class="station-cell">A1</td>
                            <td class="number-cell">{{ getAltersgruppeTotal('A1') }}</td>
                            <td class="number-cell">{{ getAltersgruppePercentage('A1') }}%</td>
                          </tr>
                          <tr>
                            <td class="station-cell">A2</td>
                            <td class="number-cell">{{ getAltersgruppeTotal('A2') }}</td>
                            <td class="number-cell">{{ getAltersgruppePercentage('A2') }}%</td>
                          </tr>
                          <tr>
                            <td class="station-cell">A3</td>
                            <td class="number-cell">{{ getAltersgruppeTotal('A3') }}</td>
                            <td class="number-cell">{{ getAltersgruppePercentage('A3') }}%</td>
                          </tr>
                          <tr>
                            <td class="station-cell">A4</td>
                            <td class="number-cell">{{ getAltersgruppeTotal('A4') }}</td>
                            <td class="number-cell">{{ getAltersgruppePercentage('A4') }}%</td>
                          </tr>
                          <tr>
                            <td class="station-cell">ohne Einstufung</td>
                            <td class="number-cell">{{ getAltersgruppeTotal('ohne') }}</td>
                            <td class="number-cell">{{ getAltersgruppePercentage('ohne') }}%</td>
                          </tr>
                          <tr class="total-row">
                            <td><strong>Gesamt</strong></td>
                            <td class="number-cell"><strong>{{ getTotalEinstufungenForAltersgruppen() }}</strong></td>
                            <td class="number-cell"><strong>100%</strong></td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </mat-card-content>
                </mat-card>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  `,
  styleUrl: './pflegestufenstatistik-charts.scss'
})
export class PflegestufenstatistikCharts implements OnInit, OnChanges {
  @Input() uploads: UploadRecord[] = [];
  
  selectedStandort = signal<string>('BAB');
  selectedStation = signal<string>('Alle');
  selectedYear = signal<number>(new Date().getFullYear());
  
  pflegestufenData = signal<PflegestufenData[]>([]);
  flippedCards = signal<{ [key: string]: boolean }>({});
  dataInfoItems = signal<DataInfoItem[]>([]);
  
  availableStandorte = computed(() => {
    const standorte = new Set<string>();
    this.pflegestufenData().forEach(d => standorte.add(d.Standort));
    return Array.from(standorte).sort();
  });
  
  availableStations = computed(() => {
    const stations = new Set<string>();
    stations.add('Alle'); // Add "All stations" option
    this.pflegestufenData()
      .filter(d => d.Standort === this.selectedStandort() && d.Kategorie === 'Gesamt')
      .forEach(d => stations.add(d.Station));
    return Array.from(stations).sort();
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
      this.dataInfoItems.set([]);
      return;
    }

    // Prepare data info items
    this.prepareDataInfoItems(pflegeUploads);

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
  }

  getFilteredData(): PflegestufenData[] {
    const filtered = this.pflegestufenData().filter(d => 
      d.Standort === this.selectedStandort() && 
      d.Kategorie === 'Gesamt' // Only show "Gesamt" rows for overview charts
    );

    // Apply station filter if not "Alle"
    if (this.selectedStation() !== 'Alle') {
      return filtered.filter(d => d.Station === this.selectedStation());
    }
    return filtered;
  }

  getDetailedData(): PflegestufenData[] {
    const filtered = this.pflegestufenData().filter(d => 
      d.Standort === this.selectedStandort() && 
      d.Kategorie !== 'Gesamt' // Exclude "Gesamt" rows for detailed view
    );

    // Apply station filter if not "Alle"
    if (this.selectedStation() !== 'Alle') {
      return filtered.filter(d => d.Station === this.selectedStation());
    }
    return filtered;
  }

  onStandortChange(standort: string) {
    this.selectedStandort.set(standort);
    // Reset station to "Alle"
    this.selectedStation.set('Alle');
  }

  onStationChange(station: string) {
    this.selectedStation.set(station);
  }

  toggleFlip(cardType: string) {
    const current = this.flippedCards();
    this.flippedCards.set({
      ...current,
      [cardType]: !current[cardType]
    });
  }

  getMonthName(month: number): string {
    const months = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 
                   'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
    return months[month - 1] || `Monat ${month}`;
  }

  // Altersgruppen Chart Methods
  getAltersgruppenChartData(): ChartData<'bar'> {
    // Get data for ALL months (not filtered by selectedMonth)
    const allMonthsData = this.pflegestufenData().filter(d => 
      d.Standort === this.selectedStandort() &&
      d.Kategorie !== 'Gesamt' &&
      (this.selectedStation() === 'Alle' || d.Station === this.selectedStation())
    );
    
    // Initialize all 12 months with zero values
    const monthData: { [month: number]: { A1: number, A2: number, A3: number, A4: number, ohne: number } } = {};
    for (let i = 1; i <= 12; i++) {
      monthData[i] = { A1: 0, A2: 0, A3: 0, A4: 0, ohne: 0 };
    }
    
    // Fill in actual data
    allMonthsData.forEach(row => {
      const monat = row.Monat;
      const kategorie = row.Kategorie;
      if (!kategorie || !monat || monat < 1 || monat > 12) return;
      
      if (kategorie.startsWith('A1')) monthData[monat].A1 += row['Einstufungen absolut'];
      else if (kategorie.startsWith('A2')) monthData[monat].A2 += row['Einstufungen absolut'];
      else if (kategorie.startsWith('A3')) monthData[monat].A3 += row['Einstufungen absolut'];
      else if (kategorie.startsWith('A4')) monthData[monat].A4 += row['Einstufungen absolut'];
      else if (kategorie.toLowerCase().includes('ohne einstufung')) monthData[monat].ohne += row['Einstufungen absolut'];
    });
    
    // All 12 months
    const months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    const labels = months.map(m => this.getMonthName(m));
    
    // Create datasets for each Altersgruppe (grouped bars)
    return {
      labels: labels,
      datasets: [
        {
          label: 'A1',
          data: months.map(m => monthData[m].A1),
          backgroundColor: 'rgba(33, 150, 243, 0.7)',
          borderColor: 'rgba(33, 150, 243, 1)',
          borderWidth: 2
        },
        {
          label: 'A2',
          data: months.map(m => monthData[m].A2),
          backgroundColor: 'rgba(76, 175, 80, 0.7)',
          borderColor: 'rgba(76, 175, 80, 1)',
          borderWidth: 2
        },
        {
          label: 'A3',
          data: months.map(m => monthData[m].A3),
          backgroundColor: 'rgba(255, 152, 0, 0.7)',
          borderColor: 'rgba(255, 152, 0, 1)',
          borderWidth: 2
        },
        {
          label: 'A4',
          data: months.map(m => monthData[m].A4),
          backgroundColor: 'rgba(156, 39, 176, 0.7)',
          borderColor: 'rgba(156, 39, 176, 1)',
          borderWidth: 2
        },
        {
          label: 'ohne Einstufung',
          data: months.map(m => monthData[m].ohne),
          backgroundColor: 'rgba(244, 67, 54, 0.7)',
          borderColor: 'rgba(244, 67, 54, 1)',
          borderWidth: 2
        }
      ]
    };
  }

  getAltersgruppenChartOptions(): ChartConfiguration['options'] {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { 
          display: true,
          position: 'top',
          labels: {
            usePointStyle: true,
            padding: 15
          }
        },
        title: { display: false },
        tooltip: {
          mode: 'index',
          intersect: false,
          callbacks: {
            label: (context) => {
              return `${context.dataset.label}: ${context.parsed.y.toLocaleString('de-DE')}`;
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'Einstufungen absolut'
          }
        },
        x: {
          title: {
            display: true,
            text: 'Monat'
          }
        }
      }
    };
  }

  getAltersgruppeTotal(gruppe: string): number {
    // Get data for ALL months (not filtered by selectedMonth)
    const allMonthsData = this.pflegestufenData().filter(d => 
      d.Standort === this.selectedStandort() &&
      d.Kategorie !== 'Gesamt' &&
      (this.selectedStation() === 'Alle' || d.Station === this.selectedStation())
    );
    
    let total = 0;
    
    allMonthsData.forEach(row => {
      const kategorie = row.Kategorie;
      if (!kategorie) return;
      
      if (gruppe === 'A1' && kategorie.startsWith('A1')) total += row['Einstufungen absolut'];
      else if (gruppe === 'A2' && kategorie.startsWith('A2')) total += row['Einstufungen absolut'];
      else if (gruppe === 'A3' && kategorie.startsWith('A3')) total += row['Einstufungen absolut'];
      else if (gruppe === 'A4' && kategorie.startsWith('A4')) total += row['Einstufungen absolut'];
      else if (gruppe === 'ohne' && kategorie.toLowerCase().includes('ohne einstufung')) total += row['Einstufungen absolut'];
    });
    
    return total;
  }

  getAltersgruppePercentage(gruppe: string): string {
    const total = this.getTotalEinstufungenForAltersgruppen();
    if (total === 0) return '0.0';
    const gruppeTotal = this.getAltersgruppeTotal(gruppe);
    return ((gruppeTotal / total) * 100).toFixed(1);
  }

  getTotalEinstufungenForAltersgruppen(): number {
    // Get data for ALL months (not filtered by selectedMonth)
    const allMonthsData = this.pflegestufenData().filter(d => 
      d.Standort === this.selectedStandort() &&
      d.Kategorie !== 'Gesamt' &&
      (this.selectedStation() === 'Alle' || d.Station === this.selectedStation())
    );
    
    return allMonthsData.reduce((sum, d) => sum + d['Einstufungen absolut'], 0);
  }

  private prepareDataInfoItems(uploads: UploadRecord[]) {
    const items: DataInfoItem[] = [];
    
    uploads.forEach(upload => {
      upload.files.forEach(file => {
        let totalRecords = 0;
        
        // Count records
        if (file.values) {
          totalRecords = file.values.length;
        }

        // Extract month and year from file values
        let dataMonth = '';
        let dataYear: number | undefined;
        if (file.values && file.values.length > 0) {
          const firstRow = file.values[0] as any;
          if (firstRow.Monat) {
            const monthNames = ['', 'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 
                               'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
            const monthNum = parseInt(String(firstRow.Monat));
            dataMonth = monthNames[monthNum] || String(firstRow.Monat);
          }
          if (firstRow.Jahr) {
            dataYear = parseInt(String(firstRow.Jahr));
          }
        }

        // Extract location/standort
        let location = '';
        if (file.values && file.values.length > 0) {
          const firstRow = file.values[0] as any;
          if (firstRow.Standort) {
            location = String(firstRow.Standort);
          }
        }

        items.push({
          fileName: file.originalName,
          uploadDate: upload.createdAt,
          dataMonth,
          dataYear,
          recordCount: totalRecords,
          status: 'success' as const,
          location,
          rawData: file.values || []
        });
      });
    });

    this.dataInfoItems.set(items);
  }
}

