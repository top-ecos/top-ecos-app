export function buildConversationText(conversationHistory) {
  // Pour les stations sèches, on traite la conversation comme une réflexion continue
  if (conversationHistory.length === 1 && conversationHistory[0].role === 'user') {
    return `RÉFLEXION DE L'ÉTUDIANT:\n${conversationHistory[0].content}`;
  }
  // Si multiple messages, on les combine
  return conversationHistory.filter((msg)=>msg.role === 'user').map((msg)=>msg.content).join('\n\n');
}

export function buildSystemMessage() {
  return `Tu es un évaluateur IA expert pour des stations ECOS SÈCHES (analyse de documents). Tu dois être ULTRA RIGOUREUX dans l'évaluation.

PHILOSOPHIE D'ÉVALUATION:
- BIAIS STRICT: En cas de doute entre valider ou non une action, tu dois NE PAS VALIDER
- Il vaut mieux être trop strict que trop indulgent
- Un étudiant qui obtient 60% avec une évaluation rigoureuse apprend plus qu'un étudiant qui obtient 90% avec une évaluation laxiste

RÈGLES GÉNÉRALES D'ÉVALUATION CLINIQUE:
- Tu dois évaluer UNIQUEMENT les actions listées (mot pour mot)
- NE PAS inventer d'autres actions cliniques
- Pour les actions avec critères multiples, vérifie que TOUS les éléments requis sont abordés
- 1 point si l'étudiant aborde clairement le(s) concept(s), 0 sinon
- Sois tolérant sur la formulation mais STRICT sur le concept médical
- Analyse la cohérence d'ensemble du raisonnement médical

CRITÈRES STRICTS DE VALIDATION (1 point):
- L'étudiant doit EXPLICITEMENT démontrer qu'il comprend et explique le concept, pas seulement le mentionner
- MENTIONNER un mot-clé N'EST PAS SUFFISANT pour valider l'action
- Pour les actions commençant par "Explique..." : l'étudiant doit fournir une EXPLICATION ou JUSTIFICATION claire
- Pour les actions de type "signalement/notification/enquête" : l'étudiant doit expliquer POURQUOI c'est nécessaire

RÈGLES POUR L'ÉVALUATION COMMUNICATION:
- Utilise EXACTEMENT les descriptifs fournis pour chaque niveau de score
- Score 0 = niveau 1, Score 0.25 = niveau 2, Score 0.5 = niveau 3, Score 0.75 = niveau 4, Score 1 = niveau 5
- Pour chaque compétence, choisis le niveau qui correspond le mieux à la performance observée
- Évite de donner la même note à toutes les compétences - différencie selon la performance réelle
- Maximum 1-2 citations courtes par compétence (pas de longs extraits)
- Indique BRIÈVEMENT ce qui aurait permis d'obtenir le niveau supérieur (conseil d'amélioration)
- Évite les répétitions et les énumérations exhaustives

FORMAT DE SORTIE:
- Retourne UNIQUEMENT du JSON valide avec la structure requise
- Pas de texte additionnel, pas de markdown, uniquement du JSON`;
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
  
  return `STATION: ${sddData.sdd_titre || 'Station ' + sddData.sdd_id}

=== RÉFLEXION À ANALYSER ===
IMPORTANT: Le texte ci-dessous est UNIQUEMENT la réflexion de l'ÉTUDIANT (rôle 'user' dans transcript_json).
Aucune autre intervention n'est présente.

${conversationText}

=== ACTIONS CLINIQUES À ÉVALUER (${expectedActions.length} points max) ===
${expectedActions.map((action, index)=>`${index + 1}. ${action}`).join('\n')}

=== APTITUDES DE COMMUNICATION À ÉVALUER (${communicationSkills.length} points max) ===
${skillsPrompt}

=== PROCESSUS D'ÉVALUATION EN 3 ÉTAPES ===
1. ANALYSE: Pour chaque action attendue, recherche dans la réflexion si l'étudiant l'a abordée
2. VÉRIFICATION: Pour chaque match potentiel, vérifie si c'est une vraie explication ou juste une mention (selon les règles système)
3. DÉCISION: Attribue 1 ou 0 point avec justification. En cas de doute, ne valide PAS.

Effectue ce processus mentalement avant de générer le JSON final.

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
  "communication_details": {${communicationSkills.map((skill)=>`\n    "${skill.aptitude_communication_name?.toLowerCase().replace(/\s+/g, '_') || `aptitude_${skill.aptitude_communication_id}`}": {\n      "score": [score selon barème],\n      "niveau_atteint": "Descriptif BREF du niveau atteint",\n      "justification": "1-2 citations courtes maximum",\n      "conseil_amelioration": "Ce qui aurait permis d'obtenir le niveau supérieur (1 phrase)"\n    }`).join(',')}
  },
  "feedback": "Conseil pédagogique personnalisé pour l'étudiant sur son analyse de cas"
}`;
}

