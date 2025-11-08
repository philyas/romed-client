import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartData, ChartType, registerables } from 'chart.js';
import Chart from 'chart.js/auto';
import { Api, ManualEntryDataResponse } from '../../core/api';
import { ComparisonDialogComponent, ComparisonMetricConfig, ComparisonSeries } from '../shared/comparison-dialog/comparison-dialog.component';

@Component({
  selector: 'app-patienten-pflegekraft-charts',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatChipsModule,
    MatIconModule,
    MatTabsModule,
    MatSelectModule,
    MatFormFieldModule,
    MatTooltipModule,
    BaseChartDirective
  ],
  template: `
    <div class="pp-chart">
      <div class="charts-header">
        <div class="header-top">
          <h3>
            <mat-icon>group</mat-icon>
            Patienten/Pflegekraft gem. PpUGV – Jahresübersicht {{ selectedYear() }}
          </h3>
          <div class="selectors-container">
            <mat-form-field appearance="outline" class="station-selector">
              <mat-label>
                <mat-icon>business</mat-icon>
                Station
              </mat-label>
              <mat-select [value]="selectedStation()" (selectionChange)="onStationChange($event.value)">
                <mat-option value="">-- Bitte wählen --</mat-option>
                <mat-option *ngFor="let station of stations()" [value]="station">{{ station }}</mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline" class="year-selector">
              <mat-label>
                <mat-icon>event</mat-icon>
                Jahr
              </mat-label>
              <mat-select [value]="selectedYear()" (selectionChange)="onYearChange($event.value)">
                <mat-option *ngFor="let year of availableYears" [value]="year">{{ year }}</mat-option>
              </mat-select>
            </mat-form-field>

            <button
              mat-stroked-button
              color="primary"
              class="comparison-button"
              (click)="openComparisonDialog($event)"
              [disabled]="comparisonLoading() || comparisonSeries().length <= 1"
              matTooltip="Vergleichen Sie bis zu vier Stationen (Tag/Nacht)">
              <mat-icon>compare</mat-icon>
              Vergleich
            </button>
          </div>
        </div>
        <p>Monatliche Entwicklung der Kennzahl Patienten/Pflegekraft (PFK) für Tag und Nacht</p>
      </div>

      <mat-card class="metric-card" *ngIf="selectedStation()">
        <mat-card-header class="metric-header">
          <mat-card-title>Patient/Pflegekraft gem. PpUGV ({{ selectedStation() }})</mat-card-title>
        </mat-card-header>
        <mat-card-content class="chart-content">
          <div class="chart-container">
            <canvas baseChart
              [data]="chartData"
              [options]="chartOptions"
              [type]="chartType">
            </canvas>
          </div>
          <div class="chart-info">
            <mat-chip-set>
              <mat-chip>Tag Ø {{ dayAverage() | number:'1.3-3' }}</mat-chip>
              <mat-chip>Nacht Ø {{ nightAverage() | number:'1.3-3' }}</mat-chip>
            </mat-chip-set>
          </div>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .pp-chart { padding: 8px; }
    .header-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; gap: 12px; flex-wrap: wrap; }
    .selectors-container { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
    .station-selector, .year-selector { width: 220px; }
    .comparison-button { display: flex; align-items: center; gap: 8px; }
    .comparison-button mat-icon { margin: 0; }
    .metric-card { box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .metric-header { background: linear-gradient(135deg, #0097a7 0%, #007c91 100%); color: white; padding: 12px 16px; }
    .chart-content { padding: 0; }
    .chart-container { height: 320px; position: relative; margin-bottom: 12px; }
    .chart-info { padding: 8px 12px; background: #f5f5f5; border-radius: 4px; margin-top: 8px; }
    .chart-info mat-chip-set { display: flex; gap: 8px; justify-content: center; }
  `]
})
export class PatientenPflegekraftCharts implements OnInit {
  private api = inject(Api);
  private dialog = inject(MatDialog);

  stations = signal<string[]>([]);
  selectedStation = signal<string>(''); // will default to BABBELEG if vorhanden
  selectedYear = signal<number>(new Date().getFullYear());

  availableYears = [2023, 2024, 2025, 2026, 2027];

  private mitaAverage = signal<number | null>(null);
  private minaAverage = signal<number | null>(null);

  private dayValues = signal<number[]>(Array(12).fill(0));
  private nightValues = signal<number[]>(Array(12).fill(0));
  private comparisonCache = new Map<string, { day: number[]; night: number[] }>();
  comparisonSeries = signal<ComparisonSeries[]>([]);
  comparisonLoading = signal<boolean>(false);

  private readonly comparisonMetrics: ComparisonMetricConfig[] = [
    {
      key: 'pfkTag',
      label: 'PFK Tag',
      chartTitle: 'Patient/Pflegekraft – Tag',
      decimals: 3,
      valueFormatter: value => value === null ? '–' : value.toLocaleString('de-DE', { minimumFractionDigits: 3, maximumFractionDigits: 3 })
    },
    {
      key: 'pfkNacht',
      label: 'PFK Nacht',
      chartTitle: 'Patient/Pflegekraft – Nacht',
      decimals: 3,
      valueFormatter: value => value === null ? '–' : value.toLocaleString('de-DE', { minimumFractionDigits: 3, maximumFractionDigits: 3 })
    }
  ];

  chartType: ChartType = 'line';
  chartData: ChartData<'line'> = {
    labels: ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'],
    datasets: [
      { data: [], label: 'Tag (PFK)', borderColor: '#00acc1', backgroundColor: 'rgba(0,172,193,0.12)', fill: true, tension: 0.35, pointRadius: 4, pointHoverRadius: 6 },
      { data: [], label: 'Nacht (PFK)', borderColor: '#7b1fa2', backgroundColor: 'rgba(123,31,162,0.12)', fill: true, tension: 0.35, pointRadius: 4, pointHoverRadius: 6 }
    ]
  };

  chartOptions: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: true }, title: { display: true, text: 'Patient/Pflegekraft (PFK)' } },
    scales: { y: { beginAtZero: true, title: { display: true, text: 'Patient/Pflegekraft' } } }
  };

  ngOnInit() {
    Chart.register(...registerables);
    this.loadStations();
  }

  onStationChange(station: string) {
    this.selectedStation.set(station);
    this.loadAveragesAndData();
  }

  onYearChange(year: number) {
    this.selectedYear.set(year);
    this.comparisonCache.clear();
    this.comparisonSeries.set([]);
    this.loadAveragesAndData();
  }

  private loadStations() {
    // Union aus Tag- und Nacht-Stationen
    Promise.all([
      this.api.getManualEntryStations().toPromise(),
      this.api.getManualEntryNachtStations().toPromise()
    ]).then(([day, night]) => {
      const set = new Set<string>([...(day?.stations || []), ...(night?.stations || [])]);
      const list = Array.from(set).sort();
      this.stations.set(list);

      // Default auswählen: BABBELEG, wenn vorhanden
      if (!this.selectedStation() && list.includes('BABBELEG')) {
        this.selectedStation.set('BABBELEG');
        this.loadAveragesAndData();
      }
    }).catch(() => {
      // Fallback: nur Tag
      this.api.getManualEntryStations().subscribe(res => {
        const list = res.stations || [];
        this.stations.set(list);
        if (!this.selectedStation() && list.includes('BABBELEG')) {
          this.selectedStation.set('BABBELEG');
          this.loadAveragesAndData();
        }
      });
    });
  }

  private async loadAveragesAndData() {
    const station = this.selectedStation();
    if (!station) return;

    try {
      const [mita, mina] = await Promise.all([
        this.api.getStationMitaAverage(station).toPromise(),
        this.api.getStationMinaAverage(station).toPromise()
      ]);
      const mitaAvg = mita?.mitaDurchschnitt ?? null;
      const minaAvg = mina?.minaDurchschnitt ?? null;
      this.mitaAverage.set(mitaAvg);
      this.minaAverage.set(minaAvg);

      const { dayValues, nightValues } = await this.fetchMonthlyValues(station, this.selectedYear(), mitaAvg, minaAvg);
      this.dayValues.set(dayValues);
      this.nightValues.set(nightValues);
      this.refreshChart();
    } catch (e) {
      // ignore
    }
  }

  private async fetchMonthlyValues(station: string, year: number, mitaAverage: number | null, minaAverage: number | null): Promise<{ dayValues: number[]; nightValues: number[] }> {
    const cacheKey = `${station}::${year}`;
    const cached = this.comparisonCache.get(cacheKey);
    if (cached) {
      return { dayValues: [...cached.day], nightValues: [...cached.night] };
    }

    const dayVals: number[] = Array(12).fill(0);
    const nightVals: number[] = Array(12).fill(0);
    const requests: Promise<void>[] = [];

    for (let month = 1; month <= 12; month++) {
      requests.push(
        this.api.getManualEntryData(station, year, month, 'PFK').toPromise()
          .then(res => { dayVals[month - 1] = this.computePatientenProPflegekraftTag(res, mitaAverage); })
          .catch(() => { dayVals[month - 1] = 0; })
      );
      requests.push(
        this.api.getManualEntryNachtData(station, year, month, 'PFK').toPromise()
          .then(res => { nightVals[month - 1] = this.computePatientenProPflegekraftNacht(res, minaAverage); })
          .catch(() => { nightVals[month - 1] = 0; })
      );
    }

    await Promise.all(requests);
    this.comparisonCache.set(cacheKey, { day: [...dayVals], night: [...nightVals] });
    return { dayValues: dayVals, nightValues: nightVals };
  }

  async openComparisonDialog(event?: MouseEvent) {
    event?.stopPropagation();

    if (this.comparisonSeries().length <= 1 && !this.comparisonLoading()) {
      await this.prepareComparisonSeries();
    }

    if (this.comparisonSeries().length <= 1) {
      return;
    }

    this.dialog.open(ComparisonDialogComponent, {
      width: '1100px',
      maxWidth: '95vw',
      data: {
        title: `Patient/Pflegekraft – Vergleich (${this.selectedYear()})`,
        subtitle: 'Tag- und Nachtwerte pro Station',
        selectionLabel: 'Stationen',
        selectionLimit: 4,
        metrics: this.comparisonMetrics,
        series: this.comparisonSeries(),
        monthLabels: ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']
      }
    });
  }

  private async prepareComparisonSeries() {
    const stations = this.stations().filter(station => station && station.trim().length > 0);
    if (stations.length <= 1) {
      return;
    }

    this.comparisonLoading.set(true);
    try {
      const year = this.selectedYear();
      const series: ComparisonSeries[] = [];

      for (const station of stations) {
        const [mita, mina] = await Promise.all([
          this.api.getStationMitaAverage(station).toPromise(),
          this.api.getStationMinaAverage(station).toPromise()
        ]);
        const mitaAvg = mita?.mitaDurchschnitt ?? null;
        const minaAvg = mina?.minaDurchschnitt ?? null;
        const { dayValues, nightValues } = await this.fetchMonthlyValues(station, year, mitaAvg, minaAvg);

        series.push({
          id: station,
          label: station,
          monthlyData: dayValues.map((day, index) => ({
            month: index + 1,
            metrics: {
              pfkTag: day,
              pfkNacht: nightValues[index] ?? null
            }
          }))
        });
      }

      this.comparisonSeries.set(series);
    } finally {
      this.comparisonLoading.set(false);
    }
  }

  private computePatientenProPflegekraftTag(res: ManualEntryDataResponse | undefined, mitaAverage: number | null): number {
    if (!res || !res.data || !mitaAverage || mitaAverage === 0) return 0;
    const dayEntries = res.data.filter(d => d.Tag > 0);
    if (dayEntries.length === 0) return 0;

    let totalMinutes = 0;
    let daysWithData = 0;
    dayEntries.forEach(d => {
      const minutes = (Number(d.Stunden) || 0) * 60 + (Number(d.Minuten) || 0);
      if (minutes > 0) { totalMinutes += minutes; daysWithData++; }
    });
    if (daysWithData === 0) return 0;
    const avgPfkHours = (totalMinutes / daysWithData) / 60;

    let tatsaechlichAnrechenbar = 0;
    if (res.phkTageswerte && Array.isArray(res.phkTageswerte) && res.phkTageswerte.length > 0) {
      const values: number[] = [];
      dayEntries.forEach(entry => {
        const tagData = res.phkTageswerte!.find(t => t.tag === entry.Tag);
        if (!tagData) return;
        const phkAnr = entry.PHK_Anrechenbar_Stunden ?? 0;
        const dez = tagData.gesamtDezimal ?? 0;
        values.push(dez >= phkAnr ? phkAnr : dez);
      });
      if (values.length > 0) tatsaechlichAnrechenbar = values.reduce((a,b)=>a+b,0) / values.length;
    } else {
      const avgRow = res.data.find(d => d.Tag === 0);
      tatsaechlichAnrechenbar = Number(avgRow?.PHK_Anrechenbar_Stunden) || 0;
    }

    const gesamt = avgPfkHours + tatsaechlichAnrechenbar;
    const examPflege = gesamt / 16;
    return examPflege / mitaAverage;
  }

  private computePatientenProPflegekraftNacht(res: ManualEntryDataResponse | undefined, minaAverage: number | null): number {
    if (!res || !res.data || !minaAverage || minaAverage === 0) return 0;
    const dayEntries = res.data.filter(d => d.Tag > 0);
    if (dayEntries.length === 0) return 0;
    let totalMinutes = 0; let daysWithData = 0;
    dayEntries.forEach(d => {
      const minutes = (Number(d.Stunden) || 0) * 60 + (Number(d.Minuten) || 0);
      if (minutes > 0) { totalMinutes += minutes; daysWithData++; }
    });
    if (daysWithData === 0) return 0;
    const avgPfkHours = (totalMinutes / daysWithData) / 60;
    const avgRow = res.data.find(d => d.Tag === 0);
    const phkAnr = Number(avgRow?.PHK_Anrechenbar_Stunden) || 0;
    const gesamt = avgPfkHours + phkAnr;
    const examPflege = gesamt / 8;
    return examPflege / minaAverage;
  }

  private refreshChart() {
    this.chartData = {
      labels: ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'],
      datasets: [
        { data: this.dayValues(), label: 'Tag (PFK)', borderColor: '#00acc1', backgroundColor: 'rgba(0,172,193,0.12)', fill: true, tension: 0.35, pointRadius: 4, pointHoverRadius: 6 },
        { data: this.nightValues(), label: 'Nacht (PFK)', borderColor: '#7b1fa2', backgroundColor: 'rgba(123,31,162,0.12)', fill: true, tension: 0.35, pointRadius: 4, pointHoverRadius: 6 }
      ]
    };
  }

  dayAverage() { const v = this.dayValues().filter(n=>n>0); return v.length? v.reduce((a,b)=>a+b,0)/v.length : 0; }
  nightAverage() { const v = this.nightValues().filter(n=>n>0); return v.length? v.reduce((a,b)=>a+b,0)/v.length : 0; }
}

