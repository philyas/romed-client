import { Component, Input, Output, EventEmitter, signal, OnInit, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { UploadRecord } from '../../core/api';

@Component({
  selector: 'app-station-selector',
  imports: [
    CommonModule,
    MatSelectModule,
    MatFormFieldModule,
    MatIconModule
  ],
  template: `
    <div class="station-selector">
      <mat-form-field appearance="outline" class="station-select-field">
        <mat-label>Station auswählen</mat-label>
        <mat-select 
          [(value)]="selectedStation" 
          (selectionChange)="onStationChange($event.value)"
          [disabled]="availableStations().length === 0">
          <mat-option value="all">
            Alle Stationen
          </mat-option>
          <mat-option 
            *ngFor="let station of availableStations()" 
            [value]="station">
            {{ station }}
          </mat-option>
        </mat-select>
      </mat-form-field>
    </div>
  `,
  styleUrl: './station-selector.scss'
})
export class StationSelector implements OnInit, OnChanges {
  @Input() uploads: UploadRecord[] = [];
  @Output() stationChanged = new EventEmitter<string>();

  selectedStation = signal<string>('all');
  availableStations = signal<string[]>([]);

  ngOnInit() {
    this.extractAvailableStations();
    this.setDefaultStation();
  }

  ngOnChanges() {
    this.extractAvailableStations();
    this.setDefaultStation();
  }

  private extractAvailableStations() {
    const stations = new Set<string>();
    
    // Extract stations from actual upload data
    this.uploads.forEach(upload => {
      // Extract stations from different schema types
      upload.files.forEach(file => {
        if (file.values && Array.isArray(file.values)) {
          file.values.forEach(row => {
            // Check for Station field in the data
            if (row['Station'] && typeof row['Station'] === 'string') {
              stations.add(row['Station']);
            }
          });
        }
      });
    });

    // Convert to array and sort alphabetically
    const sortedStations = Array.from(stations).sort();
    this.availableStations.set(sortedStations);
  }

  private setDefaultStation() {
    // Always default to 'all' stations
    this.selectedStation.set('all');
    this.stationChanged.emit('all');
  }

  onStationChange(station: string) {
    this.selectedStation.set(station);
    this.stationChanged.emit(station);
  }
}
