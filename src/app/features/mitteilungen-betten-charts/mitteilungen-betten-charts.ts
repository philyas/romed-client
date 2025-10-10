import { Component, Input, computed, effect, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatTableModule } from '@angular/material/table';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartData, ChartOptions, ChartType } from 'chart.js';
import { ResultsResponse } from '../../core/api';
import { DataInfoPanel, DataInfoItem } from '../data-info-panel/data-info-panel';

interface BettenData {
  IK: string;
  Standort: string;
  Station: string;
  Jahr: number;
  Bettenanzahl: number;
}

@Component({
  selector: 'app-mitteilungen-betten-charts',
  standalone: true,
  imports: [
    CommonModule, 
    MatCardModule, 
    MatChipsModule, 
    MatIconModule, 
    BaseChartDirective, 
    MatSelectModule, 
    MatFormFieldModule,
    MatTableModule,
    DataInfoPanel
  ],
  templateUrl: './mitteilungen-betten-charts.html',
  styleUrl: './mitteilungen-betten-charts.scss'
})
export class MitteilungenBettenCharts {
  @Input() data!: ResultsResponse | null;
  @Input() selectedYearInput?: number;
  
  selectedYear = signal<number>(new Date().getFullYear());
  selectedStandort = signal<string>('all');
  selectedStation = signal<string>('all');
  
  flippedCards: { [key: string]: boolean } = {};
  
  constructor() {
    // Update selected year when input changes
    effect(() => {
      if (this.selectedYearInput) {
        this.selectedYear.set(this.selectedYearInput);
      }
    });

    // Reset station when standort changes
    effect(() => {
      const standort = this.selectedStandort();
      if (standort === 'all') {
        this.selectedStation.set('all');
      }
    });
  }

  toggleFlip(cardName: string) {
    this.flippedCards[cardName] = !this.flippedCards[cardName];
  }

  // Extract all Betten data from locationsData (similar to mitternachtsstatistik)
  bettenData = computed(() => {
    const uploads = this.data?.uploads || [];
    const bettenUploads = uploads.filter(u => u.schemaId === 'mitteilungen_betten');
    
    const allData: BettenData[] = [];
    bettenUploads.forEach(upload => {
      // Use locationsData structure (multiple files aggregated by location)
      if (upload.locationsData) {
        Object.values(upload.locationsData).forEach((locationFiles: any) => {
          locationFiles.forEach((file: any) => {
            if (file.values) {
              file.values.forEach((value: any) => {
                allData.push({
                  IK: value.IK || '',
                  Standort: value.Standort || '',
                  Station: value.Station || '',
                  Jahr: value.Jahr || upload.jahr || new Date().getFullYear(),
                  Bettenanzahl: value.Bettenanzahl || 0
                });
              });
            }
          });
        });
      }
    });
    
    return allData;
  });

  // Check if we have data
  hasData = computed(() => this.bettenData().length > 0);

  // Get available years
  availableYears = computed(() => {
    const years = new Set(this.bettenData().map(d => d.Jahr));
    return Array.from(years).sort((a, b) => b - a);
  });

  // Filter data by selected year, standort, and station
  filteredData = computed(() => {
    let data = this.bettenData().filter(d => d.Jahr === this.selectedYear());
    
    // Filter by Standort
    if (this.selectedStandort() !== 'all') {
      data = data.filter(d => d.Standort === this.selectedStandort());
    }
    
    // Filter by Station
    if (this.selectedStation() !== 'all') {
      data = data.filter(d => d.Station === this.selectedStation());
    }
    
    return data;
  });

  // Get all unique standorte (without filter)
  standorte = computed(() => {
    const data = this.bettenData().filter(d => d.Jahr === this.selectedYear());
    const standorte = new Set(data.map(d => d.Standort));
    return Array.from(standorte).sort();
  });

  // Get available stations for selected standort
  availableStations = computed(() => {
    const standort = this.selectedStandort();
    if (standort === 'all') {
      return [];
    }
    const data = this.bettenData()
      .filter(d => d.Jahr === this.selectedYear() && d.Standort === standort);
    const stations = new Set(data.map(d => d.Station));
    return Array.from(stations).sort();
  });

  // Calculate summaries per Standort
  standortSummaries = computed(() => {
    const data = this.filteredData();
    const summaryMap = new Map<string, { stationCount: number; totalBetten: number }>();
    
    data.forEach(row => {
      const key = row.Standort;
      if (!summaryMap.has(key)) {
        summaryMap.set(key, { stationCount: 0, totalBetten: 0 });
      }
      const summary = summaryMap.get(key)!;
      summary.stationCount++;
      summary.totalBetten += row.Bettenanzahl;
    });
    
    return Array.from(summaryMap.entries()).map(([standort, data]) => ({
      standort,
      stationCount: data.stationCount,
      totalBetten: data.totalBetten,
      avgBetten: (data.totalBetten / data.stationCount).toFixed(1)
    })).sort((a, b) => a.standort.localeCompare(b.standort));
  });

  // Total statistics
  totalStations = computed(() => this.filteredData().length);
  totalBetten = computed(() => this.filteredData().reduce((sum, d) => sum + d.Bettenanzahl, 0));
  avgBettenPerStation = computed(() => {
    const total = this.totalBetten();
    const count = this.totalStations();
    return count > 0 ? (total / count).toFixed(1) : '0';
  });

  // Data Info Items (similar to mitternachtsstatistik - show multiple files aggregated)
  dataInfoItems = computed(() => {
    const items: DataInfoItem[] = [];
    const uploads = this.data?.uploads || [];
    const bettenUploads = uploads.filter(u => u.schemaId === 'mitteilungen_betten');
    
    bettenUploads.forEach(upload => {
      // Only show aggregated container with locationsData structure
      if (upload.locationsData) {
        let totalRecords = 0;
        const allRawData: any[] = [];
        const fileCount = upload.files?.length || 0;
        const locations = upload.locations?.join(', ') || '';

        // Collect all raw data from all locations
        Object.values(upload.locationsData).forEach((locationFiles: any) => {
          locationFiles.forEach((file: any) => {
            if (file.values) {
              totalRecords += file.values.length;
              allRawData.push(...file.values);
            }
          });
        });

        items.push({
          fileName: `${upload.schemaName} (${fileCount} ${fileCount === 1 ? 'Datei' : 'Dateien'})`,
          uploadDate: upload.createdAt,
          dataYear: upload.jahr,
          recordCount: totalRecords,
          status: 'success' as const,
          location: locations,
          rawData: allRawData,
          schemaColumns: ['IK', 'Standort', 'Station', 'Jahr', 'Bettenanzahl'],
          fileCount: fileCount
        });
      }
    });
    
    return items;
  });

  // Bar Chart Data
  barChartData = computed<ChartData<'bar'>>(() => {
    const standort = this.selectedStandort();
    const station = this.selectedStation();
    
    // Show specific station
    if (station !== 'all') {
      const data = this.filteredData();
      return {
        labels: data.map(d => d.Station),
        datasets: [{
          label: 'Anzahl Betten',
          data: data.map(d => d.Bettenanzahl),
          backgroundColor: '#1976d2',
          borderColor: '#1565c0',
          borderWidth: 1
        }]
      };
    }
    
    // Show all stations in selected standort
    if (standort !== 'all') {
      const data = this.filteredData().sort((a, b) => b.Bettenanzahl - a.Bettenanzahl);
      return {
        labels: data.map(d => d.Station),
        datasets: [{
          label: 'Anzahl Betten',
          data: data.map(d => d.Bettenanzahl),
          backgroundColor: '#1976d2',
          borderColor: '#1565c0',
          borderWidth: 1
        }]
      };
    }
    
    // Show all standorte
    const summaries = this.standortSummaries();
    return {
      labels: summaries.map(s => s.standort),
      datasets: [{
        label: 'Anzahl Betten',
        data: summaries.map(s => s.totalBetten),
        backgroundColor: ['#1976d2', '#388e3c', '#d32f2f', '#f57c00'],
        borderColor: ['#1565c0', '#2e7d32', '#c62828', '#e65100'],
        borderWidth: 1
      }]
    };
  });

  barChartOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            return `${context.parsed.y} Betten`;
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: 'Anzahl Betten'
        }
      }
    }
  };

  // Pie Chart Data
  pieChartData = computed<ChartData<'pie'>>(() => {
    const summaries = this.standortSummaries();
    return {
      labels: summaries.map(s => s.standort),
      datasets: [{
        data: summaries.map(s => s.totalBetten),
        backgroundColor: ['#1976d2', '#388e3c', '#d32f2f', '#f57c00'],
        borderColor: '#fff',
        borderWidth: 2
      }]
    };
  });

  pieChartOptions: ChartOptions<'pie'> = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: {
        position: 'right'
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const label = context.label || '';
            const value = context.parsed || 0;
            const total = context.dataset.data.reduce((sum, val) => sum + (val as number), 0);
            const percentage = ((value / total) * 100).toFixed(1);
            return `${label}: ${value} Betten (${percentage}%)`;
          }
        }
      }
    }
  };

  // Table data for flip cards
  getStandortTableData() {
    return this.standortSummaries().map(s => ({
      standort: s.standort,
      stationCount: s.stationCount,
      totalBetten: s.totalBetten,
      avgBetten: s.avgBetten
    }));
  }

  getStationTableData() {
    return this.filteredData()
      .sort((a, b) => b.Bettenanzahl - a.Bettenanzahl)
      .map(d => ({
        station: d.Station,
        standort: d.Standort,
        betten: d.Bettenanzahl
      }));
  }

  onYearChange(year: number) {
    this.selectedYear.set(year);
  }

  onStandortChange(standort: string) {
    this.selectedStandort.set(standort);
    this.selectedStation.set('all');
  }

  onStationChange(station: string) {
    this.selectedStation.set(station);
  }
}
