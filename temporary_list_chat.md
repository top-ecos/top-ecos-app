Here’s a concise map of the code involved in **simulation and evaluation**:

### Pages
- `src/pages/Simulation.tsx` – main simulation page (renders chat/evaluation flow).
- `src/pages/LazySimulation.tsx` – lazy-loaded wrapper for the simulation page.
- Related selection/history surfaces:
  - `src/pages/Cases.tsx` – list/select a station to simulate.
  - `src/pages/home.tsx`, `src/pages/dashboard.tsx`, `src/pages/history.tsx` – entry points that can lead into simulation or show past results.

### Core Simulation Container
- `src/components/ChatInterface.tsx` – orchestrates the simulation:
  - Chooses PS/PSS vs Sèche mode.
  - Uses `useChat` (conversation), `useEvaluation` (PS/PSS), `useSecheEvaluation` (Sèche), `useSimulationState` (replay/eval toggles), `useStationProgress`.

### Chat UI (during simulation)
- `src/components/chat/ChatView.tsx` – main chat UI (messages, input, timer, documents).
- `src/components/chat/ChatMessages.tsx`
- `src/components/chat/ChatInput.tsx`
- `src/components/chat/ChatHeader.tsx`
- `src/components/chat/BottomActionBar.tsx`
- `src/components/chat/ReplayView.tsx` – for replay mode.
- `src/components/chat/EvaluationView.tsx` – displays evaluation results inside the chat flow.

### Evaluation Display Components
- `src/components/EvaluationResults.tsx` – high-level evaluation card used by `EvaluationView`.
- `src/components/evaluation/ActionsList.tsx` – lists actions réussies/manquées.
- `src/components/evaluation/CommunicationGrid.tsx` – shows communication scores.
- `src/components/evaluation/ScoreCard.tsx` (+ `ScoreCard copy.tsx`)
- `src/components/evaluation/ScoreChart.tsx`

### Hooks (simulation/evaluation logic)
- `src/hooks/useChat.ts` – drives conversation (selects `chat-with-patient` vs `chat-with-pss`).
- `src/hooks/useEvaluation.ts` – PS/PSS evaluation (selects `evaluate-performance` or `evaluate-performance-dev`).
- `src/hooks/useSecheEvaluation.ts` – Sèche evaluation (selects `evaluate-performance-seche` or `evaluate-performance-seche-dev`).
- `src/hooks/useEvaluationScores.ts` – derives max scores/colors for display.
- `src/hooks/useSimulationState.ts` – handles UI state (replay/evaluation toggles).
- `src/hooks/useStationProgress.ts`, `src/hooks/useResults.ts` – progress/results storage.
- `src/hooks/useProfile.ts`, `src/hooks/useAuth.ts` – user context used during save/eval.

### Type/Utility Support
- `src/types/evaluation.ts`, `src/types/sdd.ts` – shapes for evaluation and station data.
- `src/lib/station.ts` – normalizes station types (PS, PSS, Sèche/Documents).
- `src/lib/simulation.ts` – helper to start simulation (invokes chat function).

If you want a tighter list (only what renders during the simulation/evaluation run): `Simulation.tsx`, `LazySimulation.tsx`, `ChatInterface.tsx`, `ChatView.tsx` (+ its chat subcomponents), `EvaluationView.tsx`, `EvaluationResults.tsx`, and the evaluation UI pieces under `src/components/evaluation/`.