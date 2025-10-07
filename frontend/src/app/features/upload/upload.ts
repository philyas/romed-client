import { Component, inject, signal, ViewChild, ElementRef, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialogModule, MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { Api, SchemaDef, UploadFileResult } from '../../core/api';

@Component({
  selector: 'app-upload',
  imports: [CommonModule, FormsModule, MatFormFieldModule, MatSelectModule, MatButtonModule, MatIconModule, MatListModule, MatCardModule, MatProgressSpinnerModule, MatDialogModule],
  templateUrl: './upload.html',
  styleUrl: './upload.scss'
})
export class Upload {
  private api = inject(Api);
  private dialog = inject(MatDialog);

  @ViewChild('fileInput', { static: false }) fileInput!: ElementRef<HTMLInputElement>;

  schemas = signal<SchemaDef[]>([]);
  selectedSchemaId = signal<string>('');
  files = signal<File[]>([]);
  uploading = signal<boolean>(false);
  lastResponse = signal<unknown | null>(null);
  dragOver = signal<boolean>(false);

  // Nur diese Schemas sollen im Dropdown erscheinen
  private allowedSchemas = ['mitternachtsstatistik', 'co_entlass_aufnahmezeiten'];

  // Gefilterte Schemas für das Dropdown
  get filteredSchemas(): SchemaDef[] {
    return this.schemas().filter(schema => this.allowedSchemas.includes(schema.id));
  }

  constructor() {
    this.api.getSchemas().subscribe(({ schemas }) => this.schemas.set(schemas));
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
    this.addFiles(Array.from(input.files));
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
    }

    const currentFiles = this.files();
    this.files.set([...currentFiles, ...validFiles]);

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
    
    // Show modal instead of snackbar
    const dialogRef = this.dialog.open(UploadResultDialog, {
      width: '600px',
      disableClose: false,
      data: {
        type: failedFiles.length === 0 ? 'success' : 'warning',
        summary: {
          totalFiles: response.files.length,
          successfulFiles: successfulFiles.length,
          failedFiles: failedFiles.length
        },
        files: response.files,
        uploadId: response.uploadId
      }
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