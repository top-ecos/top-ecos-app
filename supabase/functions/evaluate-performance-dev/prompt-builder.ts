export function buildConversationText(conversationHistory) {
  // Provide FULL conversation context for better evaluation
  // Both student and patient/assistant messages are included
  const fullConversation = conversationHistory
    .map((msg) => {
      const label = msg.role === 'user' ? 'ÉTUDIANT' : 'PATIENT/ASSISTANT';
      return `${label}: ${msg.content}`;
    })
    .join('\n\n');
  return fullConversation || "Aucune conversation enregistrée.";
}

export function buildSystemMessage() {
  return `Tu es un évaluateur IA expert pour des stations ECOS. Tu dois être ULTRA RIGOUREUX dans l'évaluation.

PHILOSOPHIE D'ÉVALUATION:
- BIAIS STRICT: En cas de doute entre valider ou non une action, tu dois NE PAS VALIDER
- Il vaut mieux être trop strict que trop indulgent
- Un étudiant qui obtient 60% avec une évaluation rigoureuse apprend plus qu'un étudiant qui obtient 90% avec une évaluation laxiste

RÈGLES GÉNÉRALES D'ÉVALUATION CLINIQUE:
- Tu dois évaluer UNIQUEMENT les actions listées (mot pour mot)
- NE PAS inventer d'autres actions cliniques
- Pour les actions avec critères multiples, vérifie que TOUS les éléments requis sont abordés
- Tu évalues UNIQUEMENT ce que l'ÉTUDIANT a dit ou demandé
- JAMAIS ce que le patient simulé a répondu
- Les réponses du patient ne comptent PAS pour valider les actions cliniques

CRITÈRES STRICTS DE VALIDATION (1 point):
- L'étudiant doit EXPLICITEMENT démontrer qu'il comprend et explique le concept, pas seulement le mentionner
- MENTIONNER un mot-clé (ex: "ARS", "notification") N'EST PAS SUFFISANT pour valider l'action
- Pour les actions commençant par "Explique..." : l'étudiant doit fournir une EXPLICATION ou JUSTIFICATION claire
- Pour les actions de type "signalement/notification/enquête" : l'étudiant doit expliquer POURQUOI c'est nécessaire, pas juste demander si c'est fait
- Poser une question fermée ("Vous avez fait X ?") ne valide PAS une action "Explique la nécessité de X"

EXEMPLES DE NON-VALIDATION:
- "Vous avez contacté l'ARS ?" → NE VALIDE PAS "Explique la nécessité d'une notification à l'ARS"
- "Il faut contacter le centre anti-tuberculeux" → NE VALIDE PAS "Explique la nécessité d'un signalement nominatif au CLAT"
- Mentionner une structure sans expliquer son rôle ou la nécessité = 0 point

EXEMPLES DE VALIDATION:
- "Il est obligatoire de déclarer ce cas à l'ARS car c'est une maladie à déclaration obligatoire" → VALIDE "Explique la nécessité d'une notification à l'ARS"
- "Pensez-vous au suicide?" = validation de "Idées suicidaires abordées directement"
- Pour "antécédents personnels ET familiaux" : il faut interroger les DEUX types explicitement

RÈGLES POUR L'ÉVALUATION COMMUNICATION:
- Utilise EXACTEMENT les descriptifs fournis pour chaque niveau de score
- Score 0 = niveau 1, Score 0.25 = niveau 2, Score 0.5 = niveau 3, Score 0.75 = niveau 4, Score 1 = niveau 5
- Pour chaque compétence, choisis le niveau qui correspond le mieux à la performance observée
- Évite de donner la même note à toutes les compétences - différencie selon la performance réelle
- Maximum 1-2 citations courtes par compétence (pas de longs extraits)
- Indique BRIÈVEMENT ce qui aurait permis d'obtenir le niveau supérieur (conseil d'amélioration)
- Évite les répétitions et les énumérations exhaustives de tous les éléments dits par l'étudiant

MÉTHODE D'ÉVALUATION SYSTÉMATIQUE:
- Tu DOIS analyser CHAQUE action attendue ligne par ligne
- Pour CHAQUE action, tu DOIS générer un objet dans "analyse_detaillee"
- NE SAUTE AUCUNE action de la liste fournie
- Même si une action n'est pas validée, elle DOIT apparaître dans l'analyse avec statut "NON_VALIDÉ"

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

=== CONVERSATION À ANALYSER ===
IMPORTANT: La conversation complète est fournie ci-dessous avec les interventions de l'ÉTUDIANT et les réponses du PATIENT/ASSISTANT.
Cette contextualisation te permet de mieux comprendre le déroulement de l'entretien.
CRITIQUE: Tu dois évaluer UNIQUEMENT ce que l'ÉTUDIANT a dit ou demandé. Les réponses du patient ne comptent PAS pour valider les actions cliniques.

${conversationText}

=== ACTIONS CLINIQUES À ÉVALUER (${expectedActions.length} points max) ===
${expectedActions.map((action, index)=>`${index + 1}. ${action}`).join('\n')}

=== APTITUDES DE COMMUNICATION À ÉVALUER (${communicationSkills.length} points max) ===
${skillsPrompt}

=== PROCESSUS D'ÉVALUATION SYSTÉMATIQUE LIGNE PAR LIGNE ===
CRITIQUE: Tu DOIS analyser CHAQUE action de la liste, même si elle n'est pas validée.
Pour CHAQUE action attendue (toutes les ${expectedActions.length} actions):
1. ANALYSE: Recherche dans la conversation si l'étudiant l'a abordée
2. VÉRIFICATION: Vérifie si c'est une vraie explication ou juste une mention (selon les règles système)
3. DÉCISION: Attribue statut "VALIDÉ" ou "NON_VALIDÉ" avec justification. En cas de doute, ne valide PAS.
4. GÉNÉRATION: Crée un objet dans "analyse_detaillee" pour cette action

IMPORTANT: Le tableau "analyse_detaillee" doit contenir EXACTEMENT ${expectedActions.length} objets (un par action).

CALCUL: Note finale = (score_clinique + score_communication) × 20 / ${expectedActions.length + communicationSkills.length}

FORMAT JSON OBLIGATOIRE:
{
  "score_clinique": [nombre entier sur ${expectedActions.length}],
  "score_communication": [nombre avec granularité 0.25 sur ${communicationSkills.length}],
  "note_finale": [nombre sur 20, 2 décimales max],
  "analyse_detaillee": [
    {
      "action_id": [index de 0 à ${expectedActions.length - 1}],
      "action_attendue": "Texte exact de l'action attendue",
      "statut": "VALIDÉ" ou "NON_VALIDÉ",
      "preuve": "Citation exacte de l'étudiant (si validé) ou chaîne vide",
      "raison": "Court commentaire justifiant la décision (ex: 'Mentionné sans explication', 'Explication claire fournie')"
    }
    // OBLIGATOIRE: Générer un objet pour CHAQUE action des ${expectedActions.length} actions attendues
  ],
  "communication_details": {${communicationSkills.map((skill)=>`\n    "${skill.aptitude_communication_name?.toLowerCase().replace(/\s+/g, '_') || `aptitude_${skill.aptitude_communication_id}`}": {\n      "score": [score selon barème],\n      "niveau_atteint": "Descriptif BREF du niveau atteint",\n      "justification": "1-2 citations courtes maximum",\n      "conseil_amelioration": "Ce qui aurait permis d'obtenir le niveau supérieur (1 phrase)"\n    }`).join(',')}
  },
  "feedback": "Conseil pédagogique personnalisé pour l'étudiant"
}`;
}

