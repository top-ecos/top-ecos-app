/**
 * Storage-related types for localStorage/sessionStorage management
 */

import { Message } from '@/features/chat/types/message.types';
import { CaseData } from '@/features/station/types/sdd.types';

export interface StoredTimerState {
  timeRemaining: number;
  isPaused: boolean;
  isTimeUp: boolean;
}

export interface StoredChatData {
  messages: Message[];
  timerState: StoredTimerState;
}

export interface CachedData<T> {
  ts: number;
  data: T;
}

export type StorageKey = 
  | `chat_messages_${string}`
  | `timer_state_${string}`
  | `consignes_shown_${string}`
  | `sddCacheV2`
  | `profileCacheV1`
  | 'selectedCase';

export interface StorageManager {
  getChatMessages(stationId: string): Message[] | null;
  saveChatMessages(stationId: string, messages: Message[]): void;
  getTimerState(stationId: string): StoredTimerState | null;
  saveTimerState(stationId: string, state: StoredTimerState): void;
  getSelectedCase(): CaseData | null;
  setSelectedCase(caseData: CaseData): void;
  clearStationData(stationId: string): void;
}
