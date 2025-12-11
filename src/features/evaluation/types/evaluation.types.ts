export type TranscriptMessage = {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: string;
};

export interface EvaluationResult {
  score_clinique: number;
  score_communication: number;
  note_finale: number;
  actions_reussies: (string | { action: string; extrait: string })[];
  actions_manquees: string[];
  communication_details: Record<string, number>;
  feedback: string;

  // Optional extended fields present in stored results
  score_phase_1?: number | null;
  score_phase_2?: number | null;
  transcript_json?: TranscriptMessage[];
}

