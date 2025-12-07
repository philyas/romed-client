import { Component, Inject, computed, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { Api, StationGruppe, AvailableStation } from '../../core/api';

export interface StationGruppenDialogData {
  id?: number;
  name?: string;
  beschreibung?: string | null;
  hauptstationId?: number | null;
  istAktiv?: boolean;
  mitglieder?: Array<{ stationId: number; stationName: string; standortName?: string | null }>;
}

export interface StationGruppenDialogResult {
  id?: number;
  name: string;
  beschreibung: string | null;
  hauptstationId: number | null;
  istAktiv: boolean;
  stationIds: number[];
}

@Component({
  selector: 'app-station-gruppen-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatChipsModule,
    MatSelectModule,
    MatCheckboxModule,
    FormsModule
  ],
  templateUrl: './station-gruppen-dialog.component.html',
  styleUrl: './station-gruppen-dialog.component.scss'
})
export class StationGruppenDialogComponent implements OnInit {
  private dialogRef = inject(MatDialogRef<StationGruppenDialogComponent>);
  private api = inject(Api);

  readonly isEditMode = signal(false);

  name = signal('');
  beschreibung = signal<string>('');
  hauptstationId = signal<number | null>(null);
  istAktiv = signal(true);
  selectedStationIds = signal<number[]>([]);

  availableStations = signal<AvailableStation[]>([]);
  loadingStations = signal(false);

  readonly canSave = computed(() => {
    const nameValue = this.name().trim();
    return nameValue.length > 0;
  });

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: StationGruppenDialogData | null
  ) {
    if (data && data.id) {
      this.isEditMode.set(true);
      if (data.name) {
        this.name.set(data.name);
      }
      if (data.beschreibung) {
        this.beschreibung.set(data.beschreibung);
      }
      if (data.hauptstationId) {
        this.hauptstationId.set(data.hauptstationId);
      }
      if (data.istAktiv !== undefined) {
        this.istAktiv.set(data.istAktiv);
      }
      if (data.mitglieder) {
        this.selectedStationIds.set(data.mitglieder.map(m => m.stationId));
      }
    }
  }

  async ngOnInit() {
    await this.loadAvailableStations();
  }

  async loadAvailableStations() {
    this.loadingStations.set(true);
    try {
      const response = await firstValueFrom(this.api.getAvailableStations());
      this.availableStations.set(response.data);
    } catch (error) {
      console.error('Error loading available stations:', error);
    } finally {
      this.loadingStations.set(false);
    }
  }

  getStationName(stationId: number): string {
    const station = this.availableStations().find(s => s.id === stationId);
    return station ? station.name : `ID: ${stationId}`;
  }

  getStationDisplay(stationId: number): string {
    const station = this.availableStations().find(s => s.id === stationId);
    if (!station) return `ID: ${stationId}`;
    return station.standortName ? `${station.name} (${station.standortName})` : station.name;
  }

  addStation(stationId: number) {
    const current = this.selectedStationIds();
    if (!current.includes(stationId)) {
      this.selectedStationIds.set([...current, stationId]);
    }
  }

  removeStation(stationId: number) {
    const current = this.selectedStationIds();
    this.selectedStationIds.set(current.filter(id => id !== stationId));
  }

  save() {
    if (!this.canSave()) {
      return;
    }

    const result: StationGruppenDialogResult = {
      id: this.data?.id,
      name: this.name().trim(),
      beschreibung: this.beschreibung().trim() || null,
      hauptstationId: this.hauptstationId(),
      istAktiv: this.istAktiv(),
      stationIds: this.selectedStationIds()
    };

    this.dialogRef.close(result);
  }

  cancel() {
    this.dialogRef.close(null);
  }
}
