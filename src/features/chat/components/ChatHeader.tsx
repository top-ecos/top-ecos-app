import React, { useState, useRef, useEffect } from "react";
import { BarChart3, Pause, Play, X, RotateCcw, Clock, MoreVertical, Info } from "lucide-react";
import { CaseData } from "@/features/station/types/sdd.types";

interface ChatHeaderProps {
  caseData: CaseData;
  timeRemaining: number;
  isPaused: boolean;
  isTimeUp: boolean;
  isEvaluating: boolean;
  messagesLength: number;
  onBack: () => void;
  onEvaluate: () => void;
  onTogglePause: () => void;
  onReset: () => void;
  onShowConsignes?: () => void;
}

const ChatHeader = ({
  caseData,
  timeRemaining,
  isPaused,
  isTimeUp,
  isEvaluating,
  messagesLength,
  onBack,
  onEvaluate,
  onTogglePause,
  onReset,
  onShowConsignes,
}: ChatHeaderProps) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getTimerClasses = () => {
    if (timeRemaining <= 120) return { wrapper: "border-[#E74C3C] text-[#E74C3C]", badge: "border-[#E74C3C] text-[#E74C3C] bg-red-50" };
    if (timeRemaining <= 300) return { wrapper: "border-[#F39C12] text-[#F39C12]", badge: "border-[#F39C12] text-[#F39C12] bg-orange-50" };
    return { wrapper: "border-[#03BB26] text-[#03BB26]", badge: "border-[#03BB26] text-[#03BB26] bg-green-50" };
  };

  const timerClasses = getTimerClasses();
  const canEvaluate = !isEvaluating && (isTimeUp || messagesLength >= 3);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  const displayId = caseData?.official_id ?? caseData?.station_code ?? null;

  return (
    <header className="bg-white/90 backdrop-blur-md border-b border-gray-100/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* ── Mobile header ── */}
        <div className="flex lg:hidden items-center justify-between h-14 gap-3">

          {/* Left: station info */}
          <div className="min-w-0 flex-1">
            <h1 className="text-sm font-semibold text-gray-900 truncate leading-tight">
              {caseData.sdd_titre || 'Station'}
            </h1>
            <p className="text-[10px] text-gray-400 leading-tight mt-0.5">
              {displayId ? `SDD ${displayId}` : 'SDD'}
            </p>
          </div>

          {/* Right: timer + kebab */}
          <div className="flex items-center gap-2 flex-shrink-0" ref={menuRef}>
            {/* Timer chip */}
            <div
              className={`flex items-center gap-1 border rounded-full px-2.5 py-1 text-xs font-semibold ${timerClasses.badge}`}
              aria-label="Minuteur de la station"
            >
              <Clock className="h-3 w-3" />
              <span>{formatTime(timeRemaining)}</span>
            </div>

            {/* Kebab button */}
            <button
              onClick={() => setMenuOpen(prev => !prev)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label="Plus d'actions"
              className="h-9 w-9 flex items-center justify-center rounded-full bg-gray-50 border border-gray-200 hover:bg-gray-100 active:bg-gray-200 transition-colors"
            >
              <MoreVertical className="h-4 w-4 text-gray-600" />
            </button>

            {/* Dropdown menu */}
            {menuOpen && (
              <div
                role="menu"
                className="absolute right-4 top-[60px] w-64 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden z-50"
                style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.08)' }}
              >
                {/* Consignes */}
                {caseData?.consignes_etudiant && onShowConsignes && (
                  <button
                    role="menuitem"
                    className="w-full flex items-center gap-3 px-4 py-3.5 text-sm text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors"
                    onClick={() => { setMenuOpen(false); onShowConsignes(); }}
                  >
                    <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                      <Info className="h-4 w-4 text-blue-600" />
                    </div>
                    <span className="font-medium">Consignes</span>
                  </button>
                )}

                <div className="border-t border-gray-50 mx-4" />

                {/* Pause / Resume */}
                <button
                  role="menuitem"
                  className="w-full flex items-center gap-3 px-4 py-3.5 text-sm text-gray-700 hover:bg-gray-50 active:bg-gray-100 disabled:opacity-40 transition-colors"
                  onClick={() => { setMenuOpen(false); onTogglePause(); }}
                  disabled={isTimeUp}
                >
                  <div className="w-8 h-8 rounded-full bg-orange-50 flex items-center justify-center flex-shrink-0">
                    {isPaused
                      ? <Play className="h-4 w-4 text-orange-500" />
                      : <Pause className="h-4 w-4 text-orange-500" />
                    }
                  </div>
                  <span className="font-medium">{isPaused ? 'Reprendre' : 'Mettre en pause'}</span>
                </button>

                {/* Terminer et évaluer */}
                <button
                  role="menuitem"
                  className="w-full flex items-center gap-3 px-4 py-3.5 text-sm hover:bg-emerald-50 active:bg-emerald-100 disabled:opacity-40 transition-colors"
                  onClick={() => { setMenuOpen(false); onEvaluate(); }}
                  disabled={!canEvaluate}
                >
                  <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center flex-shrink-0">
                    <BarChart3 className="h-4 w-4 text-emerald-600" />
                  </div>
                  <span className="font-medium text-emerald-600">
                    {isEvaluating ? 'Évaluation...' : 'Terminer et évaluer'}
                  </span>
                </button>

                <div className="border-t border-gray-50 mx-4" />

                {/* Réinitialiser */}
                <button
                  role="menuitem"
                  className="w-full flex items-center gap-3 px-4 py-3.5 text-sm text-gray-500 hover:bg-gray-50 active:bg-gray-100 transition-colors"
                  onClick={() => {
                    setMenuOpen(false);
                    if (window.confirm('Réinitialiser la station ? Votre progression locale sera effacée.')) onReset();
                  }}
                >
                  <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                    <RotateCcw className="h-3.5 w-3.5 text-gray-400" />
                  </div>
                  <span>Réinitialiser</span>
                </button>

                {/* Quitter */}
                <button
                  role="menuitem"
                  className="w-full flex items-center gap-3 px-4 py-3.5 text-sm text-red-500 hover:bg-red-50 active:bg-red-100 transition-colors"
                  onClick={() => {
                    setMenuOpen(false);
                    if (window.confirm('Quitter sans évaluer ? Votre progression locale sera effacée.')) onBack();
                  }}
                >
                  <div className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
                    <X className="h-3.5 w-3.5 text-red-400" />
                  </div>
                  <span>Quitter sans évaluer</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── Desktop header (unchanged) ── */}
        <div className="hidden lg:flex items-center justify-between py-4">
          {/* Left: title block */}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-2xl font-bold text-[#222223] truncate max-w-[60vw] sm:max-w-none">
                {caseData.sdd_titre || 'Station'}
              </h1>
              {caseData?.consignes_etudiant && (
                <button
                  onClick={onShowConsignes}
                  className="inline-flex items-center gap-1 text-blue-700 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-full px-2 py-0.5 text-xs"
                  aria-label="Afficher les consignes de la station"
                  title="Consignes de la station"
                >
                  <Info className="h-3.5 w-3.5" />
                  <span>Consignes</span>
                </button>
              )}
            </div>
            <p className="text-xs sm:text-sm text-[#707070] truncate">
              {displayId ? `SDD ${displayId}` : 'SDD'}
            </p>
          </div>

          {/* Desktop controls */}
          <div className="flex items-center space-x-3">
            {/* Timer */}
            <div className="flex flex-col items-center space-y-1" aria-label="Minuteur de la station">
              <div className={`flex items-center justify-center border-2 rounded-full px-4 py-1 font-semibold text-lg w-[120px] ${timerClasses.wrapper}`}>
                <Clock className="h-5 w-5 mr-2" />
                <span>{formatTime(timeRemaining)}</span>
              </div>
              <div className={`border rounded-full px-4 py-0.5 text-xs ${timerClasses.badge}`}>
                {isPaused ? 'En pause' : 'En cours'}
              </div>
            </div>

            {/* Pause */}
            <button
              onClick={onTogglePause}
              disabled={isTimeUp}
              className="flex items-center space-x-2 px-4 py-2 border-2 border-[#F39C12] text-[#F39C12] rounded-full font-medium text-sm hover:bg-orange-50 disabled:opacity-50"
              aria-label={isPaused ? 'Reprendre la station' : 'Mettre la station en pause'}
            >
              {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
              <span>{isPaused ? 'Reprendre' : 'Pause'}</span>
            </button>

            {/* Reset */}
            <button
              onClick={() => {
                if (window.confirm('Réinitialiser la station ? Votre progression locale sera effacée.')) onReset();
              }}
              className="flex items-center space-x-2 px-4 py-2 border-2 border-[#4299F6] text-[#4299F6] rounded-full font-medium text-sm hover:bg-blue-50"
              aria-label="Réinitialiser la station"
            >
              <RotateCcw className="h-4 w-4" />
              <span>Réinitialiser</span>
            </button>

            {/* Quit */}
            <button
              onClick={() => {
                if (window.confirm('Quitter sans évaluer ? Votre progression locale sera effacée.')) onBack();
              }}
              className="flex items-center space-x-2 px-4 py-2 border-2 border-[#E74C3C] text-[#E74C3C] rounded-full font-medium text-sm hover:bg-red-50"
              aria-label="Quitter sans évaluer"
            >
              <X className="h-4 w-4" />
              <span>Quitter sans évaluer</span>
            </button>

            {/* Evaluate */}
            <button
              onClick={onEvaluate}
              disabled={isEvaluating || (!isTimeUp && messagesLength < 3)}
              className="flex items-center space-x-2 px-4 py-2 border-2 border-[#2ECC71] text-[#2ECC71] rounded-full font-medium text-sm hover:bg-green-50 disabled:opacity-50"
              aria-label={isEvaluating ? 'Évaluation en cours' : 'Terminer et évaluer'}
            >
              <BarChart3 className="h-4 w-4" />
              <span>{isEvaluating ? 'Évaluation...' : 'Terminer et évaluer'}</span>
            </button>
          </div>
        </div>

      </div>
    </header>
  );
};

export default ChatHeader;
