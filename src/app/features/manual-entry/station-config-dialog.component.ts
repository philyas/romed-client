import { Component, Inject, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Api } from '../../core/api';

export interface StationConfigDialogData {
  station: string;
  kategorie: string;
  schicht: 'tag' | 'nacht';
  schichtLabel: string; // "Tag" oder "Nacht"
}

@Component({
  selector: 'app-station-config-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatDividerModule,
    MatChipsModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSnackBarModule
  ],
  template: `
    <h2 mat-dialog-title>
      <mat-icon>settings</mat-icon>
      Stationskonfiguration bearbeiten
    </h2>
    
    <mat-dialog-content>
      <div class="config-info" *ngIf="!loading && !saving">
        <div class="info-section">
          <h3>Daten</h3>
          <div class="info-row">
            <span class="label">Station:</span>
            <span class="value">{{ data.station }}</span>
          </div>
          <div class="info-row">
            <span class="label">Kategorie:</span>
            <span class="value">{{ data.kategorie }}</span>
          </div>
          <div class="info-row">
            <span class="label">Schicht:</span>
            <mat-chip color="primary" selected>{{ data.schichtLabel }}</mat-chip>
          </div>
        </div>

        <mat-divider></mat-divider>

        <div class="info-section" *ngIf="configInfo">
          <div class="config-source-info" [class.from-snapshot]="configInfo.fromSnapshot" [class.from-default]="!configInfo.fromSnapshot">
            <mat-icon>{{ configInfo.fromSnapshot ? 'history' : 'settings' }}</mat-icon>
            <div class="config-source-text">
              <strong *ngIf="configInfo.fromSnapshot">
                Aktuelle Konfiguration von {{ configInfo.snapshotMonth }}/{{ configInfo.snapshotYear }}
              </strong>
              <strong *ngIf="!configInfo.fromSnapshot">
                Standard-Konfiguration (noch keine stationsspezifische Konfiguration vorhanden)
              </strong>
              <span *ngIf="configInfo.message" class="config-message">{{ configInfo.message }}</span>
            </div>
          </div>
        </div>

        <mat-divider></mat-divider>

        <div class="info-section">
          <h3>Stationsspezifische Konfiguration</h3>
          <p class="config-description">
            Diese Werte werden <strong>dauerhaft</strong> für diese Station, Kategorie und Schicht gespeichert 
            und bei zukünftigen Uploads und Berechnungen verwendet.
          </p>
          
          <div class="config-values">
            <div class="config-item">
              <div class="config-item-header">
                <mat-icon>schedule</mat-icon>
                <span class="config-label">Schichtstunden ({{ data.schichtLabel }})</span>
              </div>
              <mat-form-field appearance="outline" class="config-input-field">
                <input 
                  matInput 
                  type="number" 
                  [(ngModel)]="editedValues.schicht_stunden" 
                  step="0.1"
                  min="0.1"
                  (blur)="validateValue('schicht_stunden')">
                <span matSuffix>h</span>
              </mat-form-field>
            </div>

            <div class="config-item" *ngIf="data.kategorie === 'PFK'">
              <div class="config-item-header">
                <mat-icon>percent</mat-icon>
                <span class="config-label">PHK-Anteil Basis</span>
              </div>
              <mat-form-field appearance="outline" class="config-input-field">
                <input 
                  matInput 
                  type="number" 
                  [(ngModel)]="editedValues.phk_anteil_base" 
                  step="0.1"
                  min="1"
                  (blur)="validateValue('phk_anteil_base')">
              </mat-form-field>
            </div>

            <div class="config-item">
              <div class="config-item-header">
                <mat-icon>calculate</mat-icon>
                <span class="config-label">P:P-Ratio Basis ({{ data.schichtLabel }})</span>
              </div>
              <mat-form-field appearance="outline" class="config-input-field">
                <input 
                  matInput 
                  type="number" 
                  [(ngModel)]="editedValues.pp_ratio_base" 
                  step="0.1"
                  min="0.1"
                  (blur)="validateValue('pp_ratio_base')">
              </mat-form-field>
            </div>
          </div>
        </div>

        <mat-divider></mat-divider>

        <div class="info-section">
          <mat-icon color="primary">info</mat-icon>
          <div class="info-text">
            <strong>Hinweis:</strong> Diese Konfiguration wird dauerhaft für diese Station gespeichert 
            und bei allen zukünftigen Uploads und Berechnungen verwendet, bis Sie sie erneut ändern.
          </div>
        </div>
      </div>

      <div class="loading-container" *ngIf="loading || saving">
        <mat-spinner diameter="40"></mat-spinner>
        <p>{{ loading ? 'Lade Konfiguration...' : 'Speichere Konfiguration...' }}</p>
      </div>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button (click)="onCancel()" [disabled]="saving">Abbrechen</button>
      <button mat-raised-button color="primary" (click)="onSave()" [disabled]="!isValid() || loading || saving">
        <mat-icon>save</mat-icon>
        Konfiguration speichern
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
      min-width: 500px;
      max-width: 600px;
    }

    .config-info {
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

    .config-source-info {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 12px;
      border-radius: 8px;
      border-left: 4px solid;
    }

    .config-source-info.from-snapshot {
      background-color: #e3f2fd;
      border-left-color: #2196f3;
    }

    .config-source-info.from-default {
      background-color: #f5f5f5;
      border-left-color: #9e9e9e;
    }

    .config-source-info mat-icon {
      margin-top: 2px;
    }

    .config-source-text {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .config-source-text strong {
      font-weight: 600;
      color: #333;
    }

    .config-message {
      font-size: 12px;
      color: #666;
      font-style: italic;
    }

    .config-description {
      margin: 8px 0;
      color: #666;
      font-size: 14px;
    }

    .config-values {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-top: 8px;
    }

    .config-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px;
      background-color: #f5f5f5;
      border-radius: 8px;
      border-left: 4px solid #0066cc;
      gap: 16px;
    }

    .config-input-field {
      width: 120px;
      margin: 0;
    }

    .config-input-field ::ng-deep .mat-mdc-form-field-subscript-wrapper {
      display: none;
    }

    .config-item-header {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .config-item-header mat-icon {
      color: #0066cc;
      font-size: 20px;
      width: 20px;
      height: 20px;
    }

    .config-label {
      font-weight: 500;
      color: #333;
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

    .loading-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 40px;
      gap: 16px;
    }

    .loading-container p {
      margin: 0;
      color: #666;
    }

    mat-dialog-actions {
      padding: 16px 24px;
    }

    mat-dialog-actions button {
      margin-left: 8px;
    }
  `]
})
export class StationConfigDialogComponent {
  private dialogRef = inject(MatDialogRef<StationConfigDialogComponent>);
  private api = inject(Api);
  private snackBar = inject(MatSnackBar);

  loading = false;
  saving = false;
  configInfo: {
    fromSnapshot: boolean;
    snapshotMonth?: number;
    snapshotYear?: number;
    message?: string;
  } | null = null;

  editedValues: {
    schicht_stunden: number;
    phk_anteil_base: number | null;
    pp_ratio_base: number;
  };

  constructor(@Inject(MAT_DIALOG_DATA) public data: StationConfigDialogData) {
    // Initialize with default values first (so fields are editable immediately)
    this.editedValues = {
      schicht_stunden: data.schicht === 'nacht' ? 8 : 16,
      phk_anteil_base: data.kategorie === 'PFK' ? 10 : null,
      pp_ratio_base: data.schicht === 'nacht' ? 20 : 10
    };
    // Load config from API (will override defaults if available)
    this.loadConfig();
  }

  loadConfig(): void {
    this.loading = true;
    const apiCall = this.data.schicht === 'nacht'
      ? this.api.getStationConfigNacht(this.data.station, this.data.kategorie)
      : this.api.getStationConfig(this.data.station, this.data.kategorie, this.data.schicht);

    apiCall.subscribe({
      next: (config) => {
        this.loading = false;
        this.editedValues = {
          schicht_stunden: config.schicht_stunden,
          phk_anteil_base: config.phk_anteil_base,
          pp_ratio_base: config.pp_ratio_base
        };
        this.configInfo = {
          fromSnapshot: config.fromSnapshot,
          snapshotMonth: config.snapshotMonth,
          snapshotYear: config.snapshotYear,
          message: config.message
        };
      },
      error: (err) => {
        this.loading = false;
        console.error('Error loading station config:', err);
        // Use defaults on error
        this.editedValues = {
          schicht_stunden: this.data.schicht === 'nacht' ? 8 : 16,
          phk_anteil_base: this.data.kategorie === 'PFK' ? 10 : null,
          pp_ratio_base: this.data.schicht === 'nacht' ? 20 : 10
        };
        this.configInfo = {
          fromSnapshot: false,
          message: 'Fehler beim Laden der Konfiguration. Standard-Werte werden verwendet.'
        };
      }
    });
  }

  validateValue(field: string): void {
    const value = this.editedValues[field as keyof typeof this.editedValues];
    if (value === null || value === undefined || (typeof value === 'number' && (isNaN(value) || value <= 0))) {
      // Reset to original value if invalid
      if (field === 'schicht_stunden') {
        this.editedValues.schicht_stunden = this.data.schicht === 'nacht' ? 8 : 16;
      } else if (field === 'phk_anteil_base') {
        this.editedValues.phk_anteil_base = 10;
      } else if (field === 'pp_ratio_base') {
        this.editedValues.pp_ratio_base = this.data.schicht === 'nacht' ? 20 : 10;
      }
    }
  }

  isValid(): boolean {
    return this.editedValues.schicht_stunden > 0 &&
           (this.editedValues.phk_anteil_base === null || this.editedValues.phk_anteil_base > 0) &&
           this.editedValues.pp_ratio_base > 0;
  }

  onCancel(): void {
    this.dialogRef.close(false);
  }

  onSave(): void {
    if (!this.isValid()) {
      return;
    }

    this.saving = true;
    const apiCall = this.data.schicht === 'nacht'
      ? this.api.updateStationConfigNacht(this.data.station, this.data.kategorie, this.editedValues)
      : this.api.updateStationConfig(this.data.station, this.data.kategorie, this.data.schicht, this.editedValues);

    apiCall.subscribe({
      next: (response) => {
        this.saving = false;
        this.snackBar.open('Konfiguration erfolgreich gespeichert', 'Schließen', {
          duration: 3000
        });
        this.dialogRef.close(true);
      },
      error: (err) => {
        this.saving = false;
        console.error('Error saving station config:', err);
        this.snackBar.open('Fehler beim Speichern der Konfiguration', 'Schließen', {
          duration: 5000
        });
      }
    });
  }
}


