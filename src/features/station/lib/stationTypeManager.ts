/**
 * Centralized Station Type Management
 * 
 * This module provides a comprehensive, type-safe API for working with station types.
 * It replaces scattered station type detection logic throughout the codebase.
 */

import type { CaseData } from '../types/sdd.types';

// Station type constants
export const StationTypes = {
  PS: 'PS',
  PSS: 'PSS',
  SECHE: 'Sèche',
  PROCEDURE: 'Procédure',
  DOCUMENTS: 'Document(s)' // Alias for Sèche
} as const;

export type StationType = typeof StationTypes[keyof typeof StationTypes];
export type BaseStationType = 'PS' | 'PSS' | 'Sèche' | 'Procédure';

// Station-like shape (minimal interface for type detection)
type StationLike = {
  sdd_type?: string | null;
  Type_de_station?: string | null;
  type_de_station?: string | null;
};

/**
 * Centralized Station Type Manager
 * Provides all station type operations in a single, testable class
 */
export class StationTypeManager {
  /**
   * Normalize a station to its base type
   * Handles various naming conventions and aliases
   */
  static getType(station: StationLike): BaseStationType {
    const raw = (
      station?.sdd_type || 
      station?.Type_de_station || 
      station?.type_de_station || 
      ''
    ).toString();

    // Check PSS first (more specific)
    if (/\bPSS\b/i.test(raw)) return 'PSS';
    
    // Check PS second
    if (/\bPS\b/i.test(raw)) return 'PS';
    
    // Check for document-based stations (Sèche or Document(s))
    if (/Sèche|Document\(s\)/i.test(raw)) return 'Sèche';
    
    // Check for procedure stations
    if (/Procédure/i.test(raw)) return 'Procédure';
    
    // Default to PS for unknown types
    return 'PS';
  }

  /**
   * Get human-friendly label for UI display
   * Maps document-based stations to 'Documents' for consistency
   */
  static getLabel(station: StationLike): 'PS' | 'PSS' | 'Documents' | 'Procédure' {
    const type = this.getType(station);
    return type === 'Sèche' ? 'Documents' : type;
  }

  /**
   * Check if station is document-based (Sèche/Documents)
   */
  static isDocumentStation(station: StationLike): boolean {
    return this.getType(station) === 'Sèche';
  }

  /**
   * Check if station is interactive (PS or PSS)
   * Interactive stations involve real-time conversation with AI
   */
  static isInteractive(station: StationLike): boolean {
    const type = this.getType(station);
    return type === 'PS' || type === 'PSS';
  }

  /**
   * Check if station requires chat functionality
   * All stations except Sèche use chat
   */
  static requiresChat(station: StationLike): boolean {
    return this.getType(station) !== 'Sèche';
  }

  /**
   * Check if station is a simulated patient (PS)
   */
  static isSimulatedPatient(station: StationLike): boolean {
    return this.getType(station) === 'PS';
  }

  /**
   * Check if station is a simulated healthcare professional (PSS)
   */
  static isSimulatedProfessional(station: StationLike): boolean {
    return this.getType(station) === 'PSS';
  }

  /**
   * Check if station is a procedure station
   */
  static isProcedureStation(station: StationLike): boolean {
    return this.getType(station) === 'Procédure';
  }

  /**
   * Get the appropriate chat edge function name for the station type
   * Returns null for stations that don't use chat
   */
  static getChatFunctionName(station: StationLike): string | null {
    const type = this.getType(station);
    
    switch (type) {
      case 'PS':
        return 'chat-with-patient';
      case 'PSS':
        return 'chat-with-pss';
      case 'Sèche':
        return null; // Document stations don't use chat
      case 'Procédure':
        return null; // Procedure stations may have different logic
      default:
        return 'chat-with-patient'; // Default fallback
    }
  }

  /**
   * Get the appropriate evaluation edge function name
   * Considers both station type and environment (dev vs prod)
   */
  static getEvaluationFunctionName(
    station: StationLike,
    useDevVersion: boolean = false
  ): string {
    const type = this.getType(station);
    
    if (type === 'Sèche') {
      return useDevVersion 
        ? 'evaluate-performance-seche-dev' 
        : 'evaluate-performance-seche';
    }
    
    // PS, PSS, and others use standard evaluation
    return useDevVersion 
      ? 'evaluate-performance-dev' 
      : 'evaluate-performance';
  }

  /**
   * Get station difficulty level
   * Returns typical difficulty for the station type
   */
  static getDefaultDifficulty(station: StationLike): string {
    const type = this.getType(station);
    
    // Document stations are typically Type C
    if (type === 'Sèche') return 'C';
    
    // Default for interactive stations
    return 'A';
  }

  /**
   * Get display name for the patient/character
   * Returns appropriate name based on station type
   */
  static getCharacterDisplayName(station: StationLike | CaseData): string {
    const type = this.getType(station);
    
    if (type === 'Sèche') {
      return 'Réflexion médicale';
    }
    
    if (type === 'PSS') {
      return 'Professionnel de Santé Standardisé';
    }
    
    // For PS, try to get actual patient name from case data
    if ('fiche_patient_prénom' in station || 'fiche_patient_prenom' in station) {
      const caseData = station as CaseData;
      const prenom = caseData['fiche_patient_prénom'] || caseData['fiche_patient_prenom'];
      const nom = caseData['fiche_patient_nom'];
      
      if (prenom && nom) {
        return `${prenom} ${nom}`;
      }
    }
    
    // Fallback to generic name
    return 'Sophie Durand';
  }

  /**
   * Get placeholder text for chat input
   * Returns context-appropriate placeholder based on station type
   */
  static getChatPlaceholder(station: StationLike): string {
    const type = this.getType(station);
    
    if (type === 'Sèche') {
      return "Enchaîne tes réflexions médicales…";
    }

    return "Procède à l'interrogatoire…";
  }

  /**
   * Check if two stations are the same type
   */
  static isSameType(station1: StationLike, station2: StationLike): boolean {
    return this.getType(station1) === this.getType(station2);
  }

  /**
   * Validate station type string
   * Returns true if the string represents a valid station type
   */
  static isValidType(typeString: string): boolean {
    const validTypes = ['PS', 'PSS', 'Sèche', 'Document(s)', 'Procédure'];
    return validTypes.some(valid => typeString.includes(valid));
  }

  /**
   * Get verbose description of station type
   * Useful for tooltips and help text
   */
  static getTypeDescription(station: StationLike): string {
    const type = this.getType(station);
    
    const descriptions = {
      'PS': 'Station Patient Simulé - Interview interactif avec un patient virtuel',
      'PSS': 'Station Professionnel de Santé Simulé - Appel téléphonique avec un professionnel stressé',
      'Sèche': 'Station Document(s) - Analyse écrite de documents médicaux',
      'Procédure': 'Station Procédure - Démonstration de gestes techniques'
    };
    
    return descriptions[type] || 'Station de type inconnu';
  }
}

/**
 * Re-export commonly used functions for convenience
 * Allows both `StationTypeManager.getType()` and `getStationType()` usage
 */
export const getStationType = StationTypeManager.getType.bind(StationTypeManager);
export const deriveTypeLabel = StationTypeManager.getLabel.bind(StationTypeManager);
export const isDocumentStation = StationTypeManager.isDocumentStation.bind(StationTypeManager);
export const isInteractiveStation = StationTypeManager.isInteractive.bind(StationTypeManager);
