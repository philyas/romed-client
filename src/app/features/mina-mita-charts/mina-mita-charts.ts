import { Component, Input, signal, effect, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { UploadRecord } from '../../core/api';
import { MinaMitaChart } from './mina-mita-chart.component';
import { DataInfoPanel, DataInfoItem } from '../data-info-panel/data-info-panel';
import { MinaMitaComparisonDialogComponent } from './mina-mita-comparison-dialog.component';
import { SearchableSelectComponent } from '../shared/searchable-select/searchable-select.component';

@Component({
  selector: 'app-mina-mita-charts',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatDialogModule,
    MatTooltipModule,
    MinaMitaChart,
    DataInfoPanel,
    SearchableSelectComponent
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
            <div class="actions" *ngIf="availableStations().length > 0">
              <app-searchable-select
                class="station-selector"
                label="Station"
                icon="meeting_room"
                [options]="availableStations()"
                [value]="selectedStation()"
                [includeAllOption]="true"
                [allValue]="'all'"
                [allLabel]="'Alle Stationen'"
                (valueChange)="onStationChange($event)"
              ></app-searchable-select>

              <button
                mat-stroked-button
                color="primary"
                class="comparison-button"
                (click)="openComparisonDialog()"
                matTooltip="Vergleichen Sie bis zu vier Stationen (MiNa)">
                <mat-icon>compare</mat-icon>
                Vergleich (MiNa)
              </button>
            </div>
          </div>
        </mat-card-header>
        
        <mat-card-content>
          <!-- Data Info Panel -->
          <app-data-info-panel 
            *ngIf="dataInfoItems().length > 0"
            [dataItems]="dataInfoItems()"
            [expandedByDefault]="false">
          </app-data-info-panel>

          <div class="chart-section" *ngIf="upload()">
            <app-mina-mita-chart [uploads]="uploads" [selectedStation]="selectedStation()"></app-mina-mita-chart>
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

    .actions {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: nowrap;
    }

    .comparison-button {
      position: relative;
      z-index: 0;
      flex: 0 0 auto;
    }

    .comparison-button mat-icon {
      margin-right: 8px;
    }

    mat-card-title {
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 24px;
      font-weight: 600;
    }

    .station-selector {
      min-width: 250px;
      flex: 0 0 250px;
    }

    .station-selector mat-label {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .chart-section {
      width: 100%;
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

    @media (max-width: 1100px) {
      .actions {
        flex-wrap: wrap;
      }

      .station-selector {
        flex: 1 1 240px;
        min-width: 200px;
      }

      .comparison-button {
        flex: 1 1 auto;
      }
    }

    @media (max-width: 768px) {
      .header-container {
        flex-direction: column;
        align-items: flex-start;
        gap: 16px;
      }

      .actions {
        width: 100%;
        flex-direction: column;
        align-items: stretch;
        flex-wrap: wrap;
      }

      .station-selector {
        width: 100%;
        flex: 1 1 auto;
      }

      .comparison-button {
        width: 100%;
        justify-content: center;
      }
    }
  `]
})
export class MinaMitaCharts implements OnChanges {
  @Input() uploads: UploadRecord[] = [];
  
  upload = signal<UploadRecord | null>(null);
  selectedStation = signal<string>('all');
  availableStations = signal<string[]>([]);
  dataInfoItems = signal<DataInfoItem[]>([]);

  constructor(private dialog: MatDialog) {
    // Process data when component initializes
    this.processUploads();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['uploads']) {
      // Process uploads whenever they change, including the first time
      this.processUploads();
    }
  }

  private processUploads() {
    const minaMinaUploads = this.uploads.filter(u => u.schemaId === 'ppugv_bestaende');
    console.log('[MinaMitaCharts] processUploads: Found', minaMinaUploads.length, 'ppugv_bestaende uploads');
    
    if (minaMinaUploads.length > 0) {
      const latestUpload = minaMinaUploads[0];
      this.upload.set(latestUpload);
      console.log('[MinaMitaCharts] Using upload:', latestUpload.uploadId, 'with', latestUpload.files?.length || 0, 'files');

      if (latestUpload.files && latestUpload.files.length > 0) {
        const file = latestUpload.files[0];
        
        // Extract stations from monthly averages or raw values
        const stationSet = new Set<string>();
        
        if ((file as any).monthlyAverages && Array.isArray((file as any).monthlyAverages)) {
          // Use pre-calculated monthly averages
          const averages = (file as any).monthlyAverages;
          console.log('[MinaMitaCharts] Found monthlyAverages:', averages.length, 'entries');
          averages.forEach((row: any) => {
            if (row.Station) {
              const station = String(row.Station).trim();
              if (station && station !== 'WASZNA') {
                stationSet.add(station);
              }
            }
          });
        } else if ((file as any).values && Array.isArray((file as any).values)) {
          // Fallback: Extract from raw values
          const values = (file as any).values;
          console.log('[MinaMitaCharts] Using values array:', values.length, 'entries');
          values.forEach((row: any) => {
            if (row.Station) {
              const station = String(row.Station).trim();
              if (station && station !== 'WASZNA') {
                stationSet.add(station);
              }
            }
          });
        } else {
          console.warn('[MinaMitaCharts] File has neither monthlyAverages nor values:', file);
        }
        
        const stations = Array.from(stationSet).sort((a, b) => {
          // Sort by station name/number
          const aNum = parseInt(a.replace(/\D/g, ''));
          const bNum = parseInt(b.replace(/\D/g, ''));
          if (!isNaN(aNum) && !isNaN(bNum)) {
            return aNum - bNum;
          }
          return a.localeCompare(b);
        });
        
        console.log('[MinaMitaCharts] Extracted stations:', stations.length, stations.slice(0, 5));
        this.availableStations.set(stations);
        
        // If no stations found but data exists, there might be an issue with station mapping
        if (stations.length === 0 && ((file as any).monthlyAverages?.length > 0 || (file as any).values?.length > 0)) {
          console.warn('[MinaMitaCharts] WARNING: Data exists but no stations could be extracted. This might indicate a station mapping issue.');
        }
      } else {
        console.warn('[MinaMitaCharts] No files found in upload');
        this.availableStations.set([]);
      }

      // Prepare data info items
      this.prepareDataInfoItems(latestUpload);
    } else {
      console.log('[MinaMitaCharts] No ppugv_bestaende uploads found in', this.uploads.length, 'total uploads');
      console.log('[MinaMitaCharts] Available schemaIds:', this.uploads.map(u => u.schemaId));
      this.upload.set(null);
      this.availableStations.set([]);
      this.dataInfoItems.set([]);
    }
  }

  onStationChange(station: string) {
    this.selectedStation.set(station);
  }

  openComparisonDialog() {
    const available = this.availableStations();
    if (available.length === 0) {
      return;
    }

    const minaUploads = this.uploads.filter(u => u.schemaId === 'ppugv_bestaende');
    if (minaUploads.length === 0) {
      return;
    }

    this.dialog.open(MinaMitaComparisonDialogComponent, {
      width: '960px',
      maxWidth: '95vw',
      data: {
        stations: available,
        uploads: minaUploads
      }
    });
  }

  private prepareDataInfoItems(upload: UploadRecord) {
    if (!upload) {
      this.dataInfoItems.set([]);
      return;
    }

    const items: DataInfoItem[] = upload.files.map(file => {
      let totalRecords = 0;
      
      // Count records from values or monthlyAverages
      if ((file as any).monthlyAverages) {
        totalRecords = (file as any).monthlyAverages.length;
      } else if (file.values) {
        totalRecords = file.values.length;
      }

      const monthNames = ['', 'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 
                         'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

      let dataMonth = '';
      const metadata = (file as any).metadata;
      if (metadata?.monthsInFile?.length) {
        const formattedMonths = metadata.monthsInFile.map((entry: string) => {
          const [year, month] = entry.split('-');
          const monthIndex = parseInt(month, 10);
          const label = monthNames[monthIndex] || entry;
          return `${label} ${year}`;
        });
        dataMonth = formattedMonths.join(', ');
      } else if (metadata?.month) {
        const monthNum = Number(metadata.month);
        const label = monthNames[monthNum] || metadata.month;
        const yearLabel = metadata.year ? ` ${metadata.year}` : '';
        dataMonth = `${label}${yearLabel}`.trim();
      } else if (upload.month) {
        const monthNum = parseInt(upload.month, 10);
        dataMonth = monthNames[monthNum] || upload.month;
      }

      // Use monthlyAverages or raw values as rawData
      const rawData = (file as any).monthlyAverages || file.values || [];

      return {
        fileName: file.originalName,
        uploadDate: upload.createdAt,
        dataMonth,
        recordCount: totalRecords,
        status: 'success' as const,
        rawData: rawData
      };
    });

    this.dataInfoItems.set(items);
  }
}

