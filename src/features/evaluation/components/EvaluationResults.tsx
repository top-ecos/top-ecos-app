import { useCallback, useEffect, useState } from "react";
import { ScoreCard } from "./ScoreCard";
import { ActionsList } from "./ActionsList";
import { CommunicationGrid } from "./CommunicationGrid";
import RecommendationsSection from "./RecommendationsSection";
import { useEvaluationScores } from "../hooks/useEvaluationScores";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/shared/contexts/AuthContext";
import type { ActionStatus } from "../types/evaluation.types";

/* ──────────────────────────── Types ──────────────────────────── */

interface EvaluationResult {
  score_clinique: number;
  score_communication: number;
  note_finale: number;
  actions_reussies: (string | { action: string; extrait: string })[];
  actions_manquees: string[];
  actions_partielles?: (string | { action: string; extrait?: string })[];
  communication_details: Record<string, number>;
  feedback: string;
  ai_recommendations?: {
    intro: string;
    bullets: Array<{ title: string; explanation: string }>;
  } | null;
}

interface EvaluationResultsProps {
  result: EvaluationResult;
  stationTitle: string;
  stationId: string;
  ednItemNumber?: string | null;
  ednItemName?: string | null;
  /** When provided (e.g. from history), skip the "latest row" query and target this row directly */
  mockResultId?: string;
}

/* ──────────────────────────── Helpers ─────────────────────────── */

const getActionText = (a: string | { action: string; extrait?: string }): string =>
  typeof a === 'string' ? a : a.action;

/**
 * Same formula as the Edge Function evaluation-calculator.ts
 * (score_clinique + score_communication) / (maxClinical + maxComm) × 20
 */
const calculateFinalScore = (
  clinicalScore: number,
  communicationScore: number,
  maxClinicalScore: number,
  maxCommunicationScore: number,
): number => {
  const totalScore = clinicalScore + communicationScore;
  const maxTotalScore = maxClinicalScore + maxCommunicationScore;
  if (maxTotalScore === 0) return 0;
  const finalScore = (totalScore / maxTotalScore) * 20;
  return Math.round(finalScore * 100) / 100;
};

/* ──────────────────────── Main component ─────────────────────── */

const EvaluationResults = ({
  result,
  stationTitle,
  stationId,
  ednItemNumber,
  ednItemName,
  mockResultId: mockResultIdProp,
}: EvaluationResultsProps) => {
  const { user } = useAuth();

  /* ── Mutable copy of the evaluation result ── */
  const [mutableResult, setMutableResult] = useState<EvaluationResult>(() => ({
    ...result,
    actions_partielles: result.actions_partielles || [],
  }));

  /* ── Scores hook (reacts to mutableResult changes) ── */
  const {
    maxClinicalScore,
    maxCommunicationScore,
    getScoreColor,
    getScoreBadgeColor,
    performanceLevel,
  } = useEvaluationScores(mutableResult);

  /* ── Ranking ── */
  const [rankingText, setRankingText] = useState<string | undefined>(undefined);

  useEffect(() => {
    let isMounted = true;
    const fetchRank = async () => {
      try {
        if (!user?.id || !stationId) return;
        const { data, error } = await supabase.rpc('get_user_station_rank', {
          p_station_id: String(stationId),
          p_user_id: user.id,
        });
        if (error) {
          console.error('Error fetching station rank:', error);
          return;
        }
        if (!isMounted) return;
        if (typeof data === 'string' && data.trim().length > 0) {
          setRankingText(data);
        } else {
          setRankingText(undefined);
        }
      } catch (e) {
        console.error('Unexpected error fetching station rank:', e);
      }
    };
    fetchRank();
    return () => { isMounted = false; };
  }, [user?.id, stationId]);

  /* ── mock_results row id (for DB updates) ── */
  const [mockResultId, setMockResultId] = useState<string | null>(mockResultIdProp ?? null);

  useEffect(() => {
    // If the caller already knows the exact row id (e.g. history page), skip the query
    if (mockResultIdProp) {
      setMockResultId(mockResultIdProp);
      return;
    }

    let isMounted = true;
    const fetchId = async () => {
      if (!user?.id || !stationId) return;
      try {
        const { data } = await supabase
          .from('mock_results')
          .select('id')
          .eq('user_id', user.id)
          .eq('station_id', stationId)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
        if (isMounted && data) setMockResultId(data.id);
      } catch (e) {
        console.error('Error fetching mock_result id:', e);
      }
    };
    fetchId();
    return () => { isMounted = false; };
  }, [user?.id, stationId, mockResultIdProp]);

  /* ── Save status indicator ── */
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  /* ── Track whether user has made adjustments ── */
  const [adjustmentCount, setAdjustmentCount] = useState(0);

  /* ── Persist to DB after each reclassification ── */
  useEffect(() => {
    if (adjustmentCount === 0 || !mockResultId || !user) return;

    const persist = async () => {
      setSaveStatus('saving');
      try {
        const { error } = await supabase
          .from('mock_results')
          .update({
            score: mutableResult.note_finale,
            score_clinique: mutableResult.score_clinique,
            mistakes_count: mutableResult.actions_manquees.length,
            evaluation_details: {
              actions_reussies: mutableResult.actions_reussies,
              actions_partielles: mutableResult.actions_partielles || [],
              actions_manquees: mutableResult.actions_manquees,
              communication_details: mutableResult.communication_details,
            },
          })
          .eq('id', mockResultId);

        if (error) {
          console.error('Error persisting reclassification:', error);
          setSaveStatus('error');
        } else {
          setSaveStatus('saved');
        }
      } catch (e) {
        console.error('Unexpected error persisting reclassification:', e);
        setSaveStatus('error');
      }

      // Reset status after 2s
      setTimeout(() => setSaveStatus('idle'), 2000);
    };

    persist();
  }, [adjustmentCount, mockResultId, user, mutableResult]);

  /* ── Reclassification handler ── */
  const handleReclassify = useCallback(
    (actionText: string, fromStatus: ActionStatus, toStatus: ActionStatus) => {
      setMutableResult((prev) => {
        // 1. Find the item being moved
        let movedItem: string | { action: string; extrait?: string } | undefined;

        if (fromStatus === 'reussie') {
          movedItem = prev.actions_reussies.find((a) => getActionText(a) === actionText);
        } else if (fromStatus === 'partielle') {
          movedItem = (prev.actions_partielles || []).find((a) => getActionText(a) === actionText);
        } else {
          movedItem = prev.actions_manquees.find((a) => a === actionText);
        }

        if (!movedItem) return prev;

        // 2. Build new arrays (remove from source, add to target)
        const newReussies =
          fromStatus === 'reussie'
            ? prev.actions_reussies.filter((a) => getActionText(a) !== actionText)
            : toStatus === 'reussie'
              ? [...prev.actions_reussies, movedItem]
              : [...prev.actions_reussies];

        const newPartielles =
          fromStatus === 'partielle'
            ? (prev.actions_partielles || []).filter((a) => getActionText(a) !== actionText)
            : toStatus === 'partielle'
              ? [...(prev.actions_partielles || []), movedItem]
              : [...(prev.actions_partielles || [])];

        const newManquees =
          fromStatus === 'manquee'
            ? prev.actions_manquees.filter((a) => a !== actionText)
            : toStatus === 'manquee'
              ? [...prev.actions_manquees, getActionText(movedItem)]
              : [...prev.actions_manquees];

        // 3. Recalculate scores (same formula as Edge Function)
        const newScoreClinique = newReussies.length;
        const totalActions = newReussies.length + newPartielles.length + newManquees.length;
        const commSkillsCount = Object.keys(prev.communication_details).length;
        const newNoteFinale = calculateFinalScore(
          newScoreClinique,
          prev.score_communication,
          totalActions,
          commSkillsCount,
        );

        return {
          ...prev,
          actions_reussies: newReussies,
          actions_partielles: newPartielles,
          actions_manquees: newManquees,
          score_clinique: newScoreClinique,
          note_finale: newNoteFinale,
        };
      });

      setAdjustmentCount((c) => c + 1);
    },
    [],
  );

  /* ── Progress bar color helper ── */
  const getProgressColor = (score: number, max: number) => {
    const colorClass = getScoreColor(score, max);
    if (colorClass === 'text-warning') return 'bg-orange-500';
    return colorClass ? colorClass.replace('text-', 'bg-') : undefined;
  };

  /* ──────────────────────── Render ────────────────────────────── */
  return (
    <div className="space-y-6">
      {/* ═══════════ Score cards ═══════════ */}
      <div className="grid md:grid-cols-3 gap-6">
        <ScoreCard
          title="Aptitudes cliniques"
          score={mutableResult.score_clinique}
          maxScore={maxClinicalScore}
          scoreColor={getScoreColor(mutableResult.score_clinique, maxClinicalScore)}
          progressColor={getProgressColor(mutableResult.score_clinique, maxClinicalScore)}
          badgeColor={getScoreBadgeColor(mutableResult.score_clinique, maxClinicalScore)}
          additionalInfo={`${mutableResult.actions_reussies.length} actions réussies`}
        />

        <ScoreCard
          title="Communication"
          score={mutableResult.score_communication}
          maxScore={maxCommunicationScore}
          scoreColor={getScoreColor(mutableResult.score_communication, maxCommunicationScore)}
          progressColor={getProgressColor(mutableResult.score_communication, maxCommunicationScore)}
          badgeColor={getScoreBadgeColor(mutableResult.score_communication, maxCommunicationScore)}
          additionalInfo={`${Object.keys(mutableResult.communication_details).length} compétences évaluées`}
        />

        <ScoreCard
          title="Note finale"
          score={mutableResult.note_finale}
          maxScore={20}
          scoreColor={getScoreColor(mutableResult.note_finale, 20)}
          progressColor={getProgressColor(mutableResult.note_finale, 20)}
          badgeColor={getScoreBadgeColor(mutableResult.note_finale, 20)}
          description={performanceLevel.level}
          isPrimary={true}
          secondaryBadgeText={rankingText}
        />
      </div>

      {/* ═══════════ Save status ═══════════ */}
      {saveStatus === 'saved' && (
        <div className="flex items-center gap-1.5 text-xs text-green-600 justify-end -mt-3">
          <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
          Modifications sauvegardées
        </div>
      )}
      {saveStatus === 'error' && (
        <div className="flex items-center gap-1.5 text-xs text-red-500 justify-end -mt-3">
          Erreur lors de la sauvegarde
        </div>
      )}

      {/* ═══════════ Actions détaillées ═══════════ */}
      <ActionsList
        actions_reussies={mutableResult.actions_reussies}
        actions_partielles={mutableResult.actions_partielles || []}
        actions_manquees={mutableResult.actions_manquees}
        onReclassify={handleReclassify}
      />

      {/* ═══════════ Communication détaillée ═══════════ */}
      <CommunicationGrid communication_details={mutableResult.communication_details} />

      {/* ═══════════ AI Recommendations (Premium) ═══════════ */}
      {mutableResult.ai_recommendations && (
        <RecommendationsSection
          recommendations={mutableResult.ai_recommendations}
          ednItemNumber={ednItemNumber}
          ednItemName={ednItemName}
        />
      )}
    </div>
  );
};

export default EvaluationResults;
