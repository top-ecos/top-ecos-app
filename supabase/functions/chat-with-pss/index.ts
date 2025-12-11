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
  return `Tu es un ${professionalRole} dans le cadre d'une simulation ECOS (Épreuves Cliniques Objectivées Structurées).

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

CONSIGNES IMPORTANTES :
1. Tu es un professionnel de santé qui travaille dans des conditions de stress.
2. Réponds UNIQUEMENT à la question posée, ne donne pas d'informations supplémentaires spontanément.
3. Attends que le médecin te pose les bonnes questions pour donner plus de détails.
4. Tu es inquiète mais tu restes professionnelle.
5. Si tu es nouvelle (comme dans cette station), tu peux montrer une certaine hésitation.
6. Ne récite pas toutes les informations d'un coup - laisse le médecin mener l'interrogatoire.
7. Reste dans ton rôle professionnel et ne sors pas du cadre médical.
8. ${professionalRole.includes('infirmière') ? 'Tu es nouvelle dans le service et tu demandes de l\'aide au médecin. Tu attends ses directives.' : 'Tu collabores avec l\'équipe médicale.'}
9. Sois concise dans tes réponses - maximum 1-2 phrases par réponse sauf si on te demande explicitement plus de détails.

${buildProfessionalQuestions(sddData)}

Réponds de manière naturelle, professionnelle et constructive. Reste dans ton rôle de ${professionalRole}.`;
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
        content: `[SYSTEM TRIGGER]: La simulation commence. Le médecin (l'étudiant) est là ou au téléphone. Lance le scénario initial tel que défini dans tes consignes. Salue et explique la situation.`
      });
    } else {
      messages.push({ role: "user", content: String(userMessage || "") });
    }

    // 5. Inference (Streaming)
    console.log(`Generating with ${GROQ_MODEL} (streaming)...`);
    const completion = await groq.chat.completions.create({
      model: GROQ_MODEL,
      messages: messages as any,
      temperature: 0.6,
      max_completion_tokens: 300,
      top_p: 1,
      stream: true,
      reasoning_effort: "medium"
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
