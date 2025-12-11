I'll analyze the three station types and their differences. Let me explore the codebase to understand how they're distinguished and routed to the correct evaluation functions.

[12 tools called]

Now let me verify the current routing logic in the evaluation hook:

[5 tools called]

Perfect! I've analyzed the codebase thoroughly. Here's a comprehensive breakdown of the three station types and their evaluation routing:

## 🎯 Three Station Types

### 1. **PS (Patient Simulé / Simulated Patient)**
**Interaction format:** Interactive dialogue with a simulated patient  
**Chat function:** `chat-with-patient` (uses Groq AI)  
**Evaluation function:** `evaluate-performance` (or `evaluate-performance-dev` with GPT-5.1)

**Key characteristics:**
- Student interviews an AI patient who has a medical condition
- Patient reveals information progressively ("onion rule" - only answers what's asked)
- Patient uses layman's terms, no medical knowledge
- Patient has complete medical history (symptoms, antecedents, medications, etc.)
- Evaluates clinical history-taking and communication skills

### 2. **PSS (Professionnel de Santé Simulé / Simulated Healthcare Professional)**
**Interaction format:** Phone call with stressed healthcare professional  
**Chat function:** `chat-with-pss` (uses OpenAI)  
**Evaluation function:** `evaluate-performance` (or `evaluate-performance-dev` with GPT-5.1)

**Key characteristics:**
- Student receives a call from a healthcare professional (nurse, pharmacist, etc.) asking for help
- **Critical constraint: "IGNORANCE MÉDICALE"** - The PSS knows NO medical theory, only concrete facts
- PSS is stressed and passive, waiting for the student to guide them
- PSS cannot propose diagnoses or medical hypotheses
- If asked for medical opinion: "Je ne sais pas, c'est pour ça que je vous appelle"
- Tests student's ability to manage crisis situations and give clear directives

### 3. **Sèche / Document(s) (Document Analysis Station)**
**Interaction format:** Written reflection/analysis (no live dialogue)  
**Chat function:** None - student writes their analysis  
**Evaluation function:** `evaluate-performance-seche` (or `evaluate-performance-seche-dev` with GPT-5.1)

**Key characteristics:**
- No simulated character - student analyzes documents/cases independently
- Student submits written reflection/analysis
- Evaluates clinical reasoning on paper-based scenarios
- May include medical documents, lab results, prescription analysis, etc.

---

## ✅ Current Routing Logic

The routing is **correctly implemented** in `useEvaluation.ts` (lines 34-36):

```typescript
const functionName = caseData.Type_de_station === 'Sèche' 
  ? (useGPT5 ? 'evaluate-performance-seche-dev' : 'evaluate-performance-seche')
  : (useGPT5 ? 'evaluate-performance-dev' : 'evaluate-performance');
```

**Translation:**
- **If `Type_de_station === 'Sèche'`** → Use `evaluate-performance-seche[-dev]`
- **Otherwise (PS or PSS)** → Use `evaluate-performance[-dev]`

This is correct! ✅

---

## 🔍 Key Evaluation Differences

### PS/PSS Evaluation (`evaluate-performance`)
**Data fetched from:** `sdds` table + `SDD_Type_A_Eval_2_MVP` for communication skills

**Conversation processing:**
```typescript
// Only evaluates STUDENT messages (role: 'user')
// Patient/PSS responses are NOT evaluated
const studentMessages = conversationHistory
  .filter(msg => msg.role === 'user')
  .map(msg => `ÉTUDIANT: ${msg.content}`)
```

**Evaluation focus:**
- Interactive clinical actions (history taking, communication)
- Student's questions and interventions
- Validates against expected clinical actions (up to 15 actions)

---

### Sèche Evaluation (`evaluate-performance-seche`)
**Data fetched from:** `sdds` table (communication skills embedded differently)

**Conversation processing:**
```typescript
// Treats all user messages as continuous reflection
// Single message: "RÉFLEXION DE L'ÉTUDIANT: ..."
// Multiple messages: Concatenated user content
```

**Evaluation focus:**
- Written clinical reasoning and analysis
- Completeness of document interpretation
- Medical knowledge application on paper
- More emphasis on explicit explanations vs. interactive questioning

---

## 📊 Summary Table

| Feature | PS | PSS | Sèche |
|---------|----|----|-------|
| **Format** | Patient interview | Phone with professional | Document analysis |
| **Chat Function** | `chat-with-patient` | `chat-with-pss` | None |
| **Evaluation** | `evaluate-performance` | `evaluate-performance` | `evaluate-performance-seche` |
| **AI Character** | Simulated patient | Stressed healthcare worker | No character |
| **Medical Knowledge** | Layman's understanding | NO medical knowledge | N/A |
| **Student Role** | Interview/diagnose | Guide/instruct | Analyze/explain |
| **Conversation** | Interactive dialogue | Phone call | Written submission |

---

## 🎓 Routing Verification

Your current implementation correctly routes:
- ✅ **PS → `evaluate-performance[-dev]`**
- ✅ **PSS → `evaluate-performance[-dev]`** (same as PS)
- ✅ **Sèche → `evaluate-performance-seche[-dev]`**

The distinction is made on line 34 of `useEvaluation.ts` by checking `Type_de_station === 'Sèche'`, which handles the "Document(s)" station type properly.