import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { FormsModule } from '@angular/forms';
import { PfkThresholdConfig, PfkSeverity, PfkSchicht } from '../../core/api';

export interface PfkThresholdDialogData {
  stationOptions: string[];
  threshold: PfkThresholdConfig | null;
}

export interface PfkThresholdDialogResult {
  station: string;
  schicht: PfkSchicht;
  year: number | null;
  lowerLimit: number | null;
  upperLimit: number | null;
  recommendation: string | null;
  note: string | null;
  severity: PfkSeverity;
  months: number[];
}

@Component({
  selector: 'app-pfk-threshold-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatIconModule,
    MatChipsModule,
    MatTooltipModule,
    FormsModule
  ],
  templateUrl: './pfk-threshold-dialog.component.html',
  styleUrl: './pfk-threshold-dialog.component.scss'
})
export class PfkThresholdDialogComponent {
  stationSuggestions: string[] = [];
  stationInput = '*';
  schicht: PfkSchicht = 'day';
  yearInput = '';
  lowerLimitInput = '';
  upperLimitInput = '';
  recommendation = '';
  note = '';
  severity: PfkSeverity = 'warning';
  months: number[] = [];
  readonly monthOptions = [
    { value: 1, label: 'Jan' },
    { value: 2, label: 'Feb' },
    { value: 3, label: 'Mär' },
    { value: 4, label: 'Apr' },
    { value: 5, label: 'Mai' },
    { value: 6, label: 'Jun' },
    { value: 7, label: 'Jul' },
    { value: 8, label: 'Aug' },
    { value: 9, label: 'Sep' },
    { value: 10, label: 'Okt' },
    { value: 11, label: 'Nov' },
    { value: 12, label: 'Dez' }
  ];

  readonly isEditMode: boolean;

  constructor(
    private dialogRef: MatDialogRef<PfkThresholdDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: PfkThresholdDialogData | null
  ) {
    this.stationSuggestions = Array.isArray(data?.stationOptions) ? data!.stationOptions : [];
    const threshold = data?.threshold ?? null;
    this.isEditMode = !!threshold;

    if (threshold) {
      this.stationInput = threshold.station === '*' ? '*' : threshold.station;
      this.schicht = threshold.schicht;
      if (threshold.year !== null && threshold.year !== undefined) {
        this.yearInput = String(threshold.year);
      }
      if (threshold.lowerLimit !== null && threshold.lowerLimit !== undefined) {
        this.lowerLimitInput = String(threshold.lowerLimit);
      }
      if (threshold.upperLimit !== null && threshold.upperLimit !== undefined) {
        this.upperLimitInput = String(threshold.upperLimit);
      }
      this.recommendation = threshold.recommendation ?? '';
      this.note = threshold.note ?? '';
      this.severity = threshold.severity ?? 'warning';
      this.months = Array.isArray(threshold.months) ? [...threshold.months] : [];
    }
  }

  get canSave() {
    const station = this.normalizeStationInput(this.stationInput);
    const lower = this.parseNumberInput(this.lowerLimitInput);
    const upper = this.parseNumberInput(this.upperLimitInput);
    return station.length > 0 && (lower !== null || upper !== null);
  }

  save() {
    if (!this.canSave) {
      return;
    }
    const station = this.normalizeStationInput(this.stationInput);
    const result: PfkThresholdDialogResult = {
      station,
      schicht: this.schicht,
      year: this.parseNumberInput(this.yearInput),
      lowerLimit: this.parseNumberInput(this.lowerLimitInput),
      upperLimit: this.parseNumberInput(this.upperLimitInput),
      recommendation: this.recommendation.trim() ? this.recommendation.trim() : null,
      note: this.note.trim() ? this.note.trim() : null,
      severity: this.severity,
      months: Array.from(new Set(this.months.filter((m) => Number.isInteger(m) && m >= 1 && m <= 12))).sort((a, b) => a - b)
    };
    this.dialogRef.close(result);
  }

  cancel() {
    this.dialogRef.close(null);
  }

  selectStation(option: string) {
    this.stationInput = option;
  }

  selectGlobalStation() {
    this.stationInput = '*';
  }

  trackByValue(_index: number, value: string | number) {
    return value;
  }

  private parseNumberInput(value: string) {
    const trimmed = (value ?? '').toString().trim();
    if (!trimmed) {
      return null;
    }
    const parsed = Number(trimmed);
    if (Number.isNaN(parsed)) {
      return null;
    }
    return parsed;
  }

  private normalizeStationInput(value: string) {
    const trimmed = (value ?? '').trim();
    if (!trimmed || trimmed === '*') {
      return '*';
    }
    return trimmed;
  }
}

