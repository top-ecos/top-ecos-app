import { useMemo } from "react";

interface EvaluationResult {
  score_clinique: number;
  score_communication: number;
  note_finale: number;
  actions_reussies: (string | { action: string; extrait: string })[];
  actions_manquees: string[];
  actions_partielles?: (string | { action: string; extrait?: string })[];
  communication_details: Record<string, number>;
  feedback: string;
}

export const useEvaluationScores = (result: EvaluationResult) => {
  return useMemo(() => {
    const maxClinicalScore = result.actions_reussies.length
      + (result.actions_partielles?.length || 0)
      + result.actions_manquees.length;
    const maxCommunicationScore = Object.keys(result.communication_details).length;

    const getScoreColor = (score: number, max: number) => {
      const percentage = max > 0 ? (score / max) * 100 : 0;
      if (percentage >= 60) return "text-primary";
      if (percentage >= 50) return "text-warning";
      return "text-destructive";
    };

    const getScoreBadgeColor = (score: number, max: number) => {
      const percentage = max > 0 ? (score / max) * 100 : 0;
      if (percentage >= 60) return "bg-primary/10 text-primary text-lg border-primary/20";
      if (percentage >= 50) return "bg-warning/10 text-warning text-lg border-warning/20";
      return "bg-destructive/10 text-destructive border-destructive/20";
    };

    const getPerformanceLevel = (finalScore: number) => {
      if (finalScore >= 12) {
        return {
          level: finalScore >= 15 ? "Excellent" : "Bien",
          color: "text-primary",
          badgeClasses: "bg-primary/10 text-primary border-primary/20"
        };
      }
      if (finalScore >= 10) {
        return {
          level: "Satisfaisant",
          color: "text-warning",
          badgeClasses: "bg-warning/10 text-warning border-warning/20"
        };
      }
      return {
        level: "À améliorer",
        color: "text-destructive",
        badgeClasses: "bg-destructive/10 text-destructive border-destructive/20"
      };
    };

    const getRelativePosition = (finalScore: number) => {
      if (finalScore >= 16) return { percentage: 10, label: "top 10%" };
      if (finalScore >= 14) return { percentage: 25, label: "top 25%" };
      if (finalScore >= 12) return { percentage: 50, label: "top 50%" };
      if (finalScore >= 10) return { percentage: 75, label: "top 75%" };
      return { percentage: 90, label: "amélioration nécessaire" };
    };

    return {
      maxClinicalScore,
      maxCommunicationScore,
      getScoreColor,
      getScoreBadgeColor,
      getPerformanceLevel,
      getRelativePosition,
      performanceLevel: getPerformanceLevel(result.note_finale),
      relativePosition: getRelativePosition(result.note_finale)
    };
  }, [result]);
};
