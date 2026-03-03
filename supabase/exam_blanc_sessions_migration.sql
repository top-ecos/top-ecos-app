-- Run this migration in your Supabase SQL editor to create the exam_blanc_sessions table.

CREATE TABLE public.exam_blanc_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'in_progress',       -- in_progress | completed | abandoned
  sdd_ids UUID[] NOT NULL,                          -- ordered array of 5 SDD UUIDs
  current_sdd_index INTEGER NOT NULL DEFAULT 0,     -- 0-4, tracks progress
  mock_result_ids UUID[],                           -- filled as each evaluation completes
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.exam_blanc_sessions ENABLE ROW LEVEL SECURITY;

-- Users can only see their own sessions
CREATE POLICY "Users can view own exam sessions"
  ON public.exam_blanc_sessions FOR SELECT
  USING (auth.uid() = user_id);

-- Only service role can insert (edge function uses service role key)
CREATE POLICY "Service role can insert exam sessions"
  ON public.exam_blanc_sessions FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service role can update exam sessions"
  ON public.exam_blanc_sessions FOR UPDATE
  USING (true);

-- Index for fast user lookups
CREATE INDEX exam_blanc_sessions_user_id_idx ON public.exam_blanc_sessions(user_id);
CREATE INDEX exam_blanc_sessions_status_idx ON public.exam_blanc_sessions(status);
