import { Component, Inject, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { FormsModule } from '@angular/forms';

export interface StationMappingDialogData {
  dienstplanStation?: string;
  minaMitaStation?: string | null;
  beschreibung?: string | null;
}

export interface StationMappingDialogResult {
  dienstplanStation: string;
  minaMitaStation: string | null;
  beschreibung: string | null;
}

@Component({
  selector: 'app-station-mapping-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    FormsModule
  ],
  templateUrl: './station-mapping-dialog.component.html',
  styleUrl: './station-mapping-dialog.component.scss'
})
export class StationMappingDialogComponent {
  private dialogRef = inject(MatDialogRef<StationMappingDialogComponent>);

  readonly isEditMode = signal(false);

  dienstplanStation = signal('');
  minaMitaStation = signal<string>('');
  beschreibung = signal<string>('');

  readonly canSave = computed(() => {
    const station = this.dienstplanStation().trim();
    return station.length > 0;
  });

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: StationMappingDialogData | null
  ) {
    if (data) {
      this.isEditMode.set(!!data.dienstplanStation);
      if (data.dienstplanStation) {
        this.dienstplanStation.set(data.dienstplanStation);
      }
      if (data.minaMitaStation) {
        this.minaMitaStation.set(data.minaMitaStation);
      }
      if (data.beschreibung) {
        this.beschreibung.set(data.beschreibung);
      }
    }
  }

  save() {
    if (!this.canSave()) {
      return;
    }

    const result: StationMappingDialogResult = {
      dienstplanStation: this.dienstplanStation().trim(),
      minaMitaStation: this.minaMitaStation().trim() || null,
      beschreibung: this.beschreibung().trim() || null
    };

    this.dialogRef.close(result);
  }

  cancel() {
    this.dialogRef.close(null);
  }
}



