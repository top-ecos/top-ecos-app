import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
export async function fetchEvaluationDataSeche(sddId) {
  const supabaseUrl = globalThis.Deno?.env?.get('SUPABASE_URL');
  const supabaseKey = globalThis.Deno?.env?.get('SUPABASE_SERVICE_ROLE_KEY');
  const supabase = createClient(supabaseUrl, supabaseKey);
  // Récupération des données d'évaluation pour les stations sèches depuis la nouvelle table sdds
  const { data: evaluationData, error: evalError } = await supabase.from('sdds').select('*').eq('sdd_id', sddId).maybeSingle();
  if (evalError) {
    return {
      data: null,
      communicationSkills: [],
      error: evalError
    };
  }
  if (!evaluationData) {
    return {
      data: null,
      communicationSkills: [],
      error: null
    };
  }
  // Pour la nouvelle table sdds, les aptitudes de communication sont directement dans la table principale
  const communicationSkills = [
    evaluationData.aptitude_communication_id_1,
    evaluationData.aptitude_communication_id_2,
    evaluationData.aptitude_communication_id_3,
    evaluationData.aptitude_communication_id_4,
    evaluationData.aptitude_communication_id_5
  ].filter((skill)=>skill !== null && skill !== undefined && skill !== '').map((skill, index)=>({
      aptitude_communication_id: `comm_${index + 1}`,
      description: skill
    }));
  return {
    data: evaluationData,
    communicationSkills,
    error: null
  };
}
export function buildExpectedActions(evaluationData) {
  const expectedActions = [];
  // Récupération de toutes les actions cliniques attendues (1 à 15 pour les stations sèches)
  for(let i = 1; i <= 15; i++){
    const actionKey = `aptitude_clinique_action_${i}`;
    const action = evaluationData[actionKey];
    if (action && action.trim()) {
      expectedActions.push(action);
    }
  }
  return expectedActions;
}

