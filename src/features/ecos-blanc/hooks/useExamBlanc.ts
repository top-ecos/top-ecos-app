import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/shared/contexts/AuthContext';
import { useProfile } from '@/shared/hooks/useProfile';
import type { CaseData } from '@/features/station/types/sdd.types';
import type { EvaluationResult } from '@/features/evaluation/types/evaluation.types';
import type { Message } from '@/features/chat/types/message.types';
import { evaluateStation } from '../lib/evaluateStation';

export type ExamPhase = 'intro' | 'starting' | 'chatting' | 'cooldown' | 'results';

const COOLDOWN_SECONDS = 120;
const TOTAL_STATIONS = 5;

export const useExamBlanc = () => {
  const [phase, setPhase] = useState<ExamPhase>('intro');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sdds, setSdds] = useState<CaseData[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [evaluationResults, setEvaluationResults] = useState<(EvaluationResult | null)[]>(
    Array(TOTAL_STATIONS).fill(null)
  );
  const [isEvaluatingSlots, setIsEvaluatingSlots] = useState<boolean[]>(
    Array(TOTAL_STATIONS).fill(false)
  );
  const [cooldownRemaining, setCooldownRemaining] = useState(COOLDOWN_SECONDS);
  const [startError, setStartError] = useState<string | null>(null);

  // Refs to avoid stale closures inside setInterval
  const currentIndexRef = useRef(0);
  const sddsRef = useRef<CaseData[]>([]);
  const sessionStartRef = useRef<Date>(new Date());
  const cooldownRef = useRef<ReturnType<typeof setInterval>>();

  // Keep refs in sync
  useEffect(() => { currentIndexRef.current = currentIndex; }, [currentIndex]);
  useEffect(() => { sddsRef.current = sdds; }, [sdds]);

  const { user } = useAuth();
  const { profile, updateTokens, hasPremiumAccess } = useProfile();

  // Advance past the cooldown screen to next SDD or results
  const advanceFromCooldown = useCallback(() => {
    const nextIndex = currentIndexRef.current + 1;
    if (nextIndex >= TOTAL_STATIONS) {
      setPhase('results');
    } else {
      setCurrentIndex(nextIndex);
      sessionStartRef.current = new Date();
      setPhase('chatting');
    }
  }, []);

  // Cooldown countdown timer
  useEffect(() => {
    if (phase !== 'cooldown') {
      if (cooldownRef.current) clearInterval(cooldownRef.current);
      return;
    }

    setCooldownRemaining(COOLDOWN_SECONDS);

    cooldownRef.current = setInterval(() => {
      setCooldownRemaining(prev => {
        if (prev <= 1) {
          clearInterval(cooldownRef.current);
          advanceFromCooldown();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (cooldownRef.current) clearInterval(cooldownRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, currentIndex]); // re-run when entering a new cooldown

  const startExam = useCallback(async () => {
    setStartError(null);
    setPhase('starting');

    try {
      const { data, error } = await supabase.functions.invoke('start-exam-blanc', {});

      if (error) throw new Error(error.message || 'Erreur réseau');

      if (!data?.success) {
        const code = data?.code;
        if (code === 'INSUFFICIENT_TOKENS') {
          throw new Error(
            `Tokens insuffisants. Il vous faut 5 tokens pour commencer un ECOS blanc. ` +
            `(${data.tokens_remaining ?? 0}/5 disponibles)`
          );
        }
        throw new Error(data?.error || "Erreur lors du démarrage de l'examen");
      }

      setSessionId(data.session_id);
      setSdds(data.sdds as CaseData[]);
      setCurrentIndex(0);
      setEvaluationResults(Array(TOTAL_STATIONS).fill(null));
      setIsEvaluatingSlots(Array(TOTAL_STATIONS).fill(false));
      updateTokens(data.tokens_remaining);
      sessionStartRef.current = new Date();
      setPhase('chatting');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur lors du démarrage";
      setStartError(msg);
      setPhase('intro');
    }
  }, [updateTokens]);

  const handleSDDComplete = useCallback((messages: Message[]) => {
    const idx = currentIndexRef.current;
    const caseData = sddsRef.current[idx];
    const startTime = sessionStartRef.current;

    // Move to cooldown immediately so student sees the transition
    setPhase('cooldown');

    if (!user || !caseData) return;

    // Mark this slot as evaluating
    setIsEvaluatingSlots(prev => {
      const next = [...prev];
      next[idx] = true;
      return next;
    });

    // Fire background evaluation — runs during cooldown
    evaluateStation({
      caseData,
      messages,
      userId: user.id,
      userLevel: profile?.level ?? null,
      hasPremiumAccess,
      sessionStartTime: startTime,
    })
      .then(result => {
        setEvaluationResults(prev => {
          const next = [...prev];
          next[idx] = result;
          return next;
        });
      })
      .catch(err => {
        console.error(`[ECOS blanc] Evaluation failed for station ${idx + 1}:`, err);
        // Leave the slot as null — results screen will show an error state
      })
      .finally(() => {
        setIsEvaluatingSlots(prev => {
          const next = [...prev];
          next[idx] = false;
          return next;
        });
      });
  }, [user, profile, hasPremiumAccess]);

  const skipCooldown = useCallback(() => {
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    advanceFromCooldown();
  }, [advanceFromCooldown]);

  const resetExamState = useCallback(() => {
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    setPhase('intro');
    setSessionId(null);
    setSdds([]);
    setCurrentIndex(0);
    setEvaluationResults(Array(TOTAL_STATIONS).fill(null));
    setIsEvaluatingSlots(Array(TOTAL_STATIONS).fill(false));
    setStartError(null);
  }, []);

  const quitExam = resetExamState;

  const restartExam = useCallback(() => {
    resetExamState();
    // startExam() will be called when user clicks the start button again
  }, [resetExamState]);

  return {
    phase,
    sessionId,
    sdds,
    currentIndex,
    evaluationResults,
    isEvaluatingSlots,
    cooldownRemaining,
    startError,
    totalStations: TOTAL_STATIONS,
    isLastStation: currentIndex === TOTAL_STATIONS - 1,
    startExam,
    handleSDDComplete,
    skipCooldown,
    quitExam,
    restartExam,
  };
};
