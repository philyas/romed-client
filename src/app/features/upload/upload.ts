import { Component, inject, signal, ViewChild, ElementRef, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialogModule, MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Api, SchemaDef, UploadFileResult } from '../../core/api';

@Component({
  selector: 'app-upload',
  imports: [CommonModule, FormsModule, MatFormFieldModule, MatSelectModule, MatButtonModule, MatIconModule, MatListModule, MatCardModule, MatProgressSpinnerModule, MatDialogModule, MatTooltipModule],
  templateUrl: './upload.html',
  styleUrl: './upload.scss'
})
export class Upload {
  private api = inject(Api);
  private dialog = inject(MatDialog);
  private router = inject(Router);

  @ViewChild('fileInput', { static: false }) fileInput!: ElementRef<HTMLInputElement>;

  schemas = signal<SchemaDef[]>([]);
  selectedSchemaId = signal<string>('');
  files = signal<File[]>([]);
  uploading = signal<boolean>(false);
  lastResponse = signal<unknown | null>(null);
  dragOver = signal<boolean>(false);

  // Nur diese Schemas sollen im Dropdown erscheinen
  private allowedSchemas = ['mitternachtsstatistik', 'co_entlass_aufnahmezeiten', 'ppugv_bestaende'];

  // Gefilterte Schemas für das Dropdown
  get filteredSchemas(): SchemaDef[] {
    return this.schemas().filter(schema => this.allowedSchemas.includes(schema.id));
  }

  constructor() {
    this.api.getSchemas().subscribe(({ schemas }) => this.schemas.set(schemas));
  }

  getSelectedSchema(): SchemaDef | undefined {
    return this.schemas().find(s => s.id === this.selectedSchemaId());
  }

  getSchemaFileInfo(): string | null {
    const schemaId = this.selectedSchemaId();
    switch (schemaId) {
      case 'mitternachtsstatistik':
        return 'Die Excel-Datei sollte monatliche Mitternachtsstatistiken enthalten. Dateiname-Format: <strong>[Standort] [Monat]-[Jahr] Mitternachtsstatistik.xlsx</strong><br>Beispiel: <em>BAB 09-2025 Mitternachtsstatistik.xlsx</em>';
      case 'co_entlass_aufnahmezeiten':
        return 'Die Excel-Datei sollte Aufnahme- und Entlasszeiten enthalten. Dateiname-Format: <strong>CO Entlass- Aufnahmezeiten [Jahr]-[Monat].xlsx</strong><br>Beispiel: <em>CO Entlass- Aufnahmezeiten 2025-08.xlsx</em>';
      case 'ppugv_bestaende':
        return 'Die Excel-Datei sollte MiNa- und MiTa-Bestände enthalten (beide Tabs). Dateiname-Format: <strong>*[Jahr]-[Monat]-[Tag]*.xlsx</strong> oder <strong>*[Jahr]-[Monat]*.xlsx</strong><br>Beispiel: <em>CO PpUGV MiNa_MiTa-Bestände RoMed_2025-08-31.xlsx</em><br><br>📊 Das System erkennt automatisch das Datum im Dateinamen und berechnet:<br>✅ Tagesdaten für Detailanalysen<br>✅ Monatsdurchschnitte für Übersichtsberichte';
      default:
        return null;
    }
  }

  getMaxFiles(): { max: number; description: string } {
    const schemaId = this.selectedSchemaId();
    switch (schemaId) {
      case 'mitternachtsstatistik':
        return {
          max: 0, // 0 = unbegrenzt
          description: 'Sie können mehrere Dateien gleichzeitig hochladen (z.B. verschiedene Standorte oder Monate).'
        };
      case 'co_entlass_aufnahmezeiten':
        return {
          max: 1,
          description: 'Es kann nur eine Datei pro Upload hochgeladen werden, da die Daten monatlich überschrieben werden.'
        };
      case 'ppugv_bestaende':
        return {
          max: 1,
          description: 'Es kann nur eine Datei pro Upload hochgeladen werden. Die Datei muss beide Tabs (MiNa und MiTa) enthalten. Bei erneutem Upload werden die vorherigen Daten überschrieben.'
        };
      default:
        return {
          max: 0,
          description: 'Mehrere Dateien können gleichzeitig hochgeladen werden.'
        };
    }
  }

  openSchemaInfoDialog() {
    const schema = this.getSelectedSchema();
    if (!schema) return;

    this.dialog.open(SchemaInfoDialog, {
      width: '90vw',
      maxWidth: '1000px',
      data: {
        schema: schema,
        fileInfo: this.getSchemaFileInfo(),
        maxFiles: this.getMaxFiles()
      }
    });
  }

  onSchemaChange(schemaId: string) {
    this.selectedSchemaId.set(schemaId);
    // Falls bereits Dateien ausgewählt sind: automatisch hochladen
    if (this.files().length > 0 && !this.uploading()) {
      this.doUpload();
    }
  }

  triggerFileSelect() {
    if (this.fileInput) {
      this.fileInput.nativeElement.click();
    }
  }

  onFileChange(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files) return;
    const filesArray = Array.from(input.files);
    this.addFiles(filesArray);
    // Reset input to allow selecting the same file again
    input.value = '';
  }

  addFiles(newFiles: File[]) {
    // Filter for valid file types
    const validFiles = newFiles.filter(file => {
      const validTypes = ['.xlsx', '.xls', '.xlsm', '.csv'];
      const fileName = file.name.toLowerCase();
      return validTypes.some(type => fileName.endsWith(type));
    });

    if (validFiles.length !== newFiles.length) {
      alert('Einige Dateien wurden ignoriert. Nur Excel-Dateien (.xlsx, .xls, .xlsm) und CSV-Dateien sind erlaubt.');
      // If no valid files, don't continue
      if (validFiles.length === 0) {
        return;
      }
    }

    // Check if schema allows multiple files
    const maxFiles = this.getMaxFiles();
    const currentFiles = this.files();
    
    if (maxFiles.max === 1) {
      // Only allow one file for this schema
      if (validFiles.length > 1) {
        alert('Für dieses Schema kann nur eine Datei pro Upload hochgeladen werden. Bitte wählen Sie nur eine Datei aus.');
        // Don't add any files
        return;
      }
      
      if (currentFiles.length > 0 && validFiles.length > 0) {
        alert('Für dieses Schema kann nur eine Datei gleichzeitig hochgeladen werden. Die vorherige Auswahl wurde ersetzt.');
      }
      
      // Replace existing file with the new file
      this.files.set(validFiles.length > 0 ? [validFiles[0]] : []);
    } else {
      // Allow multiple files
      this.files.set([...currentFiles, ...validFiles]);
    }

    // Auto-upload immediately when a Schema gewählt wurde
    if (this.selectedSchemaId() && this.files().length > 0 && !this.uploading()) {
      this.doUpload();
    }
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.dragOver.set(true);
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.dragOver.set(false);
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.dragOver.set(false);

    const files = event.dataTransfer?.files;
    if (files) {
      this.addFiles(Array.from(files));
    }
  }

  clearFiles() {
    this.files.set([]);
    if (this.fileInput) {
      this.fileInput.nativeElement.value = '';
    }
    this.clearUploadFeedback();
  }

  clearUploadFeedback() {
    this.lastResponse.set(null);
  }

  doUpload() {
    if (this.uploading()) return;
    const schemaId = this.selectedSchemaId();
    const files = this.files();
    if (!schemaId || files.length === 0) return;
    
    this.uploading.set(true);
    this.clearUploadFeedback();
    
    this.api.uploadFiles(schemaId, files).subscribe({
      next: (resp) => {
        this.handleUploadSuccess(resp);
        this.clearFiles();
      },
      error: (err) => {
        this.handleUploadError(err);
        this.uploading.set(false); // Reset uploading status on error
      },
      complete: () => this.uploading.set(false),
    });
  }

  private handleUploadSuccess(response: { uploadId: string; files: UploadFileResult[] }) {
    this.lastResponse.set(response);
    
    // Calculate summary
    const successfulFiles = response.files.filter(file => !file.error);
    const failedFiles = response.files.filter(file => file.error);
    
    // Get the current schema ID
    const currentSchemaId = this.selectedSchemaId();
    
    // Show modal instead of snackbar
    const dialogRef = this.dialog.open(UploadResultDialog, {
      width: '600px',
      disableClose: false,
      data: {
        type: failedFiles.length === 0 ? 'success' : 'warning',
        schemaId: currentSchemaId,
        summary: {
          totalFiles: response.files.length,
          successfulFiles: successfulFiles.length,
          failedFiles: failedFiles.length
        },
        files: response.files,
        uploadId: response.uploadId
      }
    });
    
    // Navigate to dashboard after dialog is closed
    dialogRef.afterClosed().subscribe(() => {
      // Navigate to dashboard with fragment to scroll to the uploaded schema
      this.router.navigate(['/dashboard'], { 
        fragment: currentSchemaId,
        queryParams: { highlight: currentSchemaId }
      });
    });
  }

  private handleUploadError(error: any) {
    this.lastResponse.set(error?.error || error);
    
    let errorMessage = 'Unbekannter Fehler beim Upload';
    
    // Handle specific error cases with user-friendly messages
    if (error?.error) {
      const errorData = error.error;
      
      // Handle validation errors
      if ((errorData.error === 'File validation failed' || errorData.error === 'Datei-Validierung fehlgeschlagen') && errorData.details) {
        if (Array.isArray(errorData.details)) {
          errorMessage = 'Datei-Validierung fehlgeschlagen:\n\n' + errorData.details.join('\n');
        } else {
          errorMessage = 'Datei-Validierung fehlgeschlagen: ' + errorData.details;
        }
      }
      // Handle unknown schema errors
      else if (errorData.error && (errorData.error.includes('Unknown schemaId') || errorData.error.includes('Unbekanntes Schema'))) {
        errorMessage = 'Unbekanntes Schema. Bitte wählen Sie ein gültiges Schema aus.';
      }
      // Handle no files uploaded
      else if (errorData.error === 'No files uploaded' || errorData.error === 'Keine Dateien hochgeladen') {
        errorMessage = 'Keine Dateien hochgeladen. Bitte wählen Sie mindestens eine Datei aus.';
      }
      // Handle other specific errors
      else if (errorData.error) {
        errorMessage = errorData.error;
      }
    } else if (error?.message) {
      errorMessage = error.message;
    } else if (typeof error === 'string') {
      errorMessage = error;
    }
    
    // Show error modal instead of snackbar
    const dialogRef = this.dialog.open(UploadResultDialog, {
      width: '600px',
      disableClose: false,
      data: {
        type: 'error',
        errorMessage: errorMessage,
        summary: {
          totalFiles: 0,
          successfulFiles: 0,
          failedFiles: 0
        },
        files: [],
        uploadId: null
      }
    });
  }
}

// Upload Result Dialog Component
@Component({
  selector: 'upload-result-dialog',
  template: `
    <h2 mat-dialog-title>
      <mat-icon [class.success-icon]="data.type === 'success'" 
                [class.warning-icon]="data.type === 'warning'" 
                [class.error-icon]="data.type === 'error'">
        {{ data.type === 'success' ? 'check_circle' : data.type === 'warning' ? 'warning' : 'error' }}
      </mat-icon>
      {{ getTitle() }}
    </h2>
    
    <mat-dialog-content>
      <div class="upload-result-content">
        <!-- Success/Warning Summary -->
        <div *ngIf="data.type === 'success' || data.type === 'warning'" class="upload-summary">
          <div class="summary-stats">
            <div class="stat-item">
              <mat-icon>folder</mat-icon>
              <span>{{ data.summary.totalFiles }} Datei{{ data.summary.totalFiles !== 1 ? 'en' : '' }} hochgeladen</span>
            </div>
            <div class="stat-item" *ngIf="data.summary.successfulFiles > 0">
              <mat-icon class="success-icon">check_circle</mat-icon>
              <span>{{ data.summary.successfulFiles }} erfolgreich verarbeitet</span>
            </div>
            <div class="stat-item" *ngIf="data.summary.failedFiles > 0">
              <mat-icon class="error-icon">error</mat-icon>
              <span>{{ data.summary.failedFiles }} fehlgeschlagen</span>
            </div>
          </div>
          
          <!-- File Details -->
          <div *ngIf="data.files.length > 0" class="file-details">
            <h4>Datei-Details:</h4>
            <mat-list class="file-list">
              <mat-list-item *ngFor="let file of data.files">
                <mat-icon [class.success-icon]="!file.error" [class.error-icon]="file.error">
                  {{ file.error ? 'error' : 'check_circle' }}
                </mat-icon>
                <div class="file-info">
                  <div class="file-name">{{ file.originalName }}</div>
                  <div class="file-meta" *ngIf="!file.error">
                    <span class="file-size" *ngIf="file.size">({{ (file.size / 1024) | number:'1.0-1' }} KB)</span>
                    <span class="file-rows" *ngIf="file.values && file.values.length">
                      {{ file.values.length }} Zeilen verarbeitet
                    </span>
                  </div>
                  <div class="file-error" *ngIf="file.error">
                    <span class="error-text">{{ file.error }}</span>
                  </div>
                </div>
              </mat-list-item>
            </mat-list>
          </div>
        </div>

        <!-- Error Message -->
        <div *ngIf="data.type === 'error'" class="error-message">
          <div class="error-text">{{ data.errorMessage }}</div>
        </div>
      </div>
    </mat-dialog-content>
    
    <mat-dialog-actions align="end">
      <button mat-raised-button color="primary" (click)="onClose()">Schließen</button>
    </mat-dialog-actions>
  `,
  imports: [MatDialogModule, MatButtonModule, MatIconModule, MatListModule, CommonModule],
  standalone: true,
  styles: [`
    h2 {
      display: flex;
      align-items: center;
      gap: 12px;
      margin: 0;
      font-weight: 600;
    }
    
    .success-icon { color: #4caf50; }
    .warning-icon { color: #ff9800; }
    .error-icon { color: #f44336; }
    
    .upload-result-content {
      min-width: 500px;
    }
    
    .upload-summary {
      margin-bottom: 24px;
    }
    
    .summary-stats {
      background: #f8f9fa;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 16px;
    }
    
    .stat-item {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 8px;
      font-weight: 500;
    }
    
    .stat-item:last-child {
      margin-bottom: 0;
    }
    
    .file-details h4 {
      margin: 16px 0 12px 0;
      color: #333;
      font-weight: 600;
    }
    
    .file-list {
      background: #fff;
      border-radius: 8px;
      border: 1px solid #e0e0e0;
      max-height: 300px;
      overflow-y: auto;
    }
    
    .file-info {
      flex: 1;
    }
    
    .file-name {
      font-weight: 500;
      color: #333;
    }
    
    .file-meta {
      display: flex;
      gap: 12px;
      font-size: 12px;
      color: #666;
      margin-top: 4px;
    }
    
    .file-rows {
      color: #4caf50;
      font-weight: 500;
    }
    
    .file-error {
      margin-top: 4px;
    }
    
    .error-text {
      color: #f44336;
      font-size: 12px;
      font-weight: 500;
    }
    
    .error-message {
      padding: 16px;
      background: #ffebee;
      border-radius: 8px;
      border-left: 4px solid #f44336;
    }
    
    .error-text {
      margin: 0;
      color: #d32f2f;
      font-weight: 500;
      white-space: pre-line;
      line-height: 1.5;
    }
  `]
})
export class UploadResultDialog {
  constructor(
    public dialogRef: MatDialogRef<UploadResultDialog>,
    @Inject(MAT_DIALOG_DATA) public data: {
      type: 'success' | 'warning' | 'error';
      summary: { totalFiles: number; successfulFiles: number; failedFiles: number };
      files: any[];
      uploadId: string | null;
      errorMessage?: string;
    }
  ) {}

  getTitle(): string {
    switch (this.data.type) {
      case 'success':
        return 'Upload erfolgreich!';
      case 'warning':
        return 'Upload teilweise erfolgreich';
      case 'error':
        return 'Upload fehlgeschlagen';
      default:
        return 'Upload-Ergebnis';
    }
  }

  onClose(): void {
    this.dialogRef.close();
  }
}

// Schema Info Dialog Component
@Component({
  selector: 'schema-info-dialog',
  template: `
    <h2 mat-dialog-title>
      <mat-icon class="info-icon">info</mat-icon>
      Schema-Informationen: {{ data.schema.name }}
    </h2>
    
    <mat-dialog-content>
      <div class="schema-info-content">
        <div class="info-section">
          <h4><mat-icon>description</mat-icon> Beschreibung</h4>
          <p>{{ data.schema.description }}</p>
        </div>

        <div class="info-section">
          <h4><mat-icon>view_column</mat-icon> Erwartete Spalten</h4>
          <div class="columns-grid">
            <span *ngFor="let col of data.schema.columns" class="column-chip">
              {{ col }}
            </span>
          </div>
        </div>

        <div class="info-section" *ngIf="data.fileInfo">
          <h4><mat-icon>folder</mat-icon> Datei-Anforderungen</h4>
          <p [innerHTML]="data.fileInfo"></p>
        </div>

        <div class="info-section">
          <h4><mat-icon>upload_file</mat-icon> Anzahl der Dateien</h4>
          <div class="file-count-info">
            <mat-icon [class.single-file]="data.maxFiles.max === 1" [class.multiple-files]="data.maxFiles.max !== 1">
              {{ data.maxFiles.max === 1 ? 'looks_one' : 'filter_none' }}
            </mat-icon>
            <div>
              <strong>{{ data.maxFiles.max === 1 ? 'Einzelne Datei' : 'Mehrere Dateien' }}</strong>
              <p>{{ data.maxFiles.description }}</p>
            </div>
          </div>
        </div>

        <div class="info-section">
          <h4><mat-icon>file_present</mat-icon> Unterstützte Dateiformate</h4>
          <div class="file-formats">
            <span class="format-badge">.xlsx</span>
            <span class="format-badge">.xls</span>
            <span class="format-badge">.xlsm</span>
            <span class="format-badge">.csv</span>
          </div>
        </div>
      </div>
    </mat-dialog-content>
    
    <mat-dialog-actions align="end">
      <button mat-raised-button color="primary" (click)="onClose()">
        <mat-icon>check</mat-icon>
        Verstanden
      </button>
    </mat-dialog-actions>
  `,
  imports: [MatDialogModule, MatButtonModule, MatIconModule, CommonModule],
  standalone: true,
  styles: [`
    mat-dialog-content {
      max-height: 70vh;
      overflow-y: auto;
    }

    h2 {
      display: flex;
      align-items: center;
      gap: 12px;
      margin: 0;
      font-weight: 600;
      color: #0066cc;
    }
    
    .info-icon {
      color: #0066cc;
      font-size: 28px;
      width: 28px;
      height: 28px;
    }
    
    .schema-info-content {
      padding: 16px 0;
    }
    
    .info-section {
      margin-bottom: 24px;
      padding: 16px;
      background: #f8f9fa;
      border-radius: 8px;
      border-left: 3px solid #0066cc;
    }
    
    .info-section:last-child {
      margin-bottom: 0;
    }
    
    .info-section h4 {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 0 0 12px 0;
      color: #333;
      font-weight: 600;
      font-size: 16px;
    }
    
    .info-section h4 mat-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
      color: #0066cc;
    }
    
    .info-section p {
      margin: 0;
      color: #666;
      line-height: 1.6;
    }
    
    .columns-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    
    .column-chip {
      display: inline-block;
      padding: 8px 14px;
      background: white;
      border: 1px solid #0066cc;
      border-radius: 20px;
      color: #0066cc;
      font-size: 13px;
      font-weight: 500;
      box-shadow: 0 1px 3px rgba(0, 102, 204, 0.1);
      transition: all 0.2s ease;
    }
    
    .column-chip:hover {
      background: #0066cc;
      color: white;
      transform: translateY(-1px);
      box-shadow: 0 2px 5px rgba(0, 102, 204, 0.2);
    }
    
    .file-count-info {
      display: flex;
      align-items: flex-start;
      gap: 16px;
      padding: 12px;
      background: white;
      border-radius: 8px;
      border: 2px solid #e0e0e0;
    }

    .file-count-info mat-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
    }

    .file-count-info .single-file {
      color: #ff9800;
    }

    .file-count-info .multiple-files {
      color: #4caf50;
    }

    .file-count-info div {
      flex: 1;
    }

    .file-count-info strong {
      display: block;
      font-size: 16px;
      color: #333;
      margin-bottom: 4px;
    }

    .file-count-info p {
      margin: 0;
      font-size: 14px;
      color: #666;
      line-height: 1.5;
    }

    .file-formats {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
    }
    
    .format-badge {
      padding: 8px 16px;
      background: linear-gradient(135deg, #0066cc 0%, #004c99 100%);
      color: white;
      border-radius: 6px;
      font-weight: 600;
      font-size: 14px;
      box-shadow: 0 2px 4px rgba(0, 102, 204, 0.2);
    }

    mat-dialog-actions button {
      display: flex;
      align-items: center;
      gap: 8px;
    }
  `]
})
export class SchemaInfoDialog {
  constructor(
    public dialogRef: MatDialogRef<SchemaInfoDialog>,
    @Inject(MAT_DIALOG_DATA) public data: {
      schema: SchemaDef;
      fileInfo: string | null;
      maxFiles: { max: number; description: string };
    }
  ) {}

  onClose(): void {
    this.dialogRef.close();
  }
}