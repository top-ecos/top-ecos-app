// supabase/functions/chat-with-pss/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Groq from "npm:groq-sdk";

// --- CONFIG ---
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

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
  if (consignes.includes('infirmière') || consignes.includes('infirmier')) return 'infirmier(ère)';
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
   - **RÈGLE ABSOLUE:** Ne donne JAMAIS plusieurs informations d'un coup. Une question = une réponse courte.
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
   - "Vous pouvez me raconter ?" → Maximum 2 phrases sur la situation immédiate
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
1. Tu NE CONNAIS PAS la médecine théorique - seulement les faits concrets de la situation
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
      max_completion_tokens: 150, // Reduced to enforce brevity (was 300)
      top_p: 1,
      stream: true,
      reasoning_effort: "low" // Low reasoning to avoid over-explaining
    });

    // Create SSE stream response
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        try {
          for await (const chunk of completion) {
            const content = chunk.choices[0]?.delta?.content || '';
            if (content) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`));
            }
          }
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        } catch (streamError) {
          console.error("Stream error:", streamError);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: "Stream interrupted" })}\n\n`));
        } finally {
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: { 
        ...corsHeaders, 
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive"
      }
    });

  } catch (err: any) {
    console.error("Chat Error:", err);
    return new Response(JSON.stringify({ 
      error: err.message, 
      message: "Problème technique (IA). Veuillez réessayer." 
    }), {
      status: 500, 
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
