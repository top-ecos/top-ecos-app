import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '../contexts/AuthContext';

export type StationProgress = {
  id: string;
  user_id: string;
  station_id: string;
  is_completed: boolean;
  completed_at: string | null;
  last_attempt_at: string | null;
  attempt_count: number | null;
  created_at: string;
  updated_at: string;
};

// Helper function to normalize station ID as string
const normalizeStationId = (stationId: number | string): string => {
  return String(stationId);
};

export const useStationProgress = () => {
  const [progressMap, setProgressMap] = useState<Map<string, StationProgress>>(new Map());
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const CACHE_KEY = 'stationProgressCacheV1';
  const CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

  const persistCache = (map: Map<string, StationProgress>) => {
    try {
      const arr = Array.from(map.values());
      localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data: arr }));
    } catch {}
  };

  // Fetch all user's station progress
  const fetchProgress = useCallback(async (opts?: { withLoading?: boolean }) => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    try {
      if (opts?.withLoading !== false) setLoading(true);
      const { data, error } = await supabase
        .from('user_station_progress')
        .select('id,user_id,station_id,is_completed,completed_at,last_attempt_at,attempt_count,created_at,updated_at')
        .eq('user_id', user.id);

      if (error) {
        console.error('Error fetching station progress:', error);
        return;
      }

      const newProgressMap = new Map<string, StationProgress>();
      data?.forEach((progress) => {
        newProgressMap.set(progress.station_id, progress);
      });

      setProgressMap(newProgressMap);
      persistCache(newProgressMap);
    } catch (error) {
      console.error('Error fetching station progress:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  // Mark a station as completed
  const markStationCompleted = async (stationId: number | string): Promise<boolean> => {
    if (!user?.id) return false;

    try {
      const stationIdStr = normalizeStationId(stationId);
      const existingProgress = progressMap.get(stationIdStr);
      const now = new Date().toISOString();

      if (existingProgress) {
        // Update existing record
        const { error } = await supabase
          .from('user_station_progress')
          .update({
            is_completed: true,
            completed_at: now,
            last_attempt_at: now,
            attempt_count: (existingProgress.attempt_count || 0) + 1,
            updated_at: now
          })
          .eq('id', existingProgress.id);

        if (error) {
          console.error('Error updating station progress:', error);
          return false;
        }

        // Update local state
        const updatedProgress = {
          ...existingProgress,
          is_completed: true,
          completed_at: now,
          last_attempt_at: now,
          attempt_count: (existingProgress.attempt_count || 0) + 1,
          updated_at: now
        };
        setProgressMap(prev => {
          const next = new Map(prev.set(stationIdStr, updatedProgress));
          persistCache(next);
          return next;
        });
      } else {
        // Create new record
        const { data, error } = await supabase
          .from('user_station_progress')
          .insert({
            user_id: user.id,
            station_id: stationIdStr,
            is_completed: true,
            completed_at: now,
            last_attempt_at: now,
            attempt_count: 1
          })
          .select()
          .single();

        if (error) {
          console.error('Error creating station progress:', error);
          return false;
        }

        // Update local state
        setProgressMap(prev => {
          const next = new Map(prev.set(stationIdStr, data));
          persistCache(next);
          return next;
        });
      }

      return true;
    } catch (error) {
      console.error('Error marking station completed:', error);
      return false;
    }
  };

  // Reset station progress
  const resetStationProgress = async (stationId: number | string): Promise<boolean> => {
    if (!user?.id) return false;

    try {
      const stationIdStr = normalizeStationId(stationId);
      const existingProgress = progressMap.get(stationIdStr);

      if (existingProgress?.id) {
        // Delete the existing record
        const { error } = await supabase
          .from('user_station_progress')
          .delete()
          .eq('id', existingProgress.id);

        if (error) {
          console.error('Error deleting station progress:', error);
          return false;
        }

        // Update local state
        const newProgressMap = new Map(progressMap);
        newProgressMap.delete(stationIdStr);
        setProgressMap(newProgressMap);
        persistCache(newProgressMap);
      }

      return true;
    } catch (error) {
      console.error('Error resetting station progress:', error);
      return false;
    }
  };

  // Update last attempt (for when user starts but doesn't complete)
  const updateLastAttempt = async (stationId: number | string): Promise<boolean> => {
    if (!user?.id) return false;

    try {
      const stationIdStr = normalizeStationId(stationId);
      const existingProgress = progressMap.get(stationIdStr);
      const now = new Date().toISOString();

      if (existingProgress) {
        // Update existing record
        const { error } = await supabase
          .from('user_station_progress')
          .update({
            last_attempt_at: now,
            attempt_count: (existingProgress.attempt_count || 0) + 1,
            updated_at: now
          })
          .eq('id', existingProgress.id);

        if (error) {
          console.error('Error updating last attempt:', error);
          return false;
        }

        // Update local state
        const updatedProgress = {
          ...existingProgress,
          last_attempt_at: now,
          attempt_count: (existingProgress.attempt_count || 0) + 1,
          updated_at: now
        };
        setProgressMap(prev => {
          const next = new Map(prev.set(stationIdStr, updatedProgress));
          persistCache(next);
          return next;
        });
      } else {
        // Create new record
        const { data, error } = await supabase
          .from('user_station_progress')
          .insert({
            user_id: user.id,
            station_id: stationIdStr,
            is_completed: false,
            last_attempt_at: now,
            attempt_count: 1
          })
          .select()
          .single();

        if (error) {
          console.error('Error creating station progress:', error);
          return false;
        }

        // Update local state
        setProgressMap(prev => {
          const next = new Map(prev.set(stationIdStr, data));
          persistCache(next);
          return next;
        });
      }

      return true;
    } catch (error) {
      console.error('Error updating last attempt:', error);
      return false;
    }
  };

  // Check if a station is completed
  const isStationCompleted = useCallback((stationId: number | string): boolean => {
    const stationIdStr = normalizeStationId(stationId);
    return progressMap.get(stationIdStr)?.is_completed || false;
  }, [progressMap]);

  // Get station progress
  const getStationProgress = (stationId: number | string): StationProgress | undefined => {
    const stationIdStr = normalizeStationId(stationId);
    return progressMap.get(stationIdStr);
  };

  // Get all completed stations
  const getCompletedStations = (): string[] => {
    return Array.from(progressMap.entries())
      .filter(([, progress]) => progress.is_completed)
      .map(([stationId]) => stationId);
  };

  useEffect(() => {
    // cache-first
    let usedCache = false;
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (raw) {
        const obj = JSON.parse(raw);
        if (obj && typeof obj.ts === 'number' && Array.isArray(obj.data)) {
          const fresh = (Date.now() - obj.ts) < CACHE_TTL_MS;
          if (fresh) {
            const map = new Map<string, StationProgress>();
            (obj.data as StationProgress[]).forEach((p) => map.set(p.station_id, p));
            setProgressMap(map);
            setLoading(false);
            usedCache = true;
          }
        }
      }
    } catch {}

    fetchProgress({ withLoading: usedCache ? false : true });
  }, [fetchProgress]);

  return {
    loading,
    progressMap,
    markStationCompleted,
    resetStationProgress,
    updateLastAttempt,
    isStationCompleted,
    getStationProgress,
    getCompletedStations,
    refetchProgress: fetchProgress
  };
};
