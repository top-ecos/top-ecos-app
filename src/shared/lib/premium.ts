import type { SDD } from "../hooks/useSDD";

const toBool = (v: unknown): boolean => {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase();
    return s === 'true' || s === '1' || s === 'yes';
  }
  return false;
};

/**
 * Check if a user has premium access through any of:
 * - Active premium subscription (premium = true)
 * - Active free trial (trial_ends_at > now)
 * - Active one-time purchase like Season Pass (access_expires_at > now)
 */
export const isUserPremium = (profile: { 
  premium?: unknown; 
  trial_ends_at?: string | null;
  access_expires_at?: string | null;
} | null | undefined): boolean => {
  // Check paid subscription
  if (toBool(profile?.premium)) return true;
  
  const now = new Date();
  
  // Check active trial
  if (profile?.trial_ends_at && new Date(profile.trial_ends_at) > now) return true;
  
  // Check one-time purchase (Season Pass)
  if (profile?.access_expires_at && new Date(profile.access_expires_at) > now) return true;
  
  return false;
};

export const isSddPremium = (sdd: Partial<SDD> | { premium?: unknown }): boolean => {
  return toBool(sdd?.premium);
};

export const filterSddsForUser = (sdds: SDD[], isPremiumUser: boolean): SDD[] => {
  if (isPremiumUser) return sdds;
  return sdds.filter((s) => !isSddPremium(s));
};
