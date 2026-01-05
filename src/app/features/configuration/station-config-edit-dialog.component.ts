import { Component, Inject, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';
import { Api } from '../../core/api';

interface StationConfig {
  station: string;
  tag_pfk: StationConfigValues | null;
  nacht_pfk: StationConfigValues | null;
  tag_phk: StationConfigValues | null;
  nacht_phk: StationConfigValues | null;
}

interface StationConfigValues {
  schicht_stunden: number;
  phk_anteil_base: number | null;
  pp_ratio_base: number;
}

@Component({
  selector: 'app-station-config-edit-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatDividerModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
  ],
  template: `
    <h2 mat-dialog-title>
      <mat-icon>edit</mat-icon>
      Stationskonfiguration bearbeiten - {{ data.stationConfig.station }}
    </h2>

    <mat-dialog-content>
      <div class="config-content" *ngIf="!loading">
        <div class="config-grid">
          <!-- Tag PFK -->
          <div class="config-section">
            <h4>Tag-Schicht (PFK)</h4>
            <div class="config-form">
              <mat-form-field appearance="outline">
                <mat-label>Schichtstunden</mat-label>
                <input matInput type="number" step="0.1" min="0.1"
                       [(ngModel)]="editedConfigs.tag_pfk.schicht_stunden">
                <span matSuffix>h</span>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>PHK-Anteil Basis</mat-label>
                <input matInput type="number" step="0.1" min="1"
                       [(ngModel)]="editedConfigs.tag_pfk.phk_anteil_base">
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>P:P-Ratio Basis</mat-label>
                <input matInput type="number" step="0.1" min="0.1"
                       [(ngModel)]="editedConfigs.tag_pfk.pp_ratio_base">
              </mat-form-field>
            </div>
          </div>

          <!-- Nacht PFK -->
          <div class="config-section">
            <h4>Nacht-Schicht (PFK)</h4>
            <div class="config-form">
              <mat-form-field appearance="outline">
                <mat-label>Schichtstunden</mat-label>
                <input matInput type="number" step="0.1" min="0.1"
                       [(ngModel)]="editedConfigs.nacht_pfk.schicht_stunden">
                <span matSuffix>h</span>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>PHK-Anteil Basis</mat-label>
                <input matInput type="number" step="0.1" min="1"
                       [(ngModel)]="editedConfigs.nacht_pfk.phk_anteil_base">
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>P:P-Ratio Basis</mat-label>
                <input matInput type="number" step="0.1" min="0.1"
                       [(ngModel)]="editedConfigs.nacht_pfk.pp_ratio_base">
              </mat-form-field>
            </div>
          </div>

          <!-- Tag PHK -->
          <div class="config-section">
            <h4>Tag-Schicht (PHK)</h4>
            <div class="config-form">
              <mat-form-field appearance="outline">
                <mat-label>Schichtstunden</mat-label>
                <input matInput type="number" step="0.1" min="0.1"
                       [(ngModel)]="editedConfigs.tag_phk.schicht_stunden">
                <span matSuffix>h</span>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>P:P-Ratio Basis</mat-label>
                <input matInput type="number" step="0.1" min="0.1"
                       [(ngModel)]="editedConfigs.tag_phk.pp_ratio_base">
              </mat-form-field>
            </div>
          </div>

          <!-- Nacht PHK -->
          <div class="config-section">
            <h4>Nacht-Schicht (PHK)</h4>
            <div class="config-form">
              <mat-form-field appearance="outline">
                <mat-label>Schichtstunden</mat-label>
                <input matInput type="number" step="0.1" min="0.1"
                       [(ngModel)]="editedConfigs.nacht_phk.schicht_stunden">
                <span matSuffix>h</span>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>P:P-Ratio Basis</mat-label>
                <input matInput type="number" step="0.1" min="0.1"
                       [(ngModel)]="editedConfigs.nacht_phk.pp_ratio_base">
              </mat-form-field>
            </div>
          </div>
        </div>
      </div>

      <div class="loading-container" *ngIf="loading">
        <mat-spinner diameter="40"></mat-spinner>
        <p>Lade Konfiguration...</p>
      </div>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button (click)="onCancel()" [disabled]="saving">Abbrechen</button>
      <button mat-raised-button color="primary" (click)="onSave()" [disabled]="!isValid() || loading || saving">
        <mat-icon *ngIf="saving">hourglass_empty</mat-icon>
        <mat-icon *ngIf="!saving">save</mat-icon>
        {{ saving ? 'Speichere...' : 'Konfiguration speichern' }}
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
      min-width: 800px;
      max-width: 1200px;
      max-height: 80vh;
    }

    .config-content {
      margin-top: 16px;
    }

    .config-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
      gap: 24px;
    }

    .config-section {
      background: #f8f9fa;
      border-radius: 8px;
      padding: 20px;
      border: 1px solid #e0e0e0;

      h4 {
        margin: 0 0 16px 0;
        font-size: 16px;
        font-weight: 600;
        color: #00acc1;
        text-align: center;
        padding-bottom: 8px;
        border-bottom: 2px solid #00acc1;
      }
    }

    .config-form {
      display: grid;
      grid-template-columns: 1fr;
      gap: 12px;
      margin-top: 16px;
    }

    .loading-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 40px;
      gap: 16px;

      p {
        margin: 0;
        color: #666;
      }
    }

    mat-dialog-actions {
      padding: 16px 24px;
      border-top: 1px solid #e0e0e0;

      button {
        margin-left: 8px;
      }
    }
  `]
})
export class StationConfigEditDialogComponent {
  private dialogRef = inject(MatDialogRef<StationConfigEditDialogComponent>);
  private api = inject(Api);
  private snackBar = inject(MatSnackBar);

  loading = false;
  saving = false;

  editedConfigs: {
    tag_pfk: StationConfigValues;
    nacht_pfk: StationConfigValues;
    tag_phk: StationConfigValues;
    nacht_phk: StationConfigValues;
  };

  constructor(@Inject(MAT_DIALOG_DATA) public data: { stationConfig: StationConfig }) {
    // Initialize with existing values or defaults
    this.editedConfigs = {
      tag_pfk: this.initConfigValues(data.stationConfig.tag_pfk, 'tag', 'PFK'),
      nacht_pfk: this.initConfigValues(data.stationConfig.nacht_pfk, 'nacht', 'PFK'),
      tag_phk: this.initConfigValues(data.stationConfig.tag_phk, 'tag', 'PHK'),
      nacht_phk: this.initConfigValues(data.stationConfig.nacht_phk, 'nacht', 'PHK')
    };
  }

  private initConfigValues(existing: StationConfigValues | null, schicht: 'tag' | 'nacht', kategorie: 'PFK' | 'PHK'): StationConfigValues {
    if (existing) {
      return { ...existing };
    }

    // Default values
    const defaults = {
      schicht_stunden: schicht === 'nacht' ? 8 : 16,
      phk_anteil_base: kategorie === 'PFK' ? 10 : null,
      pp_ratio_base: schicht === 'nacht' ? 20 : 10
    };

    return defaults;
  }

  isValid(): boolean {
    return Object.values(this.editedConfigs).every(config =>
      config.schicht_stunden > 0 &&
      config.pp_ratio_base > 0 &&
      (config.phk_anteil_base === null || config.phk_anteil_base > 0)
    );
  }


  onCancel(): void {
    this.dialogRef.close(false);
  }

  async onSave(): Promise<void> {
    if (!this.isValid()) {
      return;
    }

    this.saving = true;

    try {
      // Save all configurations
      const savePromises = [
        this.saveConfig('tag', 'PFK', this.editedConfigs.tag_pfk),
        this.saveConfig('nacht', 'PFK', this.editedConfigs.nacht_pfk),
        this.saveConfig('tag', 'PHK', this.editedConfigs.tag_phk),
        this.saveConfig('nacht', 'PHK', this.editedConfigs.nacht_phk)
      ];

      await Promise.all(savePromises);

      this.saving = false;
      this.snackBar.open('Konfiguration erfolgreich gespeichert', 'Schließen', { duration: 3000 });
      this.dialogRef.close(true);
    } catch (error) {
      this.saving = false;
      console.error('Error saving station configs:', error);
      this.snackBar.open('Fehler beim Speichern der Konfiguration', 'Schließen', { duration: 5000 });
    }
  }

  private async saveConfig(schicht: 'tag' | 'nacht', kategorie: 'PFK' | 'PHK', config: StationConfigValues): Promise<void> {
    const configData = {
      schicht_stunden: config.schicht_stunden,
      phk_anteil_base: config.phk_anteil_base,
      pp_ratio_base: config.pp_ratio_base
    };

    if (schicht === 'nacht') {
      await firstValueFrom(this.api.updateStationConfigNacht(this.data.stationConfig.station, kategorie, configData));
    } else {
      await firstValueFrom(this.api.updateStationConfig(this.data.stationConfig.station, kategorie, schicht, configData));
    }
  }
}