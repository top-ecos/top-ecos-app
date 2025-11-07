export function calculateFinalScore(clinicalScore, communicationScore, maxClinicalScore, maxCommunicationScore) {
  const totalScore = clinicalScore + communicationScore;
  const maxTotalScore = maxClinicalScore + maxCommunicationScore;
  if (maxTotalScore === 0) return 0;
  const finalScore = totalScore / maxTotalScore * 20;
  return Math.round(finalScore * 100) / 100; // Round to 2 decimal places
}
export function validateAndCorrectScores(result, maxClinicalScore, maxCommunicationScore) {
  // Ensure clinical score is within bounds
  result.score_clinique = Math.max(0, Math.min(result.score_clinique, maxClinicalScore));
  // Ensure communication score is within bounds and follows 0.25 granularity
  result.score_communication = Math.max(0, Math.min(result.score_communication, maxCommunicationScore));
  result.score_communication = Math.round(result.score_communication * 4) / 4; // Round to nearest 0.25
  // Recalculate final score to ensure accuracy
  result.note_finale = calculateFinalScore(result.score_clinique, result.score_communication, maxClinicalScore, maxCommunicationScore);
  return result;
}
export function generateFallbackEvaluation(maxClinicalScore, maxCommunicationScore, actions) {
  const clinicalScore = Math.floor(maxClinicalScore * 0.6); // Conservative 60% score
  const communicationScore = Math.floor(maxCommunicationScore * 0.5) * 0.25; // Conservative 50% score with 0.25 granularity
  return {
    score_clinique: clinicalScore,
    score_communication: communicationScore,
    note_finale: calculateFinalScore(clinicalScore, communicationScore, maxClinicalScore, maxCommunicationScore),
    actions_reussies: actions.slice(0, clinicalScore).map((action)=>`${action}: Évaluation automatique conservatrice`),
    actions_manquees: actions.slice(clinicalScore),
    communication_details: {},
    feedback: "Une erreur technique s'est produite lors de l'évaluation automatique. Cette note conservatrice a été attribuée. Veuillez demander une réévaluation manuelle."
  };
}
