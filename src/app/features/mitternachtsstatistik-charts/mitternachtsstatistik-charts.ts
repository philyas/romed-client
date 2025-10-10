import { Component, Input, OnInit, OnChanges, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatTableModule } from '@angular/material/table';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartData, ChartType, registerables } from 'chart.js';
import { MitternachtsstatistikResponse } from '../../core/api';
import { DataInfoPanel, DataInfoItem } from '../data-info-panel/data-info-panel';

// Register Chart.js components
import Chart from 'chart.js/auto';

interface LocationChartData {
  location: string;
  locationName: string;
  monthlyData: {
    month: number;
    pflegetage: number;
    stationsauslastung: number;
    verweildauer: number;
    stationCount: number;
  }[];
  stations?: StationChartData[];
}

interface StationChartData {
  stationName: string;
  monthlyData: {
    month: number;
    pflegetage: number;
    planbetten: number;
    verweildauer: number;
    stationsauslastung: number;
  }[];
}

@Component({
  selector: 'app-mitternachtsstatistik-charts',
  imports: [
    CommonModule,
    MatCardModule,
    MatChipsModule,
    MatIconModule,
    MatTabsModule,
    MatSelectModule,
    MatFormFieldModule,
    MatTableModule,
    BaseChartDirective,
    DataInfoPanel
  ],
  template: `
    <div class="mitternachtsstatistik-charts">
      <div class="charts-header">
        <div class="header-top">
          <h3>
            <mat-icon>analytics</mat-icon>
            Mitternachtsstatistik - Jahresübersicht {{ currentYear() }}
          </h3>
          <div class="selectors-container">
            <mat-form-field appearance="outline" class="location-selector">
              <mat-label>
                <mat-icon>location_on</mat-icon>
                Standort
              </mat-label>
              <mat-select 
                [value]="selectedLocation()" 
                (selectionChange)="onLocationChange($event.value)">
                <mat-option *ngFor="let location of availableLocations()" [value]="location">
                  {{ locationNames[location] || location }}
                </mat-option>
              </mat-select>
            </mat-form-field>
            
            <mat-form-field appearance="outline" class="station-selector">
              <mat-label>
                <mat-icon>business</mat-icon>
                Station
              </mat-label>
              <mat-select 
                [value]="selectedStation()" 
                (selectionChange)="onStationChange($event.value)">
                <mat-option value="all">Alle Stationen (Aggregiert)</mat-option>
                <mat-option *ngFor="let station of availableStations()" [value]="station">
                  {{ station }}
                </mat-option>
              </mat-select>
            </mat-form-field>
          </div>
        </div>
        <p>Monatliche Entwicklung der wichtigsten Kennzahlen {{ selectedStation() === 'all' ? '(Standort gesamt)' : '(Station: ' + selectedStation() + ')' }}</p>
      </div>

      <!-- Data Info Panel -->
      <app-data-info-panel 
        *ngIf="dataInfoItems().length > 0"
        [dataItems]="dataInfoItems()"
        [expandedByDefault]="false">
      </app-data-info-panel>

      <!-- Charts for selected location -->
      <div *ngIf="getSelectedLocationData() as locationData" class="charts-container">
        <div class="charts-grid">
          <!-- Pflegetage Chart -->
          <div class="flip-card" [class.flipped]="flippedCards['pflegetage']" (click)="toggleFlip('pflegetage')">
            <div class="flip-card-inner">
              <div class="flip-card-front">
                <mat-card class="metric-card">
                  <mat-card-header class="metric-header">
                    <mat-card-title>
                      Pflegetage
                      <span class="flip-hint-text">Klicken zum Umdrehen</span>
                      <mat-icon class="flip-icon">flip</mat-icon>
                    </mat-card-title>
                  </mat-card-header>
                  <mat-card-content class="chart-content">
                    <div class="chart-container">
                      <canvas baseChart
                        [data]="getPflegetageChartData(locationData)"
                        [options]="getChartOptions('Pflegetage', 'Pflegetage', 'pflegetage')"
                        [type]="'line'">
                      </canvas>
                    </div>
                    <div class="chart-info">
                      <mat-chip-set>
                        <mat-chip>Ø {{ calculateAverage(locationData, 'pflegetage') | number:'1.0-0' }}</mat-chip>
                        <mat-chip>Max {{ calculateMax(locationData, 'pflegetage') | number:'1.0-0' }}</mat-chip>
                        <mat-chip>Min {{ calculateMin(locationData, 'pflegetage') | number:'1.0-0' }}</mat-chip>
                      </mat-chip-set>
                    </div>
                  </mat-card-content>
                </mat-card>
              </div>
              <div class="flip-card-back">
                <mat-card class="metric-card">
                  <mat-card-header class="metric-header">
                    <mat-card-title>
                      Pflegetage - Daten
                      <mat-icon class="flip-icon">flip</mat-icon>
                    </mat-card-title>
                  </mat-card-header>
                  <mat-card-content class="table-content">
                    <div class="table-container">
                      <table mat-table [dataSource]="getTableData(locationData, 'pflegetage')">
                        <ng-container matColumnDef="month">
                          <th mat-header-cell *matHeaderCellDef>Monat</th>
                          <td mat-cell *matCellDef="let row">{{ row.month }}</td>
                        </ng-container>
                        <ng-container matColumnDef="value">
                          <th mat-header-cell *matHeaderCellDef>Pflegetage</th>
                          <td mat-cell *matCellDef="let row">{{ row.value | number:'1.0-0' }}</td>
                        </ng-container>
                        <tr mat-header-row *matHeaderRowDef="['month', 'value']"></tr>
                        <tr mat-row *matRowDef="let row; columns: ['month', 'value']"></tr>
                      </table>
                    </div>
                  </mat-card-content>
                </mat-card>
              </div>
            </div>
          </div>

          <!-- Stationsauslastung Chart -->
          <div class="flip-card" [class.flipped]="flippedCards['stationsauslastung']" (click)="toggleFlip('stationsauslastung')">
            <div class="flip-card-inner">
              <div class="flip-card-front">
                <mat-card class="metric-card">
                  <mat-card-header class="metric-header">
                    <mat-card-title>
                      Stationsauslastung
                      <span class="flip-hint-text">Klicken zum Umdrehen</span>
                      <mat-icon class="flip-icon">flip</mat-icon>
                    </mat-card-title>
                  </mat-card-header>
                  <mat-card-content class="chart-content">
                    <div class="chart-container">
                      <canvas baseChart
                        [data]="getStationsauslastungChartData(locationData)"
                        [options]="getChartOptions('Stationsauslastung', 'Auslastung (%)', 'stationsauslastung')"
                        [type]="'line'">
                      </canvas>
                    </div>
                    <div class="chart-info">
                      <mat-chip-set>
                        <mat-chip>Ø {{ calculateAverage(locationData, 'stationsauslastung') | number:'1.1-1' }}%</mat-chip>
                        <mat-chip>Max {{ calculateMax(locationData, 'stationsauslastung') | number:'1.1-1' }}%</mat-chip>
                        <mat-chip>Min {{ calculateMin(locationData, 'stationsauslastung') | number:'1.1-1' }}%</mat-chip>
                      </mat-chip-set>
                    </div>
                  </mat-card-content>
                </mat-card>
              </div>
              <div class="flip-card-back">
                <mat-card class="metric-card">
                  <mat-card-header class="metric-header">
                    <mat-card-title>
                      Stationsauslastung - Daten
                      <mat-icon class="flip-icon">flip</mat-icon>
                    </mat-card-title>
                  </mat-card-header>
                  <mat-card-content class="table-content">
                    <div class="table-container">
                      <table mat-table [dataSource]="getTableData(locationData, 'stationsauslastung')">
                        <ng-container matColumnDef="month">
                          <th mat-header-cell *matHeaderCellDef>Monat</th>
                          <td mat-cell *matCellDef="let row">{{ row.month }}</td>
                        </ng-container>
                        <ng-container matColumnDef="value">
                          <th mat-header-cell *matHeaderCellDef>Auslastung (%)</th>
                          <td mat-cell *matCellDef="let row">{{ row.value | number:'1.1-1' }}%</td>
                        </ng-container>
                        <tr mat-header-row *matHeaderRowDef="['month', 'value']"></tr>
                        <tr mat-row *matRowDef="let row; columns: ['month', 'value']"></tr>
                      </table>
                    </div>
                  </mat-card-content>
                </mat-card>
              </div>
            </div>
          </div>

          <!-- Verweildauer Chart -->
          <div class="flip-card" [class.flipped]="flippedCards['verweildauer']" (click)="toggleFlip('verweildauer')">
            <div class="flip-card-inner">
              <div class="flip-card-front">
                <mat-card class="metric-card">
                  <mat-card-header class="metric-header">
                    <mat-card-title>
                      Verweildauer (VD.inkl.)
                      <span class="flip-hint-text">Klicken zum Umdrehen</span>
                      <mat-icon class="flip-icon">flip</mat-icon>
                    </mat-card-title>
                  </mat-card-header>
                  <mat-card-content class="chart-content">
                    <div class="chart-container">
                      <canvas baseChart
                        [data]="getVerweildauerChartData(locationData)"
                        [options]="getChartOptions('Verweildauer', 'Tage', 'verweildauer')"
                        [type]="'line'">
                      </canvas>
                    </div>
                    <div class="chart-info">
                      <mat-chip-set>
                        <mat-chip>Ø {{ calculateAverage(locationData, 'verweildauer') | number:'1.2-2' }} Tage</mat-chip>
                        <mat-chip>Max {{ calculateMax(locationData, 'verweildauer') | number:'1.2-2' }} Tage</mat-chip>
                        <mat-chip>Min {{ calculateMin(locationData, 'verweildauer') | number:'1.2-2' }} Tage</mat-chip>
                      </mat-chip-set>
                    </div>
                  </mat-card-content>
                </mat-card>
              </div>
              <div class="flip-card-back">
                <mat-card class="metric-card">
                  <mat-card-header class="metric-header">
                    <mat-card-title>
                      Verweildauer - Daten
                      <mat-icon class="flip-icon">flip</mat-icon>
                    </mat-card-title>
                  </mat-card-header>
                  <mat-card-content class="table-content">
                    <div class="table-container">
                      <table mat-table [dataSource]="getTableData(locationData, 'verweildauer')">
                        <ng-container matColumnDef="month">
                          <th mat-header-cell *matHeaderCellDef>Monat</th>
                          <td mat-cell *matCellDef="let row">{{ row.month }}</td>
                        </ng-container>
                        <ng-container matColumnDef="value">
                          <th mat-header-cell *matHeaderCellDef>Verweildauer (Tage)</th>
                          <td mat-cell *matCellDef="let row">{{ row.value | number:'1.2-2' }}</td>
                        </ng-container>
                        <tr mat-header-row *matHeaderRowDef="['month', 'value']"></tr>
                        <tr mat-row *matRowDef="let row; columns: ['month', 'value']"></tr>
                      </table>
                    </div>
                  </mat-card-content>
                </mat-card>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- No data message -->
      <div *ngIf="chartDataByLocation().length === 0" class="no-data">
        <mat-icon>info</mat-icon>
        <p>Keine Mitternachtsstatistik-Daten für Charts verfügbar</p>
        <p class="hint">Laden Sie Mitternachtsstatistik-Dateien hoch, um die monatliche Entwicklung zu sehen.</p>
      </div>
    </div>
  `,
  styles: [`
    .mitternachtsstatistik-charts {
      padding: 8px;
    }

    .charts-header {
      margin-bottom: 16px;
    }

    .header-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }

    .charts-header h3 {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 0;
      font-size: 18px;
      font-weight: 600;
      color: #1976d2;
    }

    .charts-header mat-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
    }

    .charts-header p {
      margin: 0;
      color: #666;
      font-size: 12px;
    }

    .selectors-container {
      display: flex;
      gap: 12px;
      align-items: center;
    }

    .location-selector,
    .station-selector {
      width: 220px;
    }

    .location-selector mat-label,
    .station-selector mat-label {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .charts-container {
      width: 100%;
    }

    .charts-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
    }

    .flip-card {
      perspective: 1000px;
      cursor: pointer;
      height: 450px;
      transition: transform 0.2s ease;
      
      &:hover {
        transform: scale(1.02);
        
        .metric-card {
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

    .metric-card {
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      height: 100%;
    }

    .metric-header {
      background: linear-gradient(135deg, #1976d2 0%, #1565c0 100%);
      color: white;
      padding: 12px 16px;
      position: relative;
    }

    .metric-header mat-card-title {
      font-size: 15px;
      font-weight: 600;
      margin: 0;
      color: white;
      display: flex;
      justify-content: space-between;
      align-items: center;
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
      top: 50%;
      right: 50px;
      transform: translateY(-50%);
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

    .chart-content {
      padding: 0;
    }

    .chart-container {
      height: 300px;
      position: relative;
      margin-bottom: 12px;
    }

    .chart-info {
      padding: 8px 12px;
      background: #f5f5f5;
      border-radius: 4px;
      margin-top: 8px;
    }

    .chart-info mat-chip-set {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      justify-content: center;
    }

    .chart-info mat-chip {
      font-size: 11px;
      font-weight: 500;
      height: 24px;
      padding: 0 10px;
    }

    .table-content {
      padding: 16px !important;
      height: calc(100% - 60px);
      overflow: hidden;
    }

    .table-container {
      max-height: 100%;
      overflow-y: auto;
      border: 1px solid #e0e0e0;
      border-radius: 4px;
    }

    .table-container table {
      width: 100%;
    }

    .table-container th {
      background: #f5f5f5;
      font-weight: 600;
      color: #1976d2;
      position: sticky;
      top: 0;
      z-index: 10;
    }

    .table-container td,
    .table-container th {
      padding: 12px 16px;
      text-align: left;
    }

    .table-container tr:nth-child(even) {
      background: #fafafa;
    }

    .table-container tr:hover {
      background: #e3f2fd;
    }

    .no-data {
      text-align: center;
      padding: 40px 20px;
      background: #f5f5f5;
      border-radius: 8px;
      grid-column: 1 / -1;
    }

    /* Responsive: Stack on smaller screens */
    @media (max-width: 1400px) {
      .charts-grid {
        grid-template-columns: 1fr;
      }
      
      .selectors-container {
        flex-direction: column;
        gap: 8px;
        align-items: stretch;
      }
      
      .location-selector,
      .station-selector {
        width: 100%;
      }
    }

    .no-data mat-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      color: #999;
      margin-bottom: 12px;
    }

    .no-data p {
      font-size: 16px;
      color: #666;
      margin: 6px 0;
    }

    .no-data .hint {
      font-size: 13px;
      color: #999;
    }
  `]
})
export class MitternachtsstatistikCharts implements OnInit, OnChanges {
  @Input() mitternachtsstatistikData: MitternachtsstatistikResponse | null = null;

  chartDataByLocation = signal<LocationChartData[]>([]);
  selectedLocation = signal<string>('BAB');
  availableLocations = signal<string[]>([]);
  selectedStation = signal<string>('all'); // 'all' = alle Stationen (aggregiert)
  availableStations = signal<string[]>([]);
  currentYear = signal<number>(new Date().getFullYear());
  dataInfoItems = signal<DataInfoItem[]>([]);
  
  // Track flipped state for each card
  flippedCards: { [key: string]: boolean } = {
    pflegetage: false,
    stationsauslastung: false,
    verweildauer: false
  };

  // Shared Y-axis scales for visual comparison
  private sharedScales = {
    pflegetage: { min: 0, max: 0 },
    stationsauslastung: { min: 0, max: 100 },
    verweildauer: { min: 0, max: 0 }
  };

  readonly locationNames: Record<string, string> = {
    'BAB': 'BAB',
    'PRI': 'PRI',
    'ROS': 'ROS',
    'WAS': 'WAS'
  };

  private readonly monthLabels = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

  ngOnInit() {
    Chart.register(...registerables);
    this.processChartData();
  }

  ngOnChanges() {
    this.processChartData();
  }

  private processChartData() {
    if (!this.mitternachtsstatistikData || !this.mitternachtsstatistikData.uploads) {
      this.chartDataByLocation.set([]);
      this.dataInfoItems.set([]);
      return;
    }

    // Extract current year from upload data
    this.extractCurrentYear();

    // Prepare data info items
    this.prepareDataInfoItems();

    const locations = ['BAB', 'PRI', 'ROS', 'WAS'];
    const locationData: LocationChartData[] = [];

    for (const location of locations) {
      const monthlyData: LocationChartData['monthlyData'] = [];
      const stationDataMap = new Map<string, StationChartData>();

      // Initialize all 12 months with zero values
      for (let month = 1; month <= 12; month++) {
        monthlyData.push({
          month,
          pflegetage: 0,
          stationsauslastung: 0,
          verweildauer: 0,
          stationCount: 0
        });
      }

      // Process all uploads
      this.mitternachtsstatistikData.uploads.forEach(upload => {
        if (!upload.month || !upload.locationsData || !upload.locationsData[location]) {
          return;
        }

        // Parse month and year from "MM-YYYY" or just "MM"
        let monthNumber: number;
        let year: number;
        
        if (upload.month.includes('-')) {
          const [monthStr, yearStr] = upload.month.split('-');
          monthNumber = parseInt(monthStr);
          year = parseInt(yearStr);
        } else {
          monthNumber = parseInt(upload.month);
          year = new Date().getFullYear(); // Default to current year
        }

        if (isNaN(monthNumber) || monthNumber < 1 || monthNumber > 12) {
          return;
        }

        const locationFiles = upload.locationsData[location];
        let totalPflegetage = 0;
        let totalPlanbetten = 0;
        let totalStations = 0;
        let totalVerweildauer = 0;
        let verweildauerCount = 0;

        locationFiles.forEach(file => {
          if (!file.values || !Array.isArray(file.values)) return;

          file.values.forEach(row => {
            if (!row['Station']) return; // Skip rows without station
            
            totalStations++;
            
            const pflegetage = Number(row['Pflegetage']) || 0;
            totalPflegetage += pflegetage;

            const planbetten = Number(row['Planbetten']) || 0;
            totalPlanbetten += planbetten;

            const verweildauer = Number(row['VD.inkl.']) || 0;
            if (verweildauer > 0) {
              totalVerweildauer += verweildauer;
              verweildauerCount++;
            }

            // Collect individual station data
            const stationName = row['Station'].toString();
            if (!stationDataMap.has(stationName)) {
              // Initialize station with 12 months of zero values
              const stationMonthlyData = [];
              for (let m = 1; m <= 12; m++) {
                stationMonthlyData.push({
                  month: m,
                  pflegetage: 0,
                  planbetten: 0,
                  verweildauer: 0,
                  stationsauslastung: 0
                });
              }
              stationDataMap.set(stationName, {
                stationName,
                monthlyData: stationMonthlyData
              });
            }

            // Update station's monthly data
            const stationData = stationDataMap.get(stationName)!;
            const monthIndex = monthNumber - 1;
            const kalendertage = new Date(year, monthNumber, 0).getDate();
            const maxStationPflegetage = planbetten * kalendertage;
            const stationAuslastung = maxStationPflegetage > 0 ? (pflegetage / maxStationPflegetage) * 100 : 0;
            
            stationData.monthlyData[monthIndex] = {
              month: monthNumber,
              pflegetage,
              planbetten,
              verweildauer,
              stationsauslastung: stationAuslastung
            };
          });
        });

        // Calculate averages
        const avgVerweildauer = verweildauerCount > 0 ? totalVerweildauer / verweildauerCount : 0;
        
        // Stationsauslastung: Pflegetage / (Planbetten × Kalendertage) × 100
        // Kalendertage aus Monat/Jahr berechnen
        const kalendertage = new Date(year, monthNumber, 0).getDate(); // Tatsächliche Tage im Monat
        const maxPflegetage = totalPlanbetten * kalendertage;
        const auslastung = maxPflegetage > 0 ? (totalPflegetage / maxPflegetage) * 100 : 0;

        // Update monthly data
        const monthIndex = monthNumber - 1;
        monthlyData[monthIndex] = {
          month: monthNumber,
          pflegetage: totalPflegetage,
          stationsauslastung: auslastung,
          verweildauer: avgVerweildauer,
          stationCount: totalStations
        };
      });

      locationData.push({
        location,
        locationName: this.locationNames[location] || location,
        monthlyData,
        stations: Array.from(stationDataMap.values()).sort((a, b) => a.stationName.localeCompare(b.stationName))
      });
    }

    this.chartDataByLocation.set(locationData);
    this.calculateSharedScales(locationData);
    
    // Set available locations
    this.availableLocations.set(locations);
    
    // Set initial location if not set or not available
    if (!this.selectedLocation() || !locations.includes(this.selectedLocation())) {
      this.selectedLocation.set(locations[0] || 'BAB');
    }
    
    // Update available stations for selected location
    this.updateAvailableStations();
  }

  onLocationChange(location: string) {
    this.selectedLocation.set(location);
    this.selectedStation.set('all'); // Reset station to "all" when location changes
    this.updateAvailableStations();
  }

  onStationChange(station: string) {
    this.selectedStation.set(station);
  }

  private updateAvailableStations() {
    const locationData = this.chartDataByLocation().find(loc => loc.location === this.selectedLocation());
    if (locationData && locationData.stations) {
      const stations = locationData.stations.map(s => s.stationName).sort();
      this.availableStations.set(stations);
    } else {
      this.availableStations.set([]);
    }
  }

  getSelectedLocationData(): LocationChartData | null {
    const locationData = this.chartDataByLocation().find(loc => loc.location === this.selectedLocation());
    if (!locationData) return null;

    // If a specific station is selected, return modified data with station's values
    if (this.selectedStation() !== 'all') {
      const stationData = locationData.stations?.find(s => s.stationName === this.selectedStation());
      if (stationData) {
        // Map station data to location data format
        return {
          ...locationData,
          monthlyData: stationData.monthlyData.map(m => ({
            month: m.month,
            pflegetage: m.pflegetage,
            stationsauslastung: m.stationsauslastung,
            verweildauer: m.verweildauer,
            stationCount: 1 // Single station
          }))
        };
      }
    }

    return locationData;
  }

  private calculateSharedScales(locationData: LocationChartData[]) {
    // Calculate shared min/max for each metric across all locations
    let maxPflegetage = 0;
    let maxVerweildauer = 0;

    locationData.forEach(location => {
      location.monthlyData.forEach(month => {
        if (month.pflegetage > maxPflegetage) maxPflegetage = month.pflegetage;
        if (month.verweildauer > maxVerweildauer) maxVerweildauer = month.verweildauer;
      });
    });

    // Add 10% padding to max values for better visualization
    this.sharedScales.pflegetage.max = Math.ceil(maxPflegetage * 1.1);
    this.sharedScales.verweildauer.max = Math.ceil(maxVerweildauer * 1.1);
    this.sharedScales.stationsauslastung.max = 100; // Fixed at 100%
  }

  getPflegetageChartData(locationData: LocationChartData): ChartData<'line'> {
    return {
      labels: this.monthLabels,
      datasets: [{
        data: locationData.monthlyData.map(d => d.pflegetage),
        label: 'Pflegetage',
        borderColor: '#1976d2',
        backgroundColor: 'rgba(25, 118, 210, 0.1)',
        fill: true,
        tension: 0.4,
        pointRadius: 5,
        pointHoverRadius: 7
      }]
    };
  }

  getStationsauslastungChartData(locationData: LocationChartData): ChartData<'line'> {
    return {
      labels: this.monthLabels,
      datasets: [{
        data: locationData.monthlyData.map(d => d.stationsauslastung),
        label: 'Auslastung (%)',
        borderColor: '#388e3c',
        backgroundColor: 'rgba(56, 142, 60, 0.1)',
        fill: true,
        tension: 0.4,
        pointRadius: 5,
        pointHoverRadius: 7
      }]
    };
  }

  getVerweildauerChartData(locationData: LocationChartData): ChartData<'line'> {
    return {
      labels: this.monthLabels,
      datasets: [{
        data: locationData.monthlyData.map(d => d.verweildauer),
        label: 'Verweildauer (Tage)',
        borderColor: '#f57c00',
        backgroundColor: 'rgba(245, 124, 0, 0.1)',
        fill: true,
        tension: 0.4,
        pointRadius: 5,
        pointHoverRadius: 7
      }]
    };
  }

  getCombinedChartData(locationData: LocationChartData): ChartData<'line'> {
    return {
      labels: this.monthLabels,
      datasets: [
        {
          data: locationData.monthlyData.map(d => d.pflegetage / 100), // Scale down for visibility
          label: 'Pflegetage (/100)',
          borderColor: '#1976d2',
          backgroundColor: 'rgba(25, 118, 210, 0.1)',
          tension: 0.4,
          yAxisID: 'y'
        },
        {
          data: locationData.monthlyData.map(d => d.stationsauslastung),
          label: 'Auslastung (%)',
          borderColor: '#388e3c',
          backgroundColor: 'rgba(56, 142, 60, 0.1)',
          tension: 0.4,
          yAxisID: 'y1'
        },
        {
          data: locationData.monthlyData.map(d => d.verweildauer),
          label: 'Verweildauer (Tage)',
          borderColor: '#f57c00',
          backgroundColor: 'rgba(245, 124, 0, 0.1)',
          tension: 0.4,
          yAxisID: 'y1'
        }
      ]
    };
  }

  getChartOptions(title: string, yAxisLabel: string, metric?: 'pflegetage' | 'stationsauslastung' | 'verweildauer'): ChartConfiguration['options'] {
    const yAxisConfig: any = {
      display: true,
      title: {
        display: true,
        text: yAxisLabel,
        font: {
          size: 10,
          weight: 'bold'
        }
      },
      grid: {
        display: true,
        color: 'rgba(0, 0, 0, 0.05)'
      },
      beginAtZero: true,
      ticks: {
        font: {
          size: 9
        }
      }
    };

    // Apply shared scale if metric is provided
    if (metric && this.sharedScales[metric]) {
      yAxisConfig.min = this.sharedScales[metric].min;
      yAxisConfig.max = this.sharedScales[metric].max;
    }

    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: {
          display: true,
          text: title,
          font: {
            size: 11,
            weight: 'bold'
          },
          padding: 4
        },
        legend: {
          display: false
        },
        tooltip: {
          mode: 'index',
          intersect: false,
          bodyFont: {
            size: 10
          }
        }
      },
      scales: {
        x: {
          display: true,
          title: {
            display: false
          },
          grid: {
            display: true,
            color: 'rgba(0, 0, 0, 0.05)'
          },
          ticks: {
            font: {
              size: 9
            }
          }
        },
        y: yAxisConfig
      },
      interaction: {
        mode: 'nearest',
        axis: 'x',
        intersect: false
      }
    };
  }

  getCombinedChartOptions(): ChartConfiguration['options'] {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: {
          display: true,
          text: 'Alle Kennzahlen im Vergleich',
          font: {
            size: 16,
            weight: 'bold'
          }
        },
        legend: {
          display: true,
          position: 'top'
        },
        tooltip: {
          mode: 'index',
          intersect: false
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
          type: 'linear',
          display: true,
          position: 'left',
          title: {
            display: true,
            text: 'Pflegetage (/100)'
          }
        },
        y1: {
          type: 'linear',
          display: true,
          position: 'right',
          title: {
            display: true,
            text: 'Auslastung (%) / Verweildauer (Tage)'
          },
          grid: {
            drawOnChartArea: false
          }
        }
      }
    };
  }

  calculateAverage(locationData: LocationChartData, metric: 'pflegetage' | 'stationsauslastung' | 'verweildauer'): number {
    const values = locationData.monthlyData
      .map(d => d[metric])
      .filter(v => v > 0);
    
    if (values.length === 0) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  calculateMax(locationData: LocationChartData, metric: 'pflegetage' | 'stationsauslastung' | 'verweildauer'): number {
    const values = locationData.monthlyData.map(d => d[metric]);
    return Math.max(...values, 0);
  }

  calculateMin(locationData: LocationChartData, metric: 'pflegetage' | 'stationsauslastung' | 'verweildauer'): number {
    const values = locationData.monthlyData
      .map(d => d[metric])
      .filter(v => v > 0);
    
    if (values.length === 0) return 0;
    return Math.min(...values);
  }

  private extractCurrentYear() {
    if (!this.mitternachtsstatistikData?.uploads) {
      this.currentYear.set(new Date().getFullYear());
      return;
    }

    // Extract years from upload data
    const years = new Set<number>();
    
    this.mitternachtsstatistikData.uploads.forEach(upload => {
      if (upload.month && upload.month.includes('-')) {
        const [, yearStr] = upload.month.split('-');
        const year = parseInt(yearStr);
        if (!isNaN(year)) {
          years.add(year);
        }
      }
    });

    // Use the most recent year, or current year as fallback
    if (years.size > 0) {
      const sortedYears = Array.from(years).sort((a, b) => b - a);
      this.currentYear.set(sortedYears[0]);
    } else {
      this.currentYear.set(new Date().getFullYear());
    }
  }

  toggleFlip(cardKey: string, event?: Event) {
    if (event) {
      event.stopPropagation();
    }
    this.flippedCards[cardKey] = !this.flippedCards[cardKey];
  }

  getTableData(locationData: LocationChartData, metric: 'pflegetage' | 'stationsauslastung' | 'verweildauer') {
    const monthLabels = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
    
    return locationData.monthlyData.map((data, index) => ({
      month: monthLabels[index],
      value: data[metric]
    }));
  }

  private prepareDataInfoItems() {
    if (!this.mitternachtsstatistikData?.uploads) {
      this.dataInfoItems.set([]);
      return;
    }

    const monthNames = ['', 'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 
                       'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

    const items: DataInfoItem[] = this.mitternachtsstatistikData.uploads.map(upload => {
      let dataMonth = '';
      let dataYear: number | undefined;
      let totalRecords = 0;

      // Parse month/year
      if (upload.month) {
        if (upload.month.includes('-')) {
          const [monthStr, yearStr] = upload.month.split('-');
          const monthNum = parseInt(monthStr);
          dataMonth = monthNames[monthNum] || monthStr;
          dataYear = parseInt(yearStr);
        } else {
          const monthNum = parseInt(upload.month);
          dataMonth = monthNames[monthNum] || upload.month;
        }
      }

      // Count total records across all files and locations
      if (upload.locationsData) {
        Object.values(upload.locationsData).forEach(locationFiles => {
          locationFiles.forEach(file => {
            if (file.values) {
              totalRecords += file.values.length;
            }
          });
        });
      }

      // Get file count
      const fileCount = upload.files?.length || 0;

      // Get locations
      const locations = upload.locations?.join(', ') || '';

      // Collect all raw data from all locations
      const allRawData: any[] = [];
      if (upload.locationsData) {
        Object.values(upload.locationsData).forEach(locationFiles => {
          locationFiles.forEach(file => {
            if (file.values) {
              allRawData.push(...file.values);
            }
          });
        });
      }

      return {
        fileName: `${upload.schemaName} (${fileCount} ${fileCount === 1 ? 'Datei' : 'Dateien'})`,
        uploadDate: upload.createdAt,
        dataMonth,
        dataYear,
        recordCount: totalRecords,
        status: 'success' as const,
        location: locations,
        rawData: allRawData,
        fileCount: fileCount
      };
    });

    this.dataInfoItems.set(items);
  }
}

