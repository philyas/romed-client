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

export interface RecomputeConfigDialogData {
  station: string;
  jahr: number;
  monat: number;
  kategorie: string;
  schicht: 'tag' | 'nacht';
  schicht_stunden: number;
  phk_anteil_base: number | null;
  pp_ratio_base: number;
  schichtLabel: string; // "Tag" oder "Nacht"
}

@Component({
  selector: 'app-recompute-config-dialog',
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
    MatInputModule
  ],
  template: `
    <h2 mat-dialog-title>
      <mat-icon>refresh</mat-icon>
      Neuberechnung bestätigen
    </h2>
    
    <mat-dialog-content>
      <div class="config-info">
        <div class="info-section">
          <h3>Daten</h3>
          <div class="info-row">
            <span class="label">Station:</span>
            <span class="value">{{ data.station }}</span>
          </div>
          <div class="info-row">
            <span class="label">Zeitraum:</span>
            <span class="value">{{ data.monat }}/{{ data.jahr }}</span>
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

        <div class="info-section">
          <h3>Aktuelle Konfiguration</h3>
          <p class="config-description">
            Die folgenden Werte werden für die Neuberechnung verwendet:
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

            <div class="config-item" *ngIf="data.phk_anteil_base !== null">
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

        <div class="warning-section">
          <mat-icon color="warn">warning</mat-icon>
          <div class="warning-text">
            <strong>Hinweis:</strong> Alle berechneten Werte (PFK Normal, Gesamt PFK/PHK, PHK End, PHK Anrechenbar) 
            werden mit dieser Konfiguration neu berechnet. Die eingegebenen Stunden und Minuten bleiben unverändert.
          </div>
        </div>
      </div>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button (click)="onCancel()">Abbrechen</button>
      <button mat-raised-button color="primary" (click)="onConfirm()" [disabled]="!isValid()">
        <mat-icon>refresh</mat-icon>
        Neuberechnen
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

    .config-value {
      font-weight: 600;
      font-size: 16px;
      color: #0066cc;
    }

    .warning-section {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 12px;
      background-color: #fff3cd;
      border-radius: 8px;
      border-left: 4px solid #ffc107;
    }

    .warning-section mat-icon {
      color: #ffc107;
      margin-top: 2px;
    }

    .warning-text {
      flex: 1;
      font-size: 14px;
      color: #856404;
    }

    .warning-text strong {
      font-weight: 600;
    }

    mat-dialog-actions {
      padding: 16px 24px;
    }

    mat-dialog-actions button {
      margin-left: 8px;
    }
  `]
})
export class RecomputeConfigDialogComponent {
  private dialogRef = inject(MatDialogRef<RecomputeConfigDialogComponent>);

  editedValues: {
    schicht_stunden: number;
    phk_anteil_base: number | null;
    pp_ratio_base: number;
  };

  constructor(@Inject(MAT_DIALOG_DATA) public data: RecomputeConfigDialogData) {
    // Initialize edited values with current values
    this.editedValues = {
      schicht_stunden: data.schicht_stunden,
      phk_anteil_base: data.phk_anteil_base,
      pp_ratio_base: data.pp_ratio_base
    };
  }

  validateValue(field: string): void {
    const value = this.editedValues[field as keyof typeof this.editedValues];
    if (value === null || value === undefined || (typeof value === 'number' && (isNaN(value) || value <= 0))) {
      // Reset to original value if invalid
      if (field === 'schicht_stunden') {
        this.editedValues.schicht_stunden = this.data.schicht_stunden;
      } else if (field === 'phk_anteil_base') {
        this.editedValues.phk_anteil_base = this.data.phk_anteil_base;
      } else if (field === 'pp_ratio_base') {
        this.editedValues.pp_ratio_base = this.data.pp_ratio_base;
      }
    }
  }

  hasChanges(): boolean {
    return this.editedValues.schicht_stunden !== this.data.schicht_stunden ||
           this.editedValues.phk_anteil_base !== this.data.phk_anteil_base ||
           this.editedValues.pp_ratio_base !== this.data.pp_ratio_base;
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

