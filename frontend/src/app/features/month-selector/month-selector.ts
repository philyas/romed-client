import { Component, Input, Output, EventEmitter, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-month-selector',
  imports: [CommonModule, MatSelectModule, MatFormFieldModule, MatIconModule],
  template: `
    <div class="month-selector">
      <mat-form-field appearance="outline" class="month-field">
        <mat-label>
          <mat-icon>calendar_month</mat-icon>
          Monat auswählen
        </mat-label>
        <mat-select 
          [value]="selectedMonth" 
          (selectionChange)="onMonthChange($event.value)"
          [disabled]="availableMonths.length === 0">
          <mat-option value="all">Alle Monate</mat-option>
          <mat-option *ngFor="let month of availableMonths" [value]="month">
            {{ formatMonth(month) }}
          </mat-option>
        </mat-select>
      </mat-form-field>
      <div class="month-info" *ngIf="selectedMonth !== 'all'">
        <span class="info-text">
          <mat-icon>info</mat-icon>
          Daten für {{ formatMonth(selectedMonth) }}
        </span>
      </div>
    </div>
  `,
  styles: [`
    .month-selector {
      display: flex;
      flex-direction: column;
      gap: 8px;
      min-width: 200px;
    }

    .month-field {
      width: 100%;
    }

    .month-field mat-label {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .month-info {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 4px 8px;
      background-color: rgba(25, 118, 210, 0.1);
      border-radius: 4px;
      font-size: 0.875rem;
      color: #1976d2;
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
export class MonthSelector {
  @Input() availableMonths: string[] = [];
  @Input() selectedMonth: string = 'all';
  @Output() monthChanged = new EventEmitter<string>();

  onMonthChange(month: string) {
    this.selectedMonth = month;
    this.monthChanged.emit(month);
  }

  formatMonth(month: string): string {
    if (!month || month === 'all') return 'Alle Monate';
    
    const monthNames = [
      'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
      'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
    ];
    
    // Handle both formats: "09-2025" and simple "9" or "09"
    if (month.includes('-')) {
      // Format: "09-2025" -> "September 2025"
      const [monthNum, year] = month.split('-');
      const monthIndex = parseInt(monthNum) - 1;
      const monthName = monthNames[monthIndex] || monthNum;
      return `${monthName} ${year}`;
    } else {
      // Format: "9" -> "September"
      const monthIndex = parseInt(month) - 1;
      return monthNames[monthIndex] || month;
    }
  }
}
