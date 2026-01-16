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
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSelectModule } from '@angular/material/select';
import { MatRadioModule } from '@angular/material/radio';
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
  pausen_aktiviert: boolean;
  pausen_start: string;
  pausen_ende: string;
  pausen_modus: 'addieren' | 'abziehen';
  pausen_von_datum?: string | null;
  pausen_bis_datum?: string | null;
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
    MatSlideToggleModule,
    MatSelectModule,
    MatRadioModule,
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
                       [(ngModel)]="editedConfigs.tag_pfk.schicht_stunden"
                       (input)="onNumberInput($event, 'tag_pfk', 'schicht_stunden')">
                <span matSuffix>h</span>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>%PHP Tag</mat-label>
                <input matInput type="number" step="0.1" min="1"
                       [(ngModel)]="editedConfigs.tag_pfk.phk_anteil_base"
                       (input)="onNumberInput($event, 'tag_pfk', 'phk_anteil_base')">
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>P:P-Ratio Basis</mat-label>
                <input matInput type="number" step="0.1" min="0.1"
                       [(ngModel)]="editedConfigs.tag_pfk.pp_ratio_base"
                       (input)="onNumberInput($event, 'tag_pfk', 'pp_ratio_base')">
              </mat-form-field>

              <div class="pausen-section">
                <mat-slide-toggle [(ngModel)]="editedConfigs.tag_pfk.pausen_aktiviert">
                  Pausenzeiten aktivieren
                </mat-slide-toggle>
                <div class="pausen-fields" *ngIf="editedConfigs.tag_pfk.pausen_aktiviert">
                  <div class="time-row">
                    <mat-form-field appearance="outline">
                      <mat-label>Pause Start</mat-label>
                      <input matInput type="time"
                             [(ngModel)]="editedConfigs.tag_pfk.pausen_start">
                    </mat-form-field>
                    <mat-form-field appearance="outline">
                      <mat-label>Pause Ende</mat-label>
                      <input matInput type="time"
                             [(ngModel)]="editedConfigs.tag_pfk.pausen_ende">
                    </mat-form-field>
                  </div>
                  <div class="pause-duration">
                    = {{ calculatePauseDuration(editedConfigs.tag_pfk.pausen_start, editedConfigs.tag_pfk.pausen_ende) }} Minuten
                  </div>
                  <div class="modus-row">
                    <label class="modus-label">Modus:</label>
                    <mat-radio-group [(ngModel)]="editedConfigs.tag_pfk.pausen_modus">
                      <mat-radio-button value="abziehen">Abziehen</mat-radio-button>
                      <mat-radio-button value="addieren">Addieren</mat-radio-button>
                    </mat-radio-group>
                  </div>
                  <div class="date-range-row">
                    <mat-form-field appearance="outline">
                      <mat-label>Von Datum (optional)</mat-label>
                      <input matInput type="date"
                             [(ngModel)]="editedConfigs.tag_pfk.pausen_von_datum">
                    </mat-form-field>
                    <mat-form-field appearance="outline">
                      <mat-label>Bis Datum (optional)</mat-label>
                      <input matInput type="date"
                             [(ngModel)]="editedConfigs.tag_pfk.pausen_bis_datum">
                    </mat-form-field>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Nacht PFK -->
          <div class="config-section">
            <h4>Nacht-Schicht (PFK)</h4>
            <div class="config-form">
              <mat-form-field appearance="outline">
                <mat-label>Schichtstunden</mat-label>
                <input matInput type="number" step="0.1" min="0.1"
                       [(ngModel)]="editedConfigs.nacht_pfk.schicht_stunden"
                       (input)="onNumberInput($event, 'nacht_pfk', 'schicht_stunden')">
                <span matSuffix>h</span>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>%PHP Nacht</mat-label>
                <input matInput type="number" step="0.1" min="1"
                       [(ngModel)]="editedConfigs.nacht_pfk.phk_anteil_base"
                       (input)="onNumberInput($event, 'nacht_pfk', 'phk_anteil_base')">
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>P:P-Ratio Basis</mat-label>
                <input matInput type="number" step="0.1" min="0.1"
                       [(ngModel)]="editedConfigs.nacht_pfk.pp_ratio_base"
                       (input)="onNumberInput($event, 'nacht_pfk', 'pp_ratio_base')">
              </mat-form-field>

              <div class="pausen-section">
                <mat-slide-toggle [(ngModel)]="editedConfigs.nacht_pfk.pausen_aktiviert">
                  Pausenzeiten aktivieren
                </mat-slide-toggle>
                <div class="pausen-fields" *ngIf="editedConfigs.nacht_pfk.pausen_aktiviert">
                  <div class="time-row">
                    <mat-form-field appearance="outline">
                      <mat-label>Pause Start</mat-label>
                      <input matInput type="time"
                             [(ngModel)]="editedConfigs.nacht_pfk.pausen_start">
                    </mat-form-field>
                    <mat-form-field appearance="outline">
                      <mat-label>Pause Ende</mat-label>
                      <input matInput type="time"
                             [(ngModel)]="editedConfigs.nacht_pfk.pausen_ende">
                    </mat-form-field>
                  </div>
                  <div class="pause-duration">
                    = {{ calculatePauseDuration(editedConfigs.nacht_pfk.pausen_start, editedConfigs.nacht_pfk.pausen_ende) }} Minuten
                  </div>
                  <div class="modus-row">
                    <label class="modus-label">Modus:</label>
                    <mat-radio-group [(ngModel)]="editedConfigs.nacht_pfk.pausen_modus">
                      <mat-radio-button value="abziehen">Abziehen</mat-radio-button>
                      <mat-radio-button value="addieren">Addieren</mat-radio-button>
                    </mat-radio-group>
                  </div>
                  <div class="date-range-row">
                    <mat-form-field appearance="outline">
                      <mat-label>Von Datum (optional)</mat-label>
                      <input matInput type="date"
                             [(ngModel)]="editedConfigs.nacht_pfk.pausen_von_datum">
                    </mat-form-field>
                    <mat-form-field appearance="outline">
                      <mat-label>Bis Datum (optional)</mat-label>
                      <input matInput type="date"
                             [(ngModel)]="editedConfigs.nacht_pfk.pausen_bis_datum">
                    </mat-form-field>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Tag PHK -->
          <div class="config-section">
            <h4>Tag-Schicht (PHK)</h4>
            <div class="config-form">
              <mat-form-field appearance="outline">
                <mat-label>Schichtstunden</mat-label>
                <input matInput type="number" step="0.1" min="0.1"
                       [(ngModel)]="editedConfigs.tag_phk.schicht_stunden"
                       (input)="onNumberInput($event, 'tag_phk', 'schicht_stunden')">
                <span matSuffix>h</span>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>P:P-Ratio Basis</mat-label>
                <input matInput type="number" step="0.1" min="0.1"
                       [(ngModel)]="editedConfigs.tag_phk.pp_ratio_base"
                       (input)="onNumberInput($event, 'tag_phk', 'pp_ratio_base')">
              </mat-form-field>

              <div class="pausen-section">
                <mat-slide-toggle [(ngModel)]="editedConfigs.tag_phk.pausen_aktiviert">
                  Pausenzeiten aktivieren
                </mat-slide-toggle>
                <div class="pausen-fields" *ngIf="editedConfigs.tag_phk.pausen_aktiviert">
                  <div class="time-row">
                    <mat-form-field appearance="outline">
                      <mat-label>Pause Start</mat-label>
                      <input matInput type="time"
                             [(ngModel)]="editedConfigs.tag_phk.pausen_start">
                    </mat-form-field>
                    <mat-form-field appearance="outline">
                      <mat-label>Pause Ende</mat-label>
                      <input matInput type="time"
                             [(ngModel)]="editedConfigs.tag_phk.pausen_ende">
                    </mat-form-field>
                  </div>
                  <div class="pause-duration">
                    = {{ calculatePauseDuration(editedConfigs.tag_phk.pausen_start, editedConfigs.tag_phk.pausen_ende) }} Minuten
                  </div>
                  <div class="modus-row">
                    <label class="modus-label">Modus:</label>
                    <mat-radio-group [(ngModel)]="editedConfigs.tag_phk.pausen_modus">
                      <mat-radio-button value="abziehen">Abziehen</mat-radio-button>
                      <mat-radio-button value="addieren">Addieren</mat-radio-button>
                    </mat-radio-group>
                  </div>
                  <div class="date-range-row">
                    <mat-form-field appearance="outline">
                      <mat-label>Von Datum (optional)</mat-label>
                      <input matInput type="date"
                             [(ngModel)]="editedConfigs.tag_phk.pausen_von_datum">
                    </mat-form-field>
                    <mat-form-field appearance="outline">
                      <mat-label>Bis Datum (optional)</mat-label>
                      <input matInput type="date"
                             [(ngModel)]="editedConfigs.tag_phk.pausen_bis_datum">
                    </mat-form-field>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Nacht PHK -->
          <div class="config-section">
            <h4>Nacht-Schicht (PHK)</h4>
            <div class="config-form">
              <mat-form-field appearance="outline">
                <mat-label>Schichtstunden</mat-label>
                <input matInput type="number" step="0.1" min="0.1"
                       [(ngModel)]="editedConfigs.nacht_phk.schicht_stunden"
                       (input)="onNumberInput($event, 'nacht_phk', 'schicht_stunden')">
                <span matSuffix>h</span>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>P:P-Ratio Basis</mat-label>
                <input matInput type="number" step="0.1" min="0.1"
                       [(ngModel)]="editedConfigs.nacht_phk.pp_ratio_base"
                       (input)="onNumberInput($event, 'nacht_phk', 'pp_ratio_base')">
              </mat-form-field>

              <div class="pausen-section">
                <mat-slide-toggle [(ngModel)]="editedConfigs.nacht_phk.pausen_aktiviert">
                  Pausenzeiten aktivieren
                </mat-slide-toggle>
                <div class="pausen-fields" *ngIf="editedConfigs.nacht_phk.pausen_aktiviert">
                  <div class="time-row">
                    <mat-form-field appearance="outline">
                      <mat-label>Pause Start</mat-label>
                      <input matInput type="time"
                             [(ngModel)]="editedConfigs.nacht_phk.pausen_start">
                    </mat-form-field>
                    <mat-form-field appearance="outline">
                      <mat-label>Pause Ende</mat-label>
                      <input matInput type="time"
                             [(ngModel)]="editedConfigs.nacht_phk.pausen_ende">
                    </mat-form-field>
                  </div>
                  <div class="pause-duration">
                    = {{ calculatePauseDuration(editedConfigs.nacht_phk.pausen_start, editedConfigs.nacht_phk.pausen_ende) }} Minuten
                  </div>
                  <div class="modus-row">
                    <label class="modus-label">Modus:</label>
                    <mat-radio-group [(ngModel)]="editedConfigs.nacht_phk.pausen_modus">
                      <mat-radio-button value="abziehen">Abziehen</mat-radio-button>
                      <mat-radio-button value="addieren">Addieren</mat-radio-button>
                    </mat-radio-group>
                  </div>
                  <div class="date-range-row">
                    <mat-form-field appearance="outline">
                      <mat-label>Von Datum (optional)</mat-label>
                      <input matInput type="date"
                             [(ngModel)]="editedConfigs.nacht_phk.pausen_von_datum">
                    </mat-form-field>
                    <mat-form-field appearance="outline">
                      <mat-label>Bis Datum (optional)</mat-label>
                      <input matInput type="date"
                             [(ngModel)]="editedConfigs.nacht_phk.pausen_bis_datum">
                    </mat-form-field>
                  </div>
                </div>
              </div>
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

    .config-form input[type="number"]::-webkit-inner-spin-button,
    .config-form input[type="number"]::-webkit-outer-spin-button {
      -webkit-appearance: none;
      margin: 0;
    }

    .config-form input[type="number"] {
      -moz-appearance: textfield;
    }

    .pausen-section {
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px solid #e0e0e0;
    }

    .pausen-fields {
      margin-top: 12px;
    }

    .time-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }

    .pause-duration {
      text-align: center;
      font-size: 14px;
      color: #666;
      margin: 8px 0;
      font-weight: 500;
    }

    .modus-row {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-top: 8px;

      .modus-label {
        font-weight: 500;
        color: #333;
      }

      mat-radio-group {
        display: flex;
        gap: 16px;
      }
    }

    .date-range-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-top: 12px;
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
    // Default values
    const defaults: StationConfigValues = {
      schicht_stunden: schicht === 'nacht' ? 8 : 16,
      phk_anteil_base: kategorie === 'PFK' ? 10 : null,
      pp_ratio_base: schicht === 'nacht' ? 20 : 10,
      pausen_aktiviert: false,
      pausen_start: '12:00',
      pausen_ende: '12:30',
      pausen_modus: 'abziehen',
      pausen_von_datum: null,
      pausen_bis_datum: null
    };

    if (existing) {
      // Merge existing values with defaults to ensure all fields are defined
      return {
        ...defaults,
        ...existing,
        // Ensure pausenzeiten fields are always defined
        pausen_aktiviert: existing.pausen_aktiviert ?? false,
        pausen_start: existing.pausen_start ?? '12:00',
        pausen_ende: existing.pausen_ende ?? '12:30',
        pausen_modus: existing.pausen_modus ?? 'abziehen',
        pausen_von_datum: existing.pausen_von_datum ?? null,
        pausen_bis_datum: existing.pausen_bis_datum ?? null
      };
    }

    return defaults;
  }

  onNumberInput(event: Event, configKey: keyof typeof this.editedConfigs, field: string): void {
    const input = event.target as HTMLInputElement;
    if (input.value.includes(',')) {
      input.value = input.value.replace(',', '.');
      // Update the model value
      const numValue = parseFloat(input.value);
      if (!isNaN(numValue)) {
        (this.editedConfigs[configKey] as any)[field] = numValue;
      }
    }
  }

  /**
   * Calculate pause duration in minutes from start and end time strings
   */
  calculatePauseDuration(start: string, end: string): number {
    if (!start || !end) return 0;
    
    const [startH, startM] = start.split(':').map(Number);
    const [endH, endM] = end.split(':').map(Number);
    
    let startMinutes = startH * 60 + startM;
    let endMinutes = endH * 60 + endM;
    
    // Handle overnight pause (end time is next day)
    if (endMinutes < startMinutes) {
      endMinutes += 24 * 60;
    }
    
    return endMinutes - startMinutes;
  }

  isValid(): boolean {
    return Object.values(this.editedConfigs).every(config => {
      const basicValid = config.schicht_stunden > 0 &&
        config.pp_ratio_base > 0 &&
        (config.phk_anteil_base === null || config.phk_anteil_base > 0);
      
      // Validate time format if pausen is activated
      const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
      const pausenValid = !config.pausen_aktiviert || (
        timeRegex.test(config.pausen_start) &&
        timeRegex.test(config.pausen_ende) &&
        ['addieren', 'abziehen'].includes(config.pausen_modus)
      );
      
      // Validate date range: if both dates are set, von_datum must be <= bis_datum
      let dateRangeValid = true;
      if (config.pausen_von_datum && config.pausen_bis_datum) {
        const vonDate = new Date(config.pausen_von_datum);
        const bisDate = new Date(config.pausen_bis_datum);
        dateRangeValid = vonDate <= bisDate;
      }
      
      return basicValid && pausenValid && dateRangeValid;
    });
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
      pp_ratio_base: config.pp_ratio_base,
      pausen_aktiviert: config.pausen_aktiviert,
      pausen_start: config.pausen_start,
      pausen_ende: config.pausen_ende,
      pausen_modus: config.pausen_modus,
      pausen_von_datum: config.pausen_von_datum || null,
      pausen_bis_datum: config.pausen_bis_datum || null
    };

    if (schicht === 'nacht') {
      await firstValueFrom(this.api.updateStationConfigNacht(this.data.stationConfig.station, kategorie, configData));
    } else {
      await firstValueFrom(this.api.updateStationConfig(this.data.stationConfig.station, kategorie, schicht, configData));
    }
  }
}
