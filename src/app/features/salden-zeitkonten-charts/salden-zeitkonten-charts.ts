import { Component, Input, OnInit, OnChanges, SimpleChanges, signal, computed, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartData } from 'chart.js';
import { UploadRecord, Api } from '../../core/api';
import { DataInfoPanel, DataInfoItem } from '../data-info-panel/data-info-panel';
import { ComparisonDialogComponent, ComparisonMetricConfig, ComparisonSeries } from '../shared/comparison-dialog/comparison-dialog.component';
import { SearchableSelectComponent } from '../shared/searchable-select/searchable-select.component';
import { firstValueFrom } from 'rxjs';

interface SaldenZeitkontenData {
  Berufsgruppe: string;
  Fkt: string;
  KST: string;
  Beschreibung: string;
  Monat: number;
  Jahr: number;
  Summe: number;
}

interface KostenstellenMappingItem {
  kostenstelle: string;
  stations?: string[];
  standorte?: string[];
  standortnummer?: number | string | null;
  ik?: number | string | null;
  paediatrie?: string | null;
}

@Component({
  selector: 'app-salden-zeitkonten-charts',
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatChipsModule,
    MatIconModule,
    MatTooltipModule,
    BaseChartDirective,
    DataInfoPanel,
    SearchableSelectComponent
  ],
  template: `
    <div class="salden-zeitkonten-charts">
      <div class="charts-header">
        <div class="header-top">
          <h3>
            <mat-icon>schedule</mat-icon>
            Salden Zeitkonten - Mehrarbeitszeit Pflegedienst
          </h3>
          <div class="selectors">
            <app-searchable-select
              class="selector"
              label="Kostenstelle"
              icon="domain"
              [options]="availableKSTCodes()"
              [value]="selectedKST()"
              [includeAllOption]="true"
              [allValue]="'all'"
              [allLabel]="allKSTLabel"
              [displayWith]="kstDisplayName"
              (valueChange)="onKSTChange($event)"
            ></app-searchable-select>
            
            <app-searchable-select
              class="selector"
              label="Jahr"
              icon="calendar_today"
              [options]="availableYearOptions()"
              [value]="selectedYear().toString()"
              [clearable]="false"
              (valueChange)="onYearSelect($event)"
            ></app-searchable-select>
            <button
              mat-stroked-button
              color="primary"
              class="comparison-button"
              (click)="openComparisonDialog($event)"
              [disabled]="comparisonSeries().length <= 1"
              matTooltip="Vergleichen Sie bis zu vier Kostenstellen über das Jahr">
              <mat-icon>compare</mat-icon>
              Vergleich
            </button>
          </div>
        </div>
        <p>Mehrarbeitszeit (Überstunden + Arbeitszeitkonto) in Stunden - {{ selectedBereich() }}</p>
      </div>

      <!-- Data Info Panel -->
      <app-data-info-panel 
        *ngIf="dataInfoItems().length > 0"
        [dataItems]="dataInfoItems()"
        [expandedByDefault]="false">
      </app-data-info-panel>

      <!-- Charts Container -->
      <div class="charts-container" *ngIf="hasData()">
        <div class="charts-grid">
          
          <!-- Monatsverlauf Chart -->
          <div class="flip-card" [class.flipped]="flippedCards()['monatsverlauf']" (click)="toggleFlip('monatsverlauf')">
            <div class="flip-card-inner">
              <div class="flip-card-front">
                <mat-card class="metric-card">
                  <mat-card-header class="metric-header monatsverlauf-header">
                    <mat-card-title>
                      <mat-icon>trending_up</mat-icon>
                      Monatsverlauf Mehrarbeitszeit
                      <span class="flip-hint-text">Klicken zum Umdrehen</span>
                      <mat-icon class="flip-icon">flip</mat-icon>
                    </mat-card-title>
                    <mat-card-subtitle>
                      {{ selectedKST() === 'all' ? 'Alle Kostenstellen' : selectedKSTName() }} - {{ selectedYear() }}
                    </mat-card-subtitle>
                  </mat-card-header>
                  <mat-card-content class="chart-content">
                    <canvas
                      baseChart
                      [data]="monatsverlaufChartData()"
                      [options]="lineChartOptions"
                      [type]="'line'">
                    </canvas>
                    <div class="chart-loading-overlay" *ngIf="chartLoading()">
                      <div class="loading-bar"></div>
                      <p>Daten werden geladen…</p>
                    </div>
                  </mat-card-content>
                </mat-card>
              </div>
              <div class="flip-card-back">
                <mat-card class="metric-card">
                  <mat-card-header>
                    <mat-card-title>
                      <mat-icon>info</mat-icon>
                      Informationen
                    </mat-card-title>
                  </mat-card-header>
                  <mat-card-content class="info-content">
                    <h4>Monatsverlauf</h4>
                    <p *ngIf="selectedKST() === 'all'">Zeigt die durchschnittliche Mehrarbeitszeit über alle Kostenstellen pro Monat des Jahres {{ selectedYear() }}.</p>
                    <p *ngIf="selectedKST() !== 'all'">Zeigt die Entwicklung der Mehrarbeitszeit für die ausgewählte Kostenstelle über die Monate des Jahres {{ selectedYear() }}.</p>
                    <ul>
                      <li><strong>Y-Achse:</strong> Mehrarbeitszeit in Stunden <span *ngIf="selectedKST() === 'all'">(Durchschnitt)</span></li>
                      <li><strong>X-Achse:</strong> Monate</li>
                      <li><strong>Datenquelle:</strong> Salden Zeitkonten {{ selectedBereich() }}</li>
                      <li *ngIf="selectedKST() === 'all'"><strong>Hinweis:</strong> Bei "Alle Kostenstellen" wird der Durchschnitt pro Monat angezeigt, da Salden keine kumulativen Werte sind.</li>
                    </ul>
                    <div class="stats">
                      <div class="stat-item">
                        <span class="stat-label">Durchschnitt:</span>
                        <span class="stat-value">{{ monatsverlaufStats().average.toFixed(2) }} Std</span>
                      </div>
                      <div class="stat-item">
                        <span class="stat-label">Maximum:</span>
                        <span class="stat-value">{{ monatsverlaufStats().max.toFixed(2) }} Std</span>
                      </div>
                      <div class="stat-item">
                        <span class="stat-label">Minimum:</span>
                        <span class="stat-value">{{ monatsverlaufStats().min.toFixed(2) }} Std</span>
                      </div>
                    </div>
                  </mat-card-content>
                </mat-card>
              </div>
            </div>
          </div>

          <!-- Kostenstellenvergleich Chart (nur wenn "Alle" ausgewählt) -->
          <div class="flip-card" 
               *ngIf="selectedKST() === 'all'" 
               [class.flipped]="flippedCards()['vergleich']" 
               (click)="toggleFlip('vergleich')">
            <div class="flip-card-inner">
              <div class="flip-card-front">
                <mat-card class="metric-card">
                  <mat-card-header class="metric-header vergleich-header">
                    <mat-card-title>
                      <mat-icon>compare_arrows</mat-icon>
                      Kostenstellenvergleich
                      <span class="flip-hint-text">Klicken zum Umdrehen</span>
                      <mat-icon class="flip-icon">flip</mat-icon>
                    </mat-card-title>
                    <mat-card-subtitle>
                      Top 10 Kostenstellen - Gesamt {{ selectedYear() }}
                    </mat-card-subtitle>
                  </mat-card-header>
                  <mat-card-content class="chart-content">
                    <canvas
                      baseChart
                      [data]="vergleichChartData()"
                      [options]="barChartOptions"
                      [type]="'bar'">
                    </canvas>
                    <div class="chart-loading-overlay" *ngIf="chartLoading()">
                      <div class="loading-bar"></div>
                      <p>Daten werden geladen…</p>
                    </div>
                  </mat-card-content>
                </mat-card>
              </div>
              <div class="flip-card-back">
                <mat-card class="metric-card">
                  <mat-card-header>
                    <mat-card-title>
                      <mat-icon>info</mat-icon>
                      Informationen
                    </mat-card-title>
                  </mat-card-header>
                  <mat-card-content class="info-content">
                    <h4>Kostenstellenvergleich</h4>
                    <p>Vergleicht die durchschnittliche Mehrarbeitszeit über alle Kostenstellen des Pflegedienstes.</p>
                    <ul>
                      <li><strong>Top 10:</strong> Kostenstellen mit höchster durchschnittlicher Mehrarbeitszeit</li>
                      <li><strong>Durchschnitt:</strong> Durchschnittlicher Saldo über alle verfügbaren Monate pro Kostenstelle</li>
                    </ul>
                    <div class="stats">
                      <div class="stat-item">
                        <span class="stat-label">Höchste KST:</span>
                        <span class="stat-value">{{ vergleichStats().maxKST }}</span>
                      </div>
                      <div class="stat-item">
                        <span class="stat-label">Höchster Durchschnitt:</span>
                        <span class="stat-value">{{ vergleichStats().maxValue.toFixed(2) }} Std</span>
                      </div>
                    </div>
                  </mat-card-content>
                </mat-card>
              </div>
            </div>
          </div>

        </div>
      </div>

      <!-- No Data Message -->
      <div class="no-data" *ngIf="!hasData()">
        <mat-icon>info</mat-icon>
        <p>Keine Daten für die ausgewählten Filter verfügbar.</p>
      </div>
    </div>
  `,
  styles: [`
    .salden-zeitkonten-charts {
      padding: 0;
    }

    .charts-header {
      margin-bottom: 24px;
    }

    .header-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
      flex-wrap: wrap;
      gap: 16px;
    }

    .header-top h3 {
      margin: 0;
      font-size: 24px;
      font-weight: 500;
      color: #1976d2;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .header-top h3 mat-icon {
      font-size: 28px;
      width: 28px;
      height: 28px;
    }

    .charts-header p {
      margin: 0;
      color: #666;
      font-size: 14px;
    }

    .selectors {
      display: flex;
    gap: 16px;
    flex-wrap: nowrap;

      .comparison-button {
        display: flex;
        align-items: center;
        gap: 8px;
        white-space: nowrap;
        position: relative;
        z-index: 0;
      flex: 0 0 auto;

        mat-icon {
          font-size: 18px;
          width: 18px;
          height: 18px;
        }
      }
    }

    .selector {
    min-width: 250px;
    flex: 0 0 250px;
    }

    .selector mat-label {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .charts-container {
      margin-top: 24px;
    }

    .charts-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(600px, 1fr));
      gap: 24px;
    }

    @media (max-width: 1400px) {
      .charts-grid {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 768px) {
      .selectors {
        flex-direction: column;
        align-items: stretch;

        .selector {
          width: 100%;
          flex: 1 1 auto;
        }

        .comparison-button {
          width: 100%;
          justify-content: center;
          flex: 0 0 auto;
        }
      }
    }

    .flip-card {
      perspective: 1000px;
      min-height: 450px;
      cursor: pointer;
    }

    .flip-card-inner {
      position: relative;
      width: 100%;
      height: 100%;
      min-height: 450px;
      transition: transform 0.6s;
      transform-style: preserve-3d;
    }

    .flip-card.flipped .flip-card-inner {
      transform: rotateY(180deg);
    }

    .flip-card-front,
    .flip-card-back {
      position: absolute;
      width: 100%;
      height: 100%;
      backface-visibility: hidden;
      -webkit-backface-visibility: hidden;
    }

    .flip-card-back {
      transform: rotateY(180deg);
    }

    .metric-card {
      height: 100%;
      display: flex;
      flex-direction: column;
    }

    .metric-header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 16px;
      border-radius: 4px 4px 0 0;
    }

    .monatsverlauf-header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    }

    .vergleich-header {
      background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
    }

    .metric-header mat-card-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 18px;
      margin: 0;
      color: white;
    }

    .metric-header mat-card-subtitle {
      color: rgba(255, 255, 255, 0.9);
      margin: 4px 0 0 0;
    }

    .flip-hint-text {
      margin-left: auto;
      font-size: 12px;
      opacity: 0.8;
    }

    .flip-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
    }

    .chart-content {
      flex: 1;
      padding: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;

      canvas {
        max-height: 350px;
      }

      .chart-loading-overlay {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 14px;
        background: rgba(255, 255, 255, 0.92);
        border-radius: 12px;
        z-index: 2;
        pointer-events: none;

        .loading-bar {
          width: min(260px, 70%);
          height: 5px;
          border-radius: 999px;
          background: linear-gradient(90deg, rgba(102,126,234,0.2) 0%, rgba(102,126,234,0.85) 50%, rgba(102,126,234,0.2) 100%);
          animation: salden-chart-loading 1.2s ease-in-out infinite;
        }

        p {
          margin: 0;
          color: #667eea;
          font-weight: 600;
        }
      }
    }

    @keyframes salden-chart-loading {
      0% { transform: translateX(-12%); opacity: 0.4; }
      50% { transform: translateX(0%); opacity: 1; }
      100% { transform: translateX(12%); opacity: 0.4; }
    }

    .info-content {
      padding: 24px;
    }

    .info-content h4 {
      margin: 0 0 12px 0;
      color: #1976d2;
    }

    .info-content p {
      margin: 0 0 16px 0;
      color: #666;
      line-height: 1.6;
    }

    .info-content ul {
      margin: 0 0 24px 0;
      padding-left: 20px;
      color: #666;
      line-height: 1.8;
    }

    .stats {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 16px;
      background: #f5f5f5;
      border-radius: 8px;
    }

    .stat-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .stat-label {
      font-weight: 500;
      color: #666;
    }

    .stat-value {
      font-size: 18px;
      font-weight: 600;
      color: #1976d2;
    }

    .no-data {
      text-align: center;
      padding: 48px 24px;
      color: #999;
    }

    .no-data mat-icon {
      font-size: 64px;
      width: 64px;
      height: 64px;
      color: #ddd;
      margin-bottom: 16px;
    }

    .no-data p {
      margin: 0;
      font-size: 16px;
    }
  `]
})
export class SaldenZeitkontenCharts implements OnInit, OnChanges {
  @Input() uploads: UploadRecord[] = [];
  private dialog = inject(MatDialog);
  private api = inject(Api);

  // Signals
  selectedKST = signal<string>('all');
  selectedYear = signal<number>(new Date().getFullYear());
  flippedCards = signal<Record<string, boolean>>({});
  kostenstellenMapping = signal<Record<string, KostenstellenMappingItem>>({});
  chartLoading = signal<boolean>(true);

  // Computed data
  saldenData = computed(() => {
    const saldenUploads = this.uploads.filter(u => u.schemaId === 'salden_zeitkonten');
    if (saldenUploads.length === 0) return [];
    
    const allData: SaldenZeitkontenData[] = [];
    saldenUploads.forEach(upload => {
      upload.files.forEach(file => {
        if (file.values && Array.isArray(file.values)) {
          allData.push(...file.values as unknown as SaldenZeitkontenData[]);
        }
      });
    });
    
    return allData;
  });

  selectedBereich = computed(() => {
    const data = this.saldenData();
    if (data.length === 0) return '';
    
    // Extract Bereich from first upload filename
    const saldenUploads = this.uploads.filter(u => u.schemaId === 'salden_zeitkonten');
    if (saldenUploads.length > 0 && saldenUploads[0].files.length > 0) {
      const filename = saldenUploads[0].files[0].originalName || '';
      const match = filename.match(/AIB-PD|PRI-PD|ROS-PD|WAS-PD/);
      return match ? match[0] : '';
    }
    
    return '';
  });

  availableKST = computed(() => {
    const data = this.saldenData();
    const kstMap = new Map<string, { KST: string; Beschreibung: string }>();
    
    data.forEach(row => {
      if (!kstMap.has(row.KST)) {
        kstMap.set(row.KST, {
          KST: row.KST,
          Beschreibung: row.Beschreibung
        });
      }
    });
    
    return Array.from(kstMap.values()).sort((a, b) => a.KST.localeCompare(b.KST));
  });

  availableKSTCodes = computed(() => this.availableKST().map(k => k.KST));
  readonly allKSTLabel = 'Alle Kostenstellen';
  readonly kstDisplayName = (value: string): string => {
    if (value === 'all') {
      return this.allKSTLabel;
    }
    const match = this.availableKST().find(k => k.KST === value);
    if (match) {
      return match.Beschreibung;
    }
    const mapping = this.kostenstellenMapping()[value];
    if (mapping) {
      const code = mapping.kostenstelle ?? value;
      const stations = Array.isArray(mapping.stations) ? (mapping.stations.filter(Boolean) as string[]) : [];
      const stationWithCode = stations.find((station: string) => station.includes(`${code}`));
      const primaryStation = stationWithCode ?? stations[0] ?? code;
      const standorte = Array.isArray(mapping.standorte) ? mapping.standorte.filter(Boolean) : [];
      const uniqueStandorte = Array.from(new Set(standorte));
      if (uniqueStandorte.length > 0) {
        return `${primaryStation} · ${uniqueStandorte.join(' / ')}`;
      }
      return `${primaryStation}`;
    }
    return value;
  };

  availableYears = computed(() => {
    const data = this.saldenData();
    const years = new Set(data.map(row => row.Jahr));
    return Array.from(years).sort((a, b) => b - a);
  });
  availableYearOptions = computed(() => this.availableYears().map(year => year.toString()));

  selectedKSTName = computed(() => {
    const kst = this.availableKST().find(k => k.KST === this.selectedKST());
    return kst ? kst.Beschreibung : '';
  });

  filteredData = computed(() => {
    const data = this.saldenData();
    const kst = this.selectedKST();
    const year = this.selectedYear();
    
    let filtered = data.filter(row => row.Jahr === year);
    
    if (kst !== 'all') {
      filtered = filtered.filter(row => row.KST === kst);
    }
    
    return filtered;
  });

  hasData = computed(() => this.filteredData().length > 0);

  comparisonSeries = computed<ComparisonSeries[]>(() => this.buildComparisonSeries());

  openComparisonDialog(event?: MouseEvent) {
    event?.stopPropagation();

    const series = this.comparisonSeries();
    if (series.length <= 1) {
      return;
    }

    const metrics: ComparisonMetricConfig[] = [
      {
        key: 'mehrarbeitszeit',
        label: 'Mehrarbeitszeit',
        unit: 'h',
        chartTitle: 'Mehrarbeitszeit (Stunden)',
        decimals: 2
      }
    ];

    this.dialog.open(ComparisonDialogComponent, {
      width: '1100px',
      maxWidth: '95vw',
      data: {
        title: `Salden Zeitkonten – Vergleich (${this.selectedYear()})`,
        subtitle: 'Mehrarbeitszeit je Kostenstelle',
        selectionLabel: 'Kostenstellen',
        metrics,
        series
      }
    });
  }

  private buildComparisonSeries(): ComparisonSeries[] {
    const data = this.saldenData();
    if (data.length === 0) {
      return [];
    }

    const targetYear = this.selectedYear();
    const months = Array.from({ length: 12 }, (_, index) => index + 1);

    // Für einzelne Kostenstellen: Wert pro Monat (sollte nur einen Wert pro Monat/KST geben)
    const kostentragerMap = new Map<string, Map<number, number>>();
    // Für "Alle Kostenstellen": Durchschnitt pro Monat (nicht Summe)
    const aggregatedMap = new Map<number, { sum: number; count: number }>();

    data.forEach(row => {
      if (!row || row.Jahr !== targetYear || !row.Monat) {
        return;
      }

      const month = Number(row.Monat);
      if (!month || month < 1 || month > 12) {
        return;
      }

      const key = row.KST;
      if (!key) {
        return;
      }

      // Für einzelne Kostenstelle: Wert direkt setzen (falls mehrere Einträge, nehmen wir den letzten)
      if (!kostentragerMap.has(key)) {
        kostentragerMap.set(key, new Map());
      }
      const monthMap = kostentragerMap.get(key)!;
      monthMap.set(month, row.Summe || 0);

      // Für "Alle Kostenstellen": Summe und Anzahl für Durchschnitt
      const currentAgg = aggregatedMap.get(month) || { sum: 0, count: 0 };
      currentAgg.sum += row.Summe || 0;
      currentAgg.count += 1;
      aggregatedMap.set(month, currentAgg);
    });

    if (kostentragerMap.size === 0) {
      return [];
    }

    const metadata = new Map<string, string>();
    this.availableKST().forEach(item => metadata.set(item.KST, item.Beschreibung));

    const buildSeries = (id: string, label: string, monthMap: Map<number, number>): ComparisonSeries => ({
      id,
      label,
      monthlyData: months.map(month => ({
        month,
        metrics: {
          mehrarbeitszeit: monthMap.get(month) ?? 0
        }
      }))
    });

    const series: ComparisonSeries[] = [];

    // Für "Alle Kostenstellen": Durchschnitt berechnen
    if (aggregatedMap.size > 0) {
      const averageMap = new Map<number, number>();
      aggregatedMap.forEach((data, month) => {
        averageMap.set(month, data.count > 0 ? data.sum / data.count : 0);
      });
      series.push(buildSeries('all', 'Alle Kostenstellen (Durchschnitt)', averageMap));
    }

    const sortedKeys = Array.from(kostentragerMap.keys()).sort((a, b) => {
      const labelA = metadata.get(a) ?? a;
      const labelB = metadata.get(b) ?? b;
      return labelA.localeCompare(labelB, 'de-DE');
    });

    sortedKeys.forEach(key => {
      const monthMap = kostentragerMap.get(key);
      if (!monthMap) {
        return;
      }
      const label = metadata.has(key) ? `${metadata.get(key)} (${key})` : key;
      series.push(buildSeries(key, label ?? key, monthMap));
    });

    return series;
  }

  // Data Info Items
  dataInfoItems = computed(() => {
    const saldenUploads = this.uploads.filter(u => u.schemaId === 'salden_zeitkonten');
    if (saldenUploads.length === 0) return [];

    const items: DataInfoItem[] = [];

    saldenUploads.forEach(upload => {
      upload.files.forEach(file => {
        const recordCount = Array.isArray(file.values) ? file.values.length : 0;
        
        // Extract month and year from filename or data
        let dataMonth: string | undefined;
        let dataYear: number | undefined;
        const filename = file.originalName || '';
        const monthMatch = filename.match(/(\d{2})-(\d{4})/);
        if (monthMatch) {
          dataMonth = monthMatch[1];
          dataYear = parseInt(monthMatch[2]);
        }

        // Build fileName with fallback
        const fileName = file.originalName || file.storedName || 'Unbekannte Datei';

        items.push({
          fileName: fileName,
          uploadDate: upload.createdAt,
          dataMonth,
          dataYear,
          recordCount,
          status: file.error ? 'error' : 'success',
          rawData: file.values as any[],
          schemaColumns: undefined
        });
      });
    });

    return items;
  });

  // Chart Options
  lineChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: {
        display: true,
        position: 'top'
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            return `${context.dataset.label}: ${(context.parsed.y ?? 0).toFixed(2)} Std`;
          }
        }
      }
    },
    scales: {
      x: {
        grid: {
          display: false
        }
      },
      y: {
        beginAtZero: true,
        ticks: {
          callback: (value) => `${value} Std`
        }
      }
    }
  };

  barChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: true,
    indexAxis: 'y',
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            return `${(context.parsed.x ?? 0).toFixed(2)} Std`;
          }
        }
      }
    },
    scales: {
      x: {
        beginAtZero: true,
        ticks: {
          callback: (value) => `${value} Std`
        }
      },
      y: {
        grid: {
          display: false
        }
      }
    }
  };

  // Monatsverlauf Chart Data
  monatsverlaufChartData = computed<ChartData<'line'>>(() => {
    const data = this.filteredData();
    const monthNames = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
    const kst = this.selectedKST();
    
    if (kst === 'all') {
      // Bei "Alle Kostenstellen": Durchschnitt pro Monat berechnen
      // (nicht Summe, da Salden keine kumulativen Werte sind)
      const monthlyData = new Map<number, { sum: number; count: number }>();
      
      data.forEach(row => {
        const month = row.Monat;
        const current = monthlyData.get(month) || { sum: 0, count: 0 };
        current.sum += row.Summe || 0;
        current.count += 1;
        monthlyData.set(month, current);
      });
      
      // Sort by month and calculate average
      const sortedMonths = Array.from(monthlyData.keys()).sort((a, b) => a - b);
      const labels = sortedMonths.map(m => monthNames[m - 1]);
      const values = sortedMonths.map(m => {
        const monthData = monthlyData.get(m)!;
        return monthData.count > 0 ? monthData.sum / monthData.count : 0;
      });
      
      return {
        labels,
        datasets: [{
          label: 'Durchschnitt Mehrarbeitszeit (Stunden)',
          data: values,
          borderColor: '#667eea',
          backgroundColor: 'rgba(102, 126, 234, 0.1)',
          borderWidth: 2,
          fill: true,
          tension: 0.4
        }]
      };
    } else {
      // Bei einzelner Kostenstelle: Summe aller Einträge pro Monat
      // (kann mehrere Einträge geben z.B. durch verschiedene Berufsgruppen/Funktionen)
      const monthlyData = new Map<number, number>();
      data.forEach(row => {
        const month = row.Monat;
        const current = monthlyData.get(month) || 0;
        monthlyData.set(month, current + (row.Summe || 0));
      });
      
      // Sort by month
      const sortedMonths = Array.from(monthlyData.keys()).sort((a, b) => a - b);
      const labels = sortedMonths.map(m => monthNames[m - 1]);
      const values = sortedMonths.map(m => monthlyData.get(m) || 0);
      
      return {
        labels,
        datasets: [{
          label: 'Mehrarbeitszeit (Stunden)',
          data: values,
          borderColor: '#667eea',
          backgroundColor: 'rgba(102, 126, 234, 0.1)',
          borderWidth: 2,
          fill: true,
          tension: 0.4
        }]
      };
    }
  });

  monatsverlaufStats = computed(() => {
    const data = this.monatsverlaufChartData();
    const values = data.datasets[0].data as number[];
    
    return {
      average: values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0,
      max: values.length > 0 ? Math.max(...values) : 0,
      min: values.length > 0 ? Math.min(...values) : 0
    };
  });

  // Vergleich Chart Data
  vergleichChartData = computed<ChartData<'bar'>>(() => {
    const data = this.filteredData();
    
    // Group by KST - berechne Durchschnitt pro Kostenstelle (nicht Summe über alle Monate)
    // da Salden den aktuellen Stand zeigen, nicht kumulative Werte
    const kstData = new Map<string, { beschreibung: string; summe: number; count: number }>();
    data.forEach(row => {
      const current = kstData.get(row.KST) || { beschreibung: row.Beschreibung, summe: 0, count: 0 };
      current.summe += row.Summe || 0;
      current.count += 1;
      kstData.set(row.KST, current);
    });
    
    // Berechne Durchschnitt pro KST
    const kstAverages = Array.from(kstData.entries()).map(([kst, data]) => ({
      kst,
      beschreibung: data.beschreibung,
      durchschnitt: data.count > 0 ? data.summe / data.count : 0
    }));
    
    // Sort by durchschnitt and take top 10
    const sorted = kstAverages
      .sort((a, b) => b.durchschnitt - a.durchschnitt)
      .slice(0, 10);
    
    const labels = sorted.map(item => item.beschreibung);
    const values = sorted.map(item => item.durchschnitt);
    
    return {
      labels,
      datasets: [{
        label: 'Durchschnitt Mehrarbeitszeit (Stunden)',
        data: values,
        backgroundColor: 'rgba(245, 87, 108, 0.6)',
        borderColor: '#f5576c',
        borderWidth: 1
      }]
    };
  });

  private readonly chartReadyEffect = effect(() => {
    this.monatsverlaufChartData();
    this.vergleichChartData();
    queueMicrotask(() => this.chartLoading.set(false));
  }, { allowSignalWrites: true });

  vergleichStats = computed(() => {
    const data = this.vergleichChartData();
    const values = data.datasets[0].data as number[];
    const labels = data.labels as string[];
    
    const maxIndex = values.length > 0 ? values.indexOf(Math.max(...values)) : -1;
    const maxValue = values.length > 0 ? Math.max(...values) : 0;
    
    return {
      maxKST: maxIndex >= 0 ? labels[maxIndex] : '-',
      maxValue
    };
  });

  ngOnInit() {
    // Set initial year if available
    const years = this.availableYears();
    if (years.length > 0) {
      this.selectedYear.set(years[0]);
    }
    void this.loadKostenstellenMapping();
  }

  ngOnChanges(changes: SimpleChanges) {
    // Reset selection if not available
    const years = this.availableYears();
    if (years.length > 0 && !years.includes(this.selectedYear())) {
      this.selectedYear.set(years[0]);
    }
  }

  onKSTChange(kst: string) {
    if (kst === this.selectedKST()) {
      return;
    }
    this.chartLoading.set(true);
    this.selectedKST.set(kst);
  }

  onYearChange(year: number) {
    if (year === this.selectedYear()) {
      return;
    }
    this.chartLoading.set(true);
    this.selectedYear.set(year);
  }

  onYearSelect(year: string) {
    const parsed = Number.parseInt(year, 10);
    if (!Number.isNaN(parsed)) {
      this.onYearChange(parsed);
    }
  }

  toggleFlip(cardName: string) {
    const current = this.flippedCards();
    this.flippedCards.set({
      ...current,
      [cardName]: !current[cardName]
    });
  }

  private async loadKostenstellenMapping() {
    try {
      const response = await firstValueFrom(this.api.getKostenstellenMapping());
      const map: Record<string, KostenstellenMappingItem> = {};
      const data = Array.isArray(response?.data) ? response.data : [];
      data.forEach((item: any) => {
        if (!item || !item.kostenstelle) {
          return;
        }
        map[item.kostenstelle] = {
          kostenstelle: item.kostenstelle,
          stations: Array.isArray(item.stations) ? item.stations : [],
          standorte: Array.isArray(item.standorte) ? item.standorte : [],
          standortnummer: item.standortnummer ?? null,
          ik: item.ik ?? null,
          paediatrie: item.paediatrie ?? null
        };
      });
      this.kostenstellenMapping.set(map);
    } catch (error) {
      console.error('Fehler beim Laden des Kostenstellen-Mappings', error);
      this.kostenstellenMapping.set({});
    }
  }
}

