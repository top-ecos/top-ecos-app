import React, { useEffect, useCallback, useState } from "react";
import { useChat } from "@/features/chat/hooks/useChat";
import { useUnifiedEvaluation } from "@/features/evaluation/hooks/useUnifiedEvaluation";
import { useSimulationState } from "@/features/simulation/hooks/useSimulationState";
import { useStationProgress } from "@/shared/hooks/useStationProgress";
import { useProfile } from "@/shared/hooks/useProfile";
import { startSimulation } from "@/features/simulation/lib/simulation";
import { StorageManager } from "@/shared/lib/storage";
import ChatView from "@/features/chat/components/ChatView";
import ReplayView from "@/features/chat/components/ReplayView";
import EvaluationView from "@/features/evaluation/components/EvaluationView";
import LoadingEvaluation from "@/components/LoadingEvaluation";
import type { CaseData } from "@/features/station/types/sdd.types";
import type { EvaluationResult } from "@/features/evaluation/types/evaluation.types";
import type { Message } from "@/features/chat/types/message.types";

interface InteractiveSimulationProps {
  caseData: CaseData;
  onBack: () => void;
  initialPatientMessage?: string | null;
  preloadedEvaluation?: EvaluationResult;
  examMode?: boolean;
  examProgress?: string;
  onSDDComplete?: (messages: Message[]) => void;
  initialDurationSeconds?: number;
}

/**
 * InteractiveSimulation - Handles PS/PSS interactive chat simulations
 * 
 * This component manages:
 * - Real-time chat with AI patient simulation
 * - Timer and pause functionality
 * - Evaluation of student performance
 * - Replay and results viewing
 * - Station progress tracking
 */
const InteractiveSimulation = React.memo(({
  caseData,
  onBack,
  initialPatientMessage,
  preloadedEvaluation,
  examMode = false,
  examProgress,
  onSDDComplete,
  initialDurationSeconds,
}: InteractiveSimulationProps) => {
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

  // Chat state and functionality
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
    resetStation: resetChatState,
    clearSavedData
  } = useChat(caseData, initialDurationSeconds);

  // Unified evaluation for PS/PSS stations
  const { evaluationResult, isEvaluating, evaluatePerformance } = useUnifiedEvaluation(caseData, messages);

  // Prefer preloaded evaluation when provided (from dashboard history)
  const effectiveEvaluation: EvaluationResult | null = 
    (preloadedEvaluation as EvaluationResult | undefined) || (evaluationResult as any);

  // Track whether we've already auto-opened the evaluation for this run
  const [hasShownEvaluation, setHasShownEvaluation] = useState(false);

  /**
   * In exam mode: auto-end current SDD when timer runs out
   */
  useEffect(() => {
    if (examMode && isTimeUp && onSDDComplete) {
      onSDDComplete(messages);
    }
  }, [examMode, isTimeUp]); // intentionally not including messages/onSDDComplete to avoid re-triggering

  /**
   * Evaluate student performance (normal mode) or signal SDD complete (exam mode)
   */
  const handleEvaluate = useCallback(() => {
    if (examMode && onSDDComplete) {
      onSDDComplete(messages);
    } else {
      evaluatePerformance();
    }
  }, [examMode, onSDDComplete, messages, evaluatePerformance]);

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
    // Reset chat state (timer and messages)
    resetChatState();
    
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
      console.error('Failed to start fresh simulation on restart:', e);
    }

    // Allow evaluation to auto-open again for a fresh run
    setHasShownEvaluation(false);
    
    // Navigate to simulation with fresh state
    window.location.href = `/simulation?restart=${Date.now()}`;
  }, [caseData, resetChatState, resetStationProgress, updateTokens, updateLastAttempt, setHasShownEvaluation]);

  /**
   * Quit without evaluating
   */
  const handleQuitWithoutEvaluating = useCallback(async () => {
    await resetStationProgress(caseData.sdd_id);
    StorageManager.clearStationData(caseData.sdd_id);
    clearSavedData();
    onBack();
  }, [caseData.sdd_id, clearSavedData, onBack, resetStationProgress]);

  // In exam mode: never show inline evaluation views — results are deferred to exam results screen
  if (!examMode && isEvaluating) {
    return <LoadingEvaluation />;
  }

  // Show replay view (normal mode only)
  if (!examMode && showReplay) {
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

  // Show evaluation view (normal mode only)
  if (!examMode && showEvaluation && effectiveEvaluation) {
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

  // Main chat interface for PS/PSS
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
      onBack={examMode ? onBack : handleQuitWithoutEvaluating}
      onEvaluate={handleEvaluate}
      onTogglePause={togglePause}
      onResetStation={handleResetStation}
      examMode={examMode}
      examProgress={examProgress}
    />
  );
});

InteractiveSimulation.displayName = "InteractiveSimulation";

export default InteractiveSimulation;
