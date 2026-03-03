import { supabase } from "@/integrations/supabase/client";
import { getStationType } from "@/features/station/lib/station";
import type { CaseData } from "@/features/station/types/sdd.types";
import type { EvaluationResult } from "@/features/evaluation/types/evaluation.types";
import type { Message } from "@/features/chat/types/message.types";

type ConversationMessage = {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
};

function getEvalFunctionName(caseData: CaseData, hasPremiumAccess: boolean): string {
  const useGPT5 = import.meta.env.VITE_USE_GPT5_EVALUATION === 'true';
  const stationType = getStationType(caseData);
  const isSeche = stationType === 'Sèche';

  if (isSeche) {
    if (useGPT5 && hasPremiumAccess) return 'evaluate-performance-seche-dev-premium';
    return useGPT5 ? 'evaluate-performance-seche-dev' : 'evaluate-performance-seche';
  }

  if (useGPT5 && hasPremiumAccess) return 'evaluate-performance-dev-premium';
  return useGPT5 ? 'evaluate-performance-dev' : 'evaluate-performance';
}

export interface EvaluateStationParams {
  caseData: CaseData;
  messages: Message[];
  userId: string;
  userLevel: string | null;
  hasPremiumAccess: boolean;
  sessionStartTime: Date;
}

/**
 * Standalone evaluation function for use outside React hooks.
 * Calls the appropriate edge function, saves to mock_results, and returns the result.
 * Used by useExamBlanc to evaluate each SDD in the background.
 */
export async function evaluateStation(params: EvaluateStationParams): Promise<EvaluationResult> {
  const { caseData, messages, userId, userLevel, hasPremiumAccess, sessionStartTime } = params;

  const conversationHistory: ConversationMessage[] = messages
    .filter(m => m.role !== 'system')
    .map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
      timestamp: m.timestamp instanceof Date ? m.timestamp.toISOString() : String(m.timestamp),
    }));

  const functionName = getEvalFunctionName(caseData, hasPremiumAccess);

  const { data, error } = await supabase.functions.invoke(functionName, {
    body: { sddData: caseData, conversationHistory }
  });

  if (error) throw error;

  const result = data as EvaluationResult;
  const stationType = getStationType(caseData);
  const isSeche = stationType === 'Sèche';

  const sessionEndTime = new Date();
  const durationMs = sessionEndTime.getTime() - sessionStartTime.getTime();
  const durationMinutes = Math.round(durationMs / (1000 * 60));
  const messageCount = conversationHistory.length;
  const avgResponseTime = messageCount > 1 ? Math.round(durationMs / messageCount / 1000) : null;

  const typologie = isSeche ? 'Sèche' : (caseData.Type_de_station || 'PS');
  const stationDifficulty = isSeche ? 'C' : (caseData.Type_de_station || 'A');

  await supabase.from('mock_results').insert({
    user_id: userId,
    station_id: caseData.sdd_id,
    station_title: caseData.sdd_titre || `Station ${caseData.sdd_id}`,
    typologie,
    score: Number(result.note_finale || result.score || 0),
    feedback: result.feedback || `Score: ${result.note_finale || 0}/20`,
    duration_minutes: durationMinutes,
    transcript_json: conversationHistory,
    station_code: caseData.station_code || null,
    score_clinique: result.score_clinique != null ? Number(result.score_clinique) : null,
    score_communication: result.score_communication != null ? Number(result.score_communication) : null,
    score_phase_1: result.score_phase_1 != null ? Number(result.score_phase_1) : null,
    score_phase_2: result.score_phase_2 != null ? Number(result.score_phase_2) : null,
    official_id: caseData.official_id || null,
    sdd_specialite: caseData.sdd_specialite || (caseData.specialite as string) || null,
    evaluation_details: {
      actions_reussies: result.actions_reussies || [],
      actions_manquees: result.actions_manquees || [],
      communication_details: result.communication_details || null,
    },
    ai_recommendations: result.ai_recommendations || null,
    session_start_time: sessionStartTime.toISOString(),
    evaluation_time: sessionEndTime.toISOString(),
    message_count: messageCount,
    avg_response_time_seconds: avgResponseTime,
    mistakes_count: result.actions_manquees?.length || 0,
    station_difficulty: stationDifficulty,
    ai_model_version: 'gpt-4',
    student_level: userLevel || null,
  });

  return { ...result, transcript_json: conversationHistory };
}
