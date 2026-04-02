/**
 * Profile and user-related types
 */

export interface Profile {
  id: string;
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  level: string;
  premium: boolean;
  tokens: number;
  pseudo: string | null;
  phone: string | null;
  emoji: string | null;
  trial_ends_at?: string | null;
  access_expires_at?: string | null;
  paywall_cta_clicked?: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserProfile extends Profile {
  // Computed fields
  fullName?: string;
  displayName?: string;
}

export type ProfileUpdateFields = Partial<Omit<Profile, 'id' | 'user_id' | 'created_at' | 'updated_at'>>;
