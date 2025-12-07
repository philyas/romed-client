import { Injectable, inject, signal } from '@angular/core';
import { Api, StationGruppe } from './api';
import { firstValueFrom } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class StationGruppenService {
  private api = inject(Api);
  
  private stationGruppen = signal<StationGruppe[]>([]);
  private stationToGruppeMap = signal<Map<string, StationGruppe>>(new Map());
  private gruppeNameToStationsMap = signal<Map<string, string[]>>(new Map());

  /**
   * Normalize station name for comparison (trim whitespace, handle case)
   */
  private normalizeStationName(name: string): string {
    if (!name) return '';
    return name.trim();
  }

  async loadStationGruppen() {
    try {
      const response = await firstValueFrom(this.api.getStationGruppen());
      const gruppen = response.data.filter(g => g.istAktiv);
      this.stationGruppen.set(gruppen);
      
      // Build mapping: station name -> gruppe
      // Use both normalized and original names for lookup
      const stationMap = new Map<string, StationGruppe>();
      const normalizedToOriginalMap = new Map<string, string>(); // normalized -> original
      const gruppeMap = new Map<string, string[]>();
      
      gruppen.forEach(gruppe => {
        if (gruppe.mitglieder && gruppe.mitglieder.length > 0) {
          const stationNames: string[] = [];
          gruppe.mitglieder.forEach(mitglied => {
            const originalName = mitglied.stationName;
            const normalizedName = this.normalizeStationName(originalName);
            
            // Store mapping with original name
            stationMap.set(originalName, gruppe);
            // Also store with normalized name for flexible lookup
            stationMap.set(normalizedName, gruppe);
            normalizedToOriginalMap.set(normalizedName, originalName);
            
            stationNames.push(originalName);
          });
          gruppeMap.set(gruppe.name, stationNames);
        }
      });
      
      this.stationToGruppeMap.set(stationMap);
      this.gruppeNameToStationsMap.set(gruppeMap);
    } catch (error) {
      console.error('Error loading station groups:', error);
      this.stationGruppen.set([]);
      this.stationToGruppeMap.set(new Map());
      this.gruppeNameToStationsMap.set(new Map());
    }
  }

  getStationGruppen(): StationGruppe[] {
    return this.stationGruppen();
  }

  getGruppeForStation(stationName: string): StationGruppe | null {
    if (!stationName) return null;
    
    // Try exact match first
    let gruppe = this.stationToGruppeMap().get(stationName);
    if (gruppe) return gruppe;
    
    // Try normalized match
    const normalized = this.normalizeStationName(stationName);
    gruppe = this.stationToGruppeMap().get(normalized);
    if (gruppe) return gruppe;
    
    // Try case-insensitive match
    for (const [key, value] of this.stationToGruppeMap().entries()) {
      if (this.normalizeStationName(key).toLowerCase() === normalized.toLowerCase()) {
        return value;
      }
    }
    
    return null;
  }

  getStationsInGruppe(gruppeName: string): string[] {
    return this.gruppeNameToStationsMap().get(gruppeName) || [];
  }

  isStationInGruppe(stationName: string): boolean {
    return this.stationToGruppeMap().has(stationName);
  }

  /**
   * Returns a list of station options for dropdowns:
   * - Individual stations that are NOT in any group
   * - Group names for stations that ARE in groups
   */
  getStationOptions(allStations: string[]): string[] {
    const options: string[] = [];
    const processedStations = new Set<string>();
    const gruppenNames = new Set<string>();

    // Debug: Log all stations and groups
    if (allStations.length > 0) {
      console.log('[StationGruppenService] Processing stations:', allStations.slice(0, 10));
      console.log('[StationGruppenService] Available groups:', Array.from(this.gruppeNameToStationsMap().keys()));
    }

    // First, collect all group names
    allStations.forEach(station => {
      const gruppe = this.getGruppeForStation(station);
      if (gruppe) {
        gruppenNames.add(gruppe.name);
        // Mark all stations in this group as processed (both original and normalized)
        const stationsInGruppe = this.getStationsInGruppe(gruppe.name);
        stationsInGruppe.forEach(s => {
          processedStations.add(s);
          processedStations.add(this.normalizeStationName(s));
        });
        // Also mark the current station (normalized)
        processedStations.add(this.normalizeStationName(station));
        console.log(`[StationGruppenService] Station "${station}" is in group "${gruppe.name}"`);
      } else {
        // Debug: Check why station is not found
        const normalized = this.normalizeStationName(station);
        const allMappedStations = Array.from(this.stationToGruppeMap().keys());
        const similar = allMappedStations.filter(s => 
          this.normalizeStationName(s).toLowerCase() === normalized.toLowerCase()
        );
        if (similar.length > 0) {
          console.log(`[StationGruppenService] Station "${station}" not found, but similar found:`, similar);
        }
      }
    });

    // Add group names
    options.push(...Array.from(gruppenNames).sort());

    // Add individual stations that are not in any group
    allStations.forEach(station => {
      const normalized = this.normalizeStationName(station);
      if (!processedStations.has(station) && !processedStations.has(normalized)) {
        // Double-check: is this station really not in any group?
        const gruppe = this.getGruppeForStation(station);
        if (!gruppe) {
          options.push(station);
        }
      }
    });

    console.log('[StationGruppenService] Final options:', options);
    return options.sort();
  }

  /**
   * Check if a selection is a group name or individual station
   */
  isGruppeName(selection: string): boolean {
    return this.gruppeNameToStationsMap().has(selection);
  }

  /**
   * Get all station names for a selection (could be a group or single station)
   * Returns original station names from the database
   */
  getStationNamesForSelection(selection: string): string[] {
    if (this.isGruppeName(selection)) {
      return this.getStationsInGruppe(selection);
    }
    // For individual stations, try to find the original name if it's in a group
    const gruppe = this.getGruppeForStation(selection);
    if (gruppe) {
      // This station is in a group, but user selected it individually
      // Return the original name from the group
      const stationsInGruppe = this.getStationsInGruppe(gruppe.name);
      const normalized = this.normalizeStationName(selection);
      const matchingStation = stationsInGruppe.find(s => 
        this.normalizeStationName(s).toLowerCase() === normalized.toLowerCase()
      );
      return matchingStation ? [matchingStation] : [selection];
    }
    return [selection];
  }
}

