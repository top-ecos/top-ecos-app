
import React, { useEffect, useCallback, useState } from "react";
import { useChat } from "@/features/chat/hooks/useChat";
import { useUnifiedEvaluation } from "@/features/evaluation/hooks/useUnifiedEvaluation";
import { useSimulationState } from "@/features/simulation/hooks/useSimulationState";
import { useStationProgress } from "@/shared/hooks/useStationProgress";
import ChatView from "@/features/chat/components/ChatView";
import ReplayView from "@/features/chat/components/ReplayView";
import EvaluationView from "@/features/evaluation/components/EvaluationView";
import LoadingEvaluation from "@/components/LoadingEvaluation";
import { StationTypeManager } from "@/features/station/lib/stationTypeManager";
// Note: Rebuilt 'documents' (ex-"Sèche") mode to reuse ChatView UI
import type { CaseData } from "@/features/station/types/sdd.types";
import type { EvaluationResult } from "@/features/evaluation/types/evaluation.types";
import { useProfile } from "@/shared/hooks/useProfile";
import { startSimulation } from "@/features/simulation/lib/simulation";

interface ChatInterfaceProps {
  caseData: CaseData;
  onBack: () => void;
  initialPatientMessage?: string | null;
  preloadedEvaluation?: EvaluationResult;
}

const ChatInterface = React.memo(({ caseData, onBack, initialPatientMessage, preloadedEvaluation }: ChatInterfaceProps) => {

  // Station progress management
  const { markStationCompleted, resetStationProgress, updateLastAttempt } = useStationProgress();
  const { updateTokens } = useProfile();

  // Use StationTypeManager for centralized type detection
  const isStationSeche = StationTypeManager.isDocumentStation(caseData);
  
  const {
    showReplay,
    showEvaluation,
    handleShowReplay,
    handleShowEvaluation,
    handleBackToChat
  } = useSimulationState();

  const {
    messages,
    inputMessage,
    setInputMessage,
    isLoading,
    timeRemaining,
    isPaused,
    isTimeUp,
    togglePause,
    sendMessage,
    resetStation,
    clearSavedData
  } = useChat(caseData, initialPatientMessage);

  // Use unified evaluation hook that handles all station types
  const { evaluationResult, isEvaluating, evaluatePerformance } = useUnifiedEvaluation(caseData, messages);

  // Prefer preloaded evaluation when provided (from dashboard history)
  const effectiveEvaluation: EvaluationResult | null = (preloadedEvaluation as EvaluationResult | undefined) || (evaluationResult as any);

  // Track whether we've already auto-opened the evaluation for this run
  const [hasShownEvaluation, setHasShownEvaluation] = useState(false);
  
  // Unified evaluation handler for all station types
  const handleEvaluate = useCallback(() => {
    evaluatePerformance();
  }, [evaluatePerformance]);
  

  // Marquer la station comme terminée lors de l'évaluation
  useEffect(() => {
    // Only auto-show the evaluation once, and not while in replay
    if (effectiveEvaluation && !showReplay && !hasShownEvaluation) {
      markStationCompleted(caseData.sdd_id);
      handleShowEvaluation();
      setHasShownEvaluation(true);
    }
  }, [effectiveEvaluation, showReplay, hasShownEvaluation, caseData.sdd_id, handleShowEvaluation, markStationCompleted]);

  // Scroll vers le haut lors de l'affichage de l'évaluation
  useEffect(() => {
    if (showEvaluation) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [showEvaluation]);



  const handleResetStation = useCallback(async () => {
    // Reset server-side progress flags
    await resetStationProgress(caseData.sdd_id);
    // Clear local chat/timer data explicitly for safety
    try {
      localStorage.removeItem(`chat_messages_${caseData.sdd_id}`);
      localStorage.removeItem(`timer_state_${caseData.sdd_id}`);
    } catch {}
    // Clear any evaluation mode flags so a new run starts fresh
    try {
      sessionStorage.removeItem('preloadedEvaluation');
      sessionStorage.removeItem('simMode');
      sessionStorage.removeItem('resultId');
    } catch {}

    // Start a fresh simulation to fetch full SDD (including fiche_patient_*) and seed sessionStorage
    try {
      await startSimulation(
        {
          // Pass minimum SDD shape; startSimulation fetches full case
          id: String(caseData.sdd_id),
          sdd_id: String(caseData.sdd_id),
          name: caseData.sdd_titre || `SDD ${String(caseData.sdd_id).slice(0, 8)}`,
          description: caseData.consignes_etudiant || '',
          sdd_titre: caseData.sdd_titre || null,
          Type_de_station: (caseData as any).Type_de_station || (caseData as any).sdd_type || 'PS',
          item_EDN: (caseData as any).item_EDN || null,
          consignes_etudiant: (caseData as any).consignes_etudiant || null,
          specialite: (caseData as any).specialite || null,
          official_id: (caseData as any).official_id || null,
          sdd_type: (caseData as any).sdd_type || null,
          include_documents: (caseData as any).include_documents ?? null,
        } as any,
        { updateTokens, updateLastAttempt, sanitizeMessage: false }
      );
    } catch (e) {
      // Fall back to previous behavior if startSimulation fails
      console.error('Failed to start fresh simulation on restart:', e);
    }

    // Allow evaluation to auto-open again for a fresh run
    setHasShownEvaluation(false);
    // Navigate to simulation (fresh state seeded in sessionStorage by startSimulation)
    window.location.href = `/simulation?restart=${Date.now()}`;
  }, [caseData, resetStationProgress, updateTokens, updateLastAttempt, setHasShownEvaluation]);

  const handleQuitWithoutEvaluating = useCallback(async () => {
    // Réinitialiser complètement la station
    await resetStationProgress(caseData.sdd_id);
    localStorage.removeItem(`chat_messages_${caseData.sdd_id}`);
    localStorage.removeItem(`timer_state_${caseData.sdd_id}`);
    clearSavedData();
    
    // Retourner à la page des cas
    onBack();
  }, [caseData.sdd_id, clearSavedData, onBack, resetStationProgress]);

  // --- Documents mode (ex "Sèche"): Chat-like UI but notes-only ---
  // Local state for notes-only messages
  const [secheMessages, setSecheMessages] = useState<Array<{ id: string; role: 'user'; content: string; timestamp: Date }>>([]);
  const [secheInput, setSecheInput] = useState("");

  const handleSecheSendMessage = useCallback(() => {
    const content = secheInput.trim();
    if (!content || isPaused || isTimeUp) return;
    setSecheMessages(prev => ([
      ...prev,
      { id: Date.now().toString(), role: 'user', content, timestamp: new Date() }
    ]));
    setSecheInput("");
  }, [secheInput, isPaused, isTimeUp]);

  const handleSecheEvaluate = useCallback(async () => {
    if (secheMessages.length === 0) return; // nothing to evaluate
    
    // Convert local seche messages to standard format for unified evaluation
    const formattedMessages = secheMessages.map(m => ({
      id: m.id,
      role: 'user' as const,
      content: m.content,
      timestamp: m.timestamp
    }));
    
    await evaluatePerformance(formattedMessages);
  }, [secheMessages, evaluatePerformance]);


  // Afficher l'indicateur de chargement pendant l'évaluation
  if (isEvaluating) {
    return <LoadingEvaluation />;
  }

  // Vue de replay pédagogique
  if (showReplay) {
    // Prefer the full transcript saved during evaluation when available
    const transcript = effectiveEvaluation?.transcript_json;
    const replayMessages = transcript && Array.isArray(transcript) && transcript.length > 0
      ? transcript.map((m, idx) => ({
          id: `${idx}`,
          role: m.role,
          content: m.content,
          timestamp: m.timestamp ? new Date(m.timestamp) : new Date()
        }))
      : messages;
    return (
      <ReplayView
        caseData={caseData}
        messages={replayMessages}
        onBack={handleBackToChat}
        onShowEvaluation={handleShowEvaluation}
        onResetStation={handleResetStation}
        onBackToHome={onBack}
      />
    );
  }

  // Affichage de l'évaluation
  if (showEvaluation && effectiveEvaluation) {
    return (
      <EvaluationView
        caseData={caseData}
        evaluationResult={effectiveEvaluation}
        onBack={handleBackToChat}
        onShowReplay={handleShowReplay}
        onResetStation={handleResetStation}
        onBackToHome={onBack}
      />
    );
  }

  // Interface pour stations Documents (ex "Sèche")
  if (isStationSeche) {
    return (
      <ChatView
        caseData={caseData}
        messages={secheMessages}
        inputMessage={secheInput}
        isLoading={false}
        timeRemaining={timeRemaining}
        isPaused={isPaused}
        isTimeUp={isTimeUp}
        isEvaluating={isEvaluating}
        onInputChange={setSecheInput}
        onSendMessage={handleSecheSendMessage}
        onBack={handleQuitWithoutEvaluating}
        onEvaluate={handleSecheEvaluate}
        onTogglePause={togglePause}
        onResetStation={handleResetStation}
      />
    );
  }

  // Procedure interface removed (deprecated)

  // Interface de chat principale (PS/PSS)
  return (
    <ChatView
      caseData={caseData}
      messages={messages}
      inputMessage={inputMessage}
      isLoading={isLoading}
      timeRemaining={timeRemaining}
      isPaused={isPaused}
      isTimeUp={isTimeUp}
      isEvaluating={isEvaluating}
      onInputChange={setInputMessage}
      onSendMessage={sendMessage}
      onBack={handleQuitWithoutEvaluating}
      onEvaluate={handleEvaluate}
      onTogglePause={togglePause}
      onResetStation={handleResetStation}
    />
  );
});

ChatInterface.displayName = "ChatInterface";

export default ChatInterface;
