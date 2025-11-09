import { Component, inject, signal, Inject, computed, AfterViewInit } from '@angular/core';
import { CommonModule, NgIf } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatTabsModule } from '@angular/material/tabs';
import { MatDialogModule, MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { Api, ResultsResponse, UploadRecord, MitternachtsstatistikResponse, SchemaStatistics } from '../../core/api';
import { MitternachtsstatistikCharts } from '../mitternachtsstatistik-charts/mitternachtsstatistik-charts';
import { COCharts } from '../co-charts/co-charts';
import { MinaMitaCharts } from '../mina-mita-charts/mina-mita-charts';
import { PflegestufenstatistikCharts } from '../pflegestufenstatistik-charts/pflegestufenstatistik-charts';
import { SaldenZeitkontenCharts } from '../salden-zeitkonten-charts/salden-zeitkonten-charts';
import { MitteilungenBettenCharts } from '../mitteilungen-betten-charts/mitteilungen-betten-charts';
import { PatientenPflegekraftCharts } from '../patienten-pflegekraft-charts/patienten-pflegekraft-charts';
import { AusfallstatistikCharts } from '../ausfallstatistik-charts/ausfallstatistik-charts';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule, NgIf, MatCardModule, MatChipsModule, MatIconModule, MatButtonModule, MatExpansionModule, MatDialogModule, MatProgressSpinnerModule, MatProgressBarModule, RouterModule, MitternachtsstatistikCharts, COCharts, MinaMitaCharts, PflegestufenstatistikCharts, SaldenZeitkontenCharts, MitteilungenBettenCharts, PatientenPflegekraftCharts, AusfallstatistikCharts],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss'
})

export class Dashboard implements AfterViewInit {
  private api = inject(Api);
  private dialog = inject(MatDialog);
  private route = inject(ActivatedRoute);
  private pendingScrollSchemaId: string | null = null;
  data = signal<ResultsResponse | null>(null);
  statistics = signal<SchemaStatistics[]>([]);
  globalSelectedYear = signal<number>(new Date().getFullYear());
  globalSelectedStation = signal<string>('all');
  mitternachtsstatistikData = signal<MitternachtsstatistikResponse | null>(null);
  highlightedSchemaId = signal<string | null>(null);
  isLoading = signal<boolean>(true);
  // Show PPK charts only when manual-entry data exists (day or night)
  hasPatientenPflegekraftData = signal<boolean>(false);

  // Computed signals for schema-specific data
  hasCOData = computed(() => {
    const uploads = this.data()?.uploads || [];
    return uploads.some(u => u.schemaId === 'co_entlass_aufnahmezeiten');
  });

  hasMinaMitaData = computed(() => {
    const uploads = this.data()?.uploads || [];
    return uploads.some(u => u.schemaId === 'ppugv_bestaende');
  });

  hasPflegestufenData = computed(() => {
    const uploads = this.data()?.uploads || [];
    return uploads.some(u => u.schemaId === 'pflegestufenstatistik');
  });

  hasSaldenData = computed(() => {
    const uploads = this.data()?.uploads || [];
    return uploads.some(u => u.schemaId === 'salden_zeitkonten');
  });

  hasMitteilungenBettenData = computed(() => {
    const uploads = this.data()?.uploads || [];
    return uploads.some(u => u.schemaId === 'mitteilungen_betten');
  });

  hasAusfallstatistikData = computed(() => {
    const uploads = this.data()?.uploads || [];
    return uploads.some(u => u.schemaId === 'ausfallstatistik');
  });

  constructor() {
    this.refresh();
  }

  ngAfterViewInit() {
    // Listen to route changes and scroll to schema
    this.route.fragment.subscribe(fragment => {
      if (fragment) {
        this.pendingScrollSchemaId = fragment;
        this.tryScrollToSchema();
      }
    });

    // Check for highlight query param
    this.route.queryParams.subscribe(params => {
      if (params['highlight']) {
        this.highlightedSchemaId.set(params['highlight']);
        // Remove highlight after 3 seconds
        setTimeout(() => this.highlightedSchemaId.set(null), 3000);
      }
    });
  }

  refresh() {
    this.isLoading.set(true);

    forkJoin({
      data: this.api.getData(),
      statistics: this.api.getStatistics(),
      mitternachtsstatistik: this.api.getMitternachtsstatistik(),
      manualEntryDay: this.api.getManualEntryStations().pipe(
        catchError(() => of({ stations: [] }))
      ),
      manualEntryNight: this.api.getManualEntryNachtStations().pipe(
        catchError(() => of({ stations: [] }))
      )
    }).subscribe({
      next: ({ data, statistics, mitternachtsstatistik, manualEntryDay, manualEntryNight }) => {
        this.data.set(data);
        this.statistics.set(statistics.statistics);
        this.mitternachtsstatistikData.set(mitternachtsstatistik);

        const dayStations = manualEntryDay?.stations ?? [];
        const nightStations = manualEntryNight?.stations ?? [];
        const hasAny = (dayStations.length > 0) || (nightStations.length > 0);
        this.hasPatientenPflegekraftData.set(hasAny);

        this.isLoading.set(false);
        this.tryScrollToSchema();
      },
      error: (error) => {
        console.error('Fehler beim Laden der Dashboard-Daten:', error);
        this.isLoading.set(false);
        this.tryScrollToSchema();
      }
    });
  }

  onGlobalYearChange(year: number) {
    this.globalSelectedYear.set(year);
  }

  onGlobalStationChange(station: string) {
    this.globalSelectedStation.set(station);
  }

  private tryScrollToSchema(attempt = 0) {
    if (!this.pendingScrollSchemaId) {
      return;
    }

    if (this.isLoading()) {
      return;
    }

    const element = document.getElementById(this.pendingScrollSchemaId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      this.pendingScrollSchemaId = null;
    } else if (attempt < 10) {
      setTimeout(() => this.tryScrollToSchema(attempt + 1), 200);
    }
  }

  openResetDialog() {
    const dialogRef = this.dialog.open(ResetConfirmDialog, {
      width: '400px',
      disableClose: true
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result === 'confirm') {
        this.resetAllData();
      }
    });
  }

  private resetAllData() {
    this.api.resetAllData().subscribe({
      next: (response) => {
        console.log('Reset successful:', response.message);
        // Refresh all data after successful reset
        this.refresh();
        // Show success message (you could add a snackbar here)
        alert('Alle Daten wurden erfolgreich zurückgesetzt!');
      },
      error: (error) => {
        console.error('Reset failed:', error);
        alert('Fehler beim Zurücksetzen der Daten: ' + error.message);
      }
    });
  }
}

// Dialog Component for Reset Confirmation

@Component({
  selector: 'reset-confirm-dialog',
  template: `
    <h2 mat-dialog-title>Daten zurücksetzen</h2>
    <mat-dialog-content>
      <p>Sind Sie sicher, dass Sie alle hochgeladenen Daten zurücksetzen möchten?</p>
      <p><strong>Diese Aktion kann nicht rückgängig gemacht werden!</strong></p>
      <ul>
        <li>Alle hochgeladenen Excel-Dateien werden gelöscht</li>
        <li>Alle verarbeiteten Daten werden entfernt</li>
        <li>Das System kehrt zum ursprünglichen Zustand zurück</li>
      </ul>
    </mat-dialog-content>
    <mat-dialog-actions align="end" class="dialog-actions">
      <button mat-button (click)="onCancel()" class="cancel-button">Abbrechen</button>
      <button mat-raised-button color="warn" (click)="onConfirm()" class="delete-button">
        <mat-icon>delete_forever</mat-icon>
        Zurücksetzen
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .dialog-actions {
      display: flex !important;
      justify-content: flex-end !important;
      gap: 12px !important;
      padding: 16px 24px !important;
      margin: 0 !important;
    }
    
    .cancel-button {
      background-color: #f5f5f5 !important;
      color: #666 !important;
      border: 1px solid #ddd !important;
      font-weight: 500 !important;
      padding: 8px 16px !important;
      border-radius: 4px !important;
      transition: all 0.3s ease !important;
    }
    
    .cancel-button:hover {
      background-color: #e0e0e0 !important;
      border-color: #bbb !important;
    }
    
    .delete-button {
      background-color: #f44336 !important;
      color: white !important;
      border: none !important;
      font-weight: 600 !important;
      text-transform: uppercase !important;
      letter-spacing: 0.5px !important;
      padding: 8px 16px !important;
      border-radius: 4px !important;
      box-shadow: 0 2px 8px rgba(244, 67, 54, 0.3) !important;
      transition: all 0.3s ease !important;
    }
    
    .delete-button:hover {
      background-color: #d32f2f !important;
      transform: translateY(-1px) !important;
      box-shadow: 0 4px 12px rgba(244, 67, 54, 0.4) !important;
    }
    
    .delete-button mat-icon {
      margin-right: 8px !important;
      font-size: 18px !important;
      color: white !important;
    }
  `],
  imports: [MatDialogModule, MatButtonModule, MatIconModule],
  standalone: true
})
export class ResetConfirmDialog {
  constructor(
    public dialogRef: MatDialogRef<ResetConfirmDialog>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {}

  onCancel(): void {
    this.dialogRef.close('cancel');
  }

  onConfirm(): void {
    this.dialogRef.close('confirm');
  }
}
