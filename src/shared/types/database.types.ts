/**
 * Database-related types for Supabase queries and responses
 */

export interface DatabaseError {
  message: string;
  code?: string;
  details?: string;
  hint?: string;
}

export interface SupabaseResponse<T> {
  data: T | null;
  error: DatabaseError | null;
}

export interface PaginatedResponse<T> {
  data: T[];
  count: number | null;
  error: DatabaseError | null;
}

export type QueryStatus = 'idle' | 'loading' | 'success' | 'error';
