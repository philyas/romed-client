import { Component, Input, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { UploadRecord } from '../../core/api';
import { MinaMitaChart } from './mina-mita-chart.component';
import { DataInfoPanel, DataInfoItem } from '../data-info-panel/data-info-panel';
import { MinaMitaComparisonDialogComponent } from './mina-mita-comparison-dialog.component';

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
    MatDialogModule,
    MatTooltipModule,
    MinaMitaChart,
    DataInfoPanel
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
              <mat-form-field appearance="outline" class="station-selector">
                <mat-label>
                  <mat-icon>meeting_room</mat-icon>
                  Station
                </mat-label>
                <mat-select 
                  [value]="selectedStation()" 
                  (selectionChange)="onStationChange($event.value)">
                  <mat-option value="all">Alle Stationen</mat-option>
                  <mat-option *ngFor="let station of availableStations()" [value]="station">
                    {{ station }}
                  </mat-option>
                </mat-select>
              </mat-form-field>

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
      flex-wrap: wrap;
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
      }

      .station-selector {
        width: 100%;
      }

      .comparison-button {
        width: 100%;
      }
    }
  `]
})
export class MinaMitaCharts {
  @Input() uploads: UploadRecord[] = [];
  
  upload = signal<UploadRecord | null>(null);
  selectedStation = signal<string>('all');
  availableStations = signal<string[]>([]);
  dataInfoItems = signal<DataInfoItem[]>([]);

  constructor(private dialog: MatDialog) {
    effect(() => {
      const minaMinaUploads = this.uploads.filter(u => u.schemaId === 'ppugv_bestaende');
      if (minaMinaUploads.length > 0) {
        const latestUpload = minaMinaUploads[0];
        this.upload.set(latestUpload);

        if (latestUpload.files && latestUpload.files.length > 0) {
          const file = latestUpload.files[0];
          
          // Extract stations from monthly averages or raw values
          const stationSet = new Set<string>();
          
          if ((file as any).monthlyAverages) {
            // Use pre-calculated monthly averages
            const averages = (file as any).monthlyAverages;
            averages.forEach((row: any) => {
              if (row.Station) stationSet.add(String(row.Station));
            });
          } else if ((file as any).values && Array.isArray((file as any).values)) {
            // Fallback: Extract from raw values
            const values = (file as any).values;
            values.forEach((row: any) => {
              if (row.Station) stationSet.add(String(row.Station));
            });
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
          this.availableStations.set(stations);
        }

        // Prepare data info items
        this.prepareDataInfoItems(latestUpload);
      } else {
        this.upload.set(null);
        this.availableStations.set([]);
        this.dataInfoItems.set([]);
      }
    });
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

