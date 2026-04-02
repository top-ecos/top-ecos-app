import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Profile } from '@/shared/types/profile.types';
import { StorageManager } from '@/shared/lib/storage';
import { isUserPremium } from '@/shared/lib/premium';

export const useProfile = () => {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

  const updateTokens = (newTokenCount: number) => {
    setProfile(prev => prev ? { ...prev, tokens: newTokenCount } : null);
  };

  const refreshProfile = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id,user_id,first_name,last_name,level,tokens,created_at,updated_at,pseudo,phone,premium,emoji,trial_ends_at,access_expires_at,paywall_cta_clicked')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching profile:', error);
        return;
      }

      if (data) {
        const profileData: Profile = {
          ...data,
          premium: data.premium ?? false,
        };
        setProfile(profileData);
        StorageManager.setProfileCache(profileData);
      }
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
      const cached = StorageManager.getProfileCache();
      if (cached && StorageManager.isCacheValid(cached, CACHE_TTL_MS)) {
        const data = cached.data;
        const hasEssential = data && typeof data.tokens === 'number' && typeof data.premium !== 'undefined';
        if (hasEssential) {
          // Warm UI with cached profile but keep loading=true until network revalidation finishes
          setProfile(data as Profile);
        }
      }

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id,user_id,first_name,last_name,level,tokens,created_at,updated_at,pseudo,phone,premium,emoji,trial_ends_at,access_expires_at,paywall_cta_clicked')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) {
          console.error('Error fetching profile:', error);
          return;
        }

        if (data) {
          const profileData: Profile = {
            ...data,
            premium: data.premium ?? false,
          };
          setProfile(profileData);
          StorageManager.setProfileCache(profileData);
        }
      } catch (error) {
        console.error('Error fetching profile:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [user]);

  // Compute premium access (includes subscription, trial, and one-time purchases)
  const hasPremiumAccess = useMemo(() => isUserPremium(profile), [profile]);

  return { profile, loading, updateTokens, refreshProfile, hasPremiumAccess };
};
