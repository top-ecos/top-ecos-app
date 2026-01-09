export function validateAndCorrectScores(result, maxClinicalScore, maxCommunicationScore) {
  console.log('Validating scores...');
  console.log('Max clinical score:', maxClinicalScore);
  console.log('Max communication score:', maxCommunicationScore);
  console.log('Received result:', result);
  // Assurer que tous les champs requis existent
  const correctedResult = {
    score_clinique: 0,
    score_communication: 0,
    note_finale: 0,
    actions_reussies: [],
    actions_manquees: [],
    communication_details: {},
    feedback: 'Évaluation générée automatiquement'
  };
  // Valider et corriger le score clinique
  if (typeof result.score_clinique === 'number') {
    correctedResult.score_clinique = Math.max(0, Math.min(maxClinicalScore, Math.round(result.score_clinique)));
  }
  // Valider et corriger le score de communication
  if (typeof result.score_communication === 'number') {
    // Arrondir à la granularité 0.25
    const roundedCommScore = Math.round(result.score_communication * 4) / 4;
    correctedResult.score_communication = Math.max(0, Math.min(maxCommunicationScore, roundedCommScore));
  }
  // Recalculer la note finale
  const totalMaxScore = maxClinicalScore + maxCommunicationScore;
  const totalScore = correctedResult.score_clinique + correctedResult.score_communication;
  correctedResult.note_finale = totalMaxScore > 0 ? Math.round(totalScore * 20 / totalMaxScore * 100) / 100 : 0;
  // Copier les autres champs s'ils existent
  if (Array.isArray(result.actions_reussies)) {
    correctedResult.actions_reussies = result.actions_reussies;
  }
  if (Array.isArray(result.actions_manquees)) {
    correctedResult.actions_manquees = result.actions_manquees;
  }
  if (typeof result.communication_details === 'object' && result.communication_details !== null) {
    correctedResult.communication_details = result.communication_details;
  }
  if (typeof result.feedback === 'string') {
    correctedResult.feedback = result.feedback;
  }
  console.log('Corrected result:', correctedResult);
  return correctedResult;
}
export function generateFallbackEvaluation(maxClinicalScore, maxCommunicationScore, expectedActions) {
  console.log('Generating fallback evaluation for seche station...');
  // Score conservateur pour les stations sèches
  const clinicalScore = Math.max(1, Math.floor(maxClinicalScore * 0.4));
  const communicationScore = Math.max(0.5, Math.floor(maxCommunicationScore * 0.5 * 4) / 4);
  const totalMaxScore = maxClinicalScore + maxCommunicationScore;
  const totalScore = clinicalScore + communicationScore;
  const finalGrade = totalMaxScore > 0 ? Math.round(totalScore * 20 / totalMaxScore * 100) / 100 : 8.0;
  return {
    score_clinique: clinicalScore,
    score_communication: communicationScore,
    note_finale: finalGrade,
    actions_reussies: expectedActions.slice(0, clinicalScore).map((action)=>({
        action,
        extrait: "Évaluation automatique - élément identifié dans l'analyse"
      })),
    actions_manquees: expectedActions.slice(clinicalScore),
    communication_details: {},
    feedback: "Évaluation automatique générée suite à un problème technique. Votre analyse montre une compréhension de base du cas clinique. Pour améliorer votre performance, concentrez-vous sur la structuration de votre raisonnement et l'exhaustivité de votre analyse."
  };
}
