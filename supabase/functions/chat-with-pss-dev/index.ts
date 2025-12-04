import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
serve(async (req)=>{
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders
    });
  }
  try {
    console.log('🏥 PSS Chat DEV request received');
    const { sddData, userMessage, conversationHistory } = await req.json();
    if (!sddData || !userMessage) {
      throw new Error('Missing required data: sddData and userMessage are required');
    }
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }
    // Construire le prompt système pour PSS
    const systemPrompt = buildPSSSystemPrompt(sddData);
    console.log('📋 PSS DEV System prompt built');
    // Préparer les messages pour OpenAI
    const messages = [
      {
        role: 'system',
        content: systemPrompt
      },
      ...conversationHistory,
      {
        role: 'user',
        content: userMessage
      }
    ];
    console.log('🤖 Calling OpenAI for PSS DEV interaction...');
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: messages,
        temperature: 0.7,
        max_tokens: 500
      })
    });
    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }
    const data = await response.json();
    const pssResponse = data.choices[0].message.content;
    console.log('✅ PSS DEV response generated successfully');
    return new Response(JSON.stringify({
      message: pssResponse,
      timestamp: new Date().toISOString()
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('❌ Error in PSS DEV chat function:', error);
    return new Response(JSON.stringify({
      error: error.message || 'Internal server error'
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
function buildPSSSystemPrompt(sddData) {
  const professionalRole = determineProfessionalRole(sddData);
  return `Tu es un ${professionalRole} dans le cadre d'une simulation ECOS (Épreuves Cliniques Objectivées Structurées).

CONTEXTE DE LA STATION :
- Station ID: ${sddData.sdd_id}
- Titre: ${sddData.sdd_titre}
- Type: ${sddData.Type_de_station} (Professionnel de Santé)

INFORMATIONS DU PATIENT (dont tu t'occupes) :
- Nom: ${sddData.fiche_patient_nom || 'Patient'}
- Prénom: ${sddData.fiche_patient_prenom || 'Inconnu'}
- Âge: ${sddData.fiche_patient_age || 'Non précisé'} ans
- Sexe: ${sddData.fiche_patient_sexe || 'Non précisé'}
- Taille: ${sddData.fiche_patient_taille ? sddData.fiche_patient_taille + ' cm' : 'Non précisé'}
- Poids: ${sddData.fiche_patient_poids ? sddData.fiche_patient_poids + ' kg' : 'Non précisé'}
- IMC: ${sddData.fiche_patient_imc || 'Non calculé'}
- Statut: ${sddData.fiche_patient_statut || 'Non précisé'}
- Situation: ${sddData.fiche_patient_situation || 'Non précisée'}
- Métier: ${sddData.fiche_patient_métier || 'Non précisé'}
- Nombre d'enfants: ${sddData.fiche_patient_nombre_enfant || 'Non précisé'}

ANTÉCÉDENTS ET TRAITEMENTS :
- Antécédents personnels: ${sddData.fiche_patient_antecedents_personnels || 'Aucun antécédent connu'}
- Antécédents familiaux: ${sddData.fiche_patient_antecedents_familiaux || 'Aucun antécédent familial connu'}
- Habitudes de vie: ${sddData.fiche_patient_habitudes_de_vie || 'Non précisées'}
- Traitement médicamenteux: ${sddData.fiche_patient_traitement_medicamenteux || 'Aucun traitement en cours'}
- Traitement non médicamenteux: ${sddData.fiche_patient_traitement_non_medicamenteux || 'Aucun'}
- Allergies connues: ${sddData.fiche_patient_allergies_connues || 'Aucune allergie connue'}
- Addictions: ${sddData.fiche_patient_addictions || 'Aucune addiction connue'}

CONTEXTE CLINIQUE ACTUEL :
- Motif de consultation: ${sddData.fiche_patient_motif_consultation || 'Situation clinique'}
- Description des symptômes: ${sddData.fiche_patient_description_symptomes || 'À évaluer'}
- Ancienneté des symptômes: ${sddData.fiche_patient_anciennete_symptomes || 'À préciser'}
- Signes absents: ${sddData.fiche_patient_signes_absents || 'Non précisé'}
- Comportement face aux symptômes: ${sddData.fiche_patient_comportement_symptomes || 'Non décrit'}
- Degré d'anxiété: ${sddData.fiche_patient_degré_anxiete || 'Non évalué'}

POINTS À NOTER :
${sddData.fiche_patient_a_noter_1 ? `- ${sddData.fiche_patient_a_noter_1}` : ''}
${sddData.fiche_patient_a_noter_2 ? `- ${sddData.fiche_patient_a_noter_2}` : ''}
${sddData.fiche_patient_a_noter_3 ? `- ${sddData.fiche_patient_a_noter_3}` : ''}

COMPORTEMENT À ADOPTER :
${buildProfessionalBehavior(sddData)}

SCENARIO INITIAL :
${buildInitialScenario(sddData)}

CONSIGNES IMPORTANTES :
1. Tu es un professionnel de santé qui travaille dans des conditions de stress
2. Réponds UNIQUEMENT à la question posée, ne donne pas d'informations supplémentaires spontanément
3. Attends que le médecin te pose les bonnes questions pour donner plus de détails
4. Tu es inquiète mais tu restes professionnelle
5. Si tu es nouvelle (comme dans cette station), tu peux montrer une certaine hésitation
6. Ne récite pas toutes les informations d'un coup - laisse le médecin mener l'interrogatoire
7. Reste dans ton rôle professionnel et ne sors pas du cadre médical
8. ${professionalRole === 'infirmière' ? 'Tu es nouvelle dans le service et tu demandes de l\'aide au médecin. Tu attends ses directives.' : 'Tu collabores avec l\'équipe médicale'}
9. Sois concise dans tes réponses - maximum 1-2 phrases par réponse sauf si on te demande explicitement plus de détails

${buildProfessionalQuestions(sddData)}

Réponds de manière naturelle, professionnelle et constructive. Reste dans ton rôle de ${professionalRole}.`;
}
function determineProfessionalRole(sddData) {
  // Pour cette station spécifique, c'est une infirmière qui appelle
  if (sddData.consignes_etudiant?.includes('infirmière')) {
    return 'infirmière';
  }
  // Logique générale pour déterminer le rôle selon les consignes
  const consignes = sddData.consignes_etudiant?.toLowerCase() || '';
  if (consignes.includes('pharmacien')) {
    return 'pharmacien(ne)';
  } else if (consignes.includes('sage-femme')) {
    return 'sage-femme';
  } else if (consignes.includes('kinésithérapeute') || consignes.includes('kiné')) {
    return 'kinésithérapeute';
  } else if (consignes.includes('médecin')) {
    return 'médecin';
  } else if (consignes.includes('infirmier')) {
    return 'infirmier(ère)';
  } else {
    return 'professionnel de santé';
  }
}
function buildProfessionalBehavior(sddData) {
  const baseData = sddData.fiche_patient_comportement_conseils_medicaux;
  if (baseData) {
    return `Comportement professionnel : ${baseData}`;
  }
  const degreeAnxiety = sddData.fiche_patient_degré_anxiete;
  if (degreeAnxiety?.includes('calme') || degreeAnxiety?.includes('serein')) {
    return 'Tu es calme, posé(e) et rassurant(e). Tu abordes les sujets avec sérénité et professionnalisme.';
  } else if (degreeAnxiety?.includes('inquiet') || degreeAnxiety?.includes('préoccupé')) {
    return 'Tu montres une préoccupation professionnelle appropriée. Tu es attentif/attentive aux détails et poses des questions pertinentes.';
  } else {
    return 'Tu adoptes une attitude professionnelle équilibrée, à la fois compétente et accessible.';
  }
}
function buildInitialScenario(sddData) {
  // Extraire le message initial des consignes pour les stations PSS
  const consignes = sddData.consignes_etudiant || '';
  // Chercher le message de l'infirmière dans les consignes
  const match = consignes.match(/"([^"]+)"/);
  if (match) {
    return `Message initial que tu dois dire dès le premier échange : "${match[1]}"`;
  }
  return 'Tu prends contact avec le médecin pour l\'informer de la situation.';
}
function buildProfessionalQuestions(sddData) {
  const questions = [];
  if (sddData.fiche_patient_question_a_poser_au_medecin_1) {
    questions.push(sddData.fiche_patient_question_a_poser_au_medecin_1);
  }
  if (sddData.fiche_patient_question_a_poser_au_medecin_2) {
    questions.push(sddData.fiche_patient_question_a_poser_au_medecin_2);
  }
  if (sddData.fiche_patient_question_a_poser_au_medecin_3) {
    questions.push(sddData.fiche_patient_question_a_poser_au_medecin_3);
  }
  if (sddData.fiche_patient_question_a_poser_au_medecin_4) {
    questions.push(sddData.fiche_patient_question_a_poser_au_medecin_4);
  }
  if (questions.length > 0) {
    return `\nQUESTIONS/POINTS À ABORDER :
${questions.map((q, i)=>`${i + 1}. ${q}`).join('\n')}`;
  }
  return '';
}

