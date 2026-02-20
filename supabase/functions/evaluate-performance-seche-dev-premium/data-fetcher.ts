import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export async function fetchEvaluationDataSeche(sddId) {
  const supabaseUrl = globalThis.Deno?.env?.get('SUPABASE_URL');
  const supabaseKey = globalThis.Deno?.env?.get('SUPABASE_SERVICE_ROLE_KEY');
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  // Récupération des données d'évaluation pour les stations sèches depuis la nouvelle table sdds
  const { data: evaluationData, error: evalError } = await supabase
    .from('sdds')
    .select('*')
    .eq('sdd_id', sddId)
    .maybeSingle();
  
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
  
  // Récupération des IDs des aptitudes de communication pour cette station
  const communicationIds = [
    evaluationData.aptitude_communication_id_1,
    evaluationData.aptitude_communication_id_2,
    evaluationData.aptitude_communication_id_3,
    evaluationData.aptitude_communication_id_4,
    evaluationData.aptitude_communication_id_5
  ].filter((id)=>id !== null && id !== undefined && id !== '')
    .map((id)=>parseInt(id, 10))
    .filter((id)=>!isNaN(id));
  
  console.log('Communication IDs to fetch:', communicationIds);
  
  let communicationSkills = [];
  if (communicationIds.length > 0) {
    const { data: skillsData, error: skillsError } = await supabase
      .from('SDD_Type_A_Eval_2_MVP')
      .select('*')
      .in('aptitude_communication_id', communicationIds);
    
    if (skillsError) {
      console.error('Error fetching communication skills:', skillsError);
      return {
        data: evaluationData,
        communicationSkills: [],
        error: skillsError
      };
    }
    communicationSkills = skillsData || [];
    console.log('Fetched communication skills:', communicationSkills.length, 'skills');
    console.log('Skills details:', JSON.stringify(communicationSkills, null, 2));
  }
  
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

export async function fetchFicheLisa(sddId) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  // Fetch SDD data with item_edn
  const { data, error } = await supabase
    .from('sdds')
    .select(`
      item_edn,
      sdd_titre,
      consignes_etudiant
    `)
    .eq('sdd_id', sddId)
    .maybeSingle();

  if (error || !data || !data.item_edn) {
    console.log('No item_edn found for sdd_id:', sddId);
    return {
      ficheLisaContent: null,
      ficheLisaTitle: null,
      stationContext: {
        title: data?.sdd_titre || '',
        consignes: data?.consignes_etudiant || ''
      },
      error: error
    };
  }

  // Directly fetch source_materials by matching item_edn with item
  const itemEdnInt = parseInt(data.item_edn, 10);
  
  const { data: materialData, error: materialError } = await supabase
    .from('source_materials')
    .select('content_text, title')
    .eq('item', itemEdnInt)
    .maybeSingle();

  if (materialError || !materialData) {
    console.log('No material found for item_edn:', itemEdnInt);
    return {
      ficheLisaContent: null,
      ficheLisaTitle: null,
      stationContext: {
        title: data.sdd_titre,
        consignes: data.consignes_etudiant
      },
      error: materialError
    };
  }

  return {
    ficheLisaContent: materialData.content_text || null,
    ficheLisaTitle: materialData.title || null,
    stationContext: {
      title: data.sdd_titre,
      consignes: data.consignes_etudiant
    },
    error: null
  };
}
