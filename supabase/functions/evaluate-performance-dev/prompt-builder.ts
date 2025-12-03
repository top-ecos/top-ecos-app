export function buildConversationText(conversationHistory) {
  // CRITIQUE: Pour les stations PS/PSS, on ne doit évaluer QUE les interventions de l'étudiant
  // JAMAIS les réponses du patient simulé (IA)
  const studentMessages = conversationHistory.filter((msg)=>msg.role === 'user') // UNIQUEMENT les messages de l'étudiant
  .map((msg)=>`ÉTUDIANT: ${msg.content}`).join('\n\n');
  return studentMessages || "Aucune intervention de l'étudiant enregistrée.";
}
export function buildEvaluationPrompt(sddData, expectedActions, communicationSkills, conversationText) {
  const skillsPrompt = communicationSkills.map((skill)=>{
    return `
APTITUDE: ${skill.aptitude_communication_name || `Aptitude ${skill.aptitude_communication_id}`} (ID: ${skill.aptitude_communication_id})

BARÈME D'ÉVALUATION:
- Score 0: ${skill.aptitude_communication_level_1_score_0 || 'Non défini'}
- Score 0.25: ${skill["aptitude_communication_level_2_score_0.25"] || 'Non défini'}
- Score 0.5: ${skill["aptitude_communication_level_3_score_0.5"] || 'Non défini'}
- Score 0.75: ${skill["aptitude_communication_level_4_score_0.75"] || 'Non défini'}
- Score 1: ${skill.aptitude_communication_level_5_score_1 || 'Non défini'}`;
  }).join('\n\n');
  return `Tu es un évaluateur IA expert pour des stations ECOS. Tu dois être ULTRA RIGOUREUX dans l'évaluation.

STATION: ${sddData.sdd_titre || 'Station ' + sddData.sdd_id}

=== ACTIONS CLINIQUES STRICTES (${expectedActions.length} points max) ===
${expectedActions.map((action, index)=>`${index + 1}. ${action}`).join('\n')}

RÈGLES ABSOLUES POUR L'ÉVALUATION CLINIQUE:
- Tu dois évaluer UNIQUEMENT ces ${expectedActions.length} actions listées ci-dessus (mot pour mot)
- NE PAS inventer d'autres actions cliniques
- Pour les actions avec critères multiples (ex: "si les 2 éléments sont interrogés"), vérifie que TOUS les éléments requis sont abordés
- 1 point si l'étudiant aborde clairement le(s) concept(s), 0 sinon
- Sois tolérant sur la formulation mais STRICT sur le concept
- Exemples: "Pensez-vous au suicide?" = validation de "Idées suicidaires abordées directement"
- Pour "antécédents personnels ET familiaux" : il faut interroger les DEUX types d'antécédents explicitement

=== APTITUDES DE COMMUNICATION (${communicationSkills.length} points max) ===
${skillsPrompt}

RÈGLES POUR L'ÉVALUATION COMMUNICATION:
- Utilise EXACTEMENT les descriptifs fournis pour chaque niveau de score
- Score 0 = niveau 1, Score 0.25 = niveau 2, Score 0.5 = niveau 3, Score 0.75 = niveau 4, Score 1 = niveau 5
- Pour chaque compétence, choisis le niveau qui correspond le mieux à la performance observée
- OBLIGATOIRE : Cite des extraits précis de la conversation qui justifient ton choix de niveau
- Évite de donner la même note à toutes les compétences - différencie selon la performance réelle

CONVERSATION À ANALYSER - UNIQUEMENT LES INTERVENTIONS DE L'ÉTUDIANT :
${conversationText}

RÈGLE ABSOLUE D'ÉVALUATION :
- Tu évalues UNIQUEMENT ce que l'ÉTUDIANT a dit ou demandé
- JAMAIS ce que le patient simulé a répondu
- Une action est validée SEULEMENT si l'étudiant l'a explicitement interrogée ou abordée
- Les réponses du patient ne comptent PAS pour valider les actions cliniques

CALCUL: Note finale = (score_clinique + score_communication) × 20 / ${expectedActions.length + communicationSkills.length}

FORMAT JSON OBLIGATOIRE:
{
  "score_clinique": [nombre entier sur ${expectedActions.length}],
  "score_communication": [nombre avec granularité 0.25 sur ${communicationSkills.length}],
  "note_finale": [nombre sur 20, 2 décimales max],
  "actions_reussies": [
    {
      "action": "Action clinique exacte de la liste",
      "extrait": "Citation exacte de l'étudiant qui valide cette action"
    }
  ],
  "actions_manquees": ["Actions de la liste non validées"],
  "communication_details": {${communicationSkills.map((skill)=>`\n    "${skill.aptitude_communication_name?.toLowerCase().replace(/\s+/g, '_') || `aptitude_${skill.aptitude_communication_id}`}": {\n      "score": [score selon barème],\n      "niveau_atteint": "Descriptif exact du niveau atteint",\n      "justification": "Citation(s) précise(s) de l'étudiant qui justifie(nt) ce niveau"\n    }`).join(',')}
  },
  "feedback": "Conseil pédagogique personnalisé pour l'étudiant"
}`;
}

