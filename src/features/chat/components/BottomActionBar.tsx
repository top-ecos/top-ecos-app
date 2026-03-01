import React, { useEffect, useState } from "react";

interface BottomActionBarProps {
  isPaused: boolean;
  isTimeUp: boolean;
  isEvaluating: boolean;
  messagesLength: number;
  onTogglePause: () => void;
  onEvaluate: () => void;
  examMode?: boolean;
}

// Sticky bottom action bar optimized for thumbs on mobile.
// Primary actions only: Pause/Resume and Terminer & évaluer.
const BottomActionBar: React.FC<BottomActionBarProps> = ({
  isPaused,
  isTimeUp,
  isEvaluating,
  messagesLength,
  onTogglePause,
  onEvaluate,
  examMode = false,
}) => {
  const [bottomOffset, setBottomOffset] = useState(0);

  // Keep the bar above the on-screen keyboard when possible.
  useEffect(() => {
    const vv = (window as any).visualViewport as VisualViewport | undefined;
    if (!vv) return;
    const handler = () => {
      const offset = Math.max(0, (window.innerHeight - vv.height - vv.offsetTop));
      setBottomOffset(offset);
    };
    handler();
    vv.addEventListener('resize', handler);
    vv.addEventListener('scroll', handler);
    return () => {
      vv.removeEventListener('resize', handler);
      vv.removeEventListener('scroll', handler);
    };
  }, []);

  const canEvaluate = examMode
    ? !isEvaluating && (isTimeUp || messagesLength >= 1)
    : !isEvaluating && (isTimeUp || messagesLength >= 3);
  const evalLabel = isEvaluating ? "Évaluation..." : (examMode ? "Terminer cette station" : "Terminer et évaluer");

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-40 bg-white border-t border-gray-200 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] lg:hidden"
      style={{
        paddingBottom: `calc(env(safe-area-inset-bottom, 0px) + ${bottomOffset}px)`,
      }}
      aria-label="Barre d'actions principale"
    >
      <div className="max-w-7xl mx-auto px-4 py-3">
        {examMode ? (
          // Exam mode: single full-width terminate button
          <button
            onClick={onEvaluate}
            disabled={!canEvaluate}
            className={`w-full h-12 rounded-xl font-semibold text-sm transition-colors border-2 ${
              canEvaluate
                ? 'border-emerald-500 text-emerald-600 bg-emerald-50 hover:bg-emerald-100'
                : 'border-gray-300 text-gray-400 bg-gray-100 cursor-not-allowed'
            }`}
            aria-label={evalLabel}
          >
            {evalLabel}
          </button>
        ) : (
          // Normal mode: pause + evaluate
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={onTogglePause}
              className={`h-12 rounded-xl font-medium text-sm transition-colors border-2 ${
                isPaused
                  ? 'border-green-500 text-green-600 bg-green-50'
                  : 'border-orange-400 text-orange-500 bg-orange-50'
              }`}
              aria-label={isPaused ? 'Reprendre la station' : 'Mettre la station en pause'}
            >
              {isPaused ? 'Reprendre' : 'Pause'}
            </button>
            <button
              onClick={onEvaluate}
              disabled={!canEvaluate}
              className={`h-12 rounded-xl font-semibold text-sm transition-colors border-2 ${
                canEvaluate
                  ? 'border-emerald-500 text-emerald-600 bg-emerald-50 hover:bg-emerald-100'
                  : 'border-gray-300 text-gray-400 bg-gray-100 cursor-not-allowed'
              }`}
              aria-label={isEvaluating ? 'Évaluation en cours' : 'Terminer et évaluer'}
            >
              {evalLabel}
            </button>
          </div>
        )}
        <div className="mt-2 text-center text-xs text-gray-500">
          {isTimeUp ? 'Temps écoulé' : (examMode ? 'ECOS blanc' : (isPaused ? 'En pause' : 'En cours'))}
        </div>
      </div>
    </div>
  );
};

export default BottomActionBar;

