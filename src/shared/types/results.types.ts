/**
 * Types for session results and history
 */

import { EvaluationResult } from '@/features/evaluation/types/evaluation.types';

export interface SessionResult {
  id: string;
  user_id: string;
  sdd_id: string;
  score_clinique: number;
  score_communication: number;
  note_finale: number;
  actions_reussies: string[] | Array<{ action: string; extrait: string }>;
  actions_manquees: string[];
  communication_details: Record<string, number>;
  feedback: string;
  score_phase_1: number | null;
  score_phase_2: number | null;
  transcript_json: Array<{ role: string; content: string; timestamp?: string }> | null;
  created_at: string;
  station_name: string | null;
  station_type: string | null;
}

export interface SessionHistoryItem {
  id: string;
  sdd_id: string;
  station_name: string;
  station_type: string;
  note_finale: number;
  created_at: string;
  evaluation: EvaluationResult;
}

export interface ResultsGroupedByStation {
  [sdd_id: string]: SessionResult[];
}

export interface StationProgress {
  sdd_id: string;
  isCompleted: boolean;
  attempts: number;
  bestScore: number | null;
  lastAttemptDate: string | null;
}
