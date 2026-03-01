import React from 'react';
import { CheckCircle2, XCircle, Loader2, RotateCcw, Home, TrendingUp, Award } from 'lucide-react';
import type { CaseData } from '@/features/station/types/sdd.types';
import type { EvaluationResult } from '@/features/evaluation/types/evaluation.types';
import { deriveTypeLabel } from '@/features/station/lib/station';

interface ExamResultsScreenProps {
  sdds: CaseData[];
  evaluationResults: (EvaluationResult | null)[];
  isEvaluatingSlots: boolean[];
  onQuit: () => void;
  onRestart: () => void;
}

const ScoreBadge = ({ score }: { score: number }) => {
  const color =
    score >= 14 ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
    score >= 10 ? 'bg-amber-100 text-amber-700 border-amber-200' :
    'bg-red-100 text-red-700 border-red-200';

  return (
    <span className={`inline-flex items-center border rounded-full px-2.5 py-0.5 text-sm font-bold ${color}`}>
      {score.toFixed(1)}/20
    </span>
  );
};

const StationResult: React.FC<{
  index: number;
  caseData: CaseData;
  result: EvaluationResult | null;
  isEvaluating: boolean;
}> = ({ index, caseData, result, isEvaluating }) => {
  const typeLabel = deriveTypeLabel(caseData);

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Station header */}
      <div className="px-5 py-4 border-b border-gray-100 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-gray-400">Station {index + 1}</span>
            <span className="text-xs bg-gray-100 text-gray-600 rounded-full px-2 py-0.5">{typeLabel}</span>
            {caseData.sdd_specialite && (
              <span className="text-xs bg-blue-50 text-blue-600 rounded-full px-2 py-0.5">
                {caseData.sdd_specialite}
              </span>
            )}
          </div>
          <h3 className="font-semibold text-gray-900 mt-0.5 truncate">
            {caseData.sdd_titre || `Station ${index + 1}`}
          </h3>
        </div>
        {isEvaluating ? (
          <div className="flex items-center gap-2 text-sm text-gray-400 flex-shrink-0">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Évaluation…</span>
          </div>
        ) : result ? (
          <ScoreBadge score={result.note_finale} />
        ) : (
          <span className="text-xs text-red-400 flex-shrink-0">Erreur</span>
        )}
      </div>

      {/* Result body */}
      {isEvaluating && (
        <div className="px-5 py-6 text-center text-sm text-gray-400">
          L'évaluation de cette station est en cours…
        </div>
      )}

      {!isEvaluating && !result && (
        <div className="px-5 py-4 text-sm text-red-500">
          L'évaluation n'a pas pu être complétée pour cette station.
        </div>
      )}

      {!isEvaluating && result && (
        <div className="px-5 py-4 space-y-4">
          {/* Score breakdown */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <p className="text-xs text-gray-500 mb-1">Clinique</p>
              <p className="text-lg font-bold text-gray-900">{result.score_clinique ?? '—'}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <p className="text-xs text-gray-500 mb-1">Communication</p>
              <p className="text-lg font-bold text-gray-900">{result.score_communication ?? '—'}</p>
            </div>
          </div>

          {/* Feedback */}
          {result.feedback && (
            <p className="text-sm text-gray-600 leading-relaxed">{result.feedback}</p>
          )}

          {/* Actions summary */}
          <div className="space-y-2">
            {result.actions_reussies && result.actions_reussies.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-emerald-700 mb-1 flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Réussies ({result.actions_reussies.length})
                </p>
                <ul className="space-y-1">
                  {result.actions_reussies.slice(0, 3).map((a, i) => (
                    <li key={i} className="text-xs text-gray-600 pl-4 truncate">
                      • {typeof a === 'string' ? a : a.action}
                    </li>
                  ))}
                  {result.actions_reussies.length > 3 && (
                    <li className="text-xs text-gray-400 pl-4">
                      +{result.actions_reussies.length - 3} de plus
                    </li>
                  )}
                </ul>
              </div>
            )}
            {result.actions_manquees && result.actions_manquees.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-red-600 mb-1 flex items-center gap-1">
                  <XCircle className="h-3.5 w-3.5" />
                  Manquées ({result.actions_manquees.length})
                </p>
                <ul className="space-y-1">
                  {result.actions_manquees.slice(0, 3).map((a, i) => (
                    <li key={i} className="text-xs text-gray-600 pl-4 truncate">
                      • {a}
                    </li>
                  ))}
                  {result.actions_manquees.length > 3 && (
                    <li className="text-xs text-gray-400 pl-4">
                      +{result.actions_manquees.length - 3} de plus
                    </li>
                  )}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const ExamResultsScreen: React.FC<ExamResultsScreenProps> = ({
  sdds,
  evaluationResults,
  isEvaluatingSlots,
  onQuit,
  onRestart,
}) => {
  const completedResults = evaluationResults.filter(Boolean) as EvaluationResult[];
  const allDone = !isEvaluatingSlots.some(Boolean);
  const averageScore = completedResults.length > 0
    ? completedResults.reduce((sum, r) => sum + (r.note_finale ?? 0), 0) / completedResults.length
    : null;

  const averageColor =
    averageScore == null ? 'text-gray-400' :
    averageScore >= 14 ? 'text-emerald-600' :
    averageScore >= 10 ? 'text-amber-600' :
    'text-red-600';

  return (
    <div className="min-h-screen bg-surface-alt pb-24 md:pb-0">
      <div className="max-w-2xl mx-auto px-4 py-10 sm:py-16">

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

        {/* Per-station results */}
        <div className="space-y-4 mb-8">
          {sdds.map((sdd, i) => (
            <StationResult
              key={sdd.sdd_id}
              index={i}
              caseData={sdd}
              result={evaluationResults[i]}
              isEvaluating={isEvaluatingSlots[i]}
            />
          ))}
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
