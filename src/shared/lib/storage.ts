import type { CaseData } from '@/features/station/types/sdd.types';
import type { EvaluationResult } from '@/features/evaluation/types/evaluation.types';

/**
 * Message interface for chat storage
 */
export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

/**
 * Timer state interface
 */
export interface TimerState {
  timeRemaining: number;
  isPaused: boolean;
  isTimeUp: boolean;
}

/**
 * Simulation mode type
 */
export type SimulationMode = 'normal' | 'evaluation' | 'replay';

/**
 * Cached data with timestamp
 */
interface CachedData<T> {
  ts: number;
  data: T;
}

/**
 * Profile cache data
 */
interface ProfileCacheData {
  premium?: boolean;
  [key: string]: unknown;
}

/**
 * Centralized storage manager for all localStorage and sessionStorage operations.
 * Provides type-safe methods and consistent key management.
 */
export class StorageManager {
  private static readonly PREFIX = 'topECOS_';
  
  // Cache keys
  private static readonly PROFILE_CACHE_KEY = 'profileCacheV1';
  private static readonly PROFILE_DISPLAY_CACHE_KEY = 'profileDisplayCacheV1';
  private static readonly SDD_CACHE_KEY = 'sddCacheV2';
  private static readonly STATION_PROGRESS_CACHE_KEY = 'stationProgressCacheV2';
  private static readonly LAST_FIRSTNAME_CACHE_KEY = 'lastFirstNameCache';
  private static readonly LAST_RECOMMENDED_SDD_KEY = 'lastRecommendedSddV2';
  
  // Session storage keys
  private static readonly SESSION_SELECTED_CASE = 'selectedCase';
  private static readonly SESSION_INITIAL_MESSAGE = 'initialPatientMessage';
  private static readonly SESSION_PRELOADED_EVAL = 'preloadedEvaluation';
  private static readonly SESSION_SIM_MODE = 'simMode';
  private static readonly SESSION_RESULT_ID = 'resultId';
  private static readonly SESSION_PWD_RECOVERY = 'sb_pwd_recovery';
  
  // ============================================================================
  // CHAT MESSAGE STORAGE
  // ============================================================================
  
  /**
   * Get chat messages for a specific station
   */
  static getChatMessages(stationId: string): Message[] | null {
    const key = `${this.PREFIX}chat_messages_${stationId}`;
    try {
      const data = localStorage.getItem(key);
      if (!data) return null;
      
      const messages = JSON.parse(data);
      return messages.map((msg: any) => ({
        ...msg,
        timestamp: new Date(msg.timestamp)
      }));
    } catch (error) {
      console.error('Error loading chat messages:', error);
      return null;
    }
  }
  
  /**
   * Save chat messages for a specific station
   */
  static saveChatMessages(stationId: string, messages: Message[]): void {
    const key = `${this.PREFIX}chat_messages_${stationId}`;
    try {
      localStorage.setItem(key, JSON.stringify(messages));
    } catch (error) {
      console.error('Error saving chat messages:', error);
    }
  }
  
  /**
   * Remove chat messages for a specific station
   */
  static removeChatMessages(stationId: string): void {
    const key = `${this.PREFIX}chat_messages_${stationId}`;
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error('Error removing chat messages:', error);
    }
  }
  
  // ============================================================================
  // TIMER STATE STORAGE
  // ============================================================================
  
  /**
   * Get timer state for a specific station
   */
  static getTimerState(stationId: string): TimerState | null {
    const key = `${this.PREFIX}timer_state_${stationId}`;
    try {
      const data = localStorage.getItem(key);
      if (!data) return null;
      return JSON.parse(data);
    } catch (error) {
      console.error('Error loading timer state:', error);
      return null;
    }
  }
  
  /**
   * Save timer state for a specific station
   */
  static saveTimerState(stationId: string, state: TimerState): void {
    const key = `${this.PREFIX}timer_state_${stationId}`;
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch (error) {
      console.error('Error saving timer state:', error);
    }
  }
  
  /**
   * Remove timer state for a specific station
   */
  static removeTimerState(stationId: string): void {
    const key = `${this.PREFIX}timer_state_${stationId}`;
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error('Error removing timer state:', error);
    }
  }
  
  // ============================================================================
  // CONSIGNES FLAG STORAGE
  // ============================================================================
  
  /**
   * Check if user has seen consignes for a station
   */
  static hasSeenConsignes(stationId: string): boolean {
    const key = `${this.PREFIX}hasSeenConsignes_${stationId}`;
    try {
      return localStorage.getItem(key) === 'true';
    } catch (error) {
      console.error('Error checking consignes flag:', error);
      return false;
    }
  }
  
  /**
   * Mark consignes as seen for a station
   */
  static setConsignesSeen(stationId: string): void {
    const key = `${this.PREFIX}hasSeenConsignes_${stationId}`;
    try {
      localStorage.setItem(key, 'true');
    } catch (error) {
      console.error('Error setting consignes flag:', error);
    }
  }
  
  /**
   * Remove consignes flag for a station
   */
  static removeConsignesFlag(stationId: string): void {
    const key = `${this.PREFIX}hasSeenConsignes_${stationId}`;
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error('Error removing consignes flag:', error);
    }
  }
  
  // ============================================================================
  // STATION DATA CLEANUP
  // ============================================================================
  
  /**
   * Clear all stored data for a specific station (messages, timer, consignes)
   */
  static clearStationData(stationId: string): void {
    this.removeChatMessages(stationId);
    this.removeTimerState(stationId);
    this.removeConsignesFlag(stationId);
  }
  
  // ============================================================================
  // SESSION STORAGE - CASE SELECTION
  // ============================================================================
  
  /**
   * Get selected case from session storage
   */
  static getSelectedCase(): CaseData | null {
    try {
      const data = sessionStorage.getItem(this.SESSION_SELECTED_CASE);
      if (!data) return null;
      return JSON.parse(data);
    } catch (error) {
      console.error('Error loading selected case:', error);
      return null;
    }
  }
  
  /**
   * Save selected case to session storage
   */
  static setSelectedCase(caseData: CaseData): void {
    try {
      sessionStorage.setItem(this.SESSION_SELECTED_CASE, JSON.stringify(caseData));
    } catch (error) {
      console.error('Error saving selected case:', error);
    }
  }
  
  /**
   * Remove selected case from session storage
   */
  static removeSelectedCase(): void {
    try {
      sessionStorage.removeItem(this.SESSION_SELECTED_CASE);
    } catch (error) {
      console.error('Error removing selected case:', error);
    }
  }
  
  // ============================================================================
  // SESSION STORAGE - INITIAL MESSAGE
  // ============================================================================
  
  /**
   * Get initial patient message from session storage
   */
  static getInitialPatientMessage(): string | null {
    try {
      return sessionStorage.getItem(this.SESSION_INITIAL_MESSAGE);
    } catch (error) {
      console.error('Error loading initial patient message:', error);
      return null;
    }
  }
  
  /**
   * Save initial patient message to session storage
   */
  static setInitialPatientMessage(message: string): void {
    try {
      sessionStorage.setItem(this.SESSION_INITIAL_MESSAGE, message);
    } catch (error) {
      console.error('Error saving initial patient message:', error);
    }
  }
  
  /**
   * Remove initial patient message from session storage
   */
  static removeInitialPatientMessage(): void {
    try {
      sessionStorage.removeItem(this.SESSION_INITIAL_MESSAGE);
    } catch (error) {
      console.error('Error removing initial patient message:', error);
    }
  }
  
  // ============================================================================
  // SESSION STORAGE - PRELOADED EVALUATION
  // ============================================================================
  
  /**
   * Get preloaded evaluation from session storage
   */
  static getPreloadedEvaluation(): EvaluationResult | null {
    try {
      const data = sessionStorage.getItem(this.SESSION_PRELOADED_EVAL);
      if (!data) return null;
      return JSON.parse(data);
    } catch (error) {
      console.error('Error loading preloaded evaluation:', error);
      return null;
    }
  }
  
  /**
   * Save preloaded evaluation to session storage
   */
  static setPreloadedEvaluation(evaluation: EvaluationResult): void {
    try {
      sessionStorage.setItem(this.SESSION_PRELOADED_EVAL, JSON.stringify(evaluation));
    } catch (error) {
      console.error('Error saving preloaded evaluation:', error);
    }
  }
  
  /**
   * Remove preloaded evaluation from session storage
   */
  static removePreloadedEvaluation(): void {
    try {
      sessionStorage.removeItem(this.SESSION_PRELOADED_EVAL);
    } catch (error) {
      console.error('Error removing preloaded evaluation:', error);
    }
  }
  
  // ============================================================================
  // SESSION STORAGE - SIMULATION MODE
  // ============================================================================
  
  /**
   * Get simulation mode from session storage
   */
  static getSimulationMode(): SimulationMode | null {
    try {
      const mode = sessionStorage.getItem(this.SESSION_SIM_MODE);
      return mode as SimulationMode | null;
    } catch (error) {
      console.error('Error loading simulation mode:', error);
      return null;
    }
  }
  
  /**
   * Save simulation mode to session storage
   */
  static setSimulationMode(mode: SimulationMode): void {
    try {
      sessionStorage.setItem(this.SESSION_SIM_MODE, mode);
    } catch (error) {
      console.error('Error saving simulation mode:', error);
    }
  }
  
  /**
   * Remove simulation mode from session storage
   */
  static removeSimulationMode(): void {
    try {
      sessionStorage.removeItem(this.SESSION_SIM_MODE);
    } catch (error) {
      console.error('Error removing simulation mode:', error);
    }
  }
  
  // ============================================================================
  // SESSION STORAGE - RESULT ID
  // ============================================================================
  
  /**
   * Get result ID from session storage
   */
  static getResultId(): string | null {
    try {
      return sessionStorage.getItem(this.SESSION_RESULT_ID);
    } catch (error) {
      console.error('Error loading result ID:', error);
      return null;
    }
  }
  
  /**
   * Save result ID to session storage
   */
  static setResultId(id: string | number): void {
    try {
      sessionStorage.setItem(this.SESSION_RESULT_ID, String(id));
    } catch (error) {
      console.error('Error saving result ID:', error);
    }
  }
  
  /**
   * Remove result ID from session storage
   */
  static removeResultId(): void {
    try {
      sessionStorage.removeItem(this.SESSION_RESULT_ID);
    } catch (error) {
      console.error('Error removing result ID:', error);
    }
  }
  
  // ============================================================================
  // SESSION STORAGE - PASSWORD RECOVERY
  // ============================================================================
  
  /**
   * Get password recovery flag from session storage
   */
  static getPasswordRecoveryFlag(): string | null {
    try {
      return sessionStorage.getItem(this.SESSION_PWD_RECOVERY);
    } catch (error) {
      console.error('Error loading password recovery flag:', error);
      return null;
    }
  }
  
  /**
   * Remove password recovery flag from session storage
   */
  static removePasswordRecoveryFlag(): void {
    try {
      sessionStorage.removeItem(this.SESSION_PWD_RECOVERY);
    } catch (error) {
      console.error('Error removing password recovery flag:', error);
    }
  }
  
  // ============================================================================
  // SESSION STORAGE - BULK OPERATIONS
  // ============================================================================
  
  /**
   * Clear all simulation-related session data
   */
  static clearSimulationSession(): void {
    this.removeSelectedCase();
    this.removeInitialPatientMessage();
    this.removePreloadedEvaluation();
    this.removeSimulationMode();
    this.removeResultId();
  }
  
  // ============================================================================
  // CACHE MANAGEMENT - PROFILE
  // ============================================================================
  
  /**
   * Get profile cache
   */
  static getProfileCache(): CachedData<ProfileCacheData> | null {
    try {
      const data = localStorage.getItem(this.PROFILE_CACHE_KEY);
      if (!data) return null;
      return JSON.parse(data);
    } catch (error) {
      console.error('Error loading profile cache:', error);
      return null;
    }
  }
  
  /**
   * Save profile cache
   */
  static setProfileCache(data: ProfileCacheData): void {
    try {
      const cached: CachedData<ProfileCacheData> = {
        ts: Date.now(),
        data
      };
      localStorage.setItem(this.PROFILE_CACHE_KEY, JSON.stringify(cached));
    } catch (error) {
      console.error('Error saving profile cache:', error);
    }
  }
  
  /**
   * Get profile display cache
   */
  static getProfileDisplayCache(): CachedData<ProfileCacheData> | null {
    try {
      const data = localStorage.getItem(this.PROFILE_DISPLAY_CACHE_KEY);
      if (!data) return null;
      return JSON.parse(data);
    } catch (error) {
      console.error('Error loading profile display cache:', error);
      return null;
    }
  }
  
  /**
   * Save profile display cache
   */
  static setProfileDisplayCache(data: ProfileCacheData): void {
    try {
      const cached: CachedData<ProfileCacheData> = {
        ts: Date.now(),
        data
      };
      localStorage.setItem(this.PROFILE_DISPLAY_CACHE_KEY, JSON.stringify(cached));
    } catch (error) {
      console.error('Error saving profile display cache:', error);
    }
  }
  
  // ============================================================================
  // CACHE MANAGEMENT - SDD
  // ============================================================================
  
  /**
   * Get SDD cache
   */
  static getSddCache(): CachedData<any[]> | null {
    try {
      const data = localStorage.getItem(this.SDD_CACHE_KEY);
      if (!data) return null;
      return JSON.parse(data);
    } catch (error) {
      console.error('Error loading SDD cache:', error);
      return null;
    }
  }
  
  /**
   * Save SDD cache
   */
  static setSddCache(data: any[]): void {
    try {
      const cached: CachedData<any[]> = {
        ts: Date.now(),
        data
      };
      localStorage.setItem(this.SDD_CACHE_KEY, JSON.stringify(cached));
    } catch (error) {
      console.error('Error saving SDD cache:', error);
    }
  }
  
  // ============================================================================
  // CACHE MANAGEMENT - STATION PROGRESS
  // ============================================================================
  
  /**
   * Get station progress cache
   */
  static getStationProgressCache(): CachedData<any[]> | null {
    try {
      const data = localStorage.getItem(this.STATION_PROGRESS_CACHE_KEY);
      if (!data) return null;
      return JSON.parse(data);
    } catch (error) {
      console.error('Error loading station progress cache:', error);
      return null;
    }
  }
  
  /**
   * Save station progress cache
   */
  static setStationProgressCache(data: any[]): void {
    try {
      const cached: CachedData<any[]> = {
        ts: Date.now(),
        data
      };
      localStorage.setItem(this.STATION_PROGRESS_CACHE_KEY, JSON.stringify(cached));
    } catch (error) {
      console.error('Error saving station progress cache:', error);
    }
  }
  
  // ============================================================================
  // CACHE MANAGEMENT - LAST FIRST NAME
  // ============================================================================
  
  /**
   * Get last first name cache
   */
  static getLastFirstNameCache(): { name: string; ts: number } | null {
    try {
      const data = localStorage.getItem(this.LAST_FIRSTNAME_CACHE_KEY);
      if (!data) return null;
      return JSON.parse(data);
    } catch (error) {
      console.error('Error loading last first name cache:', error);
      return null;
    }
  }
  
  /**
   * Save last first name cache
   */
  static setLastFirstNameCache(name: string): void {
    try {
      const cached = {
        name,
        ts: Date.now()
      };
      localStorage.setItem(this.LAST_FIRSTNAME_CACHE_KEY, JSON.stringify(cached));
    } catch (error) {
      console.error('Error saving last first name cache:', error);
    }
  }
  
  // ============================================================================
  // CACHE MANAGEMENT - LAST RECOMMENDED SDD
  // ============================================================================
  
  /**
   * Get last recommended SDD cache
   */
  static getLastRecommendedSdd(): CachedData<any> | null {
    try {
      const data = localStorage.getItem(this.LAST_RECOMMENDED_SDD_KEY);
      if (!data) return null;
      return JSON.parse(data);
    } catch (error) {
      console.error('Error loading last recommended SDD:', error);
      return null;
    }
  }
  
  /**
   * Save last recommended SDD cache
   */
  static setLastRecommendedSdd(data: any): void {
    try {
      const cached: CachedData<any> = {
        ts: Date.now(),
        data
      };
      localStorage.setItem(this.LAST_RECOMMENDED_SDD_KEY, JSON.stringify(cached));
    } catch (error) {
      console.error('Error saving last recommended SDD:', error);
    }
  }
  
  // ============================================================================
  // UTILITY METHODS
  // ============================================================================
  
  /**
   * Check if cached data is still valid (not expired)
   * @param cachedData Cached data with timestamp
   * @param maxAgeMs Maximum age in milliseconds
   */
  static isCacheValid<T>(cachedData: CachedData<T> | null, maxAgeMs: number): boolean {
    if (!cachedData) return false;
    return (Date.now() - cachedData.ts) < maxAgeMs;
  }
  
  /**
   * Clear all storage (useful for logout or reset)
   */
  static clearAll(): void {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (error) {
      console.error('Error clearing storage:', error);
    }
  }
}
