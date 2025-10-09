import { Component, Input, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { UploadRecord } from '../../core/api';
import { MinaMitaChart } from './mina-mita-chart.component';

@Component({
  selector: 'app-mina-mita-charts',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatSelectModule,
    MatFormFieldModule,
    MinaMitaChart
  ],
  template: `
    <div class="mina-mita-charts">
      <mat-card class="chart-card">
        <mat-card-header>
          <div class="header-container">
            <mat-card-title>
              <mat-icon>nights_stay</mat-icon>
              MiNa/MiTa-Bestände (PPUGV)
            </mat-card-title>
            <mat-form-field appearance="outline" class="location-selector" *ngIf="availableLocations().length > 0">
              <mat-label>
                <mat-icon>location_on</mat-icon>
                Standort
              </mat-label>
              <mat-select 
                [value]="selectedLocation()" 
                (selectionChange)="onLocationChange($event.value)">
                <mat-option value="all">Alle Standorte</mat-option>
                <mat-option *ngFor="let location of availableLocations()" [value]="location">
                  {{ locationNames[location] || location }}
                </mat-option>
              </mat-select>
            </mat-form-field>
          </div>
        </mat-card-header>
        
        <mat-card-content>
          <div class="info-section" *ngIf="upload()">
            <div class="upload-info">
              <p><strong>Datei:</strong> {{ upload()?.files?.[0]?.originalName }}</p>
              <p><strong>Hochgeladen:</strong> {{ formatDate(upload()?.createdAt) }}</p>
              <p *ngIf="selectedLocation() !== 'all'"><strong>Standort:</strong> {{ locationNames[selectedLocation()] || selectedLocation() }}</p>
            </div>

            <div class="data-summary" *ngIf="metadata()">
              <h3>📊 Daten-Übersicht</h3>
              <div class="summary-grid">
                <div class="summary-item">
                  <span class="label">Jahr/Monat:</span>
                  <span class="value">{{ metadata()?.year }}-{{ padMonth(metadata()?.month) }}</span>
                </div>
                <div class="summary-item">
                  <span class="label">Tage:</span>
                  <span class="value">{{ metadata()?.totalDays }}</span>
                </div>
                <div class="summary-item">
                  <span class="label">Stationen:</span>
                  <span class="value">{{ filteredStationCount() }}</span>
                </div>
                <div class="summary-item">
                  <span class="label">Tagesdaten:</span>
                  <span class="value">{{ dailyDataCount() }} Zeilen</span>
                </div>
              </div>
            </div>

            <!-- Chart Section -->
            <div class="chart-section">
              <app-mina-mita-chart [uploads]="uploads" [selectedLocation]="selectedLocation()"></app-mina-mita-chart>
            </div>

            <div class="averages-section" *ngIf="monthlyAverages().length > 0">
              <h3>📈 Top 10 Stationen (Monatsdurchschnitt MiNa)</h3>
              <div class="averages-list">
                <div class="average-item" *ngFor="let avg of topStations()">
                  <div class="station-info">
                    <span class="station-name">{{ avg.Station }}</span>
                    <span class="station-haus">({{ avg.Haus }})</span>
                  </div>
                  <div class="station-values">
                    <div class="value-pair">
                      <span class="label">🌙 MiNa Ø:</span>
                      <span class="value">{{ avg.MiNa_Durchschnitt.toFixed(2) }}</span>
                    </div>
                    <div class="value-pair">
                      <span class="label">☀️ MiTa Ø:</span>
                      <span class="value">{{ avg.MiTa_Durchschnitt.toFixed(2) }}</span>
                    </div>
                    <div class="value-pair">
                      <span class="label">📊 Diff:</span>
                      <span class="value" [class.positive]="avg.MiTa_Durchschnitt > avg.MiNa_Durchschnitt"
                                        [class.negative]="avg.MiTa_Durchschnitt < avg.MiNa_Durchschnitt">
                        {{ (avg.MiTa_Durchschnitt - avg.MiNa_Durchschnitt).toFixed(2) }}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div class="by-haus-section" *ngIf="monthlyAverages().length > 0">
              <h3>🏥 Durchschnitte nach Haus</h3>
              <div class="haus-grid">
                <div class="haus-item" *ngFor="let item of hausSummary()">
                  <div class="haus-header">
                    <h4>{{ item.haus }}</h4>
                    <span class="station-count">{{ item.stationCount }} Stationen</span>
                  </div>
                  <div class="haus-values">
                    <div class="value-row">
                      <span class="label">🌙 MiNa Ø:</span>
                      <span class="value">{{ item.avgMiNa.toFixed(2) }}</span>
                    </div>
                    <div class="value-row">
                      <span class="label">☀️ MiTa Ø:</span>
                      <span class="value">{{ item.avgMiTa.toFixed(2) }}</span>
                    </div>
                    <div class="value-row">
                      <span class="label">📊 Gesamt:</span>
                      <span class="value">{{ item.totalMiNa.toFixed(0) }} / {{ item.totalMiTa.toFixed(0) }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="no-data" *ngIf="!upload()">
            <mat-icon>info</mat-icon>
            <p>Keine MiNa/MiTa-Daten vorhanden</p>
          </div>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .mina-mita-charts {
      width: 100%;
    }

    .chart-card {
      margin: 20px 0;
    }

    mat-card-header {
      margin-bottom: 20px;
    }

    .header-container {
      display: flex;
      justify-content: space-between;
      align-items: center;
      width: 100%;
      gap: 20px;
    }

    mat-card-title {
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 24px;
      font-weight: 600;
    }

    .location-selector {
      min-width: 250px;
    }

    .location-selector mat-label {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .info-section {
      display: flex;
      flex-direction: column;
      gap: 24px;
    }

    .upload-info {
      background: #f5f5f5;
      padding: 16px;
      border-radius: 8px;
    }

    .upload-info p {
      margin: 8px 0;
    }

    .data-summary h3,
    .averages-section h3,
    .by-haus-section h3 {
      margin-bottom: 16px;
      font-size: 18px;
      font-weight: 600;
    }

    .summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
    }

    .summary-item {
      display: flex;
      justify-content: space-between;
      padding: 12px;
      background: #f9f9f9;
      border-radius: 6px;
    }

    .summary-item .label {
      font-weight: 500;
      color: #666;
    }

    .summary-item .value {
      font-weight: 600;
      color: #1976d2;
    }

    .chart-section {
      margin-top: 24px;
    }

    .averages-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .average-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px;
      background: #fafafa;
      border-radius: 8px;
      border-left: 4px solid #1976d2;
    }

    .station-info {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .station-name {
      font-weight: 600;
      font-size: 16px;
    }

    .station-haus {
      color: #666;
      font-size: 14px;
    }

    .station-values {
      display: flex;
      gap: 24px;
    }

    .value-pair {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 4px;
    }

    .value-pair .label {
      font-size: 12px;
      color: #666;
    }

    .value-pair .value {
      font-weight: 600;
      font-size: 16px;
    }

    .value-pair .value.positive {
      color: #4caf50;
    }

    .value-pair .value.negative {
      color: #f44336;
    }

    .haus-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 16px;
    }

    .haus-item {
      padding: 16px;
      background: #f5f5f5;
      border-radius: 8px;
      border-top: 3px solid #1976d2;
    }

    .haus-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
      padding-bottom: 8px;
      border-bottom: 1px solid #ddd;
    }

    .haus-header h4 {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
    }

    .station-count {
      color: #666;
      font-size: 14px;
    }

    .haus-values {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .value-row {
      display: flex;
      justify-content: space-between;
      padding: 6px 0;
    }

    .value-row .label {
      color: #666;
    }

    .value-row .value {
      font-weight: 600;
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
  `]
})
export class MinaMitaCharts {
  @Input() uploads: UploadRecord[] = [];
  
  upload = signal<UploadRecord | null>(null);
  metadata = signal<any>(null);
  dailyDataCount = signal<number>(0);
  monthlyAverages = signal<any[]>([]);
  topStations = signal<any[]>([]);
  hausSummary = signal<any[]>([]);
  selectedLocation = signal<string>('all');
  availableLocations = signal<string[]>([]);
  filteredStationCount = signal<number>(0);

  readonly locationNames: Record<string, string> = {
    'BAB': 'BAB',
    'PRI': 'PRI',
    'ROS': 'ROS',
    'WAS': 'WAS',
    'CO': 'CO'
  };

  constructor() {
    effect(() => {
      const minaMinaUploads = this.uploads.filter(u => u.schemaId === 'ppugv_bestaende');
      if (minaMinaUploads.length > 0) {
        const latestUpload = minaMinaUploads[0];
        this.upload.set(latestUpload);

        if (latestUpload.files && latestUpload.files.length > 0) {
          const file = latestUpload.files[0];
          
          // Extract metadata
          if ((file as any).metadata) {
            this.metadata.set((file as any).metadata);
          }

          // Extract daily data count
          if ((file as any).dailyData) {
            this.dailyDataCount.set((file as any).dailyData.length);
          }

          // Extract monthly averages
          if ((file as any).monthlyAverages) {
            const averages = (file as any).monthlyAverages;
            this.monthlyAverages.set(averages);

            // Extract available locations
            const hausSet = new Set<string>();
            averages.forEach((row: any) => {
              if (row.Haus) hausSet.add(String(row.Haus));
            });
            const locations = Array.from(hausSet).sort();
            this.availableLocations.set(locations);

            // Update filtered data based on selected location
            this.updateFilteredData(averages);
          }
        }
      } else {
        this.upload.set(null);
        this.metadata.set(null);
        this.dailyDataCount.set(0);
        this.monthlyAverages.set([]);
        this.topStations.set([]);
        this.hausSummary.set([]);
        this.availableLocations.set([]);
        this.filteredStationCount.set(0);
      }
    });
  }

  private updateFilteredData(averages: any[]) {
    const selectedLoc = this.selectedLocation();
    
    // Filter data based on selected location
    const filteredAverages = selectedLoc === 'all' 
      ? averages 
      : averages.filter((row: any) => row.Haus === selectedLoc);

    // Update filtered station count
    this.filteredStationCount.set(filteredAverages.length);

    // Calculate top stations (filtered)
    const top = [...filteredAverages]
      .sort((a: any, b: any) => b.MiNa_Durchschnitt - a.MiNa_Durchschnitt)
      .slice(0, 10);
    this.topStations.set(top);

    // Calculate haus summary (filtered)
    const byHaus: any = {};
    filteredAverages.forEach((row: any) => {
      if (!byHaus[row.Haus]) {
        byHaus[row.Haus] = { totalMiNa: 0, totalMiTa: 0, count: 0 };
      }
      byHaus[row.Haus].totalMiNa += row.MiNa_Durchschnitt;
      byHaus[row.Haus].totalMiTa += row.MiTa_Durchschnitt;
      byHaus[row.Haus].count++;
    });

    const summary = Object.keys(byHaus).map(haus => ({
      haus,
      stationCount: byHaus[haus].count,
      totalMiNa: byHaus[haus].totalMiNa,
      totalMiTa: byHaus[haus].totalMiTa,
      avgMiNa: byHaus[haus].totalMiNa / byHaus[haus].count,
      avgMiTa: byHaus[haus].totalMiTa / byHaus[haus].count
    }));
    this.hausSummary.set(summary);
  }

  onLocationChange(location: string) {
    this.selectedLocation.set(location);
    
    // Re-filter data based on new location
    const averages = this.monthlyAverages();
    if (averages.length > 0) {
      this.updateFilteredData(averages);
    }
  }

  formatDate(dateString: string | undefined): string {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('de-DE', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  padMonth(month: number | undefined): string {
    if (!month) return '00';
    return month.toString().padStart(2, '0');
  }
}

