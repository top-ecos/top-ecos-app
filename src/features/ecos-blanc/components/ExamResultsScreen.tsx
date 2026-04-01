import React from 'react';
import { Loader2, RotateCcw, Home, TrendingUp, Award } from 'lucide-react';
import { Card, CardContent } from '@/shared/components/ui/card-premium';
import { Badge } from '@/shared/components/ui/badge-premium';
import { Button } from '@/shared/components/ui/button-premium';
import { deriveTypeLabel } from '@/features/station/lib/station';
import type { CaseData } from '@/features/station/types/sdd.types';
import type { EvaluationResult } from '@/features/evaluation/types/evaluation.types';

interface ExamResultsScreenProps {
  sdds: CaseData[];
  evaluationResults: (EvaluationResult | null)[];
  isEvaluatingSlots: boolean[];
  onViewEvaluation: (index: number) => void;
  onQuit: () => void;
  onRestart: () => void;
}

function getScoreColor(score: number) {
  if (score >= 15) return 'text-primary';
  if (score >= 10) return 'text-[#F39C12]';
  return 'text-danger';
}

function getScoreLabel(score: number) {
  if (score >= 15) return 'Excellent';
  if (score >= 12) return 'Bien';
  if (score >= 10) return 'Satisfaisant';
  return 'À améliorer';
}

function getBadgeStyles(type: string, content: string) {
  const styles: { color: string; backgroundColor: string; border?: string } = {
    color: '#707070',
    backgroundColor: '#70707033',
  };

  if (type === 'type') {
    if (content === 'Patient Standardisé' || content === 'PS') {
      styles.color = '#4299F6';
      styles.backgroundColor = '#4299F633';
    } else if (content === 'Patient Semi-Standardisé' || content === 'PSS') {
      styles.color = '#9105F8';
      styles.backgroundColor = '#9105F833';
    } else if (content === 'Documents' || content === 'Document(s)') {
      styles.color = '#FF4BD6';
      styles.backgroundColor = '#FF4BD633';
    } else if (content === 'Station sèche' || content === 'Sèche') {
      styles.color = '#934F00';
      styles.backgroundColor = '#934F0033';
    } else if (content === 'Procédure') {
      styles.color = '#28A745';
      styles.backgroundColor = '#28A74533';
    }
  } else if (type === 'specialty') {
    styles.color = '#F39C12';
    styles.backgroundColor = '#F39C1233';
  }

  return styles;
}

const ExamResultsScreen: React.FC<ExamResultsScreenProps> = ({
  sdds,
  evaluationResults,
  isEvaluatingSlots,
  onViewEvaluation,
  onQuit,
  onRestart,
}) => {
  const completedResults = evaluationResults.filter(Boolean) as EvaluationResult[];
  const allDone = !isEvaluatingSlots.some(Boolean);
  const averageScore =
    completedResults.length > 0
      ? completedResults.reduce((sum, r) => sum + (r.note_finale ?? 0), 0) / completedResults.length
      : null;

  const averageColor =
    averageScore == null
      ? 'text-gray-400'
      : averageScore >= 15
      ? 'text-primary'
      : averageScore >= 10
      ? 'text-[#F39C12]'
      : 'text-danger';

  return (
    <div className="min-h-screen bg-surface-alt pb-24 md:pb-0">
      <div className="max-w-3xl mx-auto px-4 py-10 sm:py-16">

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Award className="h-7 w-7 text-[#03BB26]" />
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Résultats de l'ECOS blanc</h1>
          </div>
          {!allDone && (
            <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2 mt-3">
              <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" />
              <span>Des évaluations sont encore en cours…</span>
            </div>
          )}
        </div>

        {/* Overall score */}
        {averageScore != null && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-6 flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-[#03BB26]/10 flex items-center justify-center flex-shrink-0">
              <TrendingUp className="h-7 w-7 text-[#03BB26]" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Score moyen sur 5 stations</p>
              <p className={`text-3xl font-bold ${averageColor}`}>
                {averageScore.toFixed(1)}<span className="text-lg text-gray-400">/20</span>
              </p>
            </div>
          </div>
        )}

        {/* Per-station cards */}
        <div className="space-y-4 mb-8">
          {sdds.map((sdd, i) => {
            const result = evaluationResults[i];
            const isEvaluating = isEvaluatingSlots[i];
            const typeLabel = deriveTypeLabel(sdd);

            return (
              <Card key={sdd.sdd_id} className="bg-surface border-border p-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  {/* Left: station info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-400 mb-1">Station {i + 1}</p>
                    <h4 className="text-base sm:text-lg font-bold text-text mb-2 truncate">
                      {sdd.sdd_titre || `Station ${i + 1}`}
                    </h4>
                    <div className="flex items-center flex-wrap gap-2">
                      <Badge
                        className="text-sm border-0 font-bold"
                        style={getBadgeStyles('type', typeLabel)}
                      >
                        {typeLabel}
                      </Badge>
                      {sdd.sdd_specialite && (
                        <Badge
                          className="text-sm border-0 font-bold"
                          style={getBadgeStyles('specialty', sdd.sdd_specialite)}
                        >
                          {sdd.sdd_specialite}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Center: score */}
                  <div className="flex-shrink-0 text-center md:mx-8">
                    {isEvaluating ? (
                      <div className="flex flex-col items-center gap-1">
                        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                        <span className="text-xs text-gray-400">Évaluation…</span>
                      </div>
                    ) : result ? (
                      <>
                        <div
                          className={`inline-flex items-center justify-center px-3 py-1 rounded-full border border-border text-base md:text-3xl font-bold ${getScoreColor(result.note_finale)}`}
                        >
                          {Math.round(result.note_finale * 10) / 10}/20
                        </div>
                        <div className="text-sm text-subtext mt-1">
                          {getScoreLabel(result.note_finale)}
                        </div>
                      </>
                    ) : (
                      <span className="text-xs text-red-400">Erreur</span>
                    )}
                  </div>

                  {/* Right: action button */}
                  <div className="flex-shrink-0">
                    <Button
                      variant="secondary"
                      className="w-full md:w-auto min-h-[44px]"
                      disabled={isEvaluating || !result}
                      onClick={() => onViewEvaluation(i)}
                    >
                      Consulter la grille d'évaluation
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={onRestart}
            className="flex-1 h-12 rounded-xl border-2 border-gray-200 text-gray-600 font-medium text-sm
              hover:bg-gray-50 active:bg-gray-100 transition-colors flex items-center justify-center gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            <span>Nouvel ECOS blanc</span>
          </button>
          <button
            onClick={onQuit}
            className="flex-1 h-12 rounded-xl bg-[#03BB26] text-white font-semibold text-sm
              hover:bg-[#02a522] active:scale-[0.98] transition-all shadow-md shadow-[#03BB26]/20
              flex items-center justify-center gap-2"
          >
            <Home className="h-4 w-4" />
            <span>Retour à l'accueil</span>
          </button>
        </div>

      </div>
    </div>
  );
};

export default ExamResultsScreen;
