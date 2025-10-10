import { Component, Input, inject, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatDialog, MatDialogModule, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';

export interface DataInfoItem {
  fileName: string;
  uploadDate: string;
  dataMonth?: string;
  dataYear?: number;
  recordCount?: number;
  status: 'success' | 'error' | 'warning';
  location?: string;
  station?: string;
  rawData?: any[]; // Original data from the file
  schemaColumns?: string[]; // Column names from schema
}

@Component({
  selector: 'app-data-info-panel',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatIconModule,
    MatTooltipModule,
    MatChipsModule,
    MatExpansionModule,
    MatButtonModule,
    MatDialogModule
  ],
  template: `
    <mat-expansion-panel class="data-info-panel" [expanded]="expandedByDefault">
      <mat-expansion-panel-header>
        <mat-panel-title>
          <mat-icon class="panel-icon">info</mat-icon>
          <span class="panel-title-text">Datenquelle & Informationen</span>
          <mat-icon class="status-icon" [class.success]="allSuccess()" [class.warning]="hasWarnings()">
            {{ allSuccess() ? 'check_circle' : 'warning' }}
          </mat-icon>
        </mat-panel-title>
        <mat-panel-description>
          {{ dataItems.length }} {{ dataItems.length === 1 ? 'Datei' : 'Dateien' }} geladen
        </mat-panel-description>
      </mat-expansion-panel-header>

      <div class="data-info-content">
        <div class="data-item" *ngFor="let item of dataItems; let i = index" 
             [class.clickable]="item.rawData && item.rawData.length > 0"
             (click)="openDetailModal(item, $event)">
          <div class="data-item-header">
            <div class="file-info">
              <mat-icon class="file-icon">description</mat-icon>
              <div class="file-details">
                <div class="file-name">
                  {{ item.fileName }}
                  <mat-icon class="detail-icon" *ngIf="item.rawData && item.rawData.length > 0">
                    open_in_new
                  </mat-icon>
                </div>
                <div class="file-meta">
                  <span class="meta-item" *ngIf="item.location">
                    <mat-icon class="meta-icon">location_on</mat-icon>
                    {{ item.location }}
                  </span>
                  <span class="meta-item" *ngIf="item.station">
                    <mat-icon class="meta-icon">medical_services</mat-icon>
                    {{ item.station }}
                  </span>
                  <span class="meta-item" *ngIf="item.dataMonth || item.dataYear">
                    <mat-icon class="meta-icon">calendar_month</mat-icon>
                    {{ formatDataPeriod(item) }}
                  </span>
                </div>
              </div>
            </div>
            <mat-chip class="status-chip" [class.success]="item.status === 'success'" 
                      [class.error]="item.status === 'error'"
                      [class.warning]="item.status === 'warning'">
              <mat-icon>{{ getStatusIcon(item.status) }}</mat-icon>
              {{ getStatusText(item.status) }}
            </mat-chip>
          </div>

          <div class="data-item-stats">
            <div class="stat-box" *ngIf="item.recordCount !== undefined">
              <mat-icon>grid_on</mat-icon>
              <div class="stat-content">
                <div class="stat-value">{{ item.recordCount }}</div>
                <div class="stat-label">Datensätze</div>
              </div>
            </div>
            <div class="stat-box">
              <mat-icon>schedule</mat-icon>
              <div class="stat-content">
                <div class="stat-value">{{ formatUploadDate(item.uploadDate) }}</div>
                <div class="stat-label">Hochgeladen am</div>
              </div>
            </div>
          </div>

          <div class="divider" *ngIf="i < dataItems.length - 1"></div>
        </div>

        <div class="info-footer" *ngIf="showFooterInfo">
          <mat-icon class="info-icon">info_outline</mat-icon>
          <span>Die Daten werden automatisch verarbeitet und in den Charts dargestellt.</span>
        </div>
      </div>
    </mat-expansion-panel>
  `,
  styles: [`
    .data-info-panel {
      margin-bottom: 24px;
      border-radius: 12px !important;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08) !important;
      border: 1px solid #e3f2fd !important;
      background: linear-gradient(135deg, #ffffff 0%, #f8fbff 100%) !important;
      overflow: hidden;

      ::ng-deep .mat-expansion-panel-header {
        padding: 16px 24px !important;
        height: auto !important;
        min-height: 64px;
        background: transparent !important;

        &:hover {
          background: rgba(227, 242, 253, 0.3) !important;
        }

        .mat-expansion-panel-header-title {
          display: flex;
          align-items: center;
          gap: 12px;
          color: #1976d2;
          font-weight: 600;
          font-size: 16px;
        }

        .mat-expansion-panel-header-description {
          color: #666;
          font-size: 14px;
        }
      }

      ::ng-deep .mat-expansion-panel-body {
        padding: 0 24px 20px 24px !important;
      }
    }

    .panel-icon {
      color: #1976d2;
      font-size: 24px;
      width: 24px;
      height: 24px;
    }

    .panel-title-text {
      flex: 1;
    }

    .status-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
      
      &.success {
        color: #4caf50;
      }
      
      &.warning {
        color: #ff9800;
      }
    }

    .data-info-content {
      padding-top: 16px;
    }

    .data-item {
      margin-bottom: 20px;
      transition: background-color 0.2s ease, box-shadow 0.2s ease;
      border-radius: 8px;
      padding: 12px;
      margin-left: -12px;
      margin-right: -12px;

      &:last-child {
        margin-bottom: 0;
      }

      &.clickable {
        cursor: pointer;

        &:hover {
          background: rgba(25, 118, 210, 0.05);
        }
      }
    }

    .data-item-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 16px;
      gap: 16px;
    }

    .file-info {
      display: flex;
      gap: 12px;
      flex: 1;
      min-width: 0;
    }

    .file-icon {
      color: #1976d2;
      font-size: 28px;
      width: 28px;
      height: 28px;
      flex-shrink: 0;
    }

    .file-details {
      flex: 1;
      min-width: 0;
    }

    .file-name {
      font-weight: 600;
      color: #333;
      font-size: 15px;
      margin-bottom: 6px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      display: flex;
      align-items: center;
      gap: 8px;

      .detail-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
        color: #1976d2;
        opacity: 0.7;
        transition: opacity 0.2s ease;
      }
    }

    .data-item.clickable:hover .detail-icon {
      opacity: 1;
      animation: pulse 1s ease-in-out infinite;
    }

    @keyframes pulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.1); }
    }

    .file-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
      font-size: 13px;
      color: #666;
    }

    .meta-item {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .meta-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
      color: #999;
    }

    .status-chip {
      border-radius: 20px !important;
      font-weight: 500 !important;
      font-size: 12px !important;
      padding: 6px 12px !important;
      height: auto !important;
      display: flex !important;
      align-items: center !important;
      gap: 6px !important;
      flex-shrink: 0;

      mat-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
        margin: 0 !important;
      }

      &.success {
        background-color: #e8f5e9 !important;
        color: #2e7d32 !important;

        mat-icon {
          color: #2e7d32 !important;
        }
      }

      &.error {
        background-color: #ffebee !important;
        color: #c62828 !important;

        mat-icon {
          color: #c62828 !important;
        }
      }

      &.warning {
        background-color: #fff3e0 !important;
        color: #ef6c00 !important;

        mat-icon {
          color: #ef6c00 !important;
        }
      }
    }

    .data-item-stats {
      display: flex;
      gap: 16px;
      flex-wrap: wrap;
    }

    .stat-box {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      background: #f8fbff;
      border-radius: 8px;
      border: 1px solid #e3f2fd;
      flex: 1;
      min-width: 200px;

      mat-icon {
        color: #1976d2;
        font-size: 24px;
        width: 24px;
        height: 24px;
      }
    }

    .stat-content {
      flex: 1;
    }

    .stat-value {
      font-weight: 600;
      color: #333;
      font-size: 16px;
      margin-bottom: 2px;
    }

    .stat-label {
      font-size: 12px;
      color: #666;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .divider {
      height: 1px;
      background: linear-gradient(90deg, transparent 0%, #e0e0e0 50%, transparent 100%);
      margin: 20px 0;
    }

    .info-footer {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 20px;
      padding: 12px 16px;
      background: #e3f2fd;
      border-radius: 8px;
      font-size: 13px;
      color: #1976d2;

      .info-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
        color: #1976d2;
      }
    }

    /* Responsive Design */
    @media (max-width: 768px) {
      .data-item-header {
        flex-direction: column;
      }

      .status-chip {
        align-self: flex-start;
      }

      .data-item-stats {
        flex-direction: column;
      }

      .stat-box {
        min-width: 100%;
      }
    }
  `]
})
export class DataInfoPanel {
  @Input() dataItems: DataInfoItem[] = [];
  @Input() expandedByDefault: boolean = false;
  @Input() showFooterInfo: boolean = true;

  private dialog = inject(MatDialog);

  allSuccess(): boolean {
    return this.dataItems.every(item => item.status === 'success');
  }

  hasWarnings(): boolean {
    return this.dataItems.some(item => item.status === 'warning' || item.status === 'error');
  }

  getStatusIcon(status: string): string {
    switch (status) {
      case 'success': return 'check_circle';
      case 'error': return 'error';
      case 'warning': return 'warning';
      default: return 'info';
    }
  }

  getStatusText(status: string): string {
    switch (status) {
      case 'success': return 'Erfolgreich';
      case 'error': return 'Fehler';
      case 'warning': return 'Warnung';
      default: return 'Unbekannt';
    }
  }

  formatDataPeriod(item: DataInfoItem): string {
    if (item.dataMonth && item.dataYear) {
      return `${item.dataMonth} ${item.dataYear}`;
    } else if (item.dataYear) {
      return `${item.dataYear}`;
    } else if (item.dataMonth) {
      return item.dataMonth;
    }
    return '';
  }

  formatUploadDate(dateStr: string): string {
    try {
      const date = new Date(dateStr);
      return new Intl.DateTimeFormat('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }).format(date);
    } catch {
      return dateStr;
    }
  }

  openDetailModal(item: DataInfoItem, event: Event) {
    if (!item.rawData || item.rawData.length === 0) {
      return;
    }

    // Stop event propagation to prevent expansion panel toggle
    event.stopPropagation();

    this.dialog.open(DataDetailModal, {
      width: '90vw',
      maxWidth: '1400px',
      maxHeight: '90vh',
      data: item,
      panelClass: 'data-detail-modal'
    });
  }
}

// Modal Component for detailed data view
@Component({
  selector: 'data-detail-modal',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatChipsModule
  ],
  template: `
    <div class="modal-header">
      <div class="header-content">
        <mat-icon class="header-icon">table_chart</mat-icon>
        <div>
          <h2>{{ data.fileName }}</h2>
          <div class="header-meta">
            <span *ngIf="data.location" class="meta-item">
              <mat-icon>location_on</mat-icon>
              {{ data.location }}
            </span>
            <span *ngIf="data.station" class="meta-item">
              <mat-icon>medical_services</mat-icon>
              {{ data.station }}
            </span>
            <span *ngIf="data.dataMonth || data.dataYear" class="meta-item">
              <mat-icon>calendar_month</mat-icon>
              {{ formatPeriod() }}
            </span>
            <span class="meta-item">
              <mat-icon>grid_on</mat-icon>
              {{ data.recordCount }} Datensätze
            </span>
          </div>
        </div>
      </div>
      <button mat-icon-button mat-dialog-close class="close-button">
        <mat-icon>close</mat-icon>
      </button>
    </div>

    <mat-dialog-content>
      <div class="data-preview">
        <div class="preview-info">
          <mat-chip-set>
            <mat-chip class="info-chip">
              <mat-icon>info</mat-icon>
              Zeige {{ displayedRows.length }} von {{ data.rawData?.length || 0 }} Zeilen
            </mat-chip>
            <mat-chip class="info-chip" *ngIf="columns.length > 0">
              <mat-icon>view_column</mat-icon>
              {{ columns.length }} Spalten
            </mat-chip>
          </mat-chip-set>
        </div>

        <div class="table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th class="row-number">#</th>
                <th *ngFor="let col of columns">{{ col }}</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let row of displayedRows; let i = index">
                <td class="row-number">{{ i + 1 }}</td>
                <td *ngFor="let col of columns" [class.number-cell]="isNumber(row[col])">
                  {{ formatValue(row[col]) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="load-more" *ngIf="canLoadMore()">
          <button mat-raised-button color="primary" (click)="loadMore()">
            <mat-icon>expand_more</mat-icon>
            Weitere {{ Math.min(50, (data.rawData?.length || 0) - displayedRows.length) }} Zeilen laden
          </button>
        </div>
      </div>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>
        <mat-icon>close</mat-icon>
        Schließen
      </button>
      <button mat-raised-button color="primary" (click)="downloadCSV()">
        <mat-icon>download</mat-icon>
        Als CSV exportieren
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding: 24px 24px 16px 24px;
      border-bottom: 2px solid #e0e0e0;
      background: linear-gradient(135deg, #f8fbff 0%, #e3f2fd 100%);
    }

    .header-content {
      display: flex;
      gap: 16px;
      flex: 1;
    }

    .header-icon {
      font-size: 40px;
      width: 40px;
      height: 40px;
      color: #1976d2;
    }

    h2 {
      margin: 0 0 8px 0;
      color: #1976d2;
      font-size: 20px;
      font-weight: 600;
    }

    .header-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
      font-size: 13px;
      color: #666;
    }

    .meta-item {
      display: flex;
      align-items: center;
      gap: 4px;

      mat-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
        color: #999;
      }
    }

    .close-button {
      color: #666;
    }

    mat-dialog-content {
      padding: 0 !important;
      margin: 0 !important;
      overflow-y: auto !important;
      max-height: 70vh !important;
    }

    .data-preview {
      display: flex;
      flex-direction: column;
      min-height: 100%;
    }

    .preview-info {
      padding: 16px 24px;
      background: #f8f9fa;
      border-bottom: 1px solid #e0e0e0;
    }

    .info-chip {
      display: flex !important;
      align-items: center !important;
      gap: 6px !important;
      background-color: #e3f2fd !important;
      color: #1976d2 !important;

      mat-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
      }
    }

    .table-wrapper {
      overflow-y: auto;
      overflow-x: auto;
      flex: 1;
      max-height: none;
      min-height: 400px;
      border: 1px solid #e0e0e0;
      border-radius: 4px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }

    .data-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }

    .data-table thead {
      position: sticky;
      top: 0;
      z-index: 10;
      background: #1976d2;
      color: white;
    }

    .data-table th {
      padding: 12px 16px;
      text-align: left;
      font-weight: 600;
      border-right: 1px solid rgba(255, 255, 255, 0.1);
      white-space: nowrap;
    }

    .data-table th:last-child {
      border-right: none;
    }

    .row-number {
      background: #f5f5f5;
      font-weight: 600;
      color: #999;
      text-align: center !important;
      min-width: 50px;
      position: sticky;
      left: 0;
      z-index: 5;
    }

    .data-table thead .row-number {
      background: #1565c0;
      color: white;
      z-index: 11;
    }

    .data-table td {
      padding: 10px 16px;
      border-bottom: 1px solid #e0e0e0;
      border-right: 1px solid #f0f0f0;
      white-space: nowrap;
    }

    .data-table td:last-child {
      border-right: none;
    }

    .data-table tbody tr:hover {
      background: #f8fbff;
    }

    .number-cell {
      text-align: right !important;
      font-family: 'Roboto Mono', monospace;
    }

    .load-more {
      padding: 20px;
      text-align: center;
      border-top: 1px solid #e0e0e0;
      background: #fafafa;
    }

    mat-dialog-actions {
      padding: 16px 24px !important;
      border-top: 1px solid #e0e0e0;
      background: #f8f9fa;

      button {
        margin-left: 8px !important;
      }
    }

    /* Responsive */
    @media (max-width: 768px) {
      .modal-header {
        padding: 16px;
      }

      .header-content {
        flex-direction: column;
      }

      .data-table {
        font-size: 11px;
      }

      .data-table th,
      .data-table td {
        padding: 8px 12px;
      }
    }
  `]
})
export class DataDetailModal {
  data: DataInfoItem;
  columns: string[] = [];
  displayedRows: any[] = [];
  Math = Math;

  constructor(@Inject(MAT_DIALOG_DATA) data: DataInfoItem) {
    this.data = data;
    this.initializeData();
  }

  private initializeData() {
    if (this.data.rawData && this.data.rawData.length > 0) {
      // Get columns from first row or from schema
      this.columns = this.data.schemaColumns || Object.keys(this.data.rawData[0]);
      
      // Initially display first 100 rows (or all if less than 100)
      this.displayedRows = this.data.rawData.slice(0, Math.min(100, this.data.rawData.length));
    }
  }

  formatPeriod(): string {
    if (this.data.dataMonth && this.data.dataYear) {
      return `${this.data.dataMonth} ${this.data.dataYear}`;
    } else if (this.data.dataYear) {
      return `${this.data.dataYear}`;
    } else if (this.data.dataMonth) {
      return this.data.dataMonth;
    }
    return '';
  }

  formatValue(value: any): string {
    if (value === null || value === undefined) {
      return '-';
    }
    if (typeof value === 'number') {
      return new Intl.NumberFormat('de-DE', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
      }).format(value);
    }
    return String(value);
  }

  isNumber(value: any): boolean {
    return typeof value === 'number';
  }

  canLoadMore(): boolean {
    return this.displayedRows.length < (this.data.rawData?.length || 0);
  }

  loadMore() {
    const currentLength = this.displayedRows.length;
    const nextBatch = this.data.rawData!.slice(currentLength, currentLength + 50);
    this.displayedRows = [...this.displayedRows, ...nextBatch];
  }

  downloadCSV() {
    if (!this.data.rawData || this.data.rawData.length === 0) return;

    // Create CSV content
    const headers = this.columns.join(';');
    const rows = this.data.rawData.map(row => 
      this.columns.map(col => {
        const value = row[col];
        if (value === null || value === undefined) return '';
        // Escape values containing semicolons or quotes
        const strValue = String(value);
        if (strValue.includes(';') || strValue.includes('"') || strValue.includes('\n')) {
          return `"${strValue.replace(/"/g, '""')}"`;
        }
        return strValue;
      }).join(';')
    );

    const csv = [headers, ...rows].join('\n');
    
    // Create download link
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `${this.data.fileName.replace(/\.[^/.]+$/, '')}_export.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

