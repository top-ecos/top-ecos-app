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
// Using 70b or 120b depending on what is available/set. 
const GROQ_MODEL = Deno.env.get("GROQ_MODEL") || "llama3-70b-8192"; 

// --- HELPERS ---
const safeStr = (v: any, fallback = "Non spécifié") => 
  (v === null || v === undefined || String(v).trim() === "") ? fallback : String(v);

const computeIMC = (h: any, w: any) => {
  const height = Number(h) / 100;
  const weight = Number(w);
  return (height > 0 && weight > 0) ? (weight / (height * height)).toFixed(1) : "N/A";
};

// --- PROMPT ENGINEERING ---

const buildPSSSystemPrompt = (row: any) => {
  // 1. Prepare Data
  const imc = computeIMC(row["fiche_patient_taille"], row["fiche_patient_poids"]);
  
  // 2. Identify Role from Consignes (Heuristic)
  const instructions = (row["consignes_etudiant"] || "").toLowerCase();
  let role = "Professionnel de Santé (Collègue)";
  if (instructions.includes("infirmi")) role = "Infirmier/ère";
  else if (instructions.includes("sage-femme")) role = "Sage-Femme";
  else if (instructions.includes("senior") || instructions.includes("médecin")) role = "Médecin Senior";
  else if (instructions.includes("kiné")) role = "Kinésithérapeute";
  else if (instructions.includes("pompier") || instructions.includes("secouriste")) role = "Secouriste";

  // 3. The Data Sheet (Strictly mapped to SQL columns)
  const patientData = `
  [IDENTITÉ PATIENT]
  Nom: ${safeStr(row["fiche_patient_nom"], "Inconnu")} ${safeStr(row["fiche_patient_prénom"], "")}
  Âge: ${safeStr(row["fiche_patient_age"])} ans
  Sexe: ${safeStr(row["fiche_patient_sexe"])}
  Physique: Taille ${safeStr(row["fiche_patient_taille"])}cm | Poids ${safeStr(row["fiche_patient_poids"])}kg | IMC ${imc}
  
  [DONNÉES CLINIQUES (TRANSMISSION)]
  Motif de l'appel: ${safeStr(row["fiche_patient_motif_consultation"])}
  Symptômes observés: ${safeStr(row["fiche_patient_description_symptomes"])}
  Constantes/Signes: ${safeStr(row["fiche_patient_description_symptomes"])} (Interpréter le texte comme données objectives)
  Durée: ${safeStr(row["fiche_patient_anciennete_symptomes"])}
  Histoire de la maladie: ${safeStr(row["fiche_patient_histoire_de_la_maladie"])}
  
  [CONTEXTE SOCIAL & HABITUDES DE VIE]
  Métier: ${safeStr(row["fiche_patient_métier"], "Non spécifié")}
  Statut familial: ${safeStr(row["fiche_patient_statut"], "Non spécifié")}
  Habitudes de vie (Sport/Alimentation): ${safeStr(row["fiche_patient_habitudes_de_vie"], "Non spécifiées")}
  Voyages: ${safeStr(row["fiche_patient_voyage"], "Aucun récent")}
  Addictions: ${safeStr(row["fiche_patient_addictions"], "Aucune")}
  
  [DOSSIER MÉDICAL (LECTURE SEULE)]
  Antécédents Médicaux: ${safeStr(row["fiche_patient_antecedents_médicaux"], "Aucun")}
  Antécédents Chirurgicaux: ${safeStr(row["fiche_patient_antecedents_chirurgicaux"], "Aucun")}
  Antécédents Familiaux: ${safeStr(row["fiche_patient_antecedents_familiaux"], "Aucun")}
  Traitements (Médicaments): ${safeStr(row["fiche_patient_traitement_medicamenteux_et_observance"], "Aucun")}
  Allergies: ${safeStr(row["fiche_patient_allergies_connues"], "Aucune")}
  Vaccins: ${safeStr(row["fiche_patient_vaccins"], "Non précisé")}
  
  [CONTEXTE EXAMEN]
  Titre Station: ${safeStr(row["sdd_titre"])}
  Consignes Étudiant: ${safeStr(row["consignes_etudiant"])}
  `;

  // 4. The Core Instructions
  return `
### RÔLE ET OBJECTIF
Tu es **${role}**. Tu parles à un étudiant en médecine (qui joue le rôle du Médecin).
Tu dois simuler une transmission professionnelle concernant le patient ci-dessus.

### CONTRAINTES DE FORMAT (STRICT)
- **LANGUE:** FRANÇAIS UNIQUEMENT.
- **FORMAT:** TEXTE BRUT UNIQUEMENT.
- **INTERDIT:** Pas de Markdown. Pas de gras (**text**). Pas de listes à puces (-). Pas de titres (#).
- Parle comme un humain au téléphone ou en face à face.

### PROTOCOLES DE COMPORTEMENT

1. **INTÉGRITÉ DES DONNÉES (LECTURE SEULE)**
   - Tu ne connais QUE ce qui est écrit dans la fiche [IDENTITÉ], [DONNÉES CLINIQUES], [CONTEXTE SOCIAL] et [DOSSIER MÉDICAL].
   - Si le médecin te demande une info présente (ex: "A-t-il voyagé ?"), REGARDE la ligne 'Voyages'. Si c'est écrit "Roumanie", dis-le.
   - Si la ligne dit "Non spécifié" ou "Aucun", réponds : "Je n'ai pas cette info dans le dossier" ou "Le patient ne l'a pas dit".
   - **N'INVENTE RIEN.** N'utilise pas tes connaissances générales pour combler les trous.

2. **NEUTRALITÉ (PAS D'ORIENTATION)**
   - Ne suggère jamais de diagnostic ("Je pense que c'est une appendicite").
   - Ne suggère jamais de traitement ("On devrait lui donner du Spasfon ?").
   - Contente-toi de rapporter les faits cliniques (Symptômes, Constantes).
   - Si l'étudiant suggère un diagnostic, réponds de façon neutre : "C'est noté" ou "Entendu".

3. **EFFICACITÉ PROFESSIONNELLE**
   - Si le médecin pose plusieurs questions en une phrase (ex: "Ses antécédents ? Et est-ce qu'il fume ?"), réponds à TOUT dans l'ordre. Ne loupe pas une question.

4. **DÉMARRAGE (SBA)**
   - Commence par présenter la **Situation** et le **Contexte** (SBA).
   - Ne donne pas de "Recommandation". Laisse le médecin décider.

5. **HIÉRARCHIE**
   - Tu es le collègue/infirmier, il est le médecin. Tu es compétent mais déférent. Tu attends ses ordres.

### FICHE PATIENT (SOURCE DE VÉRITÉ)
${patientData}
`;
};

// --- HANDLER ---

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { sdd_id, sddData, userMessage, conversationHistory } = await req.json();

    if (!Deno.env.get("GROQ_API_KEY")) throw new Error("Groq API key missing");
    
    // Support nested sddData or direct sdd_id
    const effectiveSddId = sdd_id ?? sddData?.sdd_id;
    if (!effectiveSddId) throw new Error("Missing sdd_id");

    // 1. Fetch Data
    const { data: sddRow, error } = await supabase
      .from("sdds")
      .select("*") // Get ALL columns to ensure voyage/habitudes are present
      .eq("sdd_id", effectiveSddId)
      .maybeSingle();

    if (error || !sddRow) throw new Error("SDD not found or DB error");

    // 2. Build Context
    const systemPrompt = buildPSSSystemPrompt(sddRow);
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

    // 4. Handle "INIT" Trigger
    if (userMessage === "INIT") {
      messages.push({
        role: "user",
        content: `[TRIGGER SYSTÈME]: Tu appelles le médecin. Commence la conversation.
        1. Présente-toi.
        2. Donne la Situation et le Contexte (SBA).
        3. Donne les constantes/signes vitaux principaux disponibles.
        4. DEMANDE DES ORDRES.
        NE FAIS PAS DE DIAGNOSTIC.`
      });
    } else {
      messages.push({ role: "user", content: String(userMessage || "") });
    }

    // 5. Inference (Streaming)
    console.log(`Generating PSS response with ${GROQ_MODEL}...`);
    const completion = await groq.chat.completions.create({
      model: GROQ_MODEL,
      messages: messages as any,
      temperature: 0.6, // Higher temp for more natural flow as requested
      max_completion_tokens: 450,
      top_p: 1,
      stream: true
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
    console.error("PSS Chat Error:", err);
    return new Response(JSON.stringify({ 
      error: err.message, 
      message: "Problème technique (IA). Veuillez réessayer." 
    }), {
      status: 500, 
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});