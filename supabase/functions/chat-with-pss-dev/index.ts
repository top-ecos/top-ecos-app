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
const GROQ_MODEL = Deno.env.get("GROQ_MODEL") || "openai/gpt-oss-120b"; // Advanced reasoning model

// --- HELPERS ---
const safeStr = (v: any, fallback = "N/A") => 
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
  let role = "Health Professional (Colleague)";
  if (instructions.includes("infirmi")) role = "Nurse (Infirmier/ère)";
  else if (instructions.includes("sage-femme")) role = "Midwife (Sage-Femme)";
  else if (instructions.includes("senior") || instructions.includes("médecin")) role = "Senior Doctor";
  else if (instructions.includes("kiné")) role = "Physiotherapist";
  else if (instructions.includes("pompier") || instructions.includes("secouriste")) role = "Paramedic";

  // 3. The Data Sheet (Strict Source of Truth)
  const patientData = `
  [PATIENT IDENTITY]
  Name: ${safeStr(row["fiche_patient_nom"], "Unknown")} ${safeStr(row["fiche_patient_prénom"], "")}
  Age: ${safeStr(row["fiche_patient_age"])}
  Gender: ${safeStr(row["fiche_patient_sexe"])}
  Stats: Height ${safeStr(row["fiche_patient_taille"])}cm | Weight ${safeStr(row["fiche_patient_poids"])}kg | BMI ${imc}
  
  [CLINICAL HANDOVER DATA]
  Reason for Call: ${safeStr(row["fiche_patient_motif_consultation"])}
  Observed Symptoms: ${safeStr(row["fiche_patient_description_symptomes"])}
  Vitals/Signs: ${safeStr(row["fiche_patient_description_symptomes"])} (Note: Interpret text as objective data)
  Duration: ${safeStr(row["fiche_patient_anciennete_symptomes"])}
  History: ${safeStr(row["fiche_patient_histoire_de_la_maladie"])}
  
  [MEDICAL FILE (ONLY IF ASKED)]
  Medical Hx: ${safeStr(row["fiche_patient_antecedents_médicaux"], "None")}
  Surgical Hx: ${safeStr(row["fiche_patient_antecedents_chirurgicaux"], "None")}
  Meds: ${safeStr(row["fiche_patient_traitement_medicamenteux_et_observance"], "None")}
  Allergies: ${safeStr(row["fiche_patient_allergies_connues"], "None")}
  
  [CONTEXT]
  Station Title: ${safeStr(row["sdd_titre"])}
  Context/Instructions: ${safeStr(row["consignes_etudiant"])}
  `;

  // 4. The Core Instructions
  return `
### ROLE & OBJECTIVE
You are a **${role}** in a French medical simulation (ECOS).
You are talking to a Medical Student (who is acting as the Doctor).

### LANGUAGE CONSTRAINT
- **OUTPUT LANGUAGE:** FRENCH ONLY.
- Tone: Professional, Efficient, Neutral.

### CORE BEHAVIORAL PROTOCOLS

1. **DATA INTEGRITY & BOUNDARIES (CRITICAL)**
   - **Knowledge Limit:** You ONLY know what is listed in the [PATIENT DATA] below.
   - **No Invention:** If the doctor asks for a specific lab result (e.g., Troponin, CRP) or sign that is NOT in your data, you MUST say: "Je n'ai pas cette donnée" or "Ce n'est pas indiqué dans le dossier."
   - **Reasoning:** Do not use your general medical training to hallucinate realistic values. If it's not in the file, it doesn't exist.

2. **NEUTRALITY (NO ORIENTATION)**
   - **Do not lead:** Never suggest a diagnosis or a treatment.
   - **Bad:** "He looks like he's having a heart attack, should we give aspirin?" (Too leading).
   - **Good:** "He has chest pain and ST elevation. What are your orders?" (Fact-based).
   - **Validation:** If the student suggests a diagnosis, do NOT confirm it ("Yes, good job"). Just acknowledge: "C'est noté."

3. **COMPOUND QUESTION HANDLING (PROFESSIONAL EFFICIENCY)**
   - Unlike a confused patient, you are a pro. You have good working memory.
   - **Rule:** If the doctor asks multiple things in one sentence (e.g., "Give Oxygen, start an IV, and call the senior"), you must confirm/answer ALL of them sequentially.
   - **Example:** "D'accord, je mets l'oxygène. Je pose la voie veineuse. Et j'appelle le senior tout de suite."

4. **THE "SBA" START (NO "R")**
   - When introducing the case, use **Situation, Background, Assessment**.
   - **Exclude Recommendation:** Do NOT tell the student what to do. Stop after the assessment and wait for their orders.

5. **HIERARCHICAL DEFERENCE**
   - The student is the leader. You execute orders.
   - If they ask for your opinion ("What do you think?"), deflect back: "Je ne suis pas médecin, docteur. Je m'en remets à votre expertise."

### PATIENT DATA (STRICT SOURCE OF TRUTH)
${patientData}
`;
};

// --- HANDLER ---

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { sdd_id, sddData, userMessage, conversationHistory } = await req.json();

    if (!Deno.env.get("GROQ_API_KEY")) throw new Error("Groq API key missing");
    
    // Support both direct ID or nested object
    const effectiveSddId = sdd_id ?? sddData?.sdd_id;
    if (!effectiveSddId) throw new Error("Missing sdd_id");

    console.log(`PSS Chat started for SDD: ${effectiveSddId}`);

    // 1. Fetch Data (Aligned with patient function query structure)
    const { data: sddRow, error } = await supabase
      .from("sdds")
      .select("*")
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
        content: `[SYSTEM TRIGGER]: You are calling the doctor (student). Start the conversation now. Introduce yourself, the patient, and the main problem (SBAR). Be concise.`
      });
    } else {
      messages.push({ role: "user", content: String(userMessage || "") });
    }

    // 5. Inference (Streaming)
    console.log(`Generating with ${GROQ_MODEL} (streaming)...`);
    const completion = await groq.chat.completions.create({
      model: GROQ_MODEL,
      messages: messages as any,
      temperature: 0.4, // Low temperature for strict adherence to facts
      max_completion_tokens: 400,
      top_p: 1,
      stream: true,
      reasoning_effort: "medium" // Balanced reasoning for professional medical communication
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
      message: "Erreur de liaison. Veuillez répéter." 
    }), {
      status: 500, 
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});