import { Injectable, inject, signal, computed } from '@angular/core';
import { Api } from './api';
import { firstValueFrom } from 'rxjs';

export interface KostenstellenMappingItem {
  kostenstelle: string;
  stations: string[];
  standorte: string[];
  standortnummer?: string | number | null;
  ik?: string | number | null;
  paediatrie?: string | null;
  include_in_statistics?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class DashboardFilterService {
  private api = inject(Api);

  // Global filter state
  selectedStandort = signal<string>('all');
  selectedKostenstelle = signal<string>('all');
  
  // Kostenstellen mapping data
  private kostenstellenMappingData = signal<KostenstellenMappingItem[]>([]);
  private mappingLoaded = signal<boolean>(false);

  // Computed: Available standorte from kostenstellen mapping
  availableStandorte = computed(() => {
    const mapping = this.kostenstellenMappingData();
    const standorteSet = new Set<string>();
    mapping.forEach(item => {
      if (item.standorte && item.standorte.length > 0) {
        // Use the first standort (full name) as the primary identifier
        standorteSet.add(item.standorte[0]);
      }
    });
    return Array.from(standorteSet).sort();
  });

  // Computed: Available kostenstellen filtered by selected standort
  availableKostenstellen = computed(() => {
    const mapping = this.kostenstellenMappingData();
    const selectedStandort = this.selectedStandort();
    
    let filtered = mapping;
    if (selectedStandort !== 'all') {
      filtered = mapping.filter(item => 
        item.standorte && item.standorte.some(s => 
          s.toLowerCase() === selectedStandort.toLowerCase() ||
          s.toLowerCase().includes(selectedStandort.toLowerCase())
        )
      );
    }
    
    return filtered.map(item => item.kostenstelle).sort();
  });

  // Display function for kostenstellen
  kostenstelleDisplayFn = (value: string): string => {
    if (value === 'all') return 'Alle Kostenstellen';
    const mapping = this.kostenstellenMappingData().find(m => m.kostenstelle === value);
    if (mapping) {
      const stations = mapping.stations?.filter(Boolean) || [];
      const stationWithCode = stations.find(s => s.includes(value));
      const primaryStation = stationWithCode || stations[0] || value;
      return primaryStation;
    }
    return value;
  };

  // Display function for standorte
  standortDisplayFn = (value: string): string => {
    if (value === 'all') return 'Alle Standorte';
    return value;
  };

  // Get kostenstellen mapping
  getKostenstellenMapping(): Record<string, KostenstellenMappingItem> {
    const mapping = this.kostenstellenMappingData();
    const result: Record<string, KostenstellenMappingItem> = {};
    mapping.forEach(item => {
      result[item.kostenstelle] = item;
    });
    return result;
  }

  // Load kostenstellen mapping from API
  async loadKostenstellenMapping(): Promise<void> {
    if (this.mappingLoaded()) {
      return; // Already loaded
    }

    try {
      const response = await firstValueFrom(this.api.getKostenstellenMapping());
      if (response?.data) {
        this.kostenstellenMappingData.set(response.data);
        this.mappingLoaded.set(true);
      }
    } catch (error) {
      console.error('Failed to load kostenstellen mapping:', error);
      this.kostenstellenMappingData.set([]);
      this.mappingLoaded.set(true);
    }
  }

  // Set standort filter
  setStandort(standort: string): void {
    this.selectedStandort.set(standort);
    // Reset kostenstelle when standort changes
    if (standort === 'all') {
      this.selectedKostenstelle.set('all');
    } else {
      // Auto-select first kostenstelle if only one available
      const available = this.availableKostenstellen();
      if (available.length === 1) {
        this.selectedKostenstelle.set(available[0]);
      } else {
        this.selectedKostenstelle.set('all');
      }
    }
  }

  // Set kostenstelle filter
  setKostenstelle(kostenstelle: string): void {
    this.selectedKostenstelle.set(kostenstelle);
  }

  // Reset all filters
  resetFilters(): void {
    this.selectedStandort.set('all');
    this.selectedKostenstelle.set('all');
  }
}
