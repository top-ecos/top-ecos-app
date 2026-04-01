import React from 'react';
import { Timer, RotateCcw, X } from 'lucide-react';

interface CooldownScreenProps {
  cooldownRemaining: number;
  stationsCompleted: number;
  totalStations: number;
  isLastStation: boolean;
  onSkip: () => void;
  onQuit: () => void;
  onRestart: () => void;
}

const formatTime = (seconds: number): string => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

const CooldownScreen: React.FC<CooldownScreenProps> = ({
  cooldownRemaining,
  stationsCompleted,
  totalStations,
  isLastStation,
  onSkip,
  onQuit,
  onRestart,
}) => {
  const progressPercent = (stationsCompleted / totalStations) * 100;
  const isUrgent = cooldownRemaining <= 30;
  const timerColor = isUrgent ? 'text-[#E74C3C] border-[#E74C3C]' : 'text-[#03BB26] border-[#03BB26]';

  return (
    <div className="min-h-screen bg-surface-alt pb-24 md:pb-0">
      <div className="max-w-2xl mx-auto px-4 py-10 sm:py-16">

        {/* Page header */}
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">ECOS blanc</h1>
          <p className="text-gray-500 text-sm mt-1">
            Enchaîne 5 stations aléatoires dans les conditions des ECOS nationaux
          </p>
        </div>

        {/* Countdown card */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 mb-6 flex flex-col items-center">
          {/* Timer display */}
          <div className={`flex items-center gap-3 border-2 rounded-2xl px-8 py-5 mb-6 ${timerColor}`}>
            <Timer className="h-8 w-8 flex-shrink-0" />
            <span className="text-5xl font-bold tabular-nums tracking-tight">
              {formatTime(cooldownRemaining)}
            </span>
          </div>

          <p className="text-sm text-gray-500 mb-6">
            Préparez-vous pour la station suivante.
          </p>

          {/* Skip button */}
          <button
            onClick={onSkip}
            className="w-full max-w-xs h-12 rounded-xl bg-[#03BB26] text-white font-semibold text-sm
              hover:bg-[#02a522] active:scale-[0.98] transition-all shadow-md shadow-[#03BB26]/20"
          >
            Station suivante
          </button>
        </div>

        {/* Progress section */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-6">
          <h2 className="font-semibold text-gray-900 mb-1">
            Progression de cette session d'ECOS blanc
          </h2>
          <p className="text-sm text-gray-500 mb-4">
            {stationsCompleted} station{stationsCompleted > 1 ? 's' : ''} / {totalStations} effectuée{stationsCompleted > 1 ? 's' : ''}
          </p>
          <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#03BB26] rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-400 mt-2">
            <span>{Math.round(progressPercent)}%</span>
            <span>{stationsCompleted}/{totalStations}</span>
          </div>
        </div>

        {/* Secondary actions */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={onRestart}
            className="flex-1 h-11 rounded-xl border-2 border-gray-200 text-gray-600 font-medium text-sm
              hover:bg-gray-50 active:bg-gray-100 transition-colors flex items-center justify-center gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            <span>Recommencer un ECOS blanc du début</span>
          </button>
          <button
            onClick={onQuit}
            className="flex-1 h-11 rounded-xl border-2 border-red-200 text-red-500 font-medium text-sm
              hover:bg-red-50 active:bg-red-100 transition-colors flex items-center justify-center gap-2"
          >
            <X className="h-4 w-4" />
            <span>Quitter le mode ECOS blanc</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default CooldownScreen;
