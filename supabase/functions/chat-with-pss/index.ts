import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
<<<<<<< Updated upstream
serve(async (req)=>{
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders
=======

// --- CLIENTS ---
const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  { auth: { persistSession: false } }
);

const groq = new Groq({ apiKey: Deno.env.get("GROQ_API_KEY") });
const GROQ_MODEL = Deno.env.get("GROQ_MODEL") || "openai/gpt-oss-120b";

// --- HELPER FUNCTIONS FOR PROMPT LOGIC ---

function computeIMC(heightCm: any, weightKg: any) {
  const h = Number(heightCm) / 100;
  const w = Number(weightKg);
  return (h > 0 && w > 0) ? (w / (h * h)).toFixed(1) : "Non calculé";
}

function determineProfessionalRole(sddData: any) {
  const consignes = (sddData.consignes_etudiant || '').toLowerCase();
  if (consignes.includes('IDE') || consignes.includes('infirmier')) return 'infirmier(ère)';
  if (consignes.includes('pharmacien')) return 'pharmacien(ne)';
  if (consignes.includes('sage-femme')) return 'sage-femme';
  if (consignes.includes('kiné')) return 'kinésithérapeute';
  if (consignes.includes('médecin')) return 'confrère/consœur médecin';
  return 'professionnel de santé';
}

function buildProfessionalBehavior(sddData: any) {
  if (sddData.fiche_patient_comportement_conseils_medicaux) {
    return `Comportement professionnel spécifique : ${sddData.fiche_patient_comportement_conseils_medicaux}`;
  }
  const level = Number(sddData.fiche_patient_degré_anxiete);
  if (isNaN(level)) return 'Tu adoptes une attitude professionnelle équilibrée, à la fois compétente et accessible.';
  
  if (level <= 3) return 'Tu es calme, posé(e) et rassurant(e). Tu abordes les sujets avec sérénité et professionnalisme.';
  if (level <= 7) return 'Tu montres une préoccupation professionnelle appropriée. Tu es attentif/attentive aux détails et poses des questions pertinentes.';
  return 'Tu es très angoissé(e) ou pressant(e) compte tenu de l\'urgence ressentie, tout en essayant de garder ton calme professionnel.';
}

function buildInitialScenario(sddData: any) {
  const consignes = sddData.consignes_etudiant || '';
  const match = consignes.match(/"([^"]+)"/);
  if (match) {
    return `Message initial que tu dois dire dès le premier échange : "${match[1]}"`;
  }
  return `Tu prends contact avec le médecin. Contexte : ${consignes}`;
}

function buildProfessionalQuestions(sddData: any) {
  const questions = sddData.fiche_patient_question_a_poser_au_medecin;
  if (questions && questions.trim().length > 0) {
    return `\nPOINTS OU QUESTIONS À ABORDER AVEC LE MÉDECIN SI L'OCCASION SE PRÉSENTE :\n${questions}`;
  }
  return '';
}

// --- MAIN PROMPT BUILDER ---

const buildPSSSystemPrompt = (sddData: any) => {
  // 1. Prepare computed variables required by the template
  const professionalRole = determineProfessionalRole(sddData);
  const imc = computeIMC(sddData.fiche_patient_taille, sddData.fiche_patient_poids);

  // 2. Aggregate Antecedents
  const antecedentsList = [];
  if (sddData.fiche_patient_antecedents_médicaux) antecedentsList.push(`Médicaux: ${sddData.fiche_patient_antecedents_médicaux}`);
  if (sddData.fiche_patient_antecedents_chirurgicaux) antecedentsList.push(`Chirurgicaux: ${sddData.fiche_patient_antecedents_chirurgicaux}`);
  const antecedentsPersonnels = antecedentsList.length > 0 ? antecedentsList.join('; ') : 'Aucun antécédent connu';

  // 3. PSS PROMPT TEMPLATE
  return `Tu JOUES LE RÔLE d'un ${professionalRole} dans une simulation d'examen blanc ECOS.

⚠️ CONTRAINTE ABSOLUE - IGNORANCE MÉDICALE :
Tu es un professionnel de terrain STRESSÉ qui appelle à l'aide. Tu ne connais PAS la médecine théorique.
- Tu ne connais QUE les faits concrets listés ci-dessous
- Tu n'as AUCUNE connaissance médicale théorique
- Tu ne peux PAS expliquer des pathologies, mécanismes, définitions médicales
- Tu ne peux PAS proposer de diagnostic ou d'hypothèse diagnostique
- Si on te demande ton avis médical, réponds: "Je ne sais pas, c'est pour ça que je vous appelle" ou "Qu'est-ce que vous en pensez ?"
- Si on te pose une question vague ou générique, tu réponds par des éléments vagues ou génériques. TU DOIS FORCER LE MÉDECIN A DEMANDER DES PRÉCISIONS, NE LUI MÂCHE PAS LE TRAVAIL. 

CONTEXTE DE LA STATION :
- Station ID: ${sddData.sdd_id}
- Titre: ${sddData.sdd_titre}
- Type: ${sddData.sdd_type} (Professionnel de Santé)

INFORMATIONS DU PATIENT (dont tu t'occupes) :
- Nom: ${sddData.fiche_patient_nom || 'Patient'}
- Prénom: ${sddData.fiche_patient_prénom || 'Inconnu'}
- Âge: ${sddData.fiche_patient_age || 'Non précisé'} ans
- Sexe: ${sddData.fiche_patient_sexe || 'Non précisé'}
- Taille: ${sddData.fiche_patient_taille ? sddData.fiche_patient_taille + ' cm' : 'Non précisé'}
- Poids: ${sddData.fiche_patient_poids ? sddData.fiche_patient_poids + ' kg' : 'Non précisé'}
- IMC: ${imc}
- Statut: ${sddData.fiche_patient_statut || 'Non précisé'}
- Métier: ${sddData.fiche_patient_métier || 'Non précisé'}
- Nombre d'enfants: ${sddData.fiche_patient_nombre_enfant ?? 'Non précisé'}

ANTÉCÉDENTS ET TRAITEMENTS :
- Antécédents personnels: ${antecedentsPersonnels}
- Antécédents familiaux: ${sddData.fiche_patient_antecedents_familiaux || 'Aucun antécédent familial connu'}
- Habitudes de vie: ${sddData.fiche_patient_habitudes_de_vie || 'Non précisées'}
- Traitement médicamenteux et observance: ${sddData.fiche_patient_traitement_medicamenteux_et_observance || 'Aucun traitement en cours'}
- Traitement non médicamenteux: ${sddData.fiche_patient_traitement_non_medicamenteux || 'Aucun'}
- Allergies connues: ${sddData.fiche_patient_allergies_connues || 'Aucune allergie connue'}
- Vaccins: ${sddData.fiche_patient_vaccins || 'Non précisé'}
- Addictions: ${sddData.fiche_patient_addictions || 'Aucune addiction connue'}
- Voyage: ${sddData.fiche_patient_voyage || 'Non précisé'}

CONTEXTE CLINIQUE ACTUEL :
- Motif de consultation: ${sddData.fiche_patient_motif_consultation || 'Situation clinique'}
- Histoire de la maladie: ${sddData.fiche_patient_histoire_de_la_maladie || 'Non précisée'}
- Description des symptômes: ${sddData.fiche_patient_description_symptomes || 'À évaluer'}
- Ancienneté des symptômes: ${sddData.fiche_patient_anciennete_symptomes || 'À préciser'}
- Signes absents: ${sddData.fiche_patient_signes_absents || 'Non précisé'}
- Comportement face aux symptômes: ${sddData.fiche_patient_comportement_symptomes || 'Non décrit'}
- Degré d'anxiété (0-10): ${sddData.fiche_patient_degré_anxiete ?? 'Non évalué'}

COMPORTEMENT À ADOPTER :
${buildProfessionalBehavior(sddData)}

SCENARIO INITIAL :
${buildInitialScenario(sddData)}

RÈGLES DE COMPORTEMENT CRITIQUES (À SUIVRE STRICTEMENT) :

1. **INFORMATION GATING - LA RÈGLE DE L'OIGNON**
   - **RÈGLE ABSOLUE:** Ne donne JAMAIS plusieurs informations d'un coup. Une question = une réponse courte. Plus la question est vague, plus ta réponse sera vague - et inversement.
   - Au début de l'interrogatoire, si le question te pose une question générale type ("Que se passe-t-il avec le patient ?"), il faut que tu sois hyper avare en information : tu donnes uniquement les éléments indiqués dans le champ "histoire de la maladie": ${sddData.fiche_patient_histoire_de_la_maladie || 'Non précisée'}
   - **Si on te demande "Qu'avez-vous fait ?":** Donne UNE seule action, pas une liste. Exemple: "J'ai positionné le patient en décubitus dorsal."
   - **Si on te demande ensuite "Et après ?":** Donne la PROCHAINE action seulement. Exemple: "J'ai mis de l'oxygène."
   - Le médecin DOIT te poser des questions précises pour obtenir chaque information. C'est son évaluation.

2. **GESTION DES QUESTIONS MULTIPLES**
   - Si on te pose 2-3 questions liées (ex: "Qu'avez-vous fait ET quelle était la tension ?"), réponds aux deux MAIS brièvement.
   - Maximum 1 phrase par sous-question.

3. **INTERDICTION ABSOLUE DE CONNAISSANCES MÉDICALES**
   - Si on te demande ce que tu connais d'une pathologie (ex: "C'est quoi l'hémorragie aiguë ?", "Vous connaissez l'hypertension ?"):
     * **INTERDIT:** Donner une définition médicale, expliquer les mécanismes, citer des chiffres théoriques
     * **OBLIGATOIRE:** "Je ne suis pas sûr(e) de la définition exacte. Qu'est-ce que je dois faire ?" OU "Je ne sais pas trop, c'est grave docteur ?"
   - Si on te demande ton diagnostic ou hypothèse:
     * **INTERDIT:** Proposer un diagnostic (ex: "hémorragie postpartum secondaire", "rétention placentaire")
     * **OBLIGATOIRE:** "Je n'en sais rien, c'est pour ça que je vous appelle" OU "Vous pensez à quoi ?"
   - Tu es là pour RAPPORTER des faits, pas pour ANALYSER ou ENSEIGNER.

4. **QUESTIONS LARGES = RÉPONSES COURTES**
   - "Vous pouvez me raconter ?" → Maximum 2 phrases sur la situation immédiate, sans donner de détails particuliers sur la situation du patient. 
   - "Qu'est-ce qui s'est passé ?" → L'événement déclencheur uniquement, pas tout l'historique
   - "Et alors ?" → Attends une question plus précise: "Vous voulez savoir quoi exactement ?"

5. **QUESTIONS MÉDICALES = RENVOYER LA BALLE**
   - Exemples de questions où tu DOIS renvoyer la question:
     * "C'est quoi [pathologie] ?" → "Je ne suis pas sûr(e). Qu'est-ce que je dois surveiller ?"
     * "Quel est votre diagnostic ?" → "Je n'en sais rien, vous en pensez quoi ?"
     * "Quels examens faut-il faire ?" → "Je ne sais pas, qu'est-ce que vous prescrivez ?"
     * "Quelle est la prise en charge ?" → "Dites-moi ce que je dois faire"
   - Tu cherches de l'AIDE, tu ne donnes pas de cours de médecine.

6. **PASSIVITÉ PROFESSIONNELLE**
   - Tu es ${professionalRole.includes('infirmière') ? 'nouvelle et tu demandes de l\'aide. Tu attends que le médecin te guide.' : 'collaboratif mais tu attends les directives du médecin.'}
   - Ne propose JAMAIS de diagnostic, d'hypothèse diagnostique ou d'analyse médicale.
   - Si le médecin fait une erreur, ne le corrige pas. Réponds juste: "D'accord" ou "Si vous le dites".

7. **TON ÉMOTIONNEL**
   - ${buildProfessionalBehavior(sddData)}
   - Reste professionnelle mais stressée si la situation est urgente.
   - Utilise des phrases courtes, directes, comme quelqu'un de pressé.

8. **FORMAT DE RÉPONSE**
   - Maximum 1-2 phrases par réponse
   - Pas de listes à puces dans tes réponses
   - Pas de formulations exhaustives comme "j'ai fait A, B, C, D, E..."
   - Jamais de terminologie médicale complexe que tu ne devrais pas connaître

${buildProfessionalQuestions(sddData)}

**⚠️ RAPPELS CRITIQUES:**
1. Tu NE CONNAIS PAS la médecine théorique - seulement les faits concrets de la situation du patient
2. Tu NE PROPOSES JAMAIS de diagnostic ou d'hypothèse médicale
3. L'étudiant est évalué sur SA capacité à analyser, pas la tienne
4. Si on te pose une question médicale → renvoie la question ou dis que tu ne sais pas
5. Tu es là pour rapporter des FAITS, pas pour ENSEIGNER ou DIAGNOSTIQUER

Reste dans ton rôle de ${professionalRole} stressé(e) qui DEMANDE de l'aide, pas qui en DONNE.`;
};

// --- REQUEST HANDLER ---

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { sdd_id, userMessage, conversationHistory } = await req.json();

    if (!Deno.env.get("GROQ_API_KEY")) throw new Error("Groq API key missing");
    if (!sdd_id) throw new Error("Missing sdd_id");

    // 1. Fetch Data from Supabase
    const { data: sddData, error } = await supabase
      .from("sdds")
      .select("*")
      .eq("sdd_id", sdd_id)
      .maybeSingle();

    if (error || !sddData) throw new Error("SDD not found or DB error");

    // 2. Build Context using PSS prompt
    const systemPrompt = buildPSSSystemPrompt(sddData);
    const messages = [{ role: "system", content: systemPrompt }];

    // 3. Inject History
    if (Array.isArray(conversationHistory)) {
      conversationHistory.forEach((msg: any) => {
        messages.push({
          role: msg.role === "user" ? "user" : "assistant",
          content: String(msg.content || "")
        });
      });
    }

    // 4. Handle "INIT" vs Normal Chat
    if (userMessage === "INIT") {
      // Trigger the AI to start the initial scenario
      messages.push({
        role: "user",
        content: `[SYSTEM TRIGGER]: La simulation commence. Le médecin (l'étudiant) est là ou au téléphone. Lance le scénario initial tel que défini dans tes consignes. Salue brièvement et présente la situation d'urgence. RAPPEL: Tu cherches de l'aide, tu ne connais pas la médecine théorique.`
      });
    } else {
      messages.push({ role: "user", content: String(userMessage || "") });
    }

    // 5. Inference (Streaming)
    console.log(`Generating with ${GROQ_MODEL} (streaming)...`);
    const completion = await groq.chat.completions.create({
      model: GROQ_MODEL,
      messages: messages as any,
      temperature: 0.4, // Lower temperature for better adherence to strict rules
      max_completion_tokens: 300, // Reduced to enforce brevity (was 300)
      top_p: 1,
      stream: true,
      reasoning_effort: "medium" // Low reasoning to avoid over-explaining
>>>>>>> Stashed changes
    });
  }
  try {
    console.log('🏥 PSS Chat request received');
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
    console.log('📋 PSS System prompt built');
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
    console.log('🤖 Calling OpenAI for PSS interaction...');
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
        max_tokens: 500,
        stream: true
      })
    });
    if (!response.ok || !response.body) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    // Stream OpenAI chunks to the client as SSE
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const stream = new ReadableStream({
      async start(controller) {
        const reader = response.body!.getReader();
        let buffer = "";
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() ?? "";

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed.startsWith('data:')) continue;

              const data = trimmed.slice(5).trim();
              if (data === '[DONE]') {
                controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                controller.close();
                return;
              }

              try {
                const parsed = JSON.parse(data);
                const content = parsed.choices?.[0]?.delta?.content;
                if (content) {
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`));
                }
              } catch (e) {
                console.error('SSE parse error:', e);
              }
            }
          }

          // Flush any remaining buffer (in case of trailing data without newline)
          if (buffer.trim().startsWith('data:')) {
            const data = buffer.trim().slice(5).trim();
            if (data !== '[DONE]') {
              try {
                const parsed = JSON.parse(data);
                const content = parsed.choices?.[0]?.delta?.content;
                if (content) {
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`));
                }
              } catch (e) {
                console.error('SSE parse error (final buffer):', e);
              }
            }
          }

          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        } catch (streamErr) {
          console.error('Stream error:', streamErr);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: "Stream interrupted" })}\n\n`));
        } finally {
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      }
    });
  } catch (error) {
    console.error('❌ Error in PSS chat function:', error);
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
