import { Component, OnInit, signal, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartData, ChartType, registerables } from 'chart.js';
import Chart from 'chart.js/auto';
import { Api, PatientenPflegekraftOverviewResponse, PfkAlert, PfkThresholdConfig, PfkSeverity, PfkSchicht } from '../../core/api';
import { ComparisonDialogComponent, ComparisonMetricConfig, ComparisonSeries } from '../shared/comparison-dialog/comparison-dialog.component';
import { SearchableSelectComponent } from '../shared/searchable-select/searchable-select.component';

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
    MatTooltipModule,
    BaseChartDirective,
    SearchableSelectComponent
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
            <app-searchable-select
              class="station-selector"
              label="Station"
              icon="business"
              [options]="stations()"
              [value]="selectedStation()"
              [includeAllOption]="true"
              [allValue]="''"
              [allLabel]="'-- Bitte wählen --'"
              (valueChange)="onStationChange($event)"
            ></app-searchable-select>

            <app-searchable-select
              class="year-selector"
              label="Jahr"
              icon="event"
              [options]="availableYearOptions"
              [value]="selectedYear().toString()"
              [clearable]="false"
              (valueChange)="onYearSelect($event)"
            ></app-searchable-select>

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
          <div class="chart-loading-overlay" *ngIf="chartLoading()">
            <div class="loading-bar"></div>
            <p>Daten werden geladen…</p>
          </div>
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
            <div class="chart-alerts" *ngIf="sortedAlerts().length > 0">
              <h4>
                <mat-icon>campaign</mat-icon>
                Warnungen & Empfehlungen
              </h4>
              <div class="alert-item" *ngFor="let alert of sortedAlerts()">
                <mat-icon class="alert-icon" [ngClass]="alertIconClass(alert.severity)">{{ alertIconName(alert.severity) }}</mat-icon>
                <div class="alert-content" [ngClass]="alertSeverityClass(alert)">
                  <span class="alert-title">{{ alertMonthLabel(alert) }} · {{ schichtLabel(alert.schicht) }}</span>
                  <span class="alert-message">{{ alertDescription(alert) }}</span>
                  <span class="alert-recommendation" *ngIf="alert.recommendation">{{ alert.recommendation }}</span>
                  <span class="alert-note" *ngIf="alert.note">Notiz: {{ alert.note }}</span>
                </div>
              </div>
            </div>
          </div>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .pp-chart { padding: 0; }
    .header-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; gap: 12px; flex-wrap: wrap; }
    .selectors-container { display: flex; gap: 12px; align-items: center; flex-wrap: nowrap; }
    .station-selector, .year-selector { width: 220px; flex: 0 0 220px; }
    .comparison-button { display: flex; align-items: center; gap: 8px; position: relative; z-index: 0; flex: 0 0 auto; }
    .comparison-button mat-icon { margin: 0; }
    .metric-card { box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .metric-header { background: linear-gradient(135deg, #0097a7 0%, #007c91 100%); color: white; padding: 12px 16px; }
    .chart-content { padding: 0; }
    .chart-container { height: 320px; position: relative; margin-bottom: 12px; }
    .chart-info { padding: 8px 12px; background: #f5f5f5; border-radius: 4px; margin-top: 8px; }
    .chart-info mat-chip-set { display: flex; gap: 8px; justify-content: center; }
    .chart-alerts { margin-top: 16px; display: flex; flex-direction: column; gap: 12px; }
    .chart-alerts h4 { display: flex; align-items: center; gap: 8px; margin: 0; font-size: 16px; color: #007c91; }
    .chart-alerts .alert-item { display: flex; gap: 12px; align-items: flex-start; background: white; border-radius: 6px; border: 1px solid #dce3e7; padding: 12px 16px; box-shadow: 0 1px 2px rgba(0,0,0,0.08); }
    .chart-alerts .alert-icon { font-size: 24px; width: 24px; height: 24px; }
    .chart-alerts .alert-icon.icon-info { color: #0288d1; }
    .chart-alerts .alert-icon.icon-warning { color: #f9a825; }
    .chart-alerts .alert-icon.icon-critical { color: #d32f2f; }
    .chart-alerts .alert-content { display: flex; flex-direction: column; gap: 4px; font-size: 14px; color: #424242; border-left: 3px solid transparent; padding-left: 12px; }
    .chart-alerts .alert-content.alert-info { border-color: rgba(2, 136, 209, 0.6); }
    .chart-alerts .alert-content.alert-warning { border-color: rgba(249, 168, 37, 0.7); }
    .chart-alerts .alert-content.alert-critical { border-color: rgba(211, 47, 47, 0.8); }
    .chart-alerts .alert-title { font-weight: 600; }
    .chart-alerts .alert-message { line-height: 1.4; }
    .chart-alerts .alert-recommendation { font-weight: 600; color: #00695c; }
    .chart-alerts .alert-note { font-size: 12px; color: #757575; }
    .chart-loading-overlay {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: rgba(255, 255, 255, 0.92);
      border-radius: 4px;
      gap: 16px;
      z-index: 2;
      pointer-events: none;

      .loading-bar {
        width: 180px;
        height: 4px;
        background: linear-gradient(90deg, rgba(0,151,167,0.3) 0%, rgba(0,124,145,0.9) 50%, rgba(0,151,167,0.3) 100%);
        animation: shimmer 1.4s infinite ease-in-out;
        border-radius: 999px;
      }

      p {
        margin: 0;
        font-weight: 600;
        color: #007c91;
      }
    }

    @keyframes shimmer {
      0% { transform: translateX(-50%); opacity: 0.4; }
      50% { transform: translateX(0%); opacity: 1; }
      100% { transform: translateX(50%); opacity: 0.4; }
    }
    @media (max-width: 1024px) {
      .selectors-container {
        flex-wrap: wrap;
      }
      .station-selector, .year-selector {
        flex: 1 1 240px;
        min-width: 200px;
      }
      .comparison-button {
        flex: 1 1 auto;
      }
    }
    @media (max-width: 768px) {
      .selectors-container {
        flex-direction: column;
        align-items: stretch;
      }
      .station-selector, .year-selector {
        width: 100%;
        flex: 1 1 auto;
      }
      .comparison-button {
        width: 100%;
        justify-content: center;
      }
    }
  `]
})
export class PatientenPflegekraftCharts implements OnInit {
  private api = inject(Api);
  private dialog = inject(MatDialog);

  stations = signal<string[]>([]);
  selectedStation = signal<string>(''); // will default to BABBELEG if vorhanden
  selectedYear = signal<number>(new Date().getFullYear());

  availableYears = [2023, 2024, 2025, 2026, 2027];
  readonly availableYearOptions = this.availableYears.map(year => year.toString());

  private dayValues = signal<number[]>(Array(12).fill(0));
  private nightValues = signal<number[]>(Array(12).fill(0));
  private comparisonCache = new Map<string, { day: number[]; night: number[]; metadata?: PatientenPflegekraftOverviewResponse['metadata'] }>();
  comparisonSeries = signal<ComparisonSeries[]>([]);
  comparisonLoading = signal<boolean>(false);
  chartLoading = signal<boolean>(false);
  alerts = signal<PfkAlert[]>([]);
  thresholds = signal<PfkThresholdConfig[]>([]);
  readonly sortedAlerts = computed(() => this.sortAlerts(this.alerts()));

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

  private readonly monthNames = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];
  private readonly severityRank: Record<PfkSeverity, number> = {
    info: 1,
    warning: 2,
    critical: 3
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
    this.comparisonSeries.set([]);
    this.loadAveragesAndData();
  }

  onYearSelect(year: string) {
    const parsed = Number.parseInt(year, 10);
    if (!Number.isNaN(parsed)) {
      this.onYearChange(parsed);
    }
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
    this.chartLoading.set(true);

    try {
      const { dayValues, nightValues, metadata } = await this.fetchMonthlyValues(station, this.selectedYear());
      this.dayValues.set(dayValues);
      this.nightValues.set(nightValues);
      const alerts = metadata?.alerts;
      const thresholds = metadata?.thresholds;
      this.alerts.set(Array.isArray(alerts) ? [...alerts] : []);
      this.thresholds.set(Array.isArray(thresholds) ? [...thresholds] : []);
      if (metadata?.warnings?.length) {
        console.warn(`⚠️ Patienten/Pflegekraft Hinweise (${station} ${this.selectedYear()}): ${metadata.warnings.join(' | ')}`);
      }
      this.refreshChart();
    } catch (error) {
      console.error('Fehler beim Laden der Patienten/Pflegekraft Übersicht:', error);
      this.dayValues.set(Array(12).fill(0));
      this.nightValues.set(Array(12).fill(0));
      this.alerts.set([]);
      this.thresholds.set([]);
      this.refreshChart();
    } finally {
      this.chartLoading.set(false);
    }
  }

  private async fetchMonthlyValues(station: string, year: number): Promise<{ dayValues: number[]; nightValues: number[]; metadata?: PatientenPflegekraftOverviewResponse['metadata'] }> {
    const cacheKey = `${station}::${year}`;
    const cached = this.comparisonCache.get(cacheKey);
    if (cached) {
      return { dayValues: [...cached.day], nightValues: [...cached.night], metadata: cached.metadata };
    }

    const overview = await this.api.getPatientenPflegekraftOverview(station, year).toPromise();
    const dayVals = overview?.values?.day ?? Array(12).fill(0);
    const nightVals = overview?.values?.night ?? Array(12).fill(0);
    this.comparisonCache.set(cacheKey, { day: [...dayVals], night: [...nightVals], metadata: overview?.metadata });
    return { dayValues: [...dayVals], nightValues: [...nightVals], metadata: overview?.metadata };
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
        try {
          const { dayValues, nightValues } = await this.fetchMonthlyValues(station, year);

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
        } catch (error) {
          console.warn(`Übersicht für ${station} konnte nicht geladen werden`, error);
        }
      }

      this.comparisonSeries.set(series);
    } finally {
      this.comparisonLoading.set(false);
    }
  }

  private refreshChart() {
    const dayStyles = this.computePointStyles('day');
    const nightStyles = this.computePointStyles('night');
    this.chartData = {
      labels: ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'],
      datasets: [
        {
          data: this.dayValues(),
          label: 'Tag (PFK)',
          borderColor: '#00acc1',
          backgroundColor: 'rgba(0,172,193,0.12)',
          fill: true,
          tension: 0.35,
          pointRadius: dayStyles.radius,
          pointHoverRadius: dayStyles.hoverRadius,
          pointBackgroundColor: dayStyles.background,
          pointBorderColor: dayStyles.border,
          pointBorderWidth: dayStyles.borderWidth
        },
        {
          data: this.nightValues(),
          label: 'Nacht (PFK)',
          borderColor: '#7b1fa2',
          backgroundColor: 'rgba(123,31,162,0.12)',
          fill: true,
          tension: 0.35,
          pointRadius: nightStyles.radius,
          pointHoverRadius: nightStyles.hoverRadius,
          pointBackgroundColor: nightStyles.background,
          pointBorderColor: nightStyles.border,
          pointBorderWidth: nightStyles.borderWidth
        }
      ]
    };
  }

  dayAverage() { const v = this.dayValues().filter(n=>n>0); return v.length? v.reduce((a,b)=>a+b,0)/v.length : 0; }
  nightAverage() { const v = this.nightValues().filter(n=>n>0); return v.length? v.reduce((a,b)=>a+b,0)/v.length : 0; }

  schichtLabel(schicht: PfkSchicht) {
    return schicht === 'night' ? 'Nacht' : 'Tag';
  }

  alertSeverityClass(alert: PfkAlert) {
    return `alert-${alert.severity}`;
  }

  alertIconName(severity: PfkSeverity) {
    switch (severity) {
      case 'critical':
        return 'priority_high';
      case 'warning':
        return 'warning';
      default:
        return 'info';
    }
  }

  alertIconClass(severity: PfkSeverity) {
    return `icon-${severity}`;
  }

  alertMonthLabel(alert: PfkAlert) {
    return `${this.monthNames[alert.month - 1] ?? `Monat ${alert.month}`} ${alert.year}`;
  }

  alertDescription(alert: PfkAlert) {
    const direction = alert.trigger === 'upper' ? 'über' : 'unter';
    const threshold = alert.thresholdValue.toLocaleString('de-DE', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
    const actual = alert.actualValue.toLocaleString('de-DE', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
    return `Aktueller Wert ${actual} liegt ${direction} dem Grenzwert ${threshold}.`;
  }

  private computePointStyles(schicht: PfkSchicht) {
    const length = this.monthNames.length;
    const defaultColor = schicht === 'day' ? '#00acc1' : '#7b1fa2';
    const defaultBorder = schicht === 'day' ? '#00838f' : '#5e35b1';
    const highlightColors: Record<PfkSeverity, string> = {
      info: '#0288d1',
      warning: '#fbc02d',
      critical: '#d32f2f'
    };

    const background = Array(length).fill(defaultColor);
    const border = Array(length).fill(defaultBorder);
    const radius = Array(length).fill(4);
    const hoverRadius = Array(length).fill(6);
    const borderWidth = Array(length).fill(1);
    const severityPerMonth = Array(length).fill(0);

    this.alerts().forEach(alert => {
      if (alert.schicht !== schicht) return;
      const index = alert.month - 1;
      if (index < 0 || index >= length) return;
      const rank = this.severityRank[alert.severity] ?? 0;
      if (rank >= severityPerMonth[index]) {
        severityPerMonth[index] = rank;
        const color = highlightColors[alert.severity] ?? defaultColor;
        background[index] = color;
        border[index] = color;
        radius[index] = 6;
        hoverRadius[index] = 8;
        borderWidth[index] = 2;
      }
    });

    return { background, border, radius, hoverRadius, borderWidth };
  }

  private sortAlerts(alerts: PfkAlert[]) {
    const schichtOrder: Record<PfkSchicht, number> = { day: 0, night: 1 };
    return [...alerts].sort((a, b) => {
      const severityDiff = (this.severityRank[b.severity] ?? 0) - (this.severityRank[a.severity] ?? 0);
      if (severityDiff !== 0) {
        return severityDiff;
      }
      const monthDiff = a.month - b.month;
      if (monthDiff !== 0) {
        return monthDiff;
      }
      return (schichtOrder[a.schicht] ?? 0) - (schichtOrder[b.schicht] ?? 0);
    });
  }
}

