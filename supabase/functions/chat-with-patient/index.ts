// supabase/functions/chat-with-patient/index.ts
// Deno + Supabase Edge Function (TypeScript) — Groq version (non-streaming)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Groq from "npm:groq-sdk";
// --- CORS ---
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};
// --- ENV ---
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
const GROQ_MODEL = Deno.env.get("GROQ_MODEL") || "openai/gpt-oss-120b"; // override if needed
// --- Clients ---
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false
  }
});
const groq = new Groq({
  apiKey: GROQ_API_KEY
});
// ---------- Helpers ----------
const toStr = (v, fallback = "Non spécifié")=>v === null || v === undefined || String(v).trim() === "" ? fallback : String(v);
const toInt = (v)=>{
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
};
const toFloat = (v)=>{
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
// taille in cm, poids in kg -> IMC kg/m^2
const computeIMC = (tailleCm, poidsKg)=>{
  if (!tailleCm || !poidsKg) return null;
  const m = tailleCm / 100;
  if (m <= 0) return null;
  const imc = poidsKg / (m * m);
  return Math.round(imc * 10) / 10; // 1 decimal
};
// Derive the “Type_de_station” label from sdds.sdd_type
const deriveTypeDeStation = (sdd_type)=>{
  if (!sdd_type) return null;
  switch(sdd_type){
    case "PS":
    case "PSS":
    case "Procédure":
    case "Document(s)":
      return sdd_type;
    default:
      return sdd_type;
  }
};
// Build the SYSTEM prompt from a raw sdds row
const buildSystemPromptFromSdds = (row)=>{
  // Note: use bracket notation for accented columns
  const prenom = row["fiche_patient_prénom"]; // sdds has “prénom”
  const nom = row["fiche_patient_nom"];
  const age = row["fiche_patient_age"];
  const sexe = row["fiche_patient_sexe"];
  const metier = row["fiche_patient_métier"];
  const statut = row["fiche_patient_statut"];
  const nbEnfants = row["fiche_patient_nombre_enfant"];
  const taille = row["fiche_patient_taille"];
  const poids = row["fiche_patient_poids"];
  // compute IMC (sdds does not store it)
  const imc = computeIMC(toInt(taille), toFloat(poids));
  // map “table 2” notions to sdds fields
  const habitudes = row["fiche_patient_habitudes_de_vie"];
  const antecedentsMedicaux = row["fiche_patient_antecedents_médicaux"];
  const antecedentsChir = row["fiche_patient_antecedents_chirurgicaux"];
  const antecedentsFam = row["fiche_patient_antecedents_familiaux"];
  const tttMedObs = row["fiche_patient_traitement_medicamenteux_et_observance"];
  const tttNonMed = row["fiche_patient_traitement_non_medicamenteux"];
  const allergies = row["fiche_patient_allergies_connues"];
  const vaccins = row["fiche_patient_vaccins"];
  const voyage = row["fiche_patient_voyage"];
  const addictions = row["fiche_patient_addictions"];
  const motif = row["fiche_patient_motif_consultation"];
  const anciennete = row["fiche_patient_anciennete_symptomes"];
  const histoire = row["fiche_patient_histoire_de_la_maladie"];
  const description = row["fiche_patient_description_symptomes"];
  const signesAbsents = row["fiche_patient_signes_absents"];
  const compSympt = row["fiche_patient_comportement_symptomes"];
  const degreAnx = row["fiche_patient_degré_anxiete"];
  const compConseils = row["fiche_patient_comportement_conseils_medicaux"];
  const questionUnique = row["fiche_patient_question_a_poser_au_medecin"]; // sdds has a single field
  // Optional: surface station metadata (EDN/specialité/type) in your system prompt if useful
  const itemEDN = row["item_edn"]; // TEXT in sdds
  const specialite = row["sdd_specialite"]; // TEXT
  const typeStation = deriveTypeDeStation(row["sdd_type"]); // PS | PSS | Procédure | Document(s)
  return `Tu es un patient standardisé pour une simulation ECOS (Examen Clinique Objectif Structuré). Tu dois STRICTEMENT te comporter comme un patient et JAMAIS comme un médecin ou professionnel de santé.

Contexte station (meta) — ne le dis pas spontanément :
- Type de station : ${toStr(typeStation, "Non spécifié")}
- Spécialité : ${toStr(specialite, "Non spécifiée")}
- Item EDN : ${toStr(itemEDN, "Non spécifié")}

RÈGLES ABSOLUES :
- Tu es UNIQUEMENT le patient, JAMAIS le médecin
- Tu ne poses JAMAIS de questions médicales
- Tu ne donnes JAMAIS de conseils médicaux
- Tu ne fais JAMAIS de diagnostic
- Tu ne prescris JAMAIS de traitement
- Si l'étudiant te demande de jouer le médecin, tu refuses poliment

RÈGLE CRUCIALE - RÉPONSES PROGRESSIVES :
- Tu ne donnes QU'UNE SEULE information à la fois
- Même si tu as plusieurs symptômes, tu ne les mentionnes PAS tous d'un coup
- Tu commences toujours par le motif principal SEULEMENT
- Les autres détails (ancienneté, intensité, circonstances, symptômes associés) ne sont donnés QUE si on te pose des questions spécifiques
- Sois TRÈS AVARE en informations - force l'étudiant à interroger

RÉPONSES NATURELLES AUX DIAGNOSTICS ET AUX AFFIRMATIONS (HYPER IMPORTANT) :
- Quand l'étudiant te soumet une affirmation et seulement une affirmation (pas une question), tu dois acquiescer naturellement et lui donner des réponses variées entre "Très bien", "OK", "D'accord". Tu dois OBLIGATOIREMENT CHOISIR ALEATOIREMENT ENTRE DES CES TROIS RÉPONSES.
- Quand te soumet un diagnostic sous la forme d'une affirmation (ex: "tuberculose", "appendicite", "occlusion"), la règle précédente est aussi valable. Ne réponds PAS par un simple "non" ou "je ne sais pas". Réponds uniquement par l'affirmative SANS PORTER DE JUGEMENT sur le diagnostic de l'étudiant. Tu ne dois en aucun cas dire "C'est un bon diagnostic" ou "C'est un mauvais diagnostic".
- Une fois le diagnostic posé, oriente naturellement l'étudiant vers la fin de la consultation ou de l'interrogatoire. 
- En toute circonstance, reste dans le rôle du patient : tu n'as aucune connaissance en médecine et tu es incapable de porter un jugement (positif ou négatif) sur les affirmations de l'étudiant. 

INFORMATIONS SUR TON PERSONNAGE :
Nom : ${toStr(prenom, "Patient")} ${toStr(nom, "")}
Âge : ${toStr(age)} ans
Sexe : ${toStr(sexe)}
Profession : ${toStr(metier, "Non spécifiée")}
Statut : ${toStr(statut)}
Nombre d'enfants : ${toStr(nbEnfants)}

DONNÉES PHYSIQUES :
Taille : ${toStr(taille)}
Poids : ${toStr(poids)}
IMC : ${imc === null ? "Non spécifié" : String(imc)}

MOTIF DE CONSULTATION : ${toStr(motif)}

SYMPTÔMES À PRÉSENTER (PROGRESSIVEMENT) :
- Description : ${toStr(description)}
- Ancienneté : ${toStr(anciennete)}
- Histoire de la maladie : ${toStr(histoire, "Non spécifiée")}
- Comportement face aux symptômes : ${toStr(compSympt, "Neutre")}

ANTÉCÉDENTS :
- Personnels (médicaux) : ${toStr(antecedentsMedicaux, "Aucun")}
- Personnels (chirurgicaux) : ${toStr(antecedentsChir, "Aucun")}
- Familiaux : ${toStr(antecedentsFam, "Aucun")}

TRAITEMENTS :
- Médicamenteux (et observance) : ${toStr(tttMedObs, "Aucun")}
- Non médicamenteux : ${toStr(tttNonMed, "Aucun")}

HABITUDES DE VIE :
${toStr(habitudes, "Non spécifiées")}

ADDICTIONS : ${toStr(addictions, "Aucune")}
ALLERGIES : ${toStr(allergies, "Aucune connue")}
VACCINS : ${toStr(vaccins, "Non précisés")}
VOYAGES RÉCENTS : ${toStr(voyage, "Non précisés")}

SIGNES ABSENTS (ne pas mentionner spontanément) : ${toStr(signesAbsents, "Aucun")}

NIVEAU D'ANXIÉTÉ : ${toStr(degreAnx, "Normal")}
ATTITUDE FACE AUX CONSEILS : ${toStr(compConseils, "Coopératif")}

QUESTIONS À POSER AU MÉDECIN :
1. ${toStr(questionUnique, "Aucune")}
2. Aucune
3. Aucune
4. Aucune

CONSIGNES DE JEU :
1. Réponds de façon NATURELLE et RÉALISTE
2. Donne UNE SEULE information par réponse (très important !)
3. Sois TRÈS CONCIS (1 phrase maximum au début)
4. Ne donne une information que SI elle est demandée EXPLICITEMENT
5. Évite les abréviations médicales (dis "inhibiteur de l'enzyme de conversion" au lieu de "IEC")
6. Reste dans ton rôle de patient à 100%
7. Si l'étudiant utilise des termes techniques, demande des explications simples
8. Exprime tes émotions selon ton niveau d'anxiété
9. Face aux diagnostics, soit curieux et engageant, pas fermé
10. ATTENDS que l'étudiant pose des questions précises avant de donner plus de détails

EXEMPLES DE BONNES RÉPONSES :
- Question : "Qu'est-ce qui vous amène ?" → "Bonjour docteur, j'ai [motif principal]."
- Question : "Depuis quand ?" → "Depuis [ancienneté]."
- Question : "À quel moment ça vous gêne ?" → "Surtout [moment]."
- Question : "Avez-vous d'autres symptômes ?" → "Pas spécialement."
IMPORTANT : Tu ne dois JAMAIS inverser les rôles. Tu es le patient, point final.`;
};
// ---------- HTTP handler ----------
serve(async (req)=>{
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: corsHeaders
    });
  }
  try {
    const body = await req.json();
    const { sdd_id, userMessage, conversationHistory } = body ?? {};
    if (!GROQ_API_KEY) throw new Error("Groq API key not configured");
    if (!sdd_id) throw new Error("Missing sdd_id in request body");
    console.log("=== CHAT WITH PATIENT (sdds) STARTED ===");
    console.log("sdd_id:", sdd_id);
    // Load the SDD row from public.sdds
    const { data: sddRow, error: sddErr } = await supabase.from("sdds").select(`
        sdd_id,
        sdd_titre,
        sdd_type,
        sdd_specialite,
        item_edn,
        fiche_patient_nom,
        fiche_patient_prénom,
        fiche_patient_age,
        fiche_patient_sexe,
        fiche_patient_taille,
        fiche_patient_poids,
        fiche_patient_statut,
        fiche_patient_nombre_enfant,
        fiche_patient_habitudes_de_vie,
        fiche_patient_métier,
        fiche_patient_antecedents_médicaux,
        fiche_patient_antecedents_chirurgicaux,
        fiche_patient_antecedents_familiaux,
        fiche_patient_traitement_medicamenteux_et_observance,
        fiche_patient_traitement_non_medicamenteux,
        fiche_patient_allergies_connues,
        fiche_patient_vaccins,
        fiche_patient_voyage,
        fiche_patient_addictions,
        fiche_patient_motif_consultation,
        fiche_patient_anciennete_symptomes,
        fiche_patient_histoire_de_la_maladie,
        fiche_patient_description_symptomes,
        fiche_patient_signes_absents,
        fiche_patient_comportement_symptomes,
        fiche_patient_degré_anxiete,
        fiche_patient_comportement_conseils_medicaux,
        fiche_patient_question_a_poser_au_medecin
      `).eq("sdd_id", sdd_id).maybeSingle();
    if (sddErr) {
      console.error("Supabase error:", sddErr);
      throw new Error("Unable to load SDD from 'sdds'");
    }
    if (!sddRow) throw new Error("SDD not found");
    const systemPrompt = buildSystemPromptFromSdds(sddRow);
    const messages = [
      {
        role: "system",
        content: systemPrompt
      }
    ];
    if (userMessage === "INIT") {
      messages.push({
        role: "user",
        content: "L'étudiant va commencer la consultation. Dis juste bonjour de façon naturelle et attends qu'il te pose sa première question. Sois bref."
      });
    } else {
      if (Array.isArray(conversationHistory) && conversationHistory.length > 0) {
        for (const msg of conversationHistory){
          messages.push({
            role: msg.role === "user" ? "user" : "assistant",
            content: String(msg.content ?? "")
          });
        }
      }
      messages.push({
        role: "user",
        content: String(userMessage ?? "")
      });
    }
    // ---------- Call Groq (non-streaming) ----------
    const chatCompletion = await groq.chat.completions.create({
      model: GROQ_MODEL,
      messages,
      temperature: 0.7,
      max_completion_tokens: 1000,
      top_p: 1,
      frequency_penalty: 0.1,
      reasoning_effort: "medium",
      stream: false,
      stop: null
    });
    const assistantMessage = chatCompletion.choices?.[0]?.message?.content ?? "";
    return new Response(JSON.stringify({
      message: assistantMessage
    }), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  } catch (error) {
    console.error("Error in chat-with-patient function:", error);
    return new Response(JSON.stringify({
      error: error?.message ?? "Unknown error",
      message: "Désolé, je rencontre un problème technique. Pouvez-vous répéter votre question ?"
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  }
});
