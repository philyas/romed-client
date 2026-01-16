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
import { Api } from '../../core/api';

export interface UploadConfigDialogData {
  station: string;
  kategorie: string;
  schicht: 'tag' | 'nacht';
  schichtLabel: string; // "Tag" oder "Nacht"
  initialConfig?: {
    schicht_stunden: number;
    phk_anteil_base: number | null;
    pp_ratio_base: number;
    fromSnapshot: boolean;
    snapshotMonth?: number;
    snapshotYear?: number;
    message?: string;
  };
}

@Component({
  selector: 'app-upload-config-dialog',
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
    MatProgressSpinnerModule
  ],
  template: `
    <h2 mat-dialog-title>
      <mat-icon>upload</mat-icon>
      Upload-Konfiguration
    </h2>
    
    <mat-dialog-content>
      <div class="config-info" *ngIf="!loading">
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
                Letzte bekannte Konfiguration von {{ configInfo.snapshotMonth }}/{{ configInfo.snapshotYear }}
              </strong>
              <strong *ngIf="!configInfo.fromSnapshot">
                Standard-Konfiguration
              </strong>
              <span *ngIf="configInfo.message" class="config-message">{{ configInfo.message }}</span>
            </div>
          </div>
        </div>

        <mat-divider></mat-divider>

        <div class="info-section">
          <h3>Konfiguration für Upload</h3>
          <p class="config-description">
            Die folgenden Werte werden für die Berechnung beim Upload verwendet. 
            <strong>Alle Werte sind editierbar</strong> - Sie können diese jederzeit anpassen, 
            unabhängig davon, ob es Standard-Werte oder gespeicherte Konfigurationen sind.
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
                  (input)="onNumberInput($event, 'schicht_stunden')"
                  (blur)="validateValue('schicht_stunden')">
                <span matSuffix>h</span>
              </mat-form-field>
            </div>

            <div class="config-item" *ngIf="data.kategorie === 'PFK'">
              <div class="config-item-header">
                <mat-icon>percent</mat-icon>
                <span class="config-label">%PHP</span>
              </div>
              <mat-form-field appearance="outline" class="config-input-field">
                <input 
                  matInput 
                  type="number" 
                  [(ngModel)]="editedValues.phk_anteil_base" 
                  step="0.1"
                  min="1"
                  (input)="onNumberInput($event, 'phk_anteil_base')"
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
                  (input)="onNumberInput($event, 'pp_ratio_base')"
                  (blur)="validateValue('pp_ratio_base')">
              </mat-form-field>
            </div>
          </div>
        </div>

        <mat-divider></mat-divider>

        <div class="info-section">
          <mat-icon color="primary">info</mat-icon>
          <div class="info-text">
            <strong>Hinweis:</strong> Diese Konfiguration gilt nur für diesen Upload. 
            Alle Monate in der Datei werden mit diesen Werten berechnet. 
            Die Konfiguration wird für jeden Monat separat gespeichert.
          </div>
        </div>
      </div>

      <div class="loading-container" *ngIf="loading">
        <mat-spinner diameter="40"></mat-spinner>
        <p>Lade Konfiguration...</p>
      </div>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button (click)="onCancel()">Abbrechen</button>
      <button mat-raised-button color="primary" (click)="onConfirm()" [disabled]="!isValid() || loading">
        <mat-icon>upload</mat-icon>
        Upload starten
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

    .config-input-field input[type="number"]::-webkit-inner-spin-button,
    .config-input-field input[type="number"]::-webkit-outer-spin-button {
      -webkit-appearance: none;
      margin: 0;
    }

    .config-input-field input[type="number"] {
      -moz-appearance: textfield;
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
export class UploadConfigDialogComponent {
  private dialogRef = inject(MatDialogRef<UploadConfigDialogComponent>);
  private api = inject(Api);

  loading = false;
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

  constructor(@Inject(MAT_DIALOG_DATA) public data: UploadConfigDialogData) {
    // Initialize with provided config or defaults
    if (data.initialConfig) {
      this.editedValues = {
        schicht_stunden: data.initialConfig.schicht_stunden,
        phk_anteil_base: data.initialConfig.phk_anteil_base,
        pp_ratio_base: data.initialConfig.pp_ratio_base
      };
      this.configInfo = {
        fromSnapshot: data.initialConfig.fromSnapshot,
        snapshotMonth: data.initialConfig.snapshotMonth,
        snapshotYear: data.initialConfig.snapshotYear,
        message: data.initialConfig.message
      };
    } else {
      // Initialize with default values first (so fields are editable immediately)
      // Then load config from API to override if available
      this.editedValues = {
        schicht_stunden: data.schicht === 'nacht' ? 8 : 16,
        phk_anteil_base: data.kategorie === 'PFK' ? 10 : null,
        pp_ratio_base: data.schicht === 'nacht' ? 20 : 10
      };
      // Load config from API (will override defaults if available)
      this.loadConfig();
    }
  }

  loadConfig(): void {
    this.loading = true;
    this.api.getUploadConfig(this.data.station, this.data.kategorie, this.data.schicht).subscribe({
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
        console.error('Error loading upload config:', err);
        // Use defaults on error
        this.editedValues = {
          schicht_stunden: this.data.schicht === 'nacht' ? 8 : 16,
          phk_anteil_base: 10,
          pp_ratio_base: this.data.schicht === 'nacht' ? 20 : 10
        };
        this.configInfo = {
          fromSnapshot: false,
          message: 'Fehler beim Laden der Konfiguration. Standard-Werte werden verwendet.'
        };
      }
    });
  }

  onNumberInput(event: Event, field: string): void {
    const input = event.target as HTMLInputElement;
    if (input.value.includes(',')) {
      input.value = input.value.replace(',', '.');
      // Update the model value
      const numValue = parseFloat(input.value);
      if (!isNaN(numValue)) {
        (this.editedValues as any)[field] = numValue;
      }
    }
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

  onConfirm(): void {
    if (!this.isValid()) {
      return;
    }
    // Return the edited values
    this.dialogRef.close({
      confirmed: true,
      config: {
        schicht_stunden: this.editedValues.schicht_stunden,
        phk_anteil_base: this.editedValues.phk_anteil_base,
        pp_ratio_base: this.editedValues.pp_ratio_base
      }
    });
  }
}

