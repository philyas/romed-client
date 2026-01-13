import { Injectable, inject, isDevMode } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface SchemaDef {
  id: string;
  name: string;
  description?: string;
  columns: string[];
}

export interface UploadFileResult {
  originalName: string;
  storedName?: string;
  size?: number;
  mimeType?: string;
  schemaId?: string;
  schemaName?: string;
  values?: Record<string, unknown>[];
  error?: string;
}

export interface UploadRecord {
  uploadId: string;
  schemaId: string;
  schemaName: string;
  createdAt: string;
  files: UploadFileResult[];
  month?: string;
  jahr?: number;
  locations?: string[];
  locationsData?: Record<string, UploadFileResult[]>;
}

export interface ResultsResponse {
  uploads: UploadRecord[];
}

export interface SchemaStatistics {
  schemaId: string;
  schemaName: string;
  description: string;
  columns: string[];
  uploadCount: number;
  totalFiles: number;
  totalRows: number;
  latestUpload: {
    uploadId: string;
    createdAt: string;
    fileCount: number;
  } | null;
}

export interface StatisticsResponse {
  statistics: SchemaStatistics[];
}

export interface MitternachtsstatistikResponse {
  uploads: UploadRecord[];
  availableMonths: string[];
  availableLocations: string[];
  totalStations: number;
  note?: string;
}

export interface GeleistetePhkStunden {
  durchschnitt: number;
  stunden: number;
  minuten: number;
  anzahlTageMitDaten: number;
}

export interface ManualEntryDataResponse {
  data: any[];
  geleistetePhkStunden?: GeleistetePhkStunden;
  phkTageswerte?: Array<{
    tag: number;
    stunden: number;
    minuten: number;
    gesamtDezimal: number;
  }>;
}

export type PfkSchicht = 'day' | 'night';
export type PfkAlertTrigger = 'lower' | 'upper';
export type PfkSeverity = 'info' | 'warning' | 'critical';

export interface PfkThresholdConfig {
  id: string;
  station: string;
  schicht: PfkSchicht;
  year: number | null;
  lowerLimit: number | null;
  upperLimit: number | null;
  recommendation: string | null;
  note: string | null;
  severity: PfkSeverity;
  months: number[];
  createdAt: string | null;
  updatedAt: string | null;
}

export interface CalculationConstant {
  id: number;
  key: string;
  name: string;
  description: string | null;
  value: number;
  unit: string | null;
  category: string;
  is_editable: boolean;
  created_at: string;
  updated_at: string;
}

export interface PfkAlert {
  id: string;
  thresholdId: string;
  station: string;
  year: number;
  month: number;
  schicht: PfkSchicht;
  trigger: PfkAlertTrigger;
  thresholdValue: number;
  actualValue: number;
  severity: PfkSeverity;
  recommendation: string | null;
  note: string | null;
  message: string;
}

export interface PatientenPflegekraftOverviewResponse {
  station: string;
  jahr: number;
  values: {
    day: number[];
    night: number[];
  };
  averages: {
    day: number;
    night: number;
  };
  metadata: {
    mitaDurchschnitt: number | null;
    minaDurchschnitt: number | null;
    monthsWithData: {
      day: number[];
      night: number[];
    };
    availableYears: number[];
    warnings: string[];
    thresholds?: PfkThresholdConfig[];
    alerts?: PfkAlert[];
  };
}

export interface ConfigSnapshot {
  station: string;
  jahr: number;
  monat: number;
  kategorie: string;
  schicht: 'tag' | 'nacht';
  schicht_stunden_used: number;
  phk_anteil_base_used: number | null;
  pp_ratio_base_used: number;
  erstellt_am: string | null;
  aktualisiert_am: string | null;
  isCurrentConfig?: boolean;
  message?: string;
}

@Injectable({
  providedIn: 'root'
})
export class Api {
  private http = inject(HttpClient);
  private readonly baseUrl = this.resolveBaseUrl();

  constructor() {
    const mode = isDevMode() ? 'DEVELOPMENT' : 'PRODUCTION';
    const isDockerNetwork = this.baseUrl === '' || this.baseUrl === window.location.origin;
    const connectionInfo = isDockerNetwork 
      ? `via nginx → backend:3000 (Docker Netzwerk)`
      : this.baseUrl;
    
    console.log(`🚀 API Service initialisiert`);
    console.log(`📍 Modus: ${mode}`);
    console.log(`🌐 Server: ${connectionInfo}`);
    if (isDockerNetwork) {
      console.log(`🔗 Browser → nginx (${window.location.origin}) → backend:3000 → db:5432`);
    }
  }

  getSchemas(): Observable<{ schemas: SchemaDef[] }> {
    return this.http.get<{ schemas: SchemaDef[] }>(`${this.baseUrl}/schemas`);
  }

  getData(): Observable<ResultsResponse> {
    return this.http.get<ResultsResponse>(`${this.baseUrl}/data`);
  }

  getStationsauslastung(): Observable<UploadRecord> {
    return this.http.get<UploadRecord>(`${this.baseUrl}/data/stationsauslastung`);
  }

  getVerweildauer(): Observable<UploadRecord> {
    return this.http.get<UploadRecord>(`${this.baseUrl}/data/verweildauer`);
  }

  getStatistics(): Observable<StatisticsResponse> {
    return this.http.get<StatisticsResponse>(`${this.baseUrl}/data/statistics`);
  }

  uploadFiles(schemaId: string, files: File[]): Observable<{ uploadId: string; files: UploadFileResult[] }> {
    const form = new FormData();
    for (const file of files) {
      form.append('files', file);
    }
    return this.http.post<{ uploadId: string; files: UploadFileResult[] }>(`${this.baseUrl}/upload/${schemaId}`, form);
  }

  getMitternachtsstatistik(month?: string, location?: string): Observable<MitternachtsstatistikResponse> {
    let params = new HttpParams();
    if (month) params = params.set('month', month);
    if (location) params = params.set('location', location);
    return this.http.get<MitternachtsstatistikResponse>(`${this.baseUrl}/data/mitternachtsstatistik`, { params });
  }

  getDataWithFilters(schemaId?: string, month?: string, location?: string, jahr?: number): Observable<ResultsResponse> {
    let params = new HttpParams();
    if (schemaId) params = params.set('schemaId', schemaId);
    if (month) params = params.set('month', month);
    if (location) params = params.set('location', location);
    if (typeof jahr === 'number' && !Number.isNaN(jahr)) params = params.set('jahr', jahr.toString());
    return this.http.get<ResultsResponse>(`${this.baseUrl}/data`, { params });
  }

  resetAllData(): Observable<{ success: boolean; message: string; timestamp: string }> {
    return this.http.delete<{ success: boolean; message: string; timestamp: string }>(`${this.baseUrl}/data/reset`);
  }

  deleteSchemaData(schemaId: string): Observable<{ success: boolean; message: string; schemaId: string; schemaName: string; timestamp: string }> {
    return this.http.delete<{ success: boolean; message: string; schemaId: string; schemaName: string; timestamp: string }>(`${this.baseUrl}/data/schema/${encodeURIComponent(schemaId)}`);
  }

  getAufgestellteBetten(): Observable<ResultsResponse> {
    return this.http.get<ResultsResponse>(`${this.baseUrl}/data?schemaId=mitteilungen_betten`);
  }

  // Manuelle Stundeneingabe API
  getManualEntryStations(): Observable<{ stations: string[] }> {
    return this.http.get<{ stations: string[] }>(`${this.baseUrl}/manual-entry/stations`);
  }


  getPatientenPflegekraftOverview(station: string, jahr?: number): Observable<PatientenPflegekraftOverviewResponse> {
    let params = new HttpParams().set('station', station);
    if (typeof jahr === 'number' && !Number.isNaN(jahr)) {
      params = params.set('jahr', jahr.toString());
    }
    return this.http.get<PatientenPflegekraftOverviewResponse>(`${this.baseUrl}/manual-entry/patienten-pflegekraft/overview`, { params });
  }

  getManualEntryData(station: string, jahr: number, monat: number, kategorie: string, schicht: 'tag' | 'nacht' = 'tag'): Observable<ManualEntryDataResponse> {
    const params = new HttpParams()
      .set('station', station)
      .set('jahr', jahr.toString())
      .set('monat', monat.toString())
      .set('kategorie', kategorie)
      .set('schicht', schicht);
    return this.http.get<ManualEntryDataResponse>(`${this.baseUrl}/manual-entry/data`, { params });
  }

  saveManualEntry(station: string, jahr: number, monat: number, kategorie: string, schicht: 'tag' | 'nacht', entries: any[]): Observable<{ success: boolean; uploadId: string; message: string }> {
    return this.http.post<{ success: boolean; uploadId: string; message: string }>(`${this.baseUrl}/manual-entry/save`, {
      station,
      jahr,
      monat,
      kategorie,
      schicht,
      entries
    });
  }

  deleteManualEntry(station: string, jahr: number, monat: number, kategorie: string): Observable<{ success: boolean; message: string }> {
    const params = new HttpParams()
      .set('station', station)
      .set('jahr', jahr.toString())
      .set('monat', monat.toString())
      .set('kategorie', kategorie);
    return this.http.delete<{ success: boolean; message: string }>(`${this.baseUrl}/manual-entry/data`, { params });
  }

  deleteAllManualEntry(station: string, jahr: number, monat: number): Observable<{ success: boolean; message: string; deletedCount: number }> {
    const params = new HttpParams()
      .set('station', station)
      .set('jahr', jahr.toString())
      .set('monat', monat.toString());
    return this.http.delete<{ success: boolean; message: string; deletedCount: number }>(`${this.baseUrl}/manual-entry/data/all`, { params });
  }

  deleteAllManualEntryForStation(station: string): Observable<{ success: boolean; message: string; deletedCount: number; station: string }> {
    const params = new HttpParams()
      .set('station', station);
    return this.http.delete<{ success: boolean; message: string; deletedCount: number; station: string }>(`${this.baseUrl}/manual-entry/data/station-all`, { params });
  }

  getStationMitaAverage(station: string): Observable<{ station: string; mitaDurchschnitt: number | null; message?: string }> {
    return this.http.get<{ station: string; mitaDurchschnitt: number | null; message?: string }>(`${this.baseUrl}/manual-entry/station-mita-average/${encodeURIComponent(station)}`);
  }

  getDailyMinaMita(station: string, jahr: number, monat: number): Observable<{ station: string; dailyValues: Array<{ tag: number; mina: number | null; mita: number | null }> }> {
    const params = new HttpParams()
      .set('station', station)
      .set('jahr', jahr.toString())
      .set('monat', monat.toString());
    return this.http.get<{ station: string; dailyValues: Array<{ tag: number; mina: number | null; mita: number | null }> }>(`${this.baseUrl}/manual-entry/daily-mina-mita`, { params });
  }

  getUploadConfig(station: string, kategorie: string, schicht: 'tag' | 'nacht' = 'tag'): Observable<{
    station: string;
    kategorie: string;
    schicht: string;
    schicht_stunden: number;
    phk_anteil_base: number | null;
    pp_ratio_base: number;
    fromSnapshot: boolean;
    snapshotMonth?: number;
    snapshotYear?: number;
    message?: string;
  }> {
    let params = new HttpParams()
      .set('station', station)
      .set('kategorie', kategorie)
      .set('schicht', schicht);
    return this.http.get<{
      station: string;
      kategorie: string;
      schicht: string;
      schicht_stunden: number;
      phk_anteil_base: number | null;
      pp_ratio_base: number;
      fromSnapshot: boolean;
      snapshotMonth?: number;
      snapshotYear?: number;
      message?: string;
    }>(`${this.baseUrl}/manual-entry/upload-config`, { params });
  }

  previewDienstplan(
    file: File,
    variant: '2026' | 'legacy' = 'legacy',
    schicht?: 'tag' | 'nacht'
  ): Observable<{
    success: boolean;
    preview: {
      fileName: string;
      variant: string;
      schichtFilter: string;
      totalEntries: number;
      stations: Array<{
        name: string;
        timeRange: { start: string; end: string } | null;
        categories: { tag: { PFK: number; PHK: number }; nacht: { PFK: number; PHK: number } };
        config: {
          tag: { PFK: any; PHK: any };
          nacht: { PFK: any; PHK: any };
        } | null;
      }>;
      summary: { tag: { PFK: number; PHK: number }; nacht: { PFK: number; PHK: number } };
    };
  }> {
    const form = new FormData();
    form.append('file', file);
    form.append('variant', variant);
    if (schicht) {
      form.append('schicht', schicht);
    }
    
    return this.http.post<{
      success: boolean;
      preview: {
        fileName: string;
        variant: string;
        schichtFilter: string;
        totalEntries: number;
        stations: Array<{
          name: string;
          timeRange: { start: string; end: string } | null;
          categories: { tag: { PFK: number; PHK: number }; nacht: { PFK: number; PHK: number } };
          config: {
            tag: { PFK: any; PHK: any };
            nacht: { PFK: any; PHK: any };
          } | null;
        }>;
        summary: { tag: { PFK: number; PHK: number }; nacht: { PFK: number; PHK: number } };
      };
    }>(`${this.baseUrl}/manual-entry/preview-dienstplan`, form);
  }

  uploadDienstplan(
    file: File, 
    variant: '2026' | 'legacy' = 'legacy',
    configOverrides?: { schicht_stunden?: number; phk_anteil_base?: number | null; pp_ratio_base?: number }
  ): Observable<{ success: boolean; message: string; uploaded: any[]; totalEntries: number }> {
    const form = new FormData();
    form.append('file', file);
    // Kein schicht-Parameter: Beide Schichten (Tag und Nacht) werden verarbeitet
    form.append('variant', variant);
    
    // Add config overrides if provided
    if (configOverrides) {
      if (configOverrides.schicht_stunden !== undefined && configOverrides.schicht_stunden !== null) {
        form.append('schicht_stunden', configOverrides.schicht_stunden.toString());
      }
      if (configOverrides.phk_anteil_base !== undefined && configOverrides.phk_anteil_base !== null) {
        form.append('phk_anteil_base', configOverrides.phk_anteil_base.toString());
      }
      if (configOverrides.pp_ratio_base !== undefined && configOverrides.pp_ratio_base !== null) {
        form.append('pp_ratio_base', configOverrides.pp_ratio_base.toString());
      }
    }
    
    return this.http.post<{ success: boolean; message: string; uploaded: any[]; totalEntries: number }>(`${this.baseUrl}/manual-entry/upload-dienstplan`, form);
  }

  exportPpugMeldung(station: string, jahr?: number): Observable<{ blob: Blob; filename: string }> {
    let params = new HttpParams().set('station', station);
    if (typeof jahr === 'number' && !Number.isNaN(jahr)) {
      params = params.set('jahr', jahr.toString());
    }
    return this.http.get(`${this.baseUrl}/manual-entry/export-ppug-meldung`, {
      params,
      responseType: 'blob',
      observe: 'response'
    }).pipe(
      map(response => {
        const contentDisposition = response.headers.get('Content-Disposition');
        let filename = `PPUG_Meldung_${station}_${jahr || new Date().getFullYear()}.xlsx`;
        
        if (contentDisposition) {
          // Try to extract filename from Content-Disposition header
          // First try filename* (RFC 5987)
          const filenameStarMatch = contentDisposition.match(/filename\*=UTF-8''([^;]+)/);
          if (filenameStarMatch && filenameStarMatch[1]) {
            filename = decodeURIComponent(filenameStarMatch[1]);
          } else {
            // Fallback to regular filename
            const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
            if (filenameMatch && filenameMatch[1]) {
              filename = filenameMatch[1].replace(/['"]/g, '').trim();
            }
          }
        }
        
        // Fallback: if filename doesn't contain timestamp, add it
        // Format: YYYY-MM-DD_HH-MM-SS (Datum mit Bindestrichen, Uhrzeit mit Bindestrichen, getrennt durch Unterstrich)
        if (!filename.match(/\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}/)) {
          const now = new Date();
          const datePart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
          const timePart = `${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}-${String(now.getSeconds()).padStart(2, '0')}`;
          const timestamp = `${datePart}_${timePart}`;
          const baseFilename = filename.replace('.xlsx', '');
          filename = `${baseFilename}_${timestamp}.xlsx`;
        }
        
        return {
          blob: response.body!,
          filename: filename
        };
      })
    );
  }

  // Manuelle Stundeneingabe NACHT API
  getManualEntryNachtStations(): Observable<{ stations: string[] }> {
    return this.http.get<{ stations: string[] }>(`${this.baseUrl}/manual-entry-nacht/stations`);
  }

  getManualEntryNachtData(station: string, jahr: number, monat: number, kategorie: string): Observable<ManualEntryDataResponse> {
    const params = new HttpParams()
      .set('station', station)
      .set('jahr', jahr.toString())
      .set('monat', monat.toString())
      .set('kategorie', kategorie);
    return this.http.get<ManualEntryDataResponse>(`${this.baseUrl}/manual-entry-nacht/data`, { params });
  }

  saveManualEntryNacht(station: string, jahr: number, monat: number, kategorie: string, entries: any[]): Observable<{ success: boolean; uploadId: string; message: string }> {
    return this.http.post<{ success: boolean; uploadId: string; message: string }>(`${this.baseUrl}/manual-entry-nacht/save`, {
      station,
      jahr,
      monat,
      kategorie,
      entries
    });
  }

  deleteManualEntryNacht(station: string, jahr: number, monat: number, kategorie: string): Observable<{ success: boolean; message: string }> {
    const params = new HttpParams()
      .set('station', station)
      .set('jahr', jahr.toString())
      .set('monat', monat.toString())
      .set('kategorie', kategorie);
    return this.http.delete<{ success: boolean; message: string }>(`${this.baseUrl}/manual-entry-nacht/data`, { params });
  }

  getStationMinaAverage(station: string): Observable<{ station: string; minaDurchschnitt: number | null; message?: string }> {
    return this.http.get<{ station: string; minaDurchschnitt: number | null; message?: string }>(`${this.baseUrl}/manual-entry-nacht/station-mina-average/${encodeURIComponent(station)}`);
  }

  // Kostenstellen Mapping
  getKostenstellenMapping(): Observable<{ success: boolean; data: any[]; count: number }> {
    return this.http.get<{ success: boolean; data: any[]; count: number }>(`${this.baseUrl}/kostenstellen`);
  }

  getKostenstelle(kostenstelle: string): Observable<{ success: boolean; data: any }> {
    return this.http.get<{ success: boolean; data: any }>(`${this.baseUrl}/kostenstellen/${encodeURIComponent(kostenstelle)}`);
  }

  saveKostenstelle(data: { kostenstelle: string; stations: string[]; standorte: string[]; standortnummer?: string | number | null; ik?: string | number | null; paediatrie?: string | null; include_in_statistics?: boolean }): Observable<{ success: boolean; message: string; data: any }> {
    return this.http.post<{ success: boolean; message: string; data: any }>(`${this.baseUrl}/kostenstellen`, data);
  }

  deleteKostenstelle(kostenstelle: string): Observable<{ success: boolean; message: string; deleted: string }> {
    return this.http.delete<{ success: boolean; message: string; deleted: string }>(`${this.baseUrl}/kostenstellen/${encodeURIComponent(kostenstelle)}`);
  }

  importKostenstellenFromFile(file: File): Observable<{ success: boolean; message: string; imported: number; total: number }> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<{ success: boolean; message: string; imported: number; total: number }>(`${this.baseUrl}/kostenstellen/import`, formData);
  }

  importKostenstellenFromSample(): Observable<{ success: boolean; message: string; imported: number }> {
    return this.http.post<{ success: boolean; message: string; imported: number }>(`${this.baseUrl}/kostenstellen/import-sample`, {});
  }

  // Backup
  createSqlBackup(): Observable<{ success: boolean; message: string; backup: { name: string; path: string; timestamp: string; size: number; sizeFormatted: string } }> {
    return this.http.post<{ success: boolean; message: string; backup: { name: string; path: string; timestamp: string; size: number; sizeFormatted: string } }>(`${this.baseUrl}/backup/create`, {});
  }

  listSqlBackups(): Observable<{ success: boolean; backups: Array<{ name: string; timestamp: string; size: number; sizeFormatted: string }>; count: number; storageDir: string }> {
    return this.http.get<{ success: boolean; backups: Array<{ name: string; timestamp: string; size: number; sizeFormatted: string }>; count: number; storageDir: string }>(`${this.baseUrl}/backup/list`);
  }

  downloadSqlBackup(filename: string): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/backup/download/${encodeURIComponent(filename)}`, {
      responseType: 'blob'
    });
  }

  // Archive - Uploaded files
  getArchive(): Observable<{
    storageConfig: {
      uploadsDir: string;
      storageDir: string;
      storageDirEnv: string;
    };
    totalFiles: number;
    totalSize: number;
    files: Array<{
      storedName: string;
      originalName: string;
      size: number;
      mimeType: string;
      uploadedAt: string | null;
      modifiedAt: string | null;
      exists: boolean;
      downloadUrl: string;
      uploadId?: string;
      schemaId?: string;
      schemaName?: string;
      month?: number | string;
      year?: number;
      jahr?: number;
      locations?: string[];
      rowCount?: number;
    }>;
    bySchema: Array<{
      schemaId: string;
      schemaName: string;
      fileCount: number;
      totalSize: number;
      files: any[];
    }>;
  }> {
    return this.http.get<{
      storageConfig: {
        uploadsDir: string;
        storageDir: string;
        storageDirEnv: string;
      };
      totalFiles: number;
      totalSize: number;
      files: Array<any>;
      bySchema: Array<any>;
    }>(`${this.baseUrl}/upload/archive`);
  }

  downloadUploadedFile(storedName: string): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/upload/file/${encodeURIComponent(storedName)}`, {
      responseType: 'blob'
    });
  }

  // Calculation Constants API
  getCalculationConstants(): Observable<{ success: boolean; data: CalculationConstant[] }> {
    return this.http.get<{ success: boolean; data: CalculationConstant[] }>(
      `${this.baseUrl}/api/calculation-constants`
    );
  }

  getCalculationConstant(key: string): Observable<{ success: boolean; data: CalculationConstant }> {
    return this.http.get<{ success: boolean; data: CalculationConstant }>(
      `${this.baseUrl}/api/calculation-constants/${key}`
    );
  }

  updateCalculationConstant(key: string, value: number, name?: string, description?: string): Observable<{ success: boolean; data: CalculationConstant; message: string }> {
    return this.http.put<{ success: boolean; data: CalculationConstant; message: string }>(
      `${this.baseUrl}/api/calculation-constants/${key}`,
      { value, name, description }
    );
  }

  getCalculationConstantsByCategory(category: string): Observable<{ success: boolean; data: CalculationConstant[] }> {
    return this.http.get<{ success: boolean; data: CalculationConstant[] }>(
      `${this.baseUrl}/api/calculation-constants/category/${category}`
    );
  }

  // Config Snapshot API
  getConfigSnapshot(station: string, jahr: number, monat: number, kategorie: string, schicht: 'tag' | 'nacht' = 'tag'): Observable<ConfigSnapshot> {
    const params = new HttpParams()
      .set('station', station)
      .set('jahr', jahr.toString())
      .set('monat', monat.toString())
      .set('kategorie', kategorie)
      .set('schicht', schicht);
    return this.http.get<ConfigSnapshot>(`${this.baseUrl}/manual-entry/config-snapshot`, { params });
  }

  getConfigSnapshotNacht(station: string, jahr: number, monat: number, kategorie: string): Observable<ConfigSnapshot> {
    const params = new HttpParams()
      .set('station', station)
      .set('jahr', jahr.toString())
      .set('monat', monat.toString())
      .set('kategorie', kategorie);
    return this.http.get<ConfigSnapshot>(`${this.baseUrl}/manual-entry-nacht/config-snapshot`, { params });
  }

  // Station Config API (persistent configuration)
  getStationConfig(station: string, kategorie: string, schicht: 'tag' | 'nacht' = 'tag'): Observable<{
    station: string;
    kategorie: string;
    schicht: string;
    schicht_stunden: number;
    phk_anteil_base: number | null;
    pp_ratio_base: number;
    pausen_aktiviert?: boolean;
    pausen_start?: string;
    pausen_ende?: string;
    pausen_modus?: 'addieren' | 'abziehen';
    pausen_dauer_minuten?: number;
    fromSnapshot: boolean;
    snapshotMonth?: number;
    snapshotYear?: number;
    message?: string;
  }> {
    const params = new HttpParams()
      .set('station', station)
      .set('kategorie', kategorie)
      .set('schicht', schicht);
    return this.http.get<{
      station: string;
      kategorie: string;
      schicht: string;
      schicht_stunden: number;
      phk_anteil_base: number | null;
      pp_ratio_base: number;
      pausen_aktiviert?: boolean;
      pausen_start?: string;
      pausen_ende?: string;
      pausen_modus?: 'addieren' | 'abziehen';
      pausen_dauer_minuten?: number;
      pausen_von_datum?: string | null;
      pausen_bis_datum?: string | null;
      fromSnapshot: boolean;
      snapshotMonth?: number;
      snapshotYear?: number;
      message?: string;
    }>(`${this.baseUrl}/manual-entry/station-config`, { params });
  }

  updateStationConfig(
    station: string,
    kategorie: string,
    schicht: 'tag' | 'nacht',
    config: { 
      schicht_stunden: number; 
      phk_anteil_base: number | null; 
      pp_ratio_base: number;
      pausen_aktiviert?: boolean;
      pausen_start?: string;
      pausen_ende?: string;
      pausen_modus?: 'addieren' | 'abziehen';
      pausen_von_datum?: string | null;
      pausen_bis_datum?: string | null;
    }
  ): Observable<{ success: boolean; message: string }> {
    return this.http.put<{ success: boolean; message: string }>(
      `${this.baseUrl}/manual-entry/station-config`,
      {
        station,
        kategorie,
        schicht,
        ...config
      }
    );
  }

  getStationConfigNacht(station: string, kategorie: string): Observable<{
    station: string;
    kategorie: string;
    schicht: string;
    schicht_stunden: number;
    phk_anteil_base: number | null;
    pp_ratio_base: number;
    pausen_aktiviert?: boolean;
    pausen_start?: string;
    pausen_ende?: string;
    pausen_modus?: 'addieren' | 'abziehen';
    pausen_dauer_minuten?: number;
    fromSnapshot: boolean;
    snapshotMonth?: number;
    snapshotYear?: number;
    message?: string;
  }> {
    const params = new HttpParams()
      .set('station', station)
      .set('kategorie', kategorie)
      .set('schicht', 'nacht');
    return this.http.get<{
      station: string;
      kategorie: string;
      schicht: string;
      schicht_stunden: number;
      phk_anteil_base: number | null;
      pp_ratio_base: number;
      pausen_aktiviert?: boolean;
      pausen_start?: string;
      pausen_ende?: string;
      pausen_modus?: 'addieren' | 'abziehen';
      pausen_dauer_minuten?: number;
      pausen_von_datum?: string | null;
      pausen_bis_datum?: string | null;
      fromSnapshot: boolean;
      snapshotMonth?: number;
      snapshotYear?: number;
      message?: string;
    }>(`${this.baseUrl}/manual-entry-nacht/station-config`, { params });
  }

  updateStationConfigNacht(
    station: string,
    kategorie: string,
    config: { 
      schicht_stunden: number; 
      phk_anteil_base: number | null; 
      pp_ratio_base: number;
      pausen_aktiviert?: boolean;
      pausen_start?: string;
      pausen_ende?: string;
      pausen_modus?: 'addieren' | 'abziehen';
      pausen_von_datum?: string | null;
      pausen_bis_datum?: string | null;
    }
  ): Observable<{ success: boolean; message: string }> {
    return this.http.put<{ success: boolean; message: string }>(
      `${this.baseUrl}/manual-entry-nacht/station-config`,
      {
        station,
        kategorie,
        schicht: 'nacht',
        ...config
      }
    );
  }

  // OPTIMIERT: Bulk-Endpoint für Stationskonfigurationen
  getStationConfigsBulk(): Observable<{
    success: boolean;
    configs: {
      [station: string]: {
        [key: string]: {
          station: string;
          kategorie: string;
          schicht: string;
          schicht_stunden: number;
          phk_anteil_base: number | null;
          pp_ratio_base: number;
          pausen_aktiviert: boolean;
          pausen_start: string;
          pausen_ende: string;
          pausen_modus: 'addieren' | 'abziehen';
          pausen_dauer_minuten: number;
          fromSnapshot: boolean;
        };
      };
    };
    globalConfig: {
      tag: { schicht_stunden: number; phk_anteil_base: number | null; pp_ratio_base: number };
      nacht: { schicht_stunden: number; phk_anteil_base: number | null; pp_ratio_base: number };
    };
  }> {
    return this.http.get<{
      success: boolean;
      configs: {
        [station: string]: {
          [key: string]: {
            station: string;
            kategorie: string;
            schicht: string;
            schicht_stunden: number;
            phk_anteil_base: number | null;
            pp_ratio_base: number;
            pausen_aktiviert: boolean;
            pausen_start: string;
            pausen_ende: string;
            pausen_modus: 'addieren' | 'abziehen';
            pausen_dauer_minuten: number;
            fromSnapshot: boolean;
          };
        };
      };
      globalConfig: {
        tag: { schicht_stunden: number; phk_anteil_base: number | null; pp_ratio_base: number };
        nacht: { schicht_stunden: number; phk_anteil_base: number | null; pp_ratio_base: number };
      };
    }>(`${this.baseUrl}/manual-entry/station-configs/bulk`);
  }

  // Recompute API
  recomputeManualEntry(
    station: string, 
    jahr: number, 
    monat: number, 
    kategorie: string, 
    schicht: 'tag' | 'nacht' = 'tag',
    configOverrides?: { schicht_stunden?: number; phk_anteil_base?: number | null; pp_ratio_base?: number }
  ): Observable<{ success: boolean; message: string; updatedEntries: number; daysWithData?: number }> {
    const body: any = { station, jahr, monat, kategorie, schicht };
    if (configOverrides) {
      if (configOverrides.schicht_stunden !== undefined) {
        body.schicht_stunden = configOverrides.schicht_stunden;
      }
      if (configOverrides.phk_anteil_base !== undefined && configOverrides.phk_anteil_base !== null) {
        body.phk_anteil_base = configOverrides.phk_anteil_base;
      }
      if (configOverrides.pp_ratio_base !== undefined) {
        body.pp_ratio_base = configOverrides.pp_ratio_base;
      }
    }
    return this.http.post<{ success: boolean; message: string; updatedEntries: number; daysWithData?: number }>(
      `${this.baseUrl}/manual-entry/recompute`,
      body
    );
  }

  recomputeManualEntryNacht(
    station: string, 
    jahr: number, 
    monat: number, 
    kategorie: string,
    configOverrides?: { schicht_stunden?: number; phk_anteil_base?: number | null; pp_ratio_base?: number }
  ): Observable<{ success: boolean; message: string; updatedEntries: number; daysWithData?: number }> {
    const body: any = { station, jahr, monat, kategorie };
    if (configOverrides) {
      if (configOverrides.schicht_stunden !== undefined) {
        body.schicht_stunden = configOverrides.schicht_stunden;
      }
      if (configOverrides.phk_anteil_base !== undefined && configOverrides.phk_anteil_base !== null) {
        body.phk_anteil_base = configOverrides.phk_anteil_base;
      }
      if (configOverrides.pp_ratio_base !== undefined) {
        body.pp_ratio_base = configOverrides.pp_ratio_base;
      }
    }
    return this.http.post<{ success: boolean; message: string; updatedEntries: number; daysWithData?: number }>(
      `${this.baseUrl}/manual-entry-nacht/recompute`,
      body
    );
  }

  private resolveBaseUrl(): string {
    if (isDevMode()) {
      return 'http://localhost:3000';
    }

    // Im Docker-Netzwerk: Verwende relative URLs, die über nginx Proxy gehen
    // nginx leitet diese an backend:3000 weiter
    if (typeof window !== 'undefined') {
      // Wenn wir im Docker-Container laufen (oder auf localhost mit Docker)
      // verwende relative URLs für Docker-Netzwerk-Kommunikation
      if (window.location.hostname === 'localhost' || 
          window.location.hostname === '127.0.0.1' ||
          window.location.port === '4200') {
        // Relative URL - wird von nginx an backend:3000 weitergeleitet
        return '';
      }
    }

    // Sonst: Cloud-Backend
    return 'https://romed-server.onrender.com';
  }
}
