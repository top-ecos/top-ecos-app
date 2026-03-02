import React, { useState } from 'react';
import { Layout } from '@/components/Layout';
import { useExamBlanc } from '@/features/ecos-blanc/hooks/useExamBlanc';
import IntroScreen from '@/features/ecos-blanc/components/IntroScreen';
import CooldownScreen from '@/features/ecos-blanc/components/CooldownScreen';
import ExamResultsScreen from '@/features/ecos-blanc/components/ExamResultsScreen';
import InteractiveSimulation from '@/features/simulation/components/InteractiveSimulation';
import DocumentSimulation from '@/features/simulation/components/DocumentSimulation';
import EvaluationView from '@/features/evaluation/components/EvaluationView';
import { StationTypeManager } from '@/features/station/lib/stationTypeManager';
import type { Message } from '@/features/chat/types/message.types';
import type { EvaluationResult } from '@/features/evaluation/types/evaluation.types';

/**
 * EcosBlanc - The "ECOS blanc" exam mode page.
 *
 * State machine:
 *   intro → starting → chatting → cooldown → (chatting → cooldown)* → results
 *
 * During 'chatting': full-screen without sidebar (same as /simulation).
 * During 'results' with selectedStation set: full-screen EvaluationView.
 * During all other phases: Layout wrapper with sidebar.
 */
const EcosBlanc: React.FC = () => {
  const {
    phase,
    sdds,
    currentIndex,
    evaluationResults,
    isEvaluatingSlots,
    cooldownRemaining,
    startError,
    totalStations,
    isLastStation,
    startExam,
    handleSDDComplete,
    skipCooldown,
    quitExam,
    restartExam,
  } = useExamBlanc();

  const [selectedStation, setSelectedStation] = useState<number | null>(null);

  // Full-screen chat — no sidebar during active SDD
  if (phase === 'chatting' && sdds[currentIndex]) {
    const currentSdd = sdds[currentIndex];
    const examProps = {
      caseData: currentSdd,
      examMode: true as const,
      examProgress: `Station ${currentIndex + 1}/${totalStations}`,
      onSDDComplete: (messages: Message[]) => handleSDDComplete(messages),
      onBack: quitExam,
    };

    if (StationTypeManager.isDocumentStation(currentSdd)) {
      return <DocumentSimulation {...examProps} />;
    }

    return <InteractiveSimulation {...examProps} />;
  }

  // Full-screen evaluation detail view — rendered outside Layout intentionally
  if (phase === 'results' && selectedStation !== null) {
    const stationData = sdds[selectedStation];
    const evalResult = evaluationResults[selectedStation] as EvaluationResult;

    if (stationData && evalResult) {
      return (
        <EvaluationView
          caseData={stationData}
          evaluationResult={evalResult}
          onBack={() => setSelectedStation(null)}
          backLabel="Retour aux résultats"
          showBackButton={true}
          hideResetStation={true}
          onShowReplay={() => {}}
          onResetStation={() => {}}
          onBackToHome={() => setSelectedStation(null)}
        />
      );
    }
  }

  return (
    <Layout>
      {(phase === 'intro' || phase === 'starting') && (
        <IntroScreen
          isStarting={phase === 'starting'}
          startError={startError}
          onStart={startExam}
        />
      )}

      {phase === 'cooldown' && (
        <CooldownScreen
          cooldownRemaining={cooldownRemaining}
          stationsCompleted={currentIndex + 1}
          totalStations={totalStations}
          isLastStation={isLastStation}
          onSkip={skipCooldown}
          onQuit={quitExam}
          onRestart={restartExam}
        />
      )}

      {phase === 'results' && (
        <ExamResultsScreen
          sdds={sdds}
          evaluationResults={evaluationResults}
          isEvaluatingSlots={isEvaluatingSlots}
          onViewEvaluation={(index) => setSelectedStation(index)}
          onQuit={quitExam}
          onRestart={restartExam}
        />
      )}
    </Layout>
  );
};

export default EcosBlanc;
