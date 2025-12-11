import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface MockResult {
  id: string;
  user_id: string;
  station_id: string;
  station_title: string;
  typologie: string;
  score: number;
  feedback: string | null;
  duration_minutes: number | null;
  created_at: string;
  // Enhanced analytics fields
  transcript_json: any;
  score_clinique: number | null;
  score_communication: number | null;
  score_phase_1: number | null;
  score_phase_2: number | null;
  evaluation_details: any;
  session_start_time: string | null;
  evaluation_time: string | null;
  message_count: number | null;
  avg_response_time_seconds: number | null;
  mistakes_count: number | null;
  station_difficulty: string | null;
  ai_model_version: string | null;
  student_level: string | null;
  sdd_specialite?: string | null;
}

interface ResultsStats {
  totalSessions: number;
  averageScore: number;
  timeSpent: number; // in minutes
  lastSessionDate: string | null;
  sessionsByType: Record<string, { count: number; averageScore: number }>;
  // Enhanced analytics
  totalMessages: number;
  averageResponseTime: number | null;
  totalMistakes: number;
  difficultyBreakdown: Record<string, { count: number; averageScore: number }>;
  subscoreAverages: {
    clinique: number | null;
    communication: number | null;
    phase1: number | null;
    phase2: number | null;
  };
}

type UseResultsOptions = {
  lite?: boolean;
  limit?: number;
};

export const useResults = (options: UseResultsOptions = {}) => {
  const [results, setResults] = useState<MockResult[]>([]);
  const [stats, setStats] = useState<ResultsStats | null>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const fetchResults = useCallback(async () => {
    if (!user) {
      setResults([]);
      setStats(null);
      setLoading(false);
      return;
    }

    try {
      const lite = options.lite === true;
      const limit = typeof options.limit === 'number' ? options.limit : undefined;

      const liteSelect = `
          id,
          user_id,
          station_id,
          station_title,
          typologie,
          sdd_specialite,
          score,
          duration_minutes,
          created_at
      `;

      const fullSelect = `
          id,
          user_id,
          station_id,
          station_title,
          typologie,
          sdd_specialite,
          score,
          feedback,
          duration_minutes,
          created_at,
          transcript_json,
          score_clinique,
          score_communication,
          score_phase_1,
          score_phase_2,
          evaluation_details,
          session_start_time,
          evaluation_time,
          message_count,
          avg_response_time_seconds,
          mistakes_count,
          station_difficulty,
          ai_model_version,
          student_level
      `;

      let query = supabase
        .from('mock_results')
        .select(lite ? liteSelect : fullSelect)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (limit && limit > 0) {
        query = query.limit(limit);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching results:', error);
        return;
      }

      setResults(data || []);
      
      // Calculate stats only in full mode; otherwise set basic defaults
      if (!lite) {
        if (data && data.length > 0) {
          const totalSessions = data.length;
          const totalScore = data.reduce((sum, result) => sum + result.score, 0);
          const averageScore = (totalScore / totalSessions);
          const totalTime = data.reduce((sum, result) => sum + (result.duration_minutes || 0), 0);
          const lastSessionDate = data[0]?.created_at || null;

          // Group by type
          const sessionsByType: Record<string, { count: number; totalScore: number }> = {};
          (data as any).forEach((result: any) => {
            if (!sessionsByType[result.typologie]) {
              sessionsByType[result.typologie] = { count: 0, totalScore: 0 };
            }
            sessionsByType[result.typologie].count++;
            sessionsByType[result.typologie].totalScore += result.score;
          });

          const sessionsByTypeWithAverage = Object.entries(sessionsByType).reduce((acc, [type, stats]) => {
            acc[type] = {
              count: stats.count,
              averageScore: stats.totalScore / stats.count
            };
            return acc;
          }, {} as Record<string, { count: number; averageScore: number }>);

          // Enhanced analytics
          const totalMessages = (data as any).reduce((sum: number, result: any) => sum + (result.message_count || 0), 0);
          const validResponseTimes = (data as any).filter((r: any) => r.avg_response_time_seconds != null);
          const averageResponseTime = validResponseTimes.length > 0 
            ? validResponseTimes.reduce((sum: number, result: any) => sum + (result.avg_response_time_seconds || 0), 0) / validResponseTimes.length
            : null;
          const totalMistakes = (data as any).reduce((sum: number, result: any) => sum + (result.mistakes_count || 0), 0);

          // Group by difficulty
          const difficultyBreakdown: Record<string, { count: number; totalScore: number }> = {};
          (data as any).forEach((result: any) => {
            const difficulty = result.station_difficulty || 'Unknown';
            if (!difficultyBreakdown[difficulty]) {
              difficultyBreakdown[difficulty] = { count: 0, totalScore: 0 };
            }
            difficultyBreakdown[difficulty].count++;
            difficultyBreakdown[difficulty].totalScore += result.score;
          });

          const difficultyBreakdownWithAverage = Object.entries(difficultyBreakdown).reduce((acc, [difficulty, stats]) => {
            acc[difficulty] = {
              count: stats.count,
              averageScore: stats.totalScore / stats.count
            };
            return acc;
          }, {} as Record<string, { count: number; averageScore: number }>);

          // Subscore averages
          const cliniqueScores = (data as any).filter((r: any) => r.score_clinique != null).map((r: any) => r.score_clinique!);
          const communicationScores = (data as any).filter((r: any) => r.score_communication != null).map((r: any) => r.score_communication!);
          const phase1Scores = (data as any).filter((r: any) => r.score_phase_1 != null).map((r: any) => r.score_phase_1!);
          const phase2Scores = (data as any).filter((r: any) => r.score_phase_2 != null).map((r: any) => r.score_phase_2!);

          setStats({
            totalSessions,
            averageScore,
            timeSpent: totalTime,
            lastSessionDate,
            sessionsByType: sessionsByTypeWithAverage,
            totalMessages,
            averageResponseTime,
            totalMistakes,
            difficultyBreakdown: difficultyBreakdownWithAverage,
            subscoreAverages: {
              clinique: cliniqueScores.length > 0 ? cliniqueScores.reduce((sum, score) => sum + score, 0) / cliniqueScores.length : null,
              communication: communicationScores.length > 0 ? communicationScores.reduce((sum, score) => sum + score, 0) / communicationScores.length : null,
              phase1: phase1Scores.length > 0 ? phase1Scores.reduce((sum, score) => sum + score, 0) / phase1Scores.length : null,
              phase2: phase2Scores.length > 0 ? phase2Scores.reduce((sum, score) => sum + score, 0) / phase2Scores.length : null,
            }
          });
        } else {
          setStats({
            totalSessions: 0,
            averageScore: 0,
            timeSpent: 0,
            lastSessionDate: null,
            sessionsByType: {},
            totalMessages: 0,
            averageResponseTime: null,
            totalMistakes: 0,
            difficultyBreakdown: {},
            subscoreAverages: {
              clinique: null,
              communication: null,
              phase1: null,
              phase2: null,
            }
          });
        }
      } else {
        // Lite mode: skip heavy stats
        setStats(null);
      }
    } catch (error) {
      console.error('Error fetching results:', error);
    } finally {
      setLoading(false);
    }
  }, [user, options.lite, options.limit]);

  const saveResult = async (
    stationId: string,
    stationTitle: string,
    typologie: string,
    score: number,
    feedback?: string,
    durationMinutes?: number,
    enhancedData?: {
      transcript_json?: any;
      score_clinique?: number;
      score_communication?: number;
      score_phase_1?: number;
      score_phase_2?: number;
      evaluation_details?: any;
      session_start_time?: string;
      evaluation_time?: string;
      message_count?: number;
      avg_response_time_seconds?: number;
      mistakes_count?: number;
      station_difficulty?: string;
      ai_model_version?: string;
      student_level?: string;
    }
  ) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('mock_results')
        .insert({
          user_id: user.id,
          station_id: stationId,
          station_title: stationTitle,
          typologie,
          score,
          feedback,
          duration_minutes: durationMinutes,
          ...enhancedData
        });

      if (error) {
        console.error('Error saving result:', error);
        return;
      }

      // Refresh results
      await fetchResults();
    } catch (error) {
      console.error('Error saving result:', error);
    }
  };

  useEffect(() => {
    fetchResults();
  }, [fetchResults]);

  return { results, stats, loading, saveResult, refreshResults: fetchResults };
};
