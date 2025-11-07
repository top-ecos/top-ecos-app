import type { SDD } from "@/hooks/useSDD";

const toBool = (v: unknown): boolean => {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase();
    return s === 'true' || s === '1' || s === 'yes';
  }
  return false;
};

export const isUserPremium = (profile: { premium?: any } | null | undefined): boolean => {
  return toBool(profile?.premium);
};

export const isSddPremium = (sdd: Partial<SDD> | { premium?: any } | any): boolean => {
  return toBool((sdd as any)?.premium);
};

export const filterSddsForUser = (sdds: SDD[], isPremiumUser: boolean): SDD[] => {
  if (isPremiumUser) return sdds;
  return sdds.filter((s) => !isSddPremium(s));
};
