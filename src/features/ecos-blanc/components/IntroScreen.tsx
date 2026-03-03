import React from 'react';
import { ClipboardCheck, AlertCircle, Loader2, Clock, ChevronRight } from 'lucide-react';

interface IntroScreenProps {
  isStarting: boolean;
  startError: string | null;
  onStart: () => void;
}

const IntroScreen: React.FC<IntroScreenProps> = ({ isStarting, startError, onStart }) => {
  return (
    <div className="min-h-screen bg-surface-alt pb-24 md:pb-0">
      <div className="max-w-2xl mx-auto px-4 py-10 sm:py-16">

        {/* Header */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-[#03BB26]/10 flex items-center justify-center">
              <ClipboardCheck className="h-5 w-5 text-[#03BB26]" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">ECOS blanc</h1>
          </div>
          <p className="text-gray-500 text-base leading-relaxed">
            Enchaîne 5 stations aléatoires dans les conditions des ECOS nationaux.
            Chaque station dure 8 minutes. Une pause de 2 minutes sépare chaque station.
          </p>
        </div>

        {/* Rules card */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-6">
          <h2 className="font-semibold text-gray-900 mb-4">Conditions de l'examen</h2>
          <ul className="space-y-3">
            {[
              { icon: Clock, text: '5 stations de 8 minutes chacune' },
              { icon: ChevronRight, text: 'Pause de 2 minutes entre chaque station (passable)' },
              { icon: AlertCircle, text: 'Impossible de mettre en pause ou de quitter en cours de station' },
              { icon: ClipboardCheck, text: 'Évaluations affichées uniquement à la fin des 5 stations' },
            ].map(({ icon: Icon, text }, i) => (
              <li key={i} className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Icon className="h-3.5 w-3.5 text-gray-500" />
                </div>
                <span className="text-sm text-gray-600">{text}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Error */}
        {startError && (
          <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
            <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{startError}</p>
          </div>
        )}

        {/* CTA */}
        <button
          onClick={onStart}
          disabled={isStarting}
          className="w-full h-14 rounded-2xl font-semibold text-base transition-all
            bg-[#03BB26] text-white hover:bg-[#02a522] active:scale-[0.98]
            disabled:opacity-50 disabled:cursor-not-allowed
            flex items-center justify-center gap-2 shadow-md shadow-[#03BB26]/20"
        >
          {isStarting ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Démarrage en cours…</span>
            </>
          ) : (
            <>
              <ClipboardCheck className="h-5 w-5" />
              <span>Commencer l'ECOS blanc</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default IntroScreen;
