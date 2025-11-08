import { Component, Inject, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule, MatChipInputEvent } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { FormsModule } from '@angular/forms';
import { COMMA, ENTER } from '@angular/cdk/keycodes';

export interface KostenstelleDialogData {
  kostenstelle?: string;
  stations?: string[];
  standorte?: string[];
  standortnummer?: string | number | null;
  ik?: string | number | null;
  paediatrie?: string | null;
}

export interface KostenstelleDialogResult {
  kostenstelle: string;
  stations: string[];
  standorte: string[];
  standortnummer: string | null;
  ik: string | null;
  paediatrie: string | null;
}

@Component({
  selector: 'app-kostenstelle-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatTooltipModule,
    FormsModule
  ],
  templateUrl: './kostenstelle-dialog.component.html',
  styleUrl: './kostenstelle-dialog.component.scss'
})
export class KostenstelleDialogComponent {
  private dialogRef = inject(MatDialogRef<KostenstelleDialogComponent>);

  readonly separatorKeysCodes: number[] = [ENTER, COMMA];
  readonly isEditMode = signal(false);

  kostenstelle = signal('');
  stations = signal<string[]>([]);
  standorte = signal<string[]>([]);
  standortnummer = signal<string>('');
  ik = signal<string>('');
  paediatrie = signal<string>('');

  readonly canSave = computed(() => {
    const ks = this.kostenstelle().trim();
    return ks.length > 0;
  });

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: KostenstelleDialogData | null
  ) {
    if (data) {
      this.isEditMode.set(!!data.kostenstelle);
      if (data.kostenstelle) {
        this.kostenstelle.set(data.kostenstelle);
      }
      if (Array.isArray(data.stations)) {
        this.stations.set(data.stations.filter(Boolean));
      }
      if (Array.isArray(data.standorte)) {
        this.standorte.set(data.standorte.filter(Boolean));
      }
      if (data.standortnummer !== undefined && data.standortnummer !== null) {
        this.standortnummer.set(String(data.standortnummer));
      }
      if (data.ik !== undefined && data.ik !== null) {
        this.ik.set(String(data.ik));
      }
      if (typeof data.paediatrie === 'string') {
        this.paediatrie.set(data.paediatrie);
      }
    }
  }

  save() {
    if (!this.canSave()) {
      return;
    }

    const trimArray = (values: string[]) =>
      values
        .map(value => value.trim())
        .filter((value, index, self) => value.length > 0 && self.indexOf(value) === index);

    const result: KostenstelleDialogResult = {
      kostenstelle: this.kostenstelle().trim(),
      stations: trimArray(this.stations()),
      standorte: trimArray(this.standorte()),
      standortnummer: this.standortnummer().trim() || null,
      ik: this.ik().trim() || null,
      paediatrie: this.paediatrie().trim() || null
    };

    this.dialogRef.close(result);
  }

  cancel() {
    this.dialogRef.close(null);
  }

  addStation(event: MatChipInputEvent) {
    const value = (event.value || '').trim();
    if (value) {
      const current = this.stations();
      if (!current.includes(value)) {
        this.stations.set([...current, value]);
      }
    }
    event.chipInput?.clear();
  }

  removeStation(station: string) {
    this.stations.set(this.stations().filter(item => item !== station));
  }

  addStandort(event: MatChipInputEvent) {
    const value = (event.value || '').trim();
    if (value) {
      const current = this.standorte();
      if (!current.includes(value)) {
        this.standorte.set([...current, value]);
      }
    }
    event.chipInput?.clear();
  }

  removeStandort(standort: string) {
    this.standorte.set(this.standorte().filter(item => item !== standort));
  }

  trackByValue(_index: number, value: string) {
    return value;
  }
}


