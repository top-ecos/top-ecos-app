import React from 'react';
import { Layout } from '@/components/Layout';
import { useExamBlanc } from '@/features/ecos-blanc/hooks/useExamBlanc';
import IntroScreen from '@/features/ecos-blanc/components/IntroScreen';
import CooldownScreen from '@/features/ecos-blanc/components/CooldownScreen';
import ExamResultsScreen from '@/features/ecos-blanc/components/ExamResultsScreen';
import InteractiveSimulation from '@/features/simulation/components/InteractiveSimulation';
import type { Message } from '@/features/chat/types/message.types';

/**
 * EcosBlanc - The "ECOS blanc" exam mode page.
 *
 * State machine:
 *   intro → starting → chatting → cooldown → (chatting → cooldown)* → results
 *
 * During 'chatting': full-screen without sidebar (same as /simulation).
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

  // Full-screen chat — no sidebar during active SDD
  if (phase === 'chatting' && sdds[currentIndex]) {
    return (
      <InteractiveSimulation
        caseData={sdds[currentIndex]}
        examMode={true}
        examProgress={`Station ${currentIndex + 1}/${totalStations}`}
        onSDDComplete={(messages: Message[]) => handleSDDComplete(messages)}
        onBack={quitExam}
      />
    );
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
          onQuit={quitExam}
          onRestart={restartExam}
        />
      )}
    </Layout>
  );
};

export default EcosBlanc;
