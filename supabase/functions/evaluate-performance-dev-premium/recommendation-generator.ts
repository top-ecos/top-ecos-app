export function buildRecommendationSystemPrompt() {
  return `Tu es un agent pédagogique de la plateforme top ECOS, un service de préparation aux ECOS destiné aux étudiants de médecine.
Tu interviens après qu'un étudiant a terminé une station et reçu une évaluation sur ses aptitudes cliniques et ses aptitudes de communication.

On te fournit les éléments suivants :

- le contexte de la station (titre et consignes),
- la grille d'évaluation de la station (liste d'items qui décrivent les actions attendues),
- l'historique de la performance de l'étudiant sur la station (dialogue avec le patient standardisé ou réponses rédigées pour une station "Document"),
- la fiche de cours EDN (fiche LiSA) correspondant à l'item principal de la station,
- un niveau global de performance de l'étudiant sur la station, sous la forme d'une chaîne de caractères parmi : "excellent", "intermediaire", "fragile".

Ta mission est très ciblée : tu dois aider l'étudiant à orienter ses révisions en lui indiquant quelques notions de son cours EDN à revoir en priorité, en lien direct avec ce qu'il a fait ou oublié dans la station.

RÈGLES DE FOND :

- Tu t'appuies à la fois sur la grille d'évaluation, sur ce que l'étudiant a réellement fait dans la station et sur la fiche de cours EDN.
- Tu identifies les notions de cours qui sont les plus importantes pour progresser sur des stations similaires.
- Tu restes concis : tu ne réécris pas tout le cours, tu sélectionnes seulement les axes de révision prioritaires.
- Tu écris en français, à la deuxième personne du singulier ("tu").

RÈGLES DE FORME :

Tu commences toujours par une phrase d'introduction adaptée au niveau global de performance :

Si le niveau est "excellent" :
Tu mets exactement comme valeur d'intro la phrase suivante :
"Tu maîtrises déjà bien les points essentiels de cette station. Pour aller plus loin, tu peux approfondir les notions suivantes :"

Si le niveau est "intermediaire" :
Tu mets exactement comme valeur d'intro la phrase suivante :
"Tu es plutôt au clair sur les notions de base de cette station, mais ça vaut le coup d'approfondir les points suivants :"

Si le niveau est "fragile" :
Tu mets exactement comme valeur d'intro la phrase suivante :
"Tu sembles encore en difficulté sur plusieurs notions importantes de cette station. Pour t'aider à progresser, commence par revoir les points suivants :"

Après cette phrase d'introduction, tu listes entre 3 et 5 notions de cours EDN à revoir en priorité.
Pour chaque notion :

- tu crées un champ "title" avec un intitulé court et clair (par exemple : "Facteurs de risque des carcinomes des VADS", "Signes d'alerte des lésions de la cavité buccale", "Description sémiologique d'une lésion muqueuse"),
- tu crées un champ "explanation" avec une phrase ou deux qui précisent ce que l'étudiant doit revoir dans son cours.

Tu dois produire exclusivement une réponse au format JSON, sans aucun texte supplémentaire, en respectant strictement le schéma suivant :

{
  "intro": "...",
  "bullets": [
    {
      "title": "...",
      "explanation": "..."
    }
  ]
}

CONTRAINTES SUPPLÉMENTAIRES :

- Le champ "intro" contient exactement la phrase d'introduction correspondant au niveau de performance fourni, sans texte avant ni après.
- Le tableau "bullets" contient entre 3 et 5 objets.
- Chaque champ "explanation" doit être compréhensible indépendamment du reste, et tenir en une ou deux phrases courtes.`;
}

export function buildRecommendationUserPrompt(
  stationContext: { title: string; consignes: string },
  evaluationGrid: string[],
  performanceHistory: string,
  ficheLisaContent: string,
  performanceLevel: string
) {
  return `STATION: ${stationContext.title}

CONSIGNES DE LA STATION:
${stationContext.consignes}

GRILLE D'ÉVALUATION (Actions attendues):
${evaluationGrid.map((action, i) => `${i + 1}. ${action}`).join('\n')}

HISTORIQUE DE PERFORMANCE DE L'ÉTUDIANT:
${performanceHistory}

FICHE DE COURS EDN (Fiche LiSA):
${ficheLisaContent || 'Non disponible'}

NIVEAU DE PERFORMANCE GLOBAL: ${performanceLevel}

Génère maintenant tes recommandations de révision au format JSON demandé.`;
}

export async function generateRecommendations(
  evaluationResult: any,
  stationContext: { title: string; consignes: string },
  evaluationGrid: string[],
  conversationText: string,
  ficheLisaContent: string | null,
  performanceLevel: 'excellent' | 'intermediaire' | 'fragile'
) {
  if (!ficheLisaContent) {
    console.log('No Fiche Lisa content available, skipping recommendations');
    return null;
  }

  const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
  const systemMessage = buildRecommendationSystemPrompt();
  const userPrompt = buildRecommendationUserPrompt(
    stationContext,
    evaluationGrid,
    conversationText,
    ficheLisaContent,
    performanceLevel
  );

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemMessage },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3,
        response_format: { type: "json_object" }
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('OpenAI Recommendations API Error:', response.status, error);
      return null;
    }

    const data = await response.json();
    let recommendationResult = data.choices[0].message.content;

    // Clean markdown backticks if present
    if (recommendationResult.includes('```json')) {
      recommendationResult = recommendationResult.replace(/```json\n?/g, '').replace(/\n?```/g, '').trim();
    }

    try {
      const parsedRecommendations = JSON.parse(recommendationResult);
      
      // Validate structure
      if (!parsedRecommendations.intro || !Array.isArray(parsedRecommendations.bullets)) {
        console.error('Invalid recommendations structure:', parsedRecommendations);
        return null;
      }

      // Validate bullets count (3-5)
      if (parsedRecommendations.bullets.length < 3 || parsedRecommendations.bullets.length > 5) {
        console.warn(`Recommendations bullets count is ${parsedRecommendations.bullets.length}, expected 3-5`);
      }

      console.log('✅ Recommendations generated successfully');
      return parsedRecommendations;
    } catch (parseError) {
      console.error('Error parsing recommendations:', parseError);
      return null;
    }
  } catch (error) {
    console.error('Error generating recommendations:', error);
    return null;
  }
}

export function determinePerformanceLevel(note_finale: number): 'excellent' | 'intermediaire' | 'fragile' {
  if (note_finale >= 15) return 'excellent';
  if (note_finale >= 10) return 'intermediaire';
  return 'fragile';
}

