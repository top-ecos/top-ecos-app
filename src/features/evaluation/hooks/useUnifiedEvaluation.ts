import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/shared/contexts/AuthContext";
import { useProfile } from "@/shared/hooks/useProfile";
import { getStationType } from "@/features/station/lib/station";
import { Message, ConversationHistory } from "@/features/chat/types/message.types";
import { CaseData } from "@/features/station/types/sdd.types";
import { EvaluationResult } from "@/features/evaluation/types/evaluation.types";

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
}

/**
 * Unified evaluation hook for all station types (PS, PSS, Sèche)
 * Consolidates useEvaluation and useSecheEvaluation into a single hook
 * with intelligent type detection and strategy pattern
 */
export const useUnifiedEvaluation = (caseData: CaseData, messages?: Message[]) => {
  const [evaluationResult, setEvaluationResult] = useState<EvaluationResult | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [sessionStartTime] = useState(new Date());
  const { user } = useAuth();
  const { profile } = useProfile();

  // Determine station type once
  const stationType = getStationType(caseData);
  const isSecheStation = stationType === 'Sèche';

  /**
   * Prepare conversation history from messages
   * Handles both interactive (PS/PSS) and document (Sèche) stations
   */
  const prepareConversationHistory = useCallback((providedMessages?: Message[]): ConversationMessage[] => {
    const messagesToUse = providedMessages || messages || [];
    
    return messagesToUse
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
        timestamp: typeof m.timestamp === 'string' 
          ? m.timestamp 
          : m.timestamp.toISOString()
      }));
  }, [messages]);

  /**
   * Get the appropriate edge function name based on station type and environment
   */
  const getEvaluationFunctionName = useCallback((): string => {
    const useGPT5 = import.meta.env.VITE_USE_GPT5_EVALUATION === 'true';
    const isPremium = profile?.premium || false;
    
    if (isSecheStation) {
      // Add premium variant for seche stations
      if (useGPT5 && isPremium) {
        return 'evaluate-performance-seche-dev-premium';
      }
      return useGPT5 ? 'evaluate-performance-seche-dev' : 'evaluate-performance-seche';
    }
    
    // Use premium function for premium users when GPT5 is enabled
    if (useGPT5 && isPremium) {
      return 'evaluate-performance-dev-premium';
    }
    
    return useGPT5 ? 'evaluate-performance-dev' : 'evaluate-performance';
  }, [isSecheStation, profile?.premium]);

  /**
   * Calculate session analytics metrics
   */
  const calculateSessionMetrics = useCallback((messageCount: number) => {
    const sessionEndTime = new Date();
    const durationMs = sessionEndTime.getTime() - sessionStartTime.getTime();
    const durationMinutes = Math.round(durationMs / (1000 * 60));
    const avgResponseTime = messageCount > 1 ? Math.round(durationMs / messageCount / 1000) : null;
    
    return {
      sessionEndTime,
      durationMinutes,
      avgResponseTime
    };
  }, [sessionStartTime]);

  /**
   * Save evaluation results to database with enhanced analytics
   */
  const saveResultsToDatabase = useCallback(async (
    data: EvaluationResult,
    transcriptData: ConversationMessage[]
  ) => {
    if (!user || !data) return;

    try {
      const messageCount = transcriptData.length;
      const { sessionEndTime, durationMinutes, avgResponseTime } = calculateSessionMetrics(messageCount);
      
      // Station difficulty: Sèche stations are typically 'C', others use Type_de_station
      const stationDifficulty = isSecheStation ? 'C' : (caseData.Type_de_station || 'A');
      
      // Determine typologie for display
      const typologie = isSecheStation ? 'Sèche' : (caseData.Type_de_station || 'PS');
      
      // Count mistakes from evaluation data
      const mistakesCount = data.actions_manquees?.length || 0;
      
      // Prepare feedback with station-specific default
      const defaultFeedback = isSecheStation
        ? `Analyse de document - Score: ${data.note_finale || data.score || 0}/20`
        : `Score obtenu: ${data.note_finale || data.score || 0}/20`;

      await supabase
        .from('mock_results')
        .insert({
          user_id: user.id,
          station_id: caseData.sdd_id,
          station_title: caseData.sdd_titre || `Station ${caseData.sdd_id}`,
          typologie,
          score: Number(data.note_finale || data.score || 0),
          feedback: data.feedback || defaultFeedback,
          duration_minutes: durationMinutes,
          // Enhanced analytics fields
          transcript_json: transcriptData,
          station_code: caseData.station_code || null,
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
  }, [user, caseData, sessionStartTime, profile?.level, isSecheStation, calculateSessionMetrics]);

  /**
   * Main evaluation function - works for both interactive and document stations
   * 
   * @param providedMessages - Optional messages array (used for Sèche stations)
   */
  const evaluatePerformance = useCallback(async (providedMessages?: Message[]) => {
    setIsEvaluating(true);
    
    try {
      // Prepare conversation history (handles both station types)
      const conversationHistory = prepareConversationHistory(providedMessages);

      // Get appropriate function name
      const functionName = getEvaluationFunctionName();

      // Invoke evaluation edge function
      const { data, error } = await supabase.functions.invoke(functionName, {
        body: {
          sddData: caseData,
          conversationHistory
        }
      });

      if (error) {
        console.error('Evaluation error:', error);
        throw error;
      }

      // Prepare transcript data for storage and replay
      const transcriptData: ConversationMessage[] = conversationHistory;

      // Expose transcript_json in the in-memory evaluation result for replay
      setEvaluationResult({ ...(data as any), transcript_json: transcriptData });

      // Save to database
      await saveResultsToDatabase(data, transcriptData);

      return data;
    } catch (error) {
      console.error('Error evaluating performance:', error);
      alert('Erreur lors de l\'évaluation. Veuillez réessayer.');
      throw error;
    } finally {
      setIsEvaluating(false);
    }
  }, [
    caseData,
    stationType,
    isSecheStation,
    prepareConversationHistory,
    getEvaluationFunctionName,
    saveResultsToDatabase
  ]);

  /**
   * Legacy saveResults method for backward compatibility
   * @deprecated Use evaluatePerformance directly
   */
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
    saveResults,
    // Expose station type info for convenience
    stationType,
    isSecheStation
  };
};
