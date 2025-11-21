import { Injectable, inject, isDevMode } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

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

@Injectable({
  providedIn: 'root'
})
export class Api {
  private http = inject(HttpClient);
  private readonly baseUrl = this.resolveBaseUrl();

  constructor() {
    const mode = isDevMode() ? 'DEVELOPMENT' : 'PRODUCTION';
    console.log(`🚀 API Service initialisiert`);
    console.log(`📍 Modus: ${mode}`);
    console.log(`🌐 Server: ${this.baseUrl}`);
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

  getDataWithFilters(schemaId?: string, month?: string, location?: string): Observable<ResultsResponse> {
    let params = new HttpParams();
    if (schemaId) params = params.set('schemaId', schemaId);
    if (month) params = params.set('month', month);
    if (location) params = params.set('location', location);
    return this.http.get<ResultsResponse>(`${this.baseUrl}/data`, { params });
  }

  resetAllData(): Observable<{ success: boolean; message: string; timestamp: string }> {
    return this.http.delete<{ success: boolean; message: string; timestamp: string }>(`${this.baseUrl}/data/reset`);
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

  getManualEntryData(station: string, jahr: number, monat: number, kategorie: string): Observable<ManualEntryDataResponse> {
    const params = new HttpParams()
      .set('station', station)
      .set('jahr', jahr.toString())
      .set('monat', monat.toString())
      .set('kategorie', kategorie);
    return this.http.get<ManualEntryDataResponse>(`${this.baseUrl}/manual-entry/data`, { params });
  }

  saveManualEntry(station: string, jahr: number, monat: number, kategorie: string, entries: any[]): Observable<{ success: boolean; uploadId: string; message: string }> {
    return this.http.post<{ success: boolean; uploadId: string; message: string }>(`${this.baseUrl}/manual-entry/save`, {
      station,
      jahr,
      monat,
      kategorie,
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

  uploadDienstplan(file: File): Observable<{ success: boolean; message: string; uploaded: any[]; totalEntries: number }> {
    const form = new FormData();
    form.append('file', file);
    form.append('schicht', 'tag'); // Default to tag, can be changed if needed
    return this.http.post<{ success: boolean; message: string; uploaded: any[]; totalEntries: number }>(`${this.baseUrl}/manual-entry/upload-dienstplan`, form);
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

  saveKostenstelle(data: { kostenstelle: string; stations: string[]; standorte: string[]; standortnummer?: string | number | null; ik?: string | number | null; paediatrie?: string | null }): Observable<{ success: boolean; message: string; data: any }> {
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

  // Station Mapping
  getStationMapping(): Observable<{ success: boolean; data: any[]; count: number }> {
    return this.http.get<{ success: boolean; data: any[]; count: number }>(`${this.baseUrl}/station-mapping`);
  }

  getStationMappingByDienstplanStation(dienstplanStation: string): Observable<{ success: boolean; data: any }> {
    return this.http.get<{ success: boolean; data: any }>(`${this.baseUrl}/station-mapping/${encodeURIComponent(dienstplanStation)}`);
  }

  saveStationMapping(data: { dienstplanStation: string; minaMitaStation?: string | null; beschreibung?: string | null }): Observable<{ success: boolean; message: string; data: any }> {
    return this.http.post<{ success: boolean; message: string; data: any }>(`${this.baseUrl}/station-mapping`, data);
  }

  updateStationMapping(dienstplanStation: string, data: { minaMitaStation?: string | null; beschreibung?: string | null }): Observable<{ success: boolean; message: string; data: any }> {
    return this.http.patch<{ success: boolean; message: string; data: any }>(`${this.baseUrl}/station-mapping/${encodeURIComponent(dienstplanStation)}`, data);
  }

  deleteStationMapping(dienstplanStation: string): Observable<{ success: boolean; message: string }> {
    return this.http.delete<{ success: boolean; message: string }>(`${this.baseUrl}/station-mapping/${encodeURIComponent(dienstplanStation)}`);
  }

  importStationMappingFromJson(): Observable<{ success: boolean; message: string; imported: number; skipped: number; total: number }> {
    return this.http.post<{ success: boolean; message: string; imported: number; skipped: number; total: number }>(`${this.baseUrl}/station-mapping/import-json`, {});
  }

  private resolveBaseUrl(): string {
    if (isDevMode()) {
      return 'http://localhost:3000';
    }

    const globalOverride = (globalThis as Record<string, unknown>)?.['__ROMED_BACKEND_URL__'];
    if (typeof globalOverride === 'string' && globalOverride.trim().length > 0) {
      return globalOverride;
    }

    const importMetaEnv = (import.meta as unknown as { env?: { NG_APP_BACKEND_URL?: string } })?.env;
    if (importMetaEnv?.NG_APP_BACKEND_URL) {
      return importMetaEnv.NG_APP_BACKEND_URL;
    }

    const processEnvUrl = typeof (globalThis as any)?.process !== 'undefined'
      ? (globalThis as any)?.process?.env?.NG_APP_BACKEND_URL
      : undefined;
    if (typeof processEnvUrl === 'string' && processEnvUrl.trim().length > 0) {
      return processEnvUrl;
    }

    return 'https://romed-server.onrender.com';
  }
}
