import { CheckCircle, MessageSquare, Trophy, TrendingUp } from "lucide-react";
import { ScoreCard } from "./ScoreCard";
import { ActionsList } from "./ActionsList";
import { CommunicationGrid } from "./CommunicationGrid";
import { ScoreChart } from "./ScoreChart";
import { useEvaluationScores } from "../hooks/useEvaluationScores";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/shared/contexts/AuthContext";

interface EvaluationResult {
  score_clinique: number;
  score_communication: number;
  note_finale: number;
  actions_reussies: (string | { action: string; extrait: string })[];
  actions_manquees: string[];
  communication_details: Record<string, number>;
  feedback: string;
}

interface EvaluationResultsProps {
  result: EvaluationResult;
  stationTitle: string;
  stationId: string;
}

const EvaluationResults = ({ result, stationTitle, stationId }: EvaluationResultsProps) => {
  const {
    maxClinicalScore,
    maxCommunicationScore,
    getScoreColor,
    getScoreBadgeColor,
    performanceLevel,
    relativePosition
  } = useEvaluationScores(result);

  const { user } = useAuth();
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
    return () => {
      isMounted = false;
    };
  }, [user?.id, stationId]);

  // Helper to convert text color (text-green-600) to background color (bg-green-600) for the gauge
  const getProgressColor = (score: number, max: number) => {
    const colorClass = getScoreColor(score, max);
    if (colorClass === 'text-warning') {
      return 'bg-orange-500'; // Custom orange color for mid-performance
    }
    return colorClass ? colorClass.replace('text-', 'bg-') : undefined;
  };

  return (
    <div className="space-y-6">
      {/* Synthèse en haut */}
      <div className="grid md:grid-cols-3 gap-6">
        <ScoreCard
          title="Aptitudes cliniques"
          score={result.score_clinique}
          maxScore={maxClinicalScore}
          scoreColor={getScoreColor(result.score_clinique, maxClinicalScore)}
          // Pass the converted background color for the progress bar
          progressColor={getProgressColor(result.score_clinique, maxClinicalScore)}
          badgeColor={getScoreBadgeColor(result.score_clinique, maxClinicalScore)}
          additionalInfo={`${result.actions_reussies.length} actions réussies`}
        />

        <ScoreCard
          title="Communication"
          score={result.score_communication}
          maxScore={maxCommunicationScore}
          scoreColor={getScoreColor(result.score_communication, maxCommunicationScore)}
          progressColor={getProgressColor(result.score_communication, maxCommunicationScore)}
          badgeColor={getScoreBadgeColor(result.score_communication, maxCommunicationScore)}
          additionalInfo={`${Object.keys(result.communication_details).length} compétences évaluées`}
        />

        <ScoreCard
          title="Note finale"
          score={result.note_finale}
          maxScore={20}
          scoreColor={getScoreColor(result.note_finale, 20)}
          progressColor={getProgressColor(result.note_finale, 20)}
          badgeColor={getScoreBadgeColor(result.note_finale, 20)}
          description={performanceLevel.level}
          isPrimary={true}
          secondaryBadgeText={rankingText}
        />      
      </div>


      {/* Actions détaillées */}
      <ActionsList 
        actions_reussies={result.actions_reussies}
        actions_manquees={result.actions_manquees}
      />

      {/* Communication détaillée */}
      <CommunicationGrid communication_details={result.communication_details} />

      {/* Conseils pédagogiques retirés selon les spécifications */}
    </div>
  );
};

export default EvaluationResults;