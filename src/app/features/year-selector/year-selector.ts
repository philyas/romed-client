import { Component, Input, Output, EventEmitter, signal, OnInit, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { UploadRecord } from '../../core/api';

@Component({
  selector: 'app-year-selector',
  imports: [
    CommonModule,
    MatSelectModule,
    MatFormFieldModule,
    MatIconModule
  ],
  template: `
    <div class="year-selector">
      <mat-form-field appearance="outline" class="year-select-field">
        <mat-label>Jahr auswählen</mat-label>
        <mat-select 
          [(value)]="selectedYear" 
          (selectionChange)="onYearChange($event.value)"
          [disabled]="availableYears().length === 0">
          <mat-option 
            *ngFor="let year of availableYears()" 
            [value]="year">
            {{ year }}
          </mat-option>
        </mat-select>
      </mat-form-field>
    </div>
  `,
  styleUrl: './year-selector.scss'
})
export class YearSelector implements OnInit, OnChanges {
  @Input() uploads: UploadRecord[] = [];
  @Output() yearChanged = new EventEmitter<number>();

  selectedYear = signal<number>(new Date().getFullYear());
  availableYears = signal<number[]>([]);

  ngOnInit() {
    this.extractAvailableYears();
    this.setDefaultYear();
  }

  ngOnChanges() {
    this.extractAvailableYears();
    this.setDefaultYear();
  }

  private extractAvailableYears() {
    const years = new Set<number>();
    
    this.uploads.forEach(upload => {
      const uploadDate = new Date(upload.createdAt);
      const year = uploadDate.getFullYear();
      years.add(year);
    });

    const sortedYears = Array.from(years).sort((a, b) => b - a); // Neueste zuerst
    this.availableYears.set(sortedYears);
  }

  private setDefaultYear() {
    const years = this.availableYears();
    if (years.length > 0 && !years.includes(this.selectedYear())) {
      this.selectedYear.set(years[0]); // Neuestes Jahr als Standard
      this.yearChanged.emit(this.selectedYear());
    }
  }

  onYearChange(year: number) {
    this.selectedYear.set(year);
    this.yearChanged.emit(year);
  }
}
