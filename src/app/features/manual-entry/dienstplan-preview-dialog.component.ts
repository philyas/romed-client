import { Component, Inject, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef, MatDialog } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatChipsModule } from '@angular/material/chips';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatTableModule } from '@angular/material/table';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { UploadConfigDialogComponent } from './upload-config-dialog.component';

export interface DienstplanPreviewData {
  file: File;
  variant: '2026' | 'legacy';
  schicht?: 'tag' | 'nacht';
  preview: {
    fileName: string;
    variant: string;
    schichtFilter: string;
    totalEntries: number;
    stations: Array<{
      name: string;
      timeRange: { start: string; end: string } | null;
      categories: { tag: { PFK: number; PHK: number }; nacht: { PFK: number; PHK: number } };
      config: {
        tag: { PFK: any; PHK: any };
        nacht: { PFK: any; PHK: any };
      } | null;
    }>;
    summary: { tag: { PFK: number; PHK: number }; nacht: { PFK: number; PHK: number } };
  };
}

@Component({
  selector: 'app-dienstplan-preview-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatDividerModule,
    MatChipsModule,
    MatExpansionModule,
    MatTableModule,
    MatProgressSpinnerModule,
    MatFormFieldModule,
    MatInputModule
  ],
  template: `
    <h2 mat-dialog-title>
      <mat-icon>preview</mat-icon>
      Dienstplan-Vorschau & Konfiguration
    </h2>

    <mat-dialog-content>
      <div class="preview-content">
        <!-- File Info -->
        <div class="info-section">
          <h3>Datei-Informationen</h3>
          <div class="info-row">
            <span class="label">Dateiname:</span>
            <span class="value">{{ data.preview.fileName }}</span>
          </div>
          <div class="info-row">
            <span class="label">Format:</span>
            <mat-chip [color]="data.preview.variant === '2026' ? 'accent' : 'primary'" selected>
              {{ data.preview.variant === '2026' ? '2026' : 'Legacy' }}
            </mat-chip>
          </div>
          <div class="info-row" *ngIf="data.preview.schichtFilter !== 'alle'">
            <span class="label">Schicht-Filter:</span>
            <mat-chip color="primary" selected>{{ data.preview.schichtFilter === 'tag' ? 'Tag' : 'Nacht' }}</mat-chip>
          </div>
          <div class="info-row">
            <span class="label">Gesamt-Einträge:</span>
            <span class="value">{{ data.preview.totalEntries }}</span>
          </div>
        </div>

        <mat-divider></mat-divider>

        <!-- Summary -->
        <div class="info-section">
          <h3>Zusammenfassung</h3>
          <div class="summary-grid">
            <div class="summary-item">
              <mat-icon>wb_sunny</mat-icon>
              <div class="summary-text">
                <strong>Tag-Schicht:</strong>
                <span>{{ data.preview.summary.tag.PFK }} PFK, {{ data.preview.summary.tag.PHK }} PHK</span>
              </div>
            </div>
            <div class="summary-item">
              <mat-icon>nights_stay</mat-icon>
              <div class="summary-text">
                <strong>Nacht-Schicht:</strong>
                <span>{{ data.preview.summary.nacht.PFK }} PFK, {{ data.preview.summary.nacht.PHK }} PHK</span>
              </div>
            </div>
          </div>
        </div>

        <mat-divider></mat-divider>

        <!-- Stations Details -->
        <div class="info-section">
          <h3>Gefundene Stationen ({{ data.preview.stations.length }})</h3>

          <mat-accordion>
            <mat-expansion-panel *ngFor="let station of data.preview.stations; trackBy: trackByStation">
              <mat-expansion-panel-header>
                <mat-panel-title>
                  <mat-icon>business</mat-icon>
                  {{ station.name }}
                </mat-panel-title>
                <mat-panel-description>
                  {{ station.timeRange ? (station.timeRange.start + ' bis ' + station.timeRange.end) : 'Kein Zeitraum' }}
                </mat-panel-description>
              </mat-expansion-panel-header>

              <div class="station-details">
                <!-- Time Range -->
                <div class="detail-row" *ngIf="station.timeRange">
                  <span class="label">Zeitraum:</span>
                  <span class="value">{{ station.timeRange.start }} bis {{ station.timeRange.end }}</span>
                </div>

                <!-- Categories -->
                <div class="categories-section">
                  <h4>Daten pro Schicht/Kategorie:</h4>
                  <table mat-table [dataSource]="getCategoryData(station)" class="categories-table">
                    <ng-container matColumnDef="schicht">
                      <th mat-header-cell *matHeaderCellDef>Schicht</th>
                      <td mat-cell *matCellDef="let item">{{ item.schicht }}</td>
                    </ng-container>
                    <ng-container matColumnDef="pfk">
                      <th mat-header-cell *matHeaderCellDef>PFK</th>
                      <td mat-cell *matCellDef="let item">{{ item.pfk }}</td>
                    </ng-container>
                    <ng-container matColumnDef="phk">
                      <th mat-header-cell *matHeaderCellDef>PHK</th>
                      <td mat-cell *matCellDef="let item">{{ item.phk }}</td>
                    </ng-container>
                    <tr mat-header-row *matHeaderRowDef="['schicht', 'pfk', 'phk']"></tr>
                    <tr mat-row *matRowDef="let row; columns: ['schicht', 'pfk', 'phk'];"></tr>
                  </table>
                </div>

                <!-- Configuration -->
                <div class="config-section" *ngIf="station.config">
                  <h4>Konfiguration:</h4>
                  <div class="config-details">
                    <div class="config-schicht" *ngFor="let schichtKey of ['tag', 'nacht']">
                      <h5>{{ schichtKey === 'tag' ? 'Tag-Schicht' : 'Nacht-Schicht' }}</h5>
                      <div class="config-items">
                        <div class="config-item" *ngFor="let kategorieKey of ['PFK', 'PHK']">
                          <div class="config-header">
                            <mat-icon>{{ kategorieKey === 'PFK' ? 'calculate' : 'person' }}</mat-icon>
                            <span>{{ kategorieKey }}</span>
                          </div>
                          <div class="config-values" *ngIf="getEditedConfig(station.name, schichtKey, kategorieKey)">
                            <div class="config-value">
                              <div class="config-input-row">
                                <span class="config-label">Schichtstunden:</span>
                                <mat-form-field appearance="outline" class="config-input-field">
                                  <input
                                    matInput
                                    type="number"
                                    step="0.1"
                                    min="0.1"
                                    [(ngModel)]="getEditedConfig(station.name, schichtKey, kategorieKey).schicht_stunden"
                                    (blur)="validateValue(station.name, schichtKey, kategorieKey, 'schicht_stunden')">
                                  <span matSuffix>h</span>
                                </mat-form-field>
                              </div>
                            </div>
                            <div class="config-value" *ngIf="kategorieKey === 'PFK'">
                              <div class="config-input-row">
                                <span class="config-label">PHK-Anteil:</span>
                                <mat-form-field appearance="outline" class="config-input-field">
                                  <input
                                    matInput
                                    type="number"
                                    step="0.1"
                                    min="0"
                                    [(ngModel)]="getEditedConfig(station.name, schichtKey, kategorieKey).phk_anteil_base"
                                    (blur)="validateValue(station.name, schichtKey, kategorieKey, 'phk_anteil_base')">
                                  <span matSuffix>%</span>
                                </mat-form-field>
                              </div>
                            </div>
                            <div class="config-value">
                              <div class="config-input-row">
                                <span class="config-label">P:P-Ratio:</span>
                                <mat-form-field appearance="outline" class="config-input-field">
                                  <input
                                    matInput
                                    type="number"
                                    step="0.1"
                                    min="0.1"
                                    [(ngModel)]="getEditedConfig(station.name, schichtKey, kategorieKey).pp_ratio_base"
                                    (blur)="validateValue(station.name, schichtKey, kategorieKey, 'pp_ratio_base')">
                                </mat-form-field>
                              </div>
                            </div>
                            <div class="config-source" [class.from-station]="getEditedConfig(station.name, schichtKey, kategorieKey).fromStationConfig">
                              <mat-icon>{{ getEditedConfig(station.name, schichtKey, kategorieKey).fromStationConfig ? 'business' : 'settings' }}</mat-icon>
                              <span>{{ getEditedConfig(station.name, schichtKey, kategorieKey).fromStationConfig ? 'Stations-Konfiguration' : 'Globale Konfiguration' }}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </mat-expansion-panel>
          </mat-accordion>
        </div>

        <mat-divider></mat-divider>

        <div class="info-section">
          <mat-icon color="primary">info</mat-icon>
          <div class="info-text">
            <strong>Hinweis:</strong> Überprüfen Sie die erkannten Stationen und deren Konfiguration.
            Die Konfiguration der ersten Station wird für den gesamten Upload verwendet.
            Sie können die Werte direkt bearbeiten, bevor Sie hochladen.
          </div>
        </div>
      </div>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button (click)="onCancel()">Abbrechen</button>
      <button mat-raised-button color="primary" (click)="onUpload()">
        <mat-icon>upload</mat-icon>
        Speichern & Hochladen
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    h2 mat-dialog-title {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    mat-dialog-content {
      min-width: 700px;
      max-width: 900px;
      max-height: 80vh;
    }

    .preview-content {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .info-section {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .info-section h3 {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
      color: #333;
    }

    .info-section h4 {
      margin: 8px 0;
      font-size: 16px;
      font-weight: 500;
      color: #555;
    }

    .info-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 0;
    }

    .info-row .label {
      font-weight: 500;
      color: #666;
    }

    .info-row .value {
      font-weight: 600;
      color: #333;
    }

    .summary-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-top: 8px;
    }

    .summary-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px;
      background-color: #f5f5f5;
      border-radius: 8px;
      border-left: 4px solid #0066cc;
    }

    .summary-item mat-icon {
      color: #0066cc;
    }

    .summary-text {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .summary-text strong {
      font-weight: 600;
      color: #333;
    }

    .summary-text span {
      font-size: 14px;
      color: #666;
    }

    .station-details {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .detail-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 12px;
      background-color: #f9f9f9;
      border-radius: 6px;
    }

    .detail-row .label {
      font-weight: 500;
      color: #666;
    }

    .detail-row .value {
      font-weight: 600;
      color: #333;
    }

    .categories-section {
      margin-top: 8px;
    }

    .categories-table {
      width: 100%;
      margin-top: 8px;
    }

    .categories-table th, .categories-table td {
      padding: 8px 12px;
      text-align: center;
    }

    .categories-table th {
      background-color: #f5f5f5;
      font-weight: 600;
    }

    .config-section {
      margin-top: 16px;
    }

    .config-details {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .config-schicht {
      padding: 12px;
      background-color: #f8f9fa;
      border-radius: 8px;
      border-left: 4px solid #28a745;
    }

    .config-schicht h5 {
      margin: 0 0 12px 0;
      font-size: 16px;
      font-weight: 600;
      color: #333;
    }

    .config-items {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .config-item {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 12px;
      background-color: white;
      border-radius: 6px;
      border: 1px solid #e0e0e0;
    }

    .config-header {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .config-header mat-icon {
      color: #0066cc;
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .config-values {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-left: 26px;
    }

    .config-value {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .config-input-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .config-input-field {
      width: 100px;
      margin: 0;
    }

    .config-input-field ::ng-deep .mat-mdc-form-field-subscript-wrapper {
      display: none;
    }

    .config-label {
      font-size: 14px;
      color: #666;
      font-weight: 500;
    }

    .config-val {
      font-weight: 600;
      color: #333;
    }

    .config-source {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-top: 8px;
      padding: 6px 10px;
      background-color: #e3f2fd;
      border-radius: 4px;
      font-size: 12px;
      color: #1976d2;
    }

    .config-source mat-icon {
      font-size: 14px;
      width: 14px;
      height: 14px;
    }

    .config-source.from-station {
      background-color: #f3e5f5;
      color: #7b1fa2;
    }

    .info-section {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 12px;
      background-color: #e3f2fd;
      border-radius: 8px;
      border-left: 4px solid #2196f3;
    }

    .info-section mat-icon {
      color: #2196f3;
      margin-top: 2px;
    }

    .info-text {
      flex: 1;
      font-size: 14px;
      color: #1976d2;
    }

    .info-text strong {
      font-weight: 600;
    }

    mat-dialog-actions {
      padding: 16px 24px;
    }

    mat-dialog-actions button {
      margin-left: 8px;
    }

    ::ng-deep .mat-mdc-expansion-panel-header {
      padding: 16px;
    }

    ::ng-deep .mat-mdc-expansion-panel-body {
      padding: 0 16px 16px 16px;
    }
  `]
})
export class DienstplanPreviewDialogComponent {
  private dialogRef = inject(MatDialogRef<DienstplanPreviewDialogComponent>);
  private dialog = inject(MatDialog);

  // Edited configuration values
  editedConfig: { [stationName: string]: { [schicht: string]: { [kategorie: string]: any } } } = {};

  constructor(@Inject(MAT_DIALOG_DATA) public data: DienstplanPreviewData) {
    // Initialize edited config with current values
    this.initializeEditedConfig();
  }

  private initializeEditedConfig(): void {
    this.data.preview.stations.forEach(station => {
      this.editedConfig[station.name] = {};
      (['tag', 'nacht'] as const).forEach(schicht => {
        this.editedConfig[station.name][schicht] = {};
        (['PFK', 'PHK'] as const).forEach(kategorie => {
          if (station.config && station.config[schicht] && station.config[schicht][kategorie]) {
            this.editedConfig[station.name][schicht][kategorie] = {
              ...station.config[schicht][kategorie]
            };
          }
        });
      });
    });
  }

  trackByStation(index: number, station: any): string {
    return station.name;
  }

  getCategoryData(station: any): any[] {
    return [
      { schicht: 'Tag', pfk: station.categories.tag.PFK, phk: station.categories.tag.PHK },
      { schicht: 'Nacht', pfk: station.categories.nacht.PFK, phk: station.categories.nacht.PHK }
    ];
  }

  getEditedConfig(stationName: string, schicht: string, kategorie: string): any {
    return this.editedConfig[stationName]?.[schicht]?.[kategorie] || null;
  }

  validateValue(stationName: string, schicht: string, kategorie: string, field: string): void {
    const config = this.editedConfig[stationName]?.[schicht]?.[kategorie];
    if (!config) return;

    const value = config[field];
    if (value === null || value === undefined || (typeof value === 'number' && (isNaN(value) || value <= 0))) {
      // Reset to original value if invalid
      if (field === 'schicht_stunden') {
        config.schicht_stunden = schicht === 'nacht' ? 8 : 16;
      } else if (field === 'phk_anteil_base') {
        config.phk_anteil_base = 10;
      } else if (field === 'pp_ratio_base') {
        config.pp_ratio_base = schicht === 'nacht' ? 20 : 10;
      }
    }
  }

  onCancel(): void {
    this.dialogRef.close({ confirmed: false });
  }

  onUpload(): void {
    // Proceed with upload using the edited configuration
    this.dialogRef.close({
      confirmed: true,
      config: this.editedConfig, // Use edited configuration
      preview: this.data.preview
    });
  }
}
