import React, { useCallback, useState, useEffect } from "react";
import { useUnifiedEvaluation } from "@/features/evaluation/hooks/useUnifiedEvaluation";
import { useSimulationState } from "@/features/simulation/hooks/useSimulationState";
import { useStationProgress } from "@/shared/hooks/useStationProgress";
import { useProfile } from "@/shared/hooks/useProfile";
import { useChat } from "@/features/chat/hooks/useChat";
import { startSimulation } from "@/features/simulation/lib/simulation";
import { StorageManager } from "@/shared/lib/storage";
import ChatView from "@/features/chat/components/ChatView";
import ReplayView from "@/features/chat/components/ReplayView";
import EvaluationView from "@/features/evaluation/components/EvaluationView";
import LoadingEvaluation from "@/components/LoadingEvaluation";
import type { CaseData } from "@/features/station/types/sdd.types";
import type { EvaluationResult } from "@/features/evaluation/types/evaluation.types";

interface DocumentSimulationProps {
  caseData: CaseData;
  onBack: () => void;
  preloadedEvaluation?: EvaluationResult;
}

/**
 * DocumentSimulation - Handles Sèche/document analysis simulations
 * 
 * This component manages:
 * - Document review and note-taking interface
 * - Local message state for student notes
 * - Timer functionality (no AI responses)
 * - Evaluation of document analysis
 * - Replay and results viewing
 */
const DocumentSimulation = React.memo(({
  caseData,
  onBack,
  preloadedEvaluation
}: DocumentSimulationProps) => {
  // Station progress management
  const { markStationCompleted, resetStationProgress, updateLastAttempt } = useStationProgress();
  const { updateTokens } = useProfile();

  // Simulation state management (replay, evaluation views)
  const {
    showReplay,
    showEvaluation,
    handleShowReplay,
    handleShowEvaluation,
    handleBackToChat
  } = useSimulationState();

  // Use chat hook for timer functionality only
  const {
    timeRemaining,
    isPaused,
    isTimeUp,
    togglePause,
    clearSavedData
  } = useChat(caseData, null);

  // Local state for document notes (user messages only)
  const [documentMessages, setDocumentMessages] = useState<Array<{
    id: string;
    role: 'user';
    content: string;
    timestamp: Date;
  }>>([]);
  const [noteInput, setNoteInput] = useState("");

  // Unified evaluation for document stations
  const { evaluationResult, isEvaluating, evaluatePerformance } = useUnifiedEvaluation(caseData);

  // Prefer preloaded evaluation when provided (from dashboard history)
  const effectiveEvaluation: EvaluationResult | null = 
    (preloadedEvaluation as EvaluationResult | undefined) || (evaluationResult as any);

  // Track whether we've already auto-opened the evaluation for this run
  const [hasShownEvaluation, setHasShownEvaluation] = useState(false);

  /**
   * Add a note to the document analysis
   */
  const handleAddNote = useCallback(() => {
    const content = noteInput.trim();
    if (!content || isPaused || isTimeUp) return;

    setDocumentMessages(prev => ([
      ...prev,
      {
        id: Date.now().toString(),
        role: 'user',
        content,
        timestamp: new Date()
      }
    ]));
    setNoteInput("");
  }, [noteInput, isPaused, isTimeUp]);

  /**
   * Evaluate document analysis performance
   */
  const handleEvaluate = useCallback(async () => {
    if (documentMessages.length === 0) return;

    // Convert local document messages to standard format for unified evaluation
    const formattedMessages = documentMessages.map(m => ({
      id: m.id,
      role: 'user' as const,
      content: m.content,
      timestamp: m.timestamp
    }));

    await evaluatePerformance(formattedMessages);
  }, [documentMessages, evaluatePerformance]);

  /**
   * Auto-show evaluation once completed
   */
  useEffect(() => {
    if (effectiveEvaluation && !showReplay && !hasShownEvaluation) {
      markStationCompleted(caseData.sdd_id);
      handleShowEvaluation();
      setHasShownEvaluation(true);
    }
  }, [effectiveEvaluation, showReplay, hasShownEvaluation, caseData.sdd_id, handleShowEvaluation, markStationCompleted]);

  /**
   * Scroll to top when showing evaluation
   */
  useEffect(() => {
    if (showEvaluation) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [showEvaluation]);

  /**
   * Reset station and start fresh simulation
   */
  const handleResetStation = useCallback(async () => {
    // Reset server-side progress flags
    await resetStationProgress(caseData.sdd_id);
    
    // Clear local storage data
    StorageManager.clearStationData(caseData.sdd_id);
    StorageManager.removePreloadedEvaluation();
    StorageManager.removeSimulationMode();
    StorageManager.removeResultId();

    // Start a fresh simulation
    try {
      await startSimulation(
        {
          id: String(caseData.sdd_id),
          sdd_id: String(caseData.sdd_id),
          name: caseData.sdd_titre || `SDD ${String(caseData.sdd_id).slice(0, 8)}`,
          description: caseData.consignes_etudiant || '',
          sdd_titre: caseData.sdd_titre || null,
          Type_de_station: (caseData as any).Type_de_station || (caseData as any).sdd_type || 'Sèche',
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
      console.error('Failed to start fresh simulation on restart:', e);
    }

    // Allow evaluation to auto-open again for a fresh run
    setHasShownEvaluation(false);
    
    // Navigate to simulation with fresh state
    window.location.href = `/simulation?restart=${Date.now()}`;
  }, [caseData, resetStationProgress, updateTokens, updateLastAttempt, setHasShownEvaluation]);

  /**
   * Quit without evaluating
   */
  const handleQuitWithoutEvaluating = useCallback(async () => {
    await resetStationProgress(caseData.sdd_id);
    StorageManager.clearStationData(caseData.sdd_id);
    clearSavedData();
    onBack();
  }, [caseData.sdd_id, clearSavedData, onBack, resetStationProgress]);

  // Show loading indicator during evaluation
  if (isEvaluating) {
    return <LoadingEvaluation />;
  }

  // Show replay view
  if (showReplay) {
    const transcript = effectiveEvaluation?.transcript_json;
    const replayMessages = transcript && Array.isArray(transcript) && transcript.length > 0
      ? transcript.map((m, idx) => ({
          id: `${idx}`,
          role: m.role,
          content: m.content,
          timestamp: m.timestamp ? new Date(m.timestamp) : new Date()
        }))
      : documentMessages;

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

  // Show evaluation view
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

  // Document analysis interface (notes-only, no AI responses)
  return (
    <ChatView
      caseData={caseData}
      messages={documentMessages}
      inputMessage={noteInput}
      isLoading={false}
      timeRemaining={timeRemaining}
      isPaused={isPaused}
      isTimeUp={isTimeUp}
      isEvaluating={isEvaluating}
      onInputChange={setNoteInput}
      onSendMessage={handleAddNote}
      onBack={handleQuitWithoutEvaluating}
      onEvaluate={handleEvaluate}
      onTogglePause={togglePause}
      onResetStation={handleResetStation}
    />
  );
});

DocumentSimulation.displayName = "DocumentSimulation";

export default DocumentSimulation;
