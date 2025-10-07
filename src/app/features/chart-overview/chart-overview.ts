import { Component, Input, signal, OnInit, OnChanges } from '@angular/core';
import { CommonModule, NgFor } from '@angular/common';
import { UploadRecord, SchemaStatistics } from '../../core/api';
import { SchemaChart } from '../schema-chart/schema-chart';

interface ChartData {
  schemaId: string;
  schemaName: string;
  description: string;
  columns: string[];
  uploads: UploadRecord[];
  totalRows: number;
  latestUploadDate: string;
}

@Component({
  selector: 'app-chart-overview',
  imports: [
    CommonModule, 
    NgFor, 
    SchemaChart
  ],
  template: `
    <div class="chart-overview">
      <div class="overview-header">
        <h3>Schema-Charts mit Verlaufsdaten</h3>
        <p class="overview-subtitle">Interaktive Charts für alle verarbeiteten Schemas mit zeitlichem Verlauf</p>
      </div>

      <div class="charts-grid">
        <app-schema-chart 
          *ngFor="let chart of chartData()" 
          [uploads]="uploads"
          [statistics]="statistics"
          [schemaId]="chart.schemaId"
          [selectedYear]="selectedYear"
          [selectedStation]="selectedStation"
          class="chart-card">
        </app-schema-chart>
      </div>
    </div>
  `,
  styleUrl: './chart-overview.scss'
})
export class ChartOverview implements OnInit, OnChanges {
  @Input() uploads: UploadRecord[] = [];
  @Input() statistics: SchemaStatistics[] = [];
  @Input() selectedYear: number = new Date().getFullYear();
  @Input() selectedStation: string = 'all';

  chartData = signal<ChartData[]>([]);

  ngOnInit() {
    this.processChartData();
  }

  ngOnChanges() {
    this.processChartData();
  }

  private processChartData() {
    const data: ChartData[] = [];

    // Group uploads by schema
    const uploadsBySchema = new Map<string, UploadRecord[]>();
    this.uploads.forEach(upload => {
      if (!uploadsBySchema.has(upload.schemaId)) {
        uploadsBySchema.set(upload.schemaId, []);
      }
      uploadsBySchema.get(upload.schemaId)!.push(upload);
    });

    // Create chart data for each schema
    this.statistics.forEach(stat => {
      const schemaUploads = uploadsBySchema.get(stat.schemaId) || [];
      
      if (schemaUploads.length > 0) {
        // Sort uploads by date
        schemaUploads.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        
        const totalRows = schemaUploads.reduce((sum, upload) => {
          return sum + upload.files.reduce((fileSum, file) => {
            return fileSum + (file.values?.length || 0);
          }, 0);
        }, 0);

        const latestUpload = schemaUploads[schemaUploads.length - 1];

        data.push({
          schemaId: stat.schemaId,
          schemaName: stat.schemaName,
          description: stat.description,
          columns: stat.columns,
          uploads: schemaUploads,
          totalRows,
          latestUploadDate: latestUpload.createdAt
        });
      }
    });

    // Sort by latest upload date
    data.sort((a, b) => new Date(b.latestUploadDate).getTime() - new Date(a.latestUploadDate).getTime());

    this.chartData.set(data);
  }

}
