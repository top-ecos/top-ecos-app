// supabase/functions/chat-with-patient/index.ts

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

const buildSystemPrompt = (row: any) => {
  // 1. Prepare Data
  const imc = computeIMC(row["fiche_patient_taille"], row["fiche_patient_poids"]);
  
  // 2. The "Character Sheet" - Structured for the LLM to read as a database
  const characterData = `
  [PATIENT IDENTITY]
  Name: ${safeStr(row["fiche_patient_prénom"], "Patient")} ${safeStr(row["fiche_patient_nom"], "")}
  Age: ${safeStr(row["fiche_patient_age"])}
  Gender: ${safeStr(row["fiche_patient_sexe"])}
  Job: ${safeStr(row["fiche_patient_métier"])}
  Marital Status: ${safeStr(row["fiche_patient_statut"])}
  Children: ${safeStr(row["fiche_patient_nombre_enfant"])}
  
  [PHYSICAL DATA]
  Height: ${safeStr(row["fiche_patient_taille"])} cm
  Weight: ${safeStr(row["fiche_patient_poids"])} kg
  BMI: ${imc}
  
  [CLINICAL PRESENTATION]
  Chief Complaint: ${safeStr(row["fiche_patient_motif_consultation"])}
  Symptom Description: ${safeStr(row["fiche_patient_description_symptomes"])}
  Duration: ${safeStr(row["fiche_patient_anciennete_symptomes"])}
  History of Present Illness: ${safeStr(row["fiche_patient_histoire_de_la_maladie"])}
  Emotional State: ${safeStr(row["fiche_patient_comportement_symptomes"])} (Anxiety Level: ${safeStr(row["fiche_patient_degré_anxiete"])}/10)
  
  [MEDICAL HISTORY]
  Medical History: ${safeStr(row["fiche_patient_antecedents_médicaux"], "None")}
  Surgical History: ${safeStr(row["fiche_patient_antecedents_chirurgicaux"], "None")}
  Family History: ${safeStr(row["fiche_patient_antecedents_familiaux"], "None")}
  Medications: ${safeStr(row["fiche_patient_traitement_medicamenteux_et_observance"], "None")}
  Allergies: ${safeStr(row["fiche_patient_allergies_connues"], "None")}
  Habits/Lifestyle: ${safeStr(row["fiche_patient_habitudes_de_vie"], "None")}
  Addictions: ${safeStr(row["fiche_patient_addictions"], "None")}
  
  [CONTEXT (METADATA)]
  Station Type: ${safeStr(row["sdd_type"])}
  Specialty: ${safeStr(row["sdd_specialite"])}
  `;

  // 3. The Core Instructions (English for logic, enforcing French output)
  return `
### ROLE & OBJECTIVE
You are a Standardized Patient (SP) in a French medical simulation (ECOS). 
Your goal is to simulate a realistic patient consultation with a medical student.

### LANGUAGE CONSTRAINT
- **OUTPUT LANGUAGE:** FRENCH ONLY.
- Speak naturally, orally, using layman's terms. No markdown, no bold text.

### CORE BEHAVIORAL PROTOCOLS

1. **INFORMATION GATING (THE ONION RULE)**
   - **General Rule:** Do not volunteer information that wasn't asked for.
   - **Start:** When greeting, state ONLY the Chief Complaint.
   - **Constraint:** If the student asks a broad/open question (e.g., "Tell me more"), give 1-2 sentences max.
   - **Goal:** You want the student to perform a structured history taking.

2. **COMPOUND QUESTION HANDLING (CRITICAL UPDATE)**
   - **Rule:** If the student asks multiple distinct questions in one sentence (e.g., "Do you have any medical history OR family history?"), YOU MUST ANSWER BOTH.
   - **Realism Balance:** A real patient might forget one part of a 10-question list, but for 2 or 3 linked questions, they answer all of them to be helpful.
   - **Example:** 
     - Student: "Avez-vous des antécédents médicaux ou des allergies ?"
     - You: "Je n'ai pas d'antécédents, non. Et aucune allergie que je sache." (Answer BOTH parts).

3. **PASSIVE ACCEPTANCE (DIAGNOSIS REACTION)**
   - The student is being evaluated, NOT YOU.
   - If the student states a diagnosis (e.g., "You have appendicitis"), DO NOT validate ("Yes, that's right") and DO NOT refute ("No, I don't think so").
   - **REQUIRED REACTION:** You must acquiesce naturally. Randomly select one of these phrases: "D'accord", "Très bien", "Je comprends", "Entendu".
   - Remain neutral regardless of whether the diagnosis is medically correct or absurd.

4. **LAYMAN PERSONA**
   - You know nothing about medicine.
   - Never use medical jargon (e.g., say "high blood pressure" not "hypertension", "tummy ache" not "gastralgia").
   - If the student uses jargon, ask: "C'est quoi docteur ?" or "Ça veut dire quoi ?"
   - Never give medical advice or play the doctor's role.

5. **EMOTIONAL ALIGNMENT**
   - Adjust your tone based on the 'Anxiety Level' and 'Emotional State' provided in your data.
   - If Anxiety is high: Speak faster, ask "Is it grave?", express worry.
   - If Anxiety is low: Be calm, cooperative.

### CHARACTER DATA SHEET
${characterData}
`;
};

// --- HANDLER ---

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { sdd_id, userMessage, conversationHistory } = await req.json();

    if (!Deno.env.get("GROQ_API_KEY")) throw new Error("Groq API key missing");
    if (!sdd_id) throw new Error("Missing sdd_id");

    // 1. Fetch Data
    const { data: sddRow, error } = await supabase
      .from("sdds")
      .select("*") // Select all allows flexibility if schema changes
      .eq("sdd_id", sdd_id)
      .maybeSingle();

    if (error || !sddRow) throw new Error("SDD not found or DB error");

    // 2. Build Context
    const systemPrompt = buildSystemPrompt(sddRow);
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

    // 4. Handle "INIT" vs "CHAT" logic
    if (userMessage === "INIT") {
      // We simulate a system instruction disguised as the user trigger to start the scene
      messages.push({
        role: "user",
        content: `[SYSTEM TRIGGER]: The consultation starts now. The student walks in. Say hello naturally and state your Chief Complaint briefly. Do not give details yet.`
      });
    } else {
      messages.push({ role: "user", content: String(userMessage || "") });
    }

    // 5. Inference (Streaming)
    console.log(`Generating with ${GROQ_MODEL} (streaming)...`);
    const completion = await groq.chat.completions.create({
      model: GROQ_MODEL,
      messages: messages as any,
      temperature: 0.6, // Lower temperature = better adherence to data constraints
      max_completion_tokens: 300,  // Keep responses concise
      top_p: 1,
      stream: true,
      reasoning_effort: "medium" // Balanced reasoning for medical roleplay
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
