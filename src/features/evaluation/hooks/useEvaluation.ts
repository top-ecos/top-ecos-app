
import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/shared/contexts/AuthContext";
import { useProfile } from "@/shared/hooks/useProfile";
import { Message } from "@/features/chat/types/message.types";
import { CaseData } from "@/features/station/types/sdd.types";
import { EvaluationResult } from "@/features/evaluation/types/evaluation.types";

export const useEvaluation = (caseData: CaseData, messages: Message[]) => {
  const [evaluationResult, setEvaluationResult] = useState<EvaluationResult | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [sessionStartTime] = useState(new Date());
  const { user } = useAuth();
  const { profile } = useProfile();

  const evaluatePerformance = useCallback(async () => {
    setIsEvaluating(true);
    try {
      const conversationHistory = messages.filter(m => m.role !== 'system').map(m => ({
        role: m.role,
        content: m.content
      }));

      // Choisir la bonne Edge Function selon le type de station et l'environnement
      const useGPT5 = import.meta.env.VITE_USE_GPT5_EVALUATION === 'true';
      const isPremium = profile?.premium || false;

      let functionName: string;
      if (caseData.Type_de_station === 'Sèche') {
        functionName = useGPT5 ? 'evaluate-performance-seche-dev' : 'evaluate-performance-seche';
      } else {
        // Use premium function for premium users when GPT5 is enabled
        functionName = (useGPT5 && isPremium) 
          ? 'evaluate-performance-dev-premium' 
          : (useGPT5 ? 'evaluate-performance-dev' : 'evaluate-performance');
      }

      const { data, error } = await supabase.functions.invoke(functionName, {
        body: {
          sddData: caseData,
          conversationHistory: conversationHistory
        }
      });

      if (error) {
        console.error('Evaluation error:', error);
        throw error;
      }
      // Serialize messages for JSON storage / replay
      const transcriptData = messages
        .filter(m => m.role !== 'system')
        .map(m => ({
          role: m.role,
          content: m.content,
          timestamp: m.timestamp.toISOString()
        }));

      // Expose transcript_json in the in-memory evaluation result for replay
      setEvaluationResult({ ...(data as EvaluationResult), transcript_json: transcriptData });

      // Save result to database if user is authenticated
      if (user && data) {
        try {
          // Calculate session metrics
          const sessionEndTime = new Date();
          const durationMs = sessionEndTime.getTime() - sessionStartTime.getTime();
          const durationMinutes = Math.round(durationMs / (1000 * 60));
          const messageCount = messages.filter(m => m.role !== 'system').length;
          const avgResponseTime = messageCount > 1 ? Math.round(durationMs / messageCount / 1000) : null;
          
          // Extract difficulty from station type or data
          const stationDifficulty = caseData.Type_de_station || 'A';
          
          // Count mistakes from evaluation data
          const mistakesCount = data.actions_manquees?.length || 0;

          // transcriptData already computed above

      await supabase
        .from('mock_results')
        .insert({
          user_id: user.id,
          station_id: caseData.sdd_id, // Use UUID as text
          station_title: caseData.sdd_titre || `Station ${caseData.sdd_id}`,
          typologie: caseData.Type_de_station || 'PS',
          score: Number(data.note_finale || data.score || 0),
          feedback: data.feedback || `Score obtenu: ${data.note_finale || data.score || 0}/20`,
          duration_minutes: durationMinutes,
          // Enhanced analytics fields
          transcript_json: transcriptData,
          station_code: caseData.station_code || null, // Add missing field
          score_clinique: data.score_clinique ? Number(data.score_clinique) : null,
          score_communication: data.score_communication ? Number(data.score_communication) : null,
          score_phase_1: data.score_phase_1 ? Number(data.score_phase_1) : null,
          score_phase_2: data.score_phase_2 ? Number(data.score_phase_2) : null,
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
              avg_response_time_seconds: avgResponseTime,
              mistakes_count: mistakesCount,
              station_difficulty: stationDifficulty,
              ai_model_version: 'gpt-4',
              student_level: profile?.level || null
            });
        } catch (saveError) {
          console.error("Erreur lors de la sauvegarde:", saveError);
        }
      }
    } catch (error) {
      console.error('Error evaluating performance:', error);
      alert('Erreur lors de l\'évaluation. Veuillez réessayer.');
    } finally {
      setIsEvaluating(false);
    }
  }, [caseData, messages, user, sessionStartTime, profile?.level]);

  const saveResults = useCallback(async (evaluationData: EvaluationResult) => {
    try {
      const { data, error } = await supabase.functions.invoke('save-results-mock', {
        body: {
          sddId: caseData?.sdd_id,
          stationType: caseData?.Type_de_station,
          ...evaluationData,
          sessionDuration: '8 minutes', // Mock duration
          timestamp: new Date().toISOString()
        }
      });

      if (error) {
        console.error('Error saving results:', error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error in saveResults:', error);
      throw error;
    }
  }, [caseData]);

  return {
    evaluationResult,
    isEvaluating,
    evaluatePerformance,
    saveResults
  };
};
