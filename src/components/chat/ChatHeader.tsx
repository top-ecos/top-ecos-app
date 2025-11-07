import React, { useState } from "react";
import { BarChart3, Pause, Play, X, RotateCcw, Clock, MoreVertical, Info } from "lucide-react";

interface ChatHeaderProps {
  caseData: any;
  timeRemaining: number;
  isPaused: boolean;
  isTimeUp: boolean; // Kept for logic, but not displayed as a banner
  isEvaluating: boolean;
  messagesLength: number; // Kept for logic
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
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getTimerClasses = () => {
    if (timeRemaining <= 120) {
      return {
        wrapper: "border-[#E74C3C] text-[#E74C3C]",
        badge: "border-[#E74C3C] text-[#E74C3C]",
      };
    }

    if (timeRemaining <= 300) {
      return {
        wrapper: "border-[#F39C12] text-[#F39C12]",
        badge: "border-[#F39C12] text-[#F39C12]",
      };
    }

    return {
      wrapper: "border-[#03BB26] text-[#03BB26]",
      badge: "border-[#03BB26] text-[#03BB26]",
    };
  };

  const timerClasses = getTimerClasses();

  // Role pill removed per request

  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="bg-white border-b border-[#E0E0E0]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-center justify-between">
          {/* Left: compact title block */}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-2xl font-bold text-[#222223] truncate max-w-[60vw] sm:max-w-none">
                {caseData.sdd_titre || `Station`}
              </h1>
              {caseData?.consignes_etudiant && (
                <button
                  onClick={onShowConsignes}
                  className="inline-flex items-center gap-1 text-blue-700 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-full px-2 py-0.5 text-[10px] sm:text-xs lg:hidden"
                  aria-label="Afficher les consignes de la station"
                  title="Consignes de la station"
                >
                  <Info className="h-3.5 w-3.5" />
                  <span className="hidden xs:inline">Consignes</span>
                </button>
              )}
            </div>
            <p className="text-xs sm:text-sm text-[#707070] truncate">
              {`SDD ${caseData?.official_id ?? caseData?.sdd_id}`}
            </p>
          </div>

          {/* Desktop controls (original UI) */}
          <div className="hidden lg:flex items-center space-x-3">
            {/* Timer Block */}
            <div className="flex flex-col items-center space-y-1" aria-label="Minuteur de la station">
              <div className={`flex items-center justify-center border-2 rounded-full px-4 py-1 font-semibold text-lg w-[120px] ${timerClasses.wrapper}`}>
                <Clock className="h-5 w-5 mr-2" />
                <span>{formatTime(timeRemaining)}</span>
              </div>
              <div className={`border rounded-full px-4 py-0.5 text-xs ${timerClasses.badge}`}>
                {isPaused ? 'En pause' : 'En cours'}
              </div>
            </div>

            {/* Pause/Play Button */}
            <button
              onClick={onTogglePause}
              disabled={isTimeUp}
              className="flex items-center space-x-2 px-4 py-2 border-2 border-[#F39C12] text-[#F39C12] rounded-full font-medium text-sm hover:bg-orange-50 disabled:opacity-50"
              aria-label={isPaused ? 'Reprendre la station' : 'Mettre la station en pause'}
            >
              {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
              <span>{isPaused ? 'Reprendre' : 'Pause'}</span>
            </button>

            {/* Reset Button */}
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

            {/* Quit Button */}
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

            {/* Evaluate Button */}
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

          {/* Mobile: timer chip + kebab menu */}
          <div className="flex lg:hidden items-center gap-2 relative">
            <div className={`flex items-center justify-center border rounded-full px-3 py-1 text-sm ${timerClasses.badge}`} aria-label="Minuteur de la station">
              <Clock className="h-4 w-4 mr-1" />
              <span className="font-medium">{formatTime(timeRemaining)}</span>
            </div>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label="Plus d'actions"
              className="p-2 rounded-full border border-gray-300 hover:bg-gray-50"
            >
              <MoreVertical className="h-5 w-5 text-gray-700" />
            </button>
            {menuOpen && (
              <div
                role="menu"
                className="absolute right-0 top-10 w-56 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden z-50"
              >
                <button
                  role="menuitem"
                  className="w-full text-left px-4 py-3 text-sm hover:bg-gray-50"
                  onClick={() => {
                    setMenuOpen(false);
                    if (window.confirm('Réinitialiser la station ? Votre progression locale sera effacée.')) onReset();
                  }}
                >
                  Réinitialiser la station
                </button>
                <button
                  role="menuitem"
                  className="w-full text-left px-4 py-3 text-sm text-red-600 hover:bg-red-50"
                  onClick={() => {
                    setMenuOpen(false);
                    if (window.confirm('Quitter sans évaluer ? Votre progression locale sera effacée.')) onBack();
                  }}
                >
                  Quitter sans évaluer
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default ChatHeader;
