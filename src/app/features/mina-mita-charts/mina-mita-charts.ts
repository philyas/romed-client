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
          <div class="chart-section" *ngIf="upload()">
            <app-mina-mita-chart [uploads]="uploads" [selectedLocation]="selectedLocation()"></app-mina-mita-chart>
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
  `]
})
export class MinaMitaCharts {
  @Input() uploads: UploadRecord[] = [];
  
  upload = signal<UploadRecord | null>(null);
  selectedLocation = signal<string>('all');
  availableLocations = signal<string[]>([]);

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
          
          // Extract monthly averages to get available locations
          if ((file as any).monthlyAverages) {
            const averages = (file as any).monthlyAverages;

            // Extract available locations
            const hausSet = new Set<string>();
            averages.forEach((row: any) => {
              if (row.Haus) hausSet.add(String(row.Haus));
            });
            const locations = Array.from(hausSet).sort();
            this.availableLocations.set(locations);
          }
        }
      } else {
        this.upload.set(null);
        this.availableLocations.set([]);
      }
    });
  }

  onLocationChange(location: string) {
    this.selectedLocation.set(location);
  }
}

