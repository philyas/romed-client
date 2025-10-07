import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface SchemaDef {
  id: string;
  name: string;
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

@Injectable({
  providedIn: 'root'
})
export class Api {
  private http = inject(HttpClient);
  private readonly baseUrl = 'http://localhost:3000';

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
}
