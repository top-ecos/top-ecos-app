import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { Layout } from '@/components/Layout';
import { Card, CardContent } from '@/shared/components/ui/card-premium';
import { Button } from '@/shared/components/ui/button-premium';
import { useProfile } from '@/shared/hooks/useProfile';
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
  const { hasPremiumAccess } = useProfile();
  const navigate = useNavigate();

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
      initialDurationSeconds: 8 * 60,
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

  // Premium gate: non-premium users see a paywall on the intro screen.
  // Once the exam is in progress the server has already confirmed access.
  if ((phase === 'intro' || phase === 'starting') && hasPremiumAccess === false) {
    return (
      <Layout>
        <div className="flex flex-col min-h-screen">
          <div className="flex-1 py-6 px-4 md:py-10 md:px-8 lg:px-12 flex items-center justify-center">
            <div className="w-full max-w-2xl">
              <Card className="bg-surface border border-border">
                <CardContent className="p-8 text-center space-y-4">
                  <div className="flex items-center justify-center mb-2">
                    <Lock className="h-10 w-10 text-primary" />
                  </div>
                  <h1 className="text-2xl md:text-3xl font-semibold text-text">
                    Mode ECOS blanc réservé aux abonnés
                  </h1>
                  <p className="text-subtext">
                    Ce mode d'entraînement te permet d'enchaîner 5 stations aléatoires dans les conditions des ECOS nationaux (8 minutes par station / 2 minutes de pause entre chaque station).
                  </p>
                  <div className="pt-2">
                    <Button
                      variant="primary"
                      size="lg"
                      className="w-full md:w-auto md:px-6 md:min-w-[260px] text-white bg-[var(--accent)] hover:bg-[var(--accent-hover)] border border-[var(--accent)]"
                      onClick={() => navigate('/pricing')}
                    >
                      Découvrir top ECOS Premium
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </Layout>
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
          onViewEvaluation={(index) => setSelectedStation(index)}
          onQuit={quitExam}
          onRestart={restartExam}
        />
      )}
    </Layout>
  );
};

export default EcosBlanc;
