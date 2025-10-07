import { Component, Input, Output, EventEmitter, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-location-selector',
  imports: [CommonModule, MatSelectModule, MatFormFieldModule, MatIconModule],
  template: `
    <div class="location-selector">
      <mat-form-field appearance="outline" class="location-field">
        <mat-label>
          <mat-icon>location_on</mat-icon>
          Standort auswählen
        </mat-label>
        <mat-select 
          [value]="selectedLocation" 
          (selectionChange)="onLocationChange($event.value)"
          [disabled]="availableLocations.length === 0">
          <mat-option value="all">Alle Standorte</mat-option>
          <mat-option *ngFor="let location of availableLocations" [value]="location">
            {{ formatLocation(location) }}
          </mat-option>
        </mat-select>
      </mat-form-field>
      <div class="location-info" *ngIf="selectedLocation !== 'all'">
        <span class="info-text">
          <mat-icon>business</mat-icon>
          Daten für {{ formatLocation(selectedLocation) }}
        </span>
      </div>
    </div>
  `,
  styles: [`
    .location-selector {
      display: flex;
      flex-direction: column;
      gap: 8px;
      min-width: 200px;
    }

    .location-field {
      width: 100%;
    }

    .location-field mat-label {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .location-info {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 4px 8px;
      background-color: rgba(76, 175, 80, 0.1);
      border-radius: 4px;
      font-size: 0.875rem;
      color: #4caf50;
    }

    .info-text {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .info-text mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }
  `]
})
export class LocationSelector {
  @Input() availableLocations: string[] = [];
  @Input() selectedLocation: string = 'all';
  @Output() locationChanged = new EventEmitter<string>();

  onLocationChange(location: string) {
    this.selectedLocation = location;
    this.locationChanged.emit(location);
  }

  formatLocation(location: string): string {
    if (location === 'all') return 'Alle Standorte';
    
    // Format location codes to readable names
    const locationNames: Record<string, string> = {
      'BAB': 'BAB Kliniken',
      'PRI': 'PRI Kliniken', 
      'ROS': 'ROS Kliniken',
      'WAS': 'WAS Kliniken'
    };
    
    return locationNames[location] || location;
  }
}
