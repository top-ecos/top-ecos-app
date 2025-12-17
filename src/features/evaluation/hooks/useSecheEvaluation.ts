import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/shared/contexts/AuthContext";
import { useProfile } from "@/shared/hooks/useProfile";
import { CaseData } from "@/features/station/types/sdd.types";
import { EvaluationResult } from "@/features/evaluation/types/evaluation.types";

interface SecheMessage {
  role: 'user';
  content: string;
  timestamp: string;
}

export const useSecheEvaluation = (caseData: CaseData) => {
  const [evaluationResult, setEvaluationResult] = useState<EvaluationResult | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [sessionStartTime] = useState(new Date());
  const { user } = useAuth();
  const { profile } = useProfile();

  const evaluatePerformance = useCallback(async (conversationHistory: SecheMessage[]) => {
    setIsEvaluating(true);
    try {
      const useGPT5 = import.meta.env.VITE_USE_GPT5_EVALUATION === 'true';
      const functionName = useGPT5 ? 'evaluate-performance-seche-dev' : 'evaluate-performance-seche';
      
      const { data, error } = await supabase.functions.invoke(functionName, {
        body: {
          sddData: caseData,
          conversationHistory: conversationHistory
        }
      });

      if (error) {
        console.error('Seche evaluation error:', error);
        throw error;
      }
      // Prepare transcript for replay and DB
      const transcriptData = conversationHistory.map(m => ({
        role: m.role,
        content: m.content,
        timestamp: m.timestamp
      }));

      // Attach transcript_json to the in-memory result for replay
      setEvaluationResult({ ...(data as EvaluationResult), transcript_json: transcriptData });

      // Save result to database if user is authenticated
      if (user && data) {
        try {
          // Calculate session metrics
          const sessionEndTime = new Date();
          const durationMs = sessionEndTime.getTime() - sessionStartTime.getTime();
          const durationMinutes = Math.round(durationMs / (1000 * 60));
          const messageCount = conversationHistory.length;
          
          // Extract difficulty from station type or data
          const stationDifficulty = 'C'; // Seche stations are typically Type C
          
          // Count mistakes from evaluation data
          const mistakesCount = data.actions_manquees?.length || 0;

          // transcriptData already computed above

      await supabase
        .from('mock_results')
        .insert({
          user_id: user.id,
          station_id: caseData.sdd_id, // Use UUID as text
          station_title: caseData.sdd_titre || `Station ${caseData.sdd_id}`,
          typologie: 'Sèche',
          score: Number(data.note_finale || data.score || 0),
          feedback: data.feedback || `Analyse de document - Score: ${data.note_finale || data.score || 0}/20`,
          duration_minutes: durationMinutes,
          // Enhanced analytics fields
          transcript_json: transcriptData,
          station_code: caseData.station_code || null, // Add missing field
          score_clinique: data.score_clinique ? Number(data.score_clinique) : null,
          score_communication: data.score_communication ? Number(data.score_communication) : null,
          score_phase_1: data.score_phase_1 ? Number(data.score_phase_1) : null, // Add missing field
          score_phase_2: data.score_phase_2 ? Number(data.score_phase_2) : null, // Add missing field
          // Additional SDD metadata
          official_id: caseData.official_id || null,
          sdd_specialite: (caseData.sdd_specialite || caseData.specialite) || null,
          evaluation_details: {
            actions_reussies: data.actions_reussies || [],
            actions_manquees: data.actions_manquees || [],
            communication_details: data.communication_details || null
          },
          ai_recommendations: data.ai_recommendations || null,
          session_start_time: sessionStartTime.toISOString(),
              evaluation_time: sessionEndTime.toISOString(),
              message_count: messageCount,
              avg_response_time_seconds: messageCount > 0 ? Math.round(durationMs / messageCount / 1000) : null,
              mistakes_count: mistakesCount,
              station_difficulty: stationDifficulty,
              ai_model_version: 'gpt-4',
              student_level: profile?.level || null
            });
        } catch (saveError) {
          console.error("Erreur lors de la sauvegarde Sèche:", saveError);
        }
      }
      
      return data;
    } catch (error) {
      console.error('Error evaluating seche performance:', error);
      alert('Erreur lors de l\'évaluation. Veuillez réessayer.');
      throw error;
    } finally {
      setIsEvaluating(false);
    }
  }, [caseData, user, sessionStartTime, profile?.level]);

  return {
    evaluationResult,
    isEvaluating,
    evaluatePerformance
  };
};
