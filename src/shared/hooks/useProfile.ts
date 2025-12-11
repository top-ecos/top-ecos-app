import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface Profile {
  id: string;
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  level: string;
  premium?: boolean; // whether user is premium
  tokens: number;
  pseudo?: string | null;
  phone?: string | null;
  emoji?: string | null;
  created_at: string;
  updated_at: string;
}

export const useProfile = () => {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const CACHE_KEY = 'profileCacheV1';
  const CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

  const updateTokens = (newTokenCount: number) => {
    setProfile(prev => prev ? { ...prev, tokens: newTokenCount } : null);
  };

  const refreshProfile = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id,user_id,first_name,last_name,level,tokens,created_at,updated_at,pseudo,phone,premium,emoji')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching profile:', error);
        return;
      }

      setProfile(data as any);
      try { localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data })); } catch {}
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  };

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) {
        setProfile(null);
        setLoading(false);
        return;
      }

      // Try cache-first to avoid UI flashes
      try {
        const raw = localStorage.getItem(CACHE_KEY);
        if (raw) {
          const obj = JSON.parse(raw);
          if (obj && typeof obj.ts === 'number') {
            const fresh = (Date.now() - obj.ts) < CACHE_TTL_MS;
            const data = obj?.data || null;
            const hasEssential = data && typeof data.tokens === 'number' && typeof data.premium !== 'undefined';
            if (fresh && hasEssential) {
              // Warm UI with cached profile but keep loading=true until network revalidation finishes
              setProfile(data as Profile);
            }
          }
        }
      } catch {}

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id,user_id,first_name,last_name,level,tokens,created_at,updated_at,pseudo,phone,premium,emoji')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) {
          console.error('Error fetching profile:', error);
          return;
        }

        setProfile(data as any);
        try { localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data })); } catch {}
      } catch (error) {
        console.error('Error fetching profile:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [user]);

  return { profile, loading, updateTokens, refreshProfile };
};
