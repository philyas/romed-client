import { Component, Input, OnInit, OnChanges, signal, inject, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartData, ChartType, registerables } from 'chart.js';
import { MitternachtsstatistikResponse, Api, ResultsResponse } from '../../core/api';
import { DataInfoPanel, DataInfoItem } from '../data-info-panel/data-info-panel';
import { ComparisonDialogComponent, ComparisonMetricConfig, ComparisonSeries } from '../shared/comparison-dialog/comparison-dialog.component';
import { SearchableSelectComponent } from '../shared/searchable-select/searchable-select.component';
import { StationGruppenService } from '../../core/station-gruppen.service';

// Register Chart.js components
import Chart from 'chart.js/auto';

interface AufgestellteBettenData {
  IK: string;
  Standort: string;
  Station: string;
  Jahr: number;
  Bettenanzahl: number;
}

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
    betten: number; // Aufgestellte Betten (aus mitteilungen_betten), 0 wenn nicht verfügbar
    verweildauer: number;
    stationsauslastung: number;
  }[];
}

@Component({
  selector: 'app-mitternachtsstatistik-charts',
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatChipsModule,
    MatIconModule,
    MatTabsModule,
    MatTableModule,
    MatTooltipModule,
    BaseChartDirective,
    DataInfoPanel,
    SearchableSelectComponent
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
            <app-searchable-select
              class="location-selector"
              label="Standort"
              icon="location_on"
              [options]="availableLocations()"
              [value]="selectedLocation()"
              [displayWith]="locationDisplayName"
              (valueChange)="onLocationChange($event)"
            ></app-searchable-select>

            <app-searchable-select
              class="station-selector"
              label="Station"
              icon="business"
              [options]="availableStations()"
              [value]="selectedStation()"
              [includeAllOption]="true"
              [allValue]="'all'"
              [allLabel]="aggregatedStationLabel"
              (valueChange)="onStationChange($event)"
            ></app-searchable-select>
            <button
              mat-stroked-button
              color="primary"
              class="comparison-button"
              (click)="openComparisonDialog($event)"
              [disabled]="comparisonSeries().length === 0"
              matTooltip="Vergleichen Sie bis zu vier Stationen für diesen Standort">
              <mat-icon>compare</mat-icon>
              Vergleich
            </button>
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
      <div *ngIf="selectedLocationData() as locationData" class="charts-container">
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
                      <div class="chart-loading-overlay" *ngIf="chartLoading()">
                        <div class="loading-bar"></div>
                        <p>Daten werden geladen…</p>
                      </div>
                      <canvas baseChart
                        [data]="pflegetageChartData()"
                        [options]="pflegetageChartOptions()"
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
                      <div class="chart-loading-overlay" *ngIf="chartLoading()">
                        <div class="loading-bar"></div>
                        <p>Daten werden geladen…</p>
                      </div>
                      <canvas baseChart
                        [data]="stationsauslastungChartData()"
                        [options]="stationsauslastungChartOptions()"
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
                      <table mat-table [dataSource]="getAuslastungTableData(locationData)">
                        <ng-container matColumnDef="month">
                          <th mat-header-cell *matHeaderCellDef>Monat</th>
                          <td mat-cell *matCellDef="let row">{{ row.month }}</td>
                        </ng-container>
                        <ng-container matColumnDef="betten">
                          <th mat-header-cell *matHeaderCellDef>Betten</th>
                          <td mat-cell *matCellDef="let row">{{ row.betten | number:'1.0-0' }}</td>
                        </ng-container>
                        <ng-container matColumnDef="value">
                          <th mat-header-cell *matHeaderCellDef>Auslastung (%)</th>
                          <td mat-cell *matCellDef="let row">{{ row.value | number:'1.1-1' }}%</td>
                        </ng-container>
                        <tr mat-header-row *matHeaderRowDef="['month', 'betten', 'value']"></tr>
                        <tr mat-row *matRowDef="let row; columns: ['month', 'betten', 'value']"></tr>
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
                      <div class="chart-loading-overlay" *ngIf="chartLoading()">
                        <div class="loading-bar"></div>
                        <p>Daten werden geladen…</p>
                      </div>
                      <canvas baseChart
                        [data]="verweildauerChartData()"
                        [options]="verweildauerChartOptions()"
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
      flex-wrap: nowrap;
    }

    .comparison-button {
      position: relative;
      z-index: 0;
      flex: 0 0 auto;
    }

    .comparison-button mat-icon {
      margin-right: 6px;
    }

    .location-selector,
    .station-selector {
      width: 220px;
      flex: 0 0 220px;
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

      .chart-loading-overlay {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 14px;
        background: rgba(255, 255, 255, 0.92);
        border-radius: 8px;
        z-index: 2;
        pointer-events: none;

        .loading-bar {
          width: min(240px, 70%);
          height: 5px;
          border-radius: 999px;
          background: linear-gradient(90deg, rgba(25,118,210,0.2) 0%, rgba(25,118,210,0.9) 50%, rgba(25,118,210,0.2) 100%);
          animation: mitternachts-loading 1.2s ease-in-out infinite;
        }

        p {
          margin: 0;
          color: #1976d2;
          font-weight: 600;
        }
      }
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

    @keyframes mitternachts-loading {
      0% { transform: translateX(-12%); opacity: 0.4; }
      50% { transform: translateX(0%); opacity: 1; }
      100% { transform: translateX(12%); opacity: 0.4; }
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
        flex-wrap: wrap;
      }
      
      .location-selector,
      .station-selector {
        width: 100%;
        flex: 1 1 auto;
      }

      .comparison-button {
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

  private api = inject(Api);
  private dialog = inject(MatDialog);
  private stationGruppenService = inject(StationGruppenService);

  chartDataByLocation = signal<LocationChartData[]>([]);
  selectedLocation = signal<string>('BAB');
  availableLocations = signal<string[]>([]);
  selectedStation = signal<string>('all'); // 'all' = alle Stationen (aggregiert)
  availableStations = signal<string[]>([]);
  readonly aggregatedStationLabel = 'Alle Stationen (Aggregiert)';
  readonly locationDisplayName = (value: string) => this.locationNames[value] || value;
  currentYear = signal<number>(new Date().getFullYear());
  dataInfoItems = signal<DataInfoItem[]>([]);
  aufgestellteBettenData = signal<AufgestellteBettenData[]>([]);
  chartLoading = signal<boolean>(true);
  private sharedScales: Record<'pflegetage' | 'stationsauslastung' | 'verweildauer', {
    aggregated: { min: number; max: number };
    station: { min: number; max: number };
  }> = {
    pflegetage: {
      aggregated: { min: 0, max: 0 },
      station: { min: 0, max: 0 }
    },
    stationsauslastung: {
      aggregated: { min: 0, max: 100 },
      station: { min: 0, max: 100 }
    },
    verweildauer: {
      aggregated: { min: 0, max: 0 },
      station: { min: 0, max: 0 }
    }
  };
  readonly locationNames: Record<string, string> = {
    'BAB': 'BAB',
    'PRI': 'PRI',
    'ROS': 'ROS',
    'WAS': 'WAS'
  };
  private readonly monthLabels = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
  selectedLocationData = computed<LocationChartData | null>(() => {
    const baseLocation = this.chartDataByLocation().find(loc => loc.location === this.selectedLocation());
    if (!baseLocation) {
      return null;
    }

    if (this.selectedStation() !== 'all') {
      // Check if selection is a group
      if (this.stationGruppenService.isGruppeName(this.selectedStation())) {
        // Aggregate data for all stations in the group
        const stationNames = this.stationGruppenService.getStationNamesForSelection(this.selectedStation());
        const aggregatedData: LocationChartData['monthlyData'] = [];
        
        // Initialize 12 months
        for (let month = 1; month <= 12; month++) {
          let totalPflegetage = 0;
          let totalBetten = 0;
          let totalVerweildauer = 0;
          let verweildauerCount = 0;
          let stationCount = 0;
          
          // Track unique betten values to avoid double counting when stations share the same aggregated station
          const bettenValues = new Set<number>();
          
          stationNames.forEach(stationName => {
            const stationData = baseLocation.stations?.find(s => s.stationName === stationName);
            if (stationData) {
              const monthData = stationData.monthlyData.find(m => m.month === month);
              if (monthData) {
                totalPflegetage += monthData.pflegetage;
                
                // Für Betten: Wenn mehrere Stationen die gleichen Betten haben (weil sie die gleiche
                // aggregierte Station in mitteilungen_betten finden), zähle sie nur einmal
                const bettenValue = Number(monthData.betten) || 0;
                if (bettenValue > 0) {
                  if (!bettenValues.has(bettenValue)) {
                    // Erste Station mit diesen Betten - zähle sie
                    bettenValues.add(bettenValue);
                    totalBetten += bettenValue;
                  } else {
                    // Diese Betten wurden bereits von einer anderen Station in der Gruppe gezählt
                    // (wahrscheinlich weil beide die gleiche aggregierte Station gefunden haben)
                    // Zähle sie nicht nochmal
                  }
                }
                
                if (monthData.verweildauer > 0) {
                  totalVerweildauer += monthData.verweildauer;
                  verweildauerCount++;
                }
                stationCount++;
              }
            }
          });
          
          const avgVerweildauer = verweildauerCount > 0 ? totalVerweildauer / verweildauerCount : 0;
          const year = this.currentYear();
          const kalendertage = new Date(year, month, 0).getDate();
          const maxPflegetage = totalBetten * kalendertage;
          const auslastung = maxPflegetage > 0 ? (totalPflegetage / maxPflegetage) * 100 : 0;
          
          aggregatedData.push({
            month,
            pflegetage: totalPflegetage,
            stationsauslastung: auslastung,
            verweildauer: avgVerweildauer,
            stationCount
          });
        }
        
        return {
          ...baseLocation,
          monthlyData: aggregatedData
        };
      } else {
        // Single station
        const stationData = baseLocation.stations?.find(s => s.stationName === this.selectedStation());
        if (stationData) {
          return {
            ...baseLocation,
            monthlyData: stationData.monthlyData.map(m => ({
              month: m.month,
              pflegetage: m.pflegetage,
              stationsauslastung: m.stationsauslastung,
              verweildauer: m.verweildauer,
              stationCount: 1,
              betten: m.betten
            }))
          };
        }
      }
    }

    return baseLocation;
  });
  pflegetageChartData = signal<ChartData<'line'>>(this.createEmptyLineChart());
  stationsauslastungChartData = signal<ChartData<'line'>>(this.createEmptyLineChart());
  verweildauerChartData = signal<ChartData<'line'>>(this.createEmptyLineChart());
  pflegetageChartOptions = signal<ChartConfiguration['options']>(
    this.buildChartOptions('Pflegetage', 'Pflegetage', 'pflegetage')
  );
  stationsauslastungChartOptions = signal<ChartConfiguration['options']>(
    this.buildChartOptions('Stationsauslastung', 'Auslastung (%)', 'stationsauslastung')
  );
  verweildauerChartOptions = signal<ChartConfiguration['options']>(
    this.buildChartOptions('Verweildauer', 'Tage', 'verweildauer')
  );
  private readonly chartStateEffect = effect(() => {
    const locationData = this.selectedLocationData();
    if (!locationData) {
      this.pflegetageChartData.set(this.createEmptyLineChart());
      this.stationsauslastungChartData.set(this.createEmptyLineChart());
      this.verweildauerChartData.set(this.createEmptyLineChart());

      this.pflegetageChartOptions.set(this.buildChartOptions('Pflegetage', 'Pflegetage', 'pflegetage'));
      this.stationsauslastungChartOptions.set(this.buildChartOptions('Stationsauslastung', 'Auslastung (%)', 'stationsauslastung'));
      this.verweildauerChartOptions.set(this.buildChartOptions('Verweildauer', 'Tage', 'verweildauer'));
      this.chartLoading.set(false);
      return;
    }

    this.pflegetageChartData.set(this.buildPflegetageChartData(locationData));
    this.stationsauslastungChartData.set(this.buildStationsauslastungChartData(locationData));
    this.verweildauerChartData.set(this.buildVerweildauerChartData(locationData));

    this.pflegetageChartOptions.set(this.buildChartOptions('Pflegetage', 'Pflegetage', 'pflegetage'));
    this.stationsauslastungChartOptions.set(this.buildChartOptions('Stationsauslastung', 'Auslastung (%)', 'stationsauslastung'));
    this.verweildauerChartOptions.set(this.buildChartOptions('Verweildauer', 'Tage', 'verweildauer'));
    this.chartLoading.set(false);
  });
  comparisonSeries = computed<ComparisonSeries[]>(() => {
    const location = this.chartDataByLocation().find(loc => loc.location === this.selectedLocation());
    if (!location || !location.stations || location.stations.length === 0) {
      return [];
    }

    return location.stations.map(station => ({
      id: station.stationName,
      label: station.stationName,
      monthlyData: station.monthlyData.map(month => ({
        month: month.month,
        metrics: {
          pflegetage: month.pflegetage ?? null,
          stationsauslastung: month.stationsauslastung ?? null,
          verweildauer: month.verweildauer ?? null
        }
      }))
    }));
  });
  private readonly comparisonMetrics: ComparisonMetricConfig[] = [
    {
      key: 'pflegetage',
      label: 'Pflegetage',
      chartTitle: 'Pflegetage',
      decimals: 0,
      valueFormatter: (value) => value === null ? '–' : `${value.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
    },
    {
      key: 'stationsauslastung',
      label: 'Stationsauslastung (%)',
      chartTitle: 'Stationsauslastung',
      unit: '%',
      decimals: 1,
      valueFormatter: (value) => value === null ? '–' : `${value.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`
    },
    {
      key: 'verweildauer',
      label: 'Verweildauer (Tage)',
      chartTitle: 'Verweildauer (VD.inkl.)',
      unit: 'Tage',
      decimals: 2,
      valueFormatter: (value) => value === null ? '–' : `${value.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Tage`
    }
  ];
  
  // Track flipped state for each card
  flippedCards: { [key: string]: boolean } = {
    pflegetage: false,
    stationsauslastung: false,
    verweildauer: false
  };

  // Shared Y-axis scales for visual comparison (separate for aggregated vs. stations)
  async ngOnInit() {
    Chart.register(...registerables);
    await this.stationGruppenService.loadStationGruppen();
    this.loadAufgestellteBetten();
    this.processChartData();
  }

  ngOnChanges() {
    this.processChartData();
  }

  private loadAufgestellteBetten() {
    this.api.getAufgestellteBetten().subscribe({
      next: (response: ResultsResponse) => {
        const bettenData: AufgestellteBettenData[] = [];
        
        response.uploads.forEach(upload => {
          upload.files.forEach(file => {
            if (file.values && Array.isArray(file.values)) {
              file.values.forEach(row => {
                bettenData.push({
                  IK: row['IK'] as string,
                  Standort: row['Standort'] as string,
                  Station: row['Station'] as string,
                  Jahr: row['Jahr'] as number,
                  Bettenanzahl: row['Bettenanzahl'] as number
                });
              });
            }
          });
        });
        
        this.aufgestellteBettenData.set(bettenData);
        console.log(`✅ Aufgestellte Betten geladen: ${bettenData.length} Stationen`);
        
        // Reprocess chart data with new bed data
        this.processChartData();
      },
      error: (err) => {
        console.warn('⚠️ Konnte Aufgestellte Betten nicht laden:', err);
      }
    });
  }

  /**
   * Findet die aufgestellten Betten für eine Station.
   * Matching-Strategie:
   * 1. Prüfe ob Station Teil einer Station-Gruppe ist → suche nach aggregierter Station
   * 2. Exakte Übereinstimmung (Station === AufgestellteBetten.Station)
   * 3. Präfix-Match (AufgestellteBetten.Station startet mit Station)
   * 4. Standort muss übereinstimmen
   */
  private findAufgestellteBetten(stationName: string, standort: string, year: number): number | null {
    const bettenData = this.aufgestellteBettenData();
    if (!bettenData || bettenData.length === 0) return null;

    // Normalisiere Stationsnamen für Vergleich
    const normalizedStation = stationName.trim().toUpperCase();

    // Filter für den richtigen Standort und Jahr
    const relevantData = bettenData.filter(
      b => b.Standort === standort && b.Jahr === year
    );

    if (relevantData.length === 0) {
      return null;
    }

    // 0. Spezialfall: Wenn Station Teil einer Station-Gruppe ist, suche zuerst nach aggregierter Station
    // z.B. PRNGHZS3 und PRNGHZS4 → suche nach "PRNGHZ Station S3/S4 GHZ" oder ähnlich
    const gruppe = this.stationGruppenService.getGruppeForStation(stationName);
    if (gruppe) {
      // Suche nach aggregierter Station, die die Gruppe repräsentiert
      // Mögliche Namen: "PRNGHZ Station S3/S4 GHZ", "PRNGHZ S3/S4", etc.
      const gruppeNameNormalized = gruppe.name.toUpperCase();
      const stationPrefix = normalizedStation.replace(/S\d+$/, '').trim(); // z.B. "PRNGHZ" aus "PRNGHZS3"
      
      // Suche nach Stationen, die den Gruppennamen oder das Präfix enthalten
      let gruppeMatch = relevantData.find(b => {
        const bettenStation = b.Station.trim().toUpperCase();
        // Suche nach "PRNGHZ Station S3/S4" oder ähnlichen Varianten
        return bettenStation.includes(gruppeNameNormalized) ||
               (bettenStation.includes(stationPrefix) && 
                (bettenStation.includes('S3') || bettenStation.includes('S4') || bettenStation.includes('S3/S4')));
      });
      
      if (gruppeMatch) {
        // Für Station-Gruppen: Teile die Betten durch die Anzahl der Stationen in der Gruppe
        // um zu vermeiden, dass die Betten doppelt gezählt werden
        const stationsInGruppe = this.stationGruppenService.getStationsInGruppe(gruppe.name);
        if (stationsInGruppe.length > 0) {
          // Wenn beide Stationen die gleiche aggregierte Station finden,
          // sollte jede Station nur ihren Anteil zurückgeben
          // Aber eigentlich sollten wir die Betten nicht teilen, sondern nur einmal zählen
          // Daher: Wenn die Station Teil einer Gruppe ist, gib die Betten zurück,
          // aber die Aggregation sollte sicherstellen, dass sie nicht doppelt gezählt werden
          return gruppeMatch.Bettenanzahl;
        }
        return gruppeMatch.Bettenanzahl;
      }
    }

    // 1. Versuche exakte Übereinstimmung
    let match = relevantData.find(
      b => b.Station.trim().toUpperCase() === normalizedStation
    );

    // 2. Versuche Präfix-Match (z.B. "PRNB1" matched "PRNB1 Station B1")
    if (!match) {
      match = relevantData.find(b => 
        b.Station.trim().toUpperCase().startsWith(normalizedStation) ||
        normalizedStation.startsWith(b.Station.trim().toUpperCase().split(' ')[0])
      );
    }

    // 3. Spezialfall für ROS: Stationen können nur Nummern sein (z.B. "112")
    if (!match && standort === 'ROS') {
      // Extrahiere führende Ziffern
      const stationNumber = normalizedStation.match(/^\d+/)?.[0];
      if (stationNumber) {
        match = relevantData.find(b => 
          b.Station.trim().startsWith(stationNumber + ' ')
        );
      }
    }

    if (match) {
      return match.Bettenanzahl;
    }

    // Keine aufgestellten Betten gefunden - wird als 0 behandelt (keine Planbetten als Fallback)
    return null;
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
        let totalBetten = 0; // Aufgestellte Betten (aus mitteilungen_betten), 0 wenn nicht verfügbar
        let totalStations = 0;
        let totalVerweildauer = 0;
        let verweildauerCount = 0;

        // Track betten by gruppe to avoid double counting
        const bettenByGruppe = new Map<string, number>(); // gruppe name -> betten
        const stationToGruppeMap = new Map<string, string>(); // station name -> gruppe name

        locationFiles.forEach(file => {
          if (!file.values || !Array.isArray(file.values)) return;

          file.values.forEach(row => {
            if (!row['Station']) return; // Skip rows without station
            
            totalStations++;
            
            const pflegetage = Number(row['Pflegetage']) || 0;
            totalPflegetage += pflegetage;

            const stationName = row['Station'].toString();
            
            // Verwende nur aufgestellte Betten (aus Schema mitteilungen_betten), keine Planbetten als Fallback
            const aufgestellteBetten = this.findAufgestellteBetten(stationName, location, year);
            const betten = aufgestellteBetten !== null ? aufgestellteBetten : 0;
            
            // Prüfe ob Station Teil einer Gruppe ist
            const gruppe = this.stationGruppenService.getGruppeForStation(stationName);
            if (gruppe && betten > 0) {
              // Wenn Station Teil einer Gruppe ist und Betten gefunden wurden,
              // prüfe ob andere Stationen aus derselben Gruppe bereits die gleichen Betten haben
              const gruppeName = gruppe.name;
              if (bettenByGruppe.has(gruppeName)) {
                // Gruppe wurde bereits gezählt, überspringe diese Station für totalBetten
                // (aber behalte die Betten für die einzelne Station, damit die Stationsauslastung korrekt ist)
              } else {
                // Erste Station aus dieser Gruppe mit Betten
                bettenByGruppe.set(gruppeName, betten);
                stationToGruppeMap.set(stationName, gruppeName);
                totalBetten += betten;
              }
            } else {
              // Station ist nicht in einer Gruppe oder hat keine Betten
              totalBetten += betten;
            }

            const verweildauer = Number(row['VD.inkl.']) || 0;
            if (verweildauer > 0) {
              totalVerweildauer += verweildauer;
              verweildauerCount++;
            }

            // Collect individual station data
            if (!stationDataMap.has(stationName)) {
              // Initialize station with 12 months of zero values
              const stationMonthlyData = [];
              for (let m = 1; m <= 12; m++) {
                stationMonthlyData.push({
                  month: m,
                  pflegetage: 0,
                  betten: 0,
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
            
            // Verwende nur aufgestellte Betten aus mitteilungen_betten (keine Planbetten als Fallback)
            const maxStationPflegetage = betten * kalendertage;
            const stationAuslastung = maxStationPflegetage > 0 ? (pflegetage / maxStationPflegetage) * 100 : 0;
            
            stationData.monthlyData[monthIndex] = {
              month: monthNumber,
              pflegetage,
              betten, // Aufgestellte Betten (aus mitteilungen_betten), 0 wenn nicht verfügbar
              verweildauer,
              stationsauslastung: stationAuslastung
            };
          });
        });

        // Calculate averages
        const avgVerweildauer = verweildauerCount > 0 ? totalVerweildauer / verweildauerCount : 0;
        
        // Stationsauslastung: Pflegetage / (Aufgestellte Betten × Kalendertage) × 100
        // Kalendertage aus Monat/Jahr berechnen
        const kalendertage = new Date(year, monthNumber, 0).getDate(); // Tatsächliche Tage im Monat
        const maxPflegetage = totalBetten * kalendertage;
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
    this.chartLoading.set(true);
    this.selectedLocation.set(location);
    this.selectedStation.set('all'); // Reset station to "all" when location changes
    this.updateAvailableStations();
  }

  onStationChange(station: string) {
    this.chartLoading.set(true);
    this.selectedStation.set(station);
  }

  openComparisonDialog(event?: MouseEvent) {
    event?.stopPropagation();

    const locationData = this.chartDataByLocation().find(loc => loc.location === this.selectedLocation());
    const series = this.comparisonSeries();

    if (!locationData || series.length === 0) {
      return;
    }

    const dialogData = {
      title: `Mitternachtsstatistik – Vergleich (${locationData.locationName})`,
      subtitle: `Jahr ${this.currentYear()}`,
      selectionLabel: 'Stationen',
      metrics: this.comparisonMetrics,
      series,
      monthLabels: this.monthLabels
    };

    this.dialog.open(ComparisonDialogComponent, {
      width: '1100px',
      maxWidth: '95vw',
      data: dialogData
    });
  }

  private updateAvailableStations() {
    const locationData = this.chartDataByLocation().find(loc => loc.location === this.selectedLocation());
    if (locationData && locationData.stations) {
      const allStations = locationData.stations.map(s => s.stationName);
      // Use service to get grouped station options
      const options = this.stationGruppenService.getStationOptions(allStations);
      this.availableStations.set(options);
    } else {
      this.availableStations.set([]);
    }
  }

  private calculateSharedScales(locationData: LocationChartData[]) {
    // Calculate shared min/max for each metric across all locations
    let aggregatedMaxPflegetage = 0;
    let stationMaxPflegetage = 0;
    let aggregatedMaxVerweildauer = 0;
    let stationMaxVerweildauer = 0;

    locationData.forEach(location => {
      location.monthlyData.forEach(month => {
        if (month.pflegetage > aggregatedMaxPflegetage) aggregatedMaxPflegetage = month.pflegetage;
        if (month.verweildauer > aggregatedMaxVerweildauer) aggregatedMaxVerweildauer = month.verweildauer;
      });

      location.stations?.forEach(station => {
        station.monthlyData.forEach(month => {
          if (month.pflegetage > stationMaxPflegetage) stationMaxPflegetage = month.pflegetage;
          if (month.verweildauer > stationMaxVerweildauer) stationMaxVerweildauer = month.verweildauer;
        });
      });
    });

    const addPadding = (value: number) => {
      const padded = Math.ceil(value * 1.1);
      return padded > 0 ? padded : 1; // Ensure chart always has a positive range
    };

    this.sharedScales.pflegetage.aggregated.max = addPadding(aggregatedMaxPflegetage);
    this.sharedScales.pflegetage.station.max = addPadding(stationMaxPflegetage);

    // Verweildauer: Fix auf 30 Tage für Skala (sowohl aggregiert als auch Station)
    this.sharedScales.verweildauer.aggregated.max = 30;
    this.sharedScales.verweildauer.station.max = 30;

    // Stationsauslastung is always represented as a percentage
    this.sharedScales.stationsauslastung.aggregated.max = 100;
    this.sharedScales.stationsauslastung.station.max = 100;
  }

  private createEmptyLineChart(): ChartData<'line'> {
    return {
      labels: [...this.monthLabels],
      datasets: []
    };
  }

  private buildPflegetageChartData(locationData: LocationChartData): ChartData<'line'> {
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

  private buildStationsauslastungChartData(locationData: LocationChartData): ChartData<'line'> {
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

  private buildVerweildauerChartData(locationData: LocationChartData): ChartData<'line'> {
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

  private buildCombinedChartData(locationData: LocationChartData): ChartData<'line'> {
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

  private buildChartOptions(title: string, yAxisLabel: string, metric?: 'pflegetage' | 'stationsauslastung' | 'verweildauer'): ChartConfiguration['options'] {
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
      const scaleMode = this.selectedStation() === 'all' ? 'aggregated' : 'station';
      yAxisConfig.min = this.sharedScales[metric][scaleMode].min;
      yAxisConfig.max = this.sharedScales[metric][scaleMode].max;
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

  getAuslastungTableData(locationData: LocationChartData) {
    const monthLabels = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
    
    // Wenn eine einzelne Station oder Gruppe ausgewählt ist
    if (this.selectedStation() !== 'all') {
      if (this.stationGruppenService.isGruppeName(this.selectedStation())) {
        // Group: aggregate betten (vermeide doppeltes Zählen wenn Stationen die gleiche aggregierte Station haben)
        const stationNames = this.stationGruppenService.getStationNamesForSelection(this.selectedStation());
        return locationData.monthlyData.map((data, index) => {
          const monthNumber = index + 1;
          let totalBetten = 0;
          const bettenValues = new Set<number>(); // Track eindeutige Betten-Werte
          
          stationNames.forEach(stationName => {
            const stationData = locationData.stations?.find(s => s.stationName === stationName);
            if (stationData) {
              const monthData = stationData.monthlyData.find(m => m.month === monthNumber);
              if (monthData && monthData.betten > 0) {
                const bettenValue = Number(monthData.betten) || 0;
                if (bettenValue > 0 && !bettenValues.has(bettenValue)) {
                  // Erste Station mit diesen Betten - zähle sie
                  bettenValues.add(bettenValue);
                  totalBetten += bettenValue;
                }
                // Wenn bettenValue bereits im Set ist, überspringe (wurde bereits gezählt)
              }
            }
          });
          
          return {
            month: monthLabels[index],
            betten: totalBetten,
            value: data.stationsauslastung
          };
        });
      } else {
        // Single station
        const stationData = locationData.stations?.find(s => s.stationName === this.selectedStation());
        if (stationData) {
          return stationData.monthlyData.map((data, index) => ({
            month: monthLabels[data.month - 1],
            betten: data.betten,
            value: data.stationsauslastung
          }));
        }
      }
    }
    
    // Für aggregierte Ansicht: Berechne Gesamtbetten für jeden Monat
    return locationData.monthlyData.map((data, index) => {
      // Berechne Gesamtbetten für diesen Monat aus allen Stationen
      // Wichtig: Vermeide doppeltes Zählen wenn Stationen aus derselben Gruppe die gleichen Betten haben
      let totalBetten = 0;
      const monthNumber = index + 1;
      const gruppenBetten = new Map<string, number>(); // Track Betten pro Gruppe (um doppeltes Zählen zu vermeiden)
      
      if (locationData.stations) {
        locationData.stations.forEach(station => {
          const monthData = station.monthlyData.find(m => m.month === monthNumber);
          if (monthData && monthData.betten > 0) {
            const bettenValue = Number(monthData.betten) || 0;
            
            // Prüfe ob Station Teil einer Gruppe ist
            const gruppe = this.stationGruppenService.getGruppeForStation(station.stationName);
            if (gruppe) {
              // Station ist in einer Gruppe
              const gruppeName = gruppe.name;
              if (gruppenBetten.has(gruppeName)) {
                // Gruppe wurde bereits gezählt - überspringe (vermeidet doppeltes Zählen)
                // z.B. PRNGHZS3 und PRNGHZS4 finden beide "PRNGHZ Station S3/S4 GHZ" mit 16 Betten
                // → nur einmal zählen
              } else {
                // Erste Station aus dieser Gruppe - zähle die Betten
                gruppenBetten.set(gruppeName, bettenValue);
                totalBetten += bettenValue;
              }
            } else {
              // Station ist nicht in einer Gruppe - zähle normal
              totalBetten += bettenValue;
            }
          }
        });
      }
      
      return {
        month: monthLabels[index],
        betten: totalBetten,
        value: data.stationsauslastung
      };
    });
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

      // Build fileName from all files - show actual filenames, not schema name
      const fileNames = (upload.files || [])
        .map(f => f.originalName || f.storedName || 'Unbekannte Datei')
        .filter(name => name && name !== 'Unbekannte Datei');
      
      const fileName = fileNames.length > 0 
        ? (fileNames.length === 1 
            ? fileNames[0] 
            : `${fileNames.length} Dateien: ${fileNames.join(', ')}`)
        : `${upload.schemaName} (${fileCount} ${fileCount === 1 ? 'Datei' : 'Dateien'})`;

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
        fileName: fileName,
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

