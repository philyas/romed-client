import { CommonModule } from '@angular/common';
import { Component, Inject, OnInit, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxChange, MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialogModule, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { BaseChartDirective } from 'ng2-charts';
import { Chart, ChartConfiguration, ChartData, registerables } from 'chart.js';
import { UploadRecord } from '../../core/api';

interface ComparisonDialogData {
  uploads: UploadRecord[];
  stations: string[];
}

interface StationMonthAggregate {
  total: number;
  count: number;
}

interface MonthMetadata {
  month: number;
  year: number;
}

@Component({
  selector: 'app-mina-mita-comparison-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatCheckboxModule,
    MatDividerModule,
    BaseChartDirective
  ],
  template: `
    <h2 mat-dialog-title>
      <mat-icon>compare</mat-icon>
      MiNa-Vergleich (Mitternacht)
    </h2>

    <mat-dialog-content>
      <p class="dialog-description">
        Wählen Sie bis zu vier Stationen aus, um deren Mitternachtsdurchschnitte (MiNa) im Zeitverlauf gegenüberzustellen.
      </p>

      <div class="station-selection">
        <div class="selection-header">
          <mat-icon>meeting_room</mat-icon>
          <span>Stationen</span>
          <span class="selection-count">{{ selectedStations().length }} / 4</span>
        </div>
        <mat-divider></mat-divider>

        <div class="selection-grid">
          <mat-checkbox
            class="station-option"
            *ngFor="let station of availableStations()"
            [checked]="isStationSelected(station)"
            (change)="toggleStation(station, $event)"
            [disabled]="isSelectionLimitReached() && !isStationSelected(station)">
            {{ station }}
          </mat-checkbox>
        </div>

        <div class="selection-hint" *ngIf="isSelectionLimitReached()">
          <mat-icon>info</mat-icon>
          Maximale Anzahl erreicht. Entfernen Sie eine Station, um eine andere auszuwählen.
        </div>
      </div>

      <div class="comparison-content" *ngIf="chartReady(); else emptyState">
        <div class="chart-wrapper">
          <canvas baseChart
            [type]="'line'"
            [data]="chartData()"
            [options]="chartOptions">
          </canvas>
        </div>

        <div class="table-wrapper" *ngIf="tableRows().length > 0">
          <table class="comparison-table">
            <thead>
              <tr>
                <th>Monat</th>
                <th *ngFor="let station of selectedStations()">{{ station }}</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let row of tableRows()">
                <td>{{ row.label }}</td>
                <td *ngFor="let station of selectedStations()">
                  {{ row.values[station] === null ? '–' : (row.values[station] ?? 0) | number:'1.2-2' }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <ng-template #emptyState>
        <div class="empty-state">
          <mat-icon>playlist_add</mat-icon>
          <p>Bitte wählen Sie mindestens eine Station aus, um den Vergleich zu starten.</p>
        </div>
      </ng-template>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>
        <mat-icon>close</mat-icon>
        Schließen
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    :host {
      display: block;
      max-width: 960px;
    }

    mat-dialog-content {
      max-height: 70vh;
      overflow: visible;
    }

    .dialog-description {
      margin-bottom: 16px;
      color: rgba(0, 0, 0, 0.7);
    }

    .station-selection {
      margin-bottom: 24px;
      border: 1px solid rgba(0, 0, 0, 0.08);
      border-radius: 8px;
      padding: 16px;
      background: #fafafa;
    }

    .selection-header {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 600;
      margin-bottom: 12px;
    }

    .selection-header mat-icon {
      color: #1976d2;
    }

    .selection-count {
      margin-left: auto;
      font-size: 13px;
      color: rgba(0, 0, 0, 0.6);
    }

    .selection-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
      gap: 8px 12px;
      margin-top: 12px;
    }

    .station-option {
      padding: 4px 8px;
      border-radius: 4px;
    }

    .station-option.mat-mdc-checkbox-checked {
      background: rgba(25, 118, 210, 0.06);
    }

    .selection-hint {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 12px;
      font-size: 13px;
      color: rgba(0, 0, 0, 0.6);
    }

    .selection-hint mat-icon {
      font-size: 18px;
      height: 18px;
      width: 18px;
      color: #ff9800;
    }

    .comparison-content {
      display: flex;
      flex-direction: column;
      gap: 24px;
    }

    .chart-wrapper {
      min-height: 320px;
      border: 1px solid rgba(0, 0, 0, 0.08);
      border-radius: 8px;
      padding: 16px;
      background: white;
    }

    .table-wrapper {
      overflow-x: auto;
      border: 1px solid rgba(0, 0, 0, 0.08);
      border-radius: 8px;
      background: white;
    }

    .comparison-table {
      width: 100%;
      border-collapse: collapse;
    }

    .comparison-table th,
    .comparison-table td {
      padding: 12px 16px;
      text-align: left;
      border-bottom: 1px solid rgba(0, 0, 0, 0.06);
      white-space: nowrap;
    }

    .comparison-table th {
      background: #f5f5f5;
      font-weight: 600;
    }

    .comparison-table tbody tr:hover {
      background: rgba(25, 118, 210, 0.06);
      transition: background-color 0.2s ease;
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 12px;
      padding: 40px 16px;
      color: rgba(0, 0, 0, 0.6);
      text-align: center;
    }

    .empty-state mat-icon {
      font-size: 48px;
      height: 48px;
      width: 48px;
      color: #b0bec5;
    }

    @media (max-width: 768px) {
      :host {
        max-width: 100%;
      }

      .selection-grid {
        grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
      }
    }
  `]
})
export class MinaMitaComparisonDialogComponent implements OnInit {
  availableStations = signal<string[]>([]);
  selectedStations = signal<string[]>([]);
  chartData = signal<ChartData<'line'>>({ labels: [], datasets: [] });
  tableRows = signal<Array<{ key: string; label: string; values: Record<string, number | null> }>>([]);

  chartOptions: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          usePointStyle: true,
          padding: 12
        }
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        callbacks: {
          label: (context) => {
            const label = context.dataset.label ?? '';
            const value = context.parsed.y;
            return `${label}: ${value !== null ? value.toFixed(2) : '–'} Patienten`;
          }
        }
      }
    },
    interaction: {
      mode: 'nearest',
      axis: 'x',
      intersect: false
    },
    scales: {
      x: {
        title: {
          display: true,
          text: 'Monat'
        }
      },
      y: {
        title: {
          display: true,
          text: 'MiNa Durchschnitt'
        },
        beginAtZero: false
      }
    }
  };

  private readonly colorPalette = ['#1976d2', '#ef6c00', '#7b1fa2', '#00897b', '#c2185b', '#6d4c41', '#0097a7'];
  private readonly stationMonthAggregates = new Map<string, Map<string, StationMonthAggregate>>();
  private readonly monthMetadata = new Map<string, MonthMetadata>();
  private monthOrder: string[] = [];

  constructor(
    @Inject(MAT_DIALOG_DATA) private data: ComparisonDialogData
  ) {
    Chart.register(...registerables);
  }

  ngOnInit(): void {
    this.availableStations.set([...this.data.stations]);
    this.initializeAggregates();
    this.selectDefaultStations();
    this.updateOutputs();
  }

  isStationSelected(station: string): boolean {
    return this.selectedStations().includes(station);
  }

  toggleStation(station: string, event: MatCheckboxChange) {
    const checked = event.checked;
    const current = new Set(this.selectedStations());

    if (checked) {
      if (current.size >= 4) {
        event.source.checked = false;
        return;
      }
      current.add(station);
    } else {
      current.delete(station);
    }

    const ordered = this.availableStations().filter(name => current.has(name));
    this.selectedStations.set(ordered);
    this.updateOutputs();
  }

  isSelectionLimitReached(): boolean {
    return this.selectedStations().length >= 4;
  }

  chartReady(): boolean {
    return this.selectedStations().length > 0 && this.monthOrder.length > 0;
  }

  private initializeAggregates() {
    this.stationMonthAggregates.clear();
    this.monthMetadata.clear();

    this.data.uploads
      .filter(upload => upload.schemaId === 'ppugv_bestaende')
      .forEach(upload => {
        upload.files.forEach(file => {
          const metadata = (file as any)?.metadata ?? {};

          if ((file as any)?.monthlyAverages && Array.isArray((file as any).monthlyAverages)) {
            this.processMonthlyAverages((file as any).monthlyAverages, metadata, upload);
          } else if ((file as any)?.values && Array.isArray((file as any).values)) {
            this.processRawValues((file as any).values, upload);
          }
        });
      });

    this.monthOrder = Array.from(this.monthMetadata.keys()).sort();
  }

  private processMonthlyAverages(rows: any[], metadata: any, upload: UploadRecord) {
    rows.forEach(row => {
      const station = this.normalizeStation(row.Station ?? row.station);
      if (!station) {
        return;
      }

      const { month, year } = this.resolveMonthYear(row, metadata, upload);
      if (!month || !year) {
        return;
      }

      const key = this.makeMonthKey(year, month);
      const minaValue = this.parseNumber(row.MiNa_Durchschnitt ?? row.MiNa ?? row.minaAverage ?? row.mina_durchschnitt);

      this.addAggregateValue(station, key, month, year, minaValue);
    });
  }

  private processRawValues(rows: any[], upload: UploadRecord) {
    const stationMonthMap = new Map<string, Map<string, StationMonthAggregate>>();

    rows.forEach(row => {
      const station = this.normalizeStation(row.Station ?? row.station);
      const date = this.parseDate(row.Datum ?? row.datum);
      if (!station || !date) {
        return;
      }

      const month = date.getMonth() + 1;
      const year = date.getFullYear();
      const key = this.makeMonthKey(year, month);
      const minaValue = this.parseNumber(row.MiNa_Bestand ?? row.MiNa ?? row.mina ?? row.minaBestand);

      if (!stationMonthMap.has(station)) {
        stationMonthMap.set(station, new Map());
      }
      const monthMap = stationMonthMap.get(station)!;
      if (!monthMap.has(key)) {
        monthMap.set(key, { total: 0, count: 0 });
      }
      const aggregate = monthMap.get(key)!;
      aggregate.total += minaValue;
      aggregate.count += 1;
    });

    stationMonthMap.forEach((monthMap, station) => {
      monthMap.forEach((aggregate, key) => {
        const { month, year } = this.monthMetadata.get(key) ?? this.parseMonthKey(key) ?? { month: null, year: null };
        if (!month || !year) {
          return;
        }
        const average = aggregate.count > 0 ? aggregate.total / aggregate.count : 0;
        this.addAggregateValue(station, key, month, year, average);
      });
    });
  }

  private resolveMonthYear(row: any, metadata: any, upload: UploadRecord): { month: number | null; year: number | null } {
    const monthSources = [row.Monat, row.month, metadata?.month];
    const yearSources = [row.Jahr, row.jahr, row.year, metadata?.year, metadata?.jahr];

    let month = this.parseMonth(monthSources);
    let year = this.parseYear(yearSources);

    if (!year) {
      const uploadDate = new Date(upload.createdAt);
      year = isNaN(uploadDate.getTime()) ? null : uploadDate.getFullYear();
    }

    if (!month && metadata?.monthsInFile?.length === 1) {
      const [metaYear, metaMonth] = String(metadata.monthsInFile[0]).split('-');
      month = this.parseNumber(metaMonth);
      year = year ?? this.parseNumber(metaYear);
    }

    if (!month || month < 1 || month > 12) {
      return { month: null, year: null };
    }

    return { month, year };
  }

  private parseMonth(sources: any[]): number | null {
    for (const source of sources) {
      const parsed = this.parseMonthValue(source);
      if (parsed !== null) {
        return parsed;
      }
    }
    return null;
  }

  private parseYear(sources: any[]): number | null {
    for (const source of sources) {
      const parsed = this.parseYearValue(source);
      if (parsed !== null) {
        return parsed;
      }
    }
    return null;
  }

  private parseMonthValue(value: any): number | null {
    if (value === undefined || value === null) {
      return null;
    }

    if (typeof value === 'number') {
      return value >= 1 && value <= 12 ? value : null;
    }

    if (typeof value === 'string') {
      const trimmed = value.trim();

      const isoMatch = trimmed.match(/^(\d{4})-(\d{2})$/);
      if (isoMatch) {
        return this.parseNumber(isoMatch[2]);
      }

      const numericMatch = trimmed.match(/^(\d{1,2})$/);
      if (numericMatch) {
        return this.parseNumber(numericMatch[1]);
      }

      const monthNameMap: Record<string, number> = {
        januar: 1, jan: 1,
        februar: 2, feb: 2,
        märz: 3, maerz: 3, mrz: 3,
        april: 4, apr: 4,
        mai: 5,
        juni: 6, jun: 6,
        juli: 7, jul: 7,
        august: 8, aug: 8,
        september: 9, sep: 9, sept: 9,
        oktober: 10, okt: 10,
        november: 11, nov: 11,
        dezember: 12, dez: 12
      };

      const normalized = trimmed.toLowerCase();
      if (monthNameMap[normalized]) {
        return monthNameMap[normalized];
      }
    }

    return null;
  }

  private parseYearValue(value: any): number | null {
    if (value === undefined || value === null) {
      return null;
    }

    if (typeof value === 'number') {
      return value;
    }

    if (typeof value === 'string') {
      const trimmed = value.trim();

      const isoMatch = trimmed.match(/^(\d{4})-(\d{2})$/);
      if (isoMatch) {
        return this.parseNumber(isoMatch[1]);
      }

      const numericMatch = trimmed.match(/^(\d{4})$/);
      if (numericMatch) {
        return this.parseNumber(numericMatch[1]);
      }
    }

    return null;
  }

  private parseNumber(value: any): number {
    const num = Number(value);
    return isNaN(num) ? 0 : num;
  }

  private parseDate(value: any): Date | null {
    if (!value) {
      return null;
    }

    if (value instanceof Date) {
      return isNaN(value.getTime()) ? null : value;
    }

    if (typeof value === 'number') {
      return this.excelDateToJSDate(value);
    }

    if (typeof value === 'string') {
      const isoDate = new Date(value);
      if (!isNaN(isoDate.getTime())) {
        return isoDate;
      }

      const germanMatch = value.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
      if (germanMatch) {
        const [_, day, month, year] = germanMatch;
        return new Date(Number(year), Number(month) - 1, Number(day));
      }
    }

    return null;
  }

  private excelDateToJSDate(excelDate: number): Date {
    const excelEpoch = new Date(1900, 0, 1);
    const days = excelDate - 2; // Excel incorrectly includes 29.02.1900
    return new Date(excelEpoch.getTime() + days * 86400000);
  }

  private addAggregateValue(station: string, key: string, month: number, year: number, value: number) {
    if (!this.stationMonthAggregates.has(station)) {
      this.stationMonthAggregates.set(station, new Map());
    }

    const monthMap = this.stationMonthAggregates.get(station)!;
    if (!monthMap.has(key)) {
      monthMap.set(key, { total: 0, count: 0 });
    }

    const aggregate = monthMap.get(key)!;
    aggregate.total += value;
    aggregate.count += 1;

    if (!this.monthMetadata.has(key)) {
      this.monthMetadata.set(key, { month, year });
    }
  }

  private selectDefaultStations() {
    const defaultSelection = this.availableStations().slice(0, Math.min(4, Math.max(1, this.availableStations().length >= 2 ? 2 : 1)));
    this.selectedStations.set(defaultSelection);
  }

  private updateOutputs() {
    this.chartData.set(this.buildChartData());
    this.tableRows.set(this.buildTableRows());
  }

  private buildChartData(): ChartData<'line'> {
    const selected = this.selectedStations();

    const labels = this.monthOrder.map(key => this.formatMonthLabel(key));
    const datasets = selected.map((station, index) => {
      const monthMap = this.stationMonthAggregates.get(station) ?? new Map();
      return {
        label: station,
        data: this.monthOrder.map(key => {
          const aggregate = monthMap.get(key);
          if (!aggregate || aggregate.count === 0) {
            return null;
          }
          const average = aggregate.total / aggregate.count;
          return Number(average.toFixed(2));
        }),
        borderColor: this.colorPalette[index % this.colorPalette.length],
        backgroundColor: this.toRgba(this.colorPalette[index % this.colorPalette.length], 0.25),
        fill: false,
        tension: 0.3,
        pointRadius: 4,
        pointHoverRadius: 6
      };
    });

    return { labels, datasets };
  }

  private buildTableRows(): Array<{ key: string; label: string; values: Record<string, number | null> }> {
    const selected = this.selectedStations();

    return this.monthOrder.map(key => {
      const label = this.formatMonthLabel(key);
      const values: Record<string, number | null> = {};

      selected.forEach(station => {
        const aggregate = this.stationMonthAggregates.get(station)?.get(key);
        if (!aggregate || aggregate.count === 0) {
          values[station] = null;
        } else {
          values[station] = Number((aggregate.total / aggregate.count).toFixed(2));
        }
      });

      return { key, label, values };
    });
  }

  private formatMonthLabel(key: string): string {
    const metadata = this.monthMetadata.get(key) ?? this.parseMonthKey(key);
    if (!metadata) {
      return key;
    }
    const { month, year } = metadata;
    const date = new Date(year, month - 1);
    return date.toLocaleDateString('de-DE', { month: 'short', year: 'numeric' });
  }

  private makeMonthKey(year: number, month: number): string {
    return `${year}-${month.toString().padStart(2, '0')}`;
  }

  private parseMonthKey(key: string): MonthMetadata | null {
    const match = key.match(/^(\d{4})-(\d{2})$/);
    if (!match) {
      return null;
    }
    const year = this.parseNumber(match[1]);
    const month = this.parseNumber(match[2]);
    if (!month || !year) {
      return null;
    }
    return { month, year };
  }

  private normalizeStation(station: unknown): string | null {
    if (typeof station === 'string') {
      const trimmed = station.trim();
      return trimmed.length > 0 ? trimmed : null;
    }
    return null;
  }

  private toRgba(hex: string, alpha: number): string {
    const sanitized = hex.replace('#', '');
    const bigint = parseInt(sanitized, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
}

