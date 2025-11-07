
import { CheckCircle, MessageSquare, Trophy, TrendingUp } from "lucide-react";
import { ScoreCard } from "./evaluation/ScoreCard";
import { ActionsList } from "./evaluation/ActionsList";
import { CommunicationGrid } from "./evaluation/CommunicationGrid";
import { ScoreChart } from "./evaluation/ScoreChart";
import { useEvaluationScores } from "@/hooks/useEvaluationScores";

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
}

const EvaluationResults = ({ result, stationTitle }: EvaluationResultsProps) => {
  const {
    maxClinicalScore,
    maxCommunicationScore,
    getScoreColor,
    getScoreBadgeColor,
    performanceLevel,
    relativePosition
  } = useEvaluationScores(result);

  return (
    <div className="space-y-6">
      {/* Synthèse en haut */}
      <div className="grid md:grid-cols-3 gap-6">
        <ScoreCard
          title="Aptitudes cliniques"
          score={result.score_clinique}
          maxScore={maxClinicalScore}
          scoreColor={getScoreColor(result.score_clinique, maxClinicalScore)}
          badgeColor={getScoreBadgeColor(result.score_clinique, maxClinicalScore)}
          additionalInfo={`${result.actions_reussies.length} actions réussies`}
        />

        <ScoreCard
          title="Communication"
          score={result.score_communication}
          maxScore={maxCommunicationScore}
          scoreColor={getScoreColor(result.score_communication, maxCommunicationScore)}
          badgeColor={getScoreBadgeColor(result.score_communication, maxCommunicationScore)}
          additionalInfo={`${Object.keys(result.communication_details).length} compétences évaluées`}
        />

        <ScoreCard
          title="Note finale"
          score={result.note_finale}
          maxScore={20}
          scoreColor={getScoreColor(result.note_finale, 20)}
          badgeColor={getScoreBadgeColor(result.note_finale, 20)}
          description={performanceLevel.level}
          isPrimary={true}
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
