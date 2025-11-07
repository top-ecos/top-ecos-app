
import { useState, useCallback } from "react";

export const useSimulationState = () => {
  const [showReplay, setShowReplay] = useState(false);
  const [showEvaluation, setShowEvaluation] = useState(false);

  const handleShowReplay = useCallback(() => {
    setShowReplay(true);
    setShowEvaluation(false);
  }, []);

  const handleShowEvaluation = useCallback(() => {
    setShowEvaluation(true);
    setShowReplay(false);
  }, []);

  const handleBackToChat = useCallback(() => {
    setShowReplay(false);
    setShowEvaluation(false);
  }, []);

  return {
    showReplay,
    showEvaluation,
    handleShowReplay,
    handleShowEvaluation,
    handleBackToChat
  };
};
