import React from "react";
import { ChevronLeft, PlayCircle, RotateCcw, Play } from "lucide-react";
import EvaluationResults from "./EvaluationResults";
import { CaseData } from "@/features/station/types/sdd.types";
import { EvaluationResult } from "@/features/evaluation/types/evaluation.types";

interface EvaluationViewProps {
  caseData: CaseData;
  evaluationResult: EvaluationResult;
  onBack: () => void;
  onShowReplay: () => void;
  onResetStation: () => void;
  onBackToHome: () => void;
  backLabel?: string;
  showBackButton?: boolean;
  hideResetStation?: boolean;
}

const EvaluationView = ({ 
  caseData, 
  evaluationResult, 
  onBack,
  onShowReplay, 
  onResetStation, 
  onBackToHome,
  backLabel = "Retour",
  showBackButton = false,
  hideResetStation = false,
}: EvaluationViewProps) => {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex items-center gap-3">
              {showBackButton ? (
                <button
                  onClick={onBack}
                  className="h-10 w-10 sm:h-auto sm:w-auto inline-flex items-center justify-center sm:justify-start rounded-full border-2 border-gray-200 text-gray-700 hover:bg-gray-50 transition px-0 sm:px-4 py-0 sm:py-2"
                  aria-label={backLabel}
                  title={backLabel}
                >
                  <ChevronLeft className="h-5 w-5 sm:h-4 sm:w-4 sm:mr-2" />
                  <span className="hidden sm:inline">{backLabel}</span>
                </button>
              ) : null}
              <div className="min-w-0">
                <h1 className="text-lg sm:text-2xl font-bold text-[#222223] truncate max-w-[50vw] sm:max-w-none">
                  {caseData.sdd_titre || `Station`}
                </h1>
                <p className="text-xs sm:text-sm text-[#707070] truncate">
                  {(() => {
                    const displayId = caseData?.official_id ?? caseData?.station_code ?? null;
                    return displayId ? `SDD ${displayId}` : "SDD";
                  })()}
                </p>
              </div>
            </div>

            {/* Desktop controls */}
            <div className="hidden lg:flex items-center gap-3">
              <button
                onClick={onShowReplay}
                className="inline-flex items-center rounded-full border-2 px-4 py-2 text-sm font-medium border-[#F39C12] text-[#F39C12] hover:bg-orange-50 transition"
                aria-label="Voir le replay"
              >
                <PlayCircle className="h-4 w-4 mr-2" />
                Voir le replay
              </button>
              {!hideResetStation && (
                <button
                  onClick={() => {
                    if (window.confirm('Recommencer cette station ? Votre progression locale sera effacée.')) onResetStation();
                  }}
                  className="inline-flex items-center rounded-full border-2 px-4 py-2 text-sm font-medium border-[#4299F6] text-[#4299F6] hover:bg-blue-50 transition"
                  aria-label="Recommencer la station"
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Recommencer
                </button>
              )}
              <button
                onClick={() => (window.location.href = "/cases")}
                className="inline-flex items-center rounded-full border-2 px-4 py-2 text-sm font-medium border-[#2ECC71] text-[#2ECC71] hover:bg-green-50 transition"
                aria-label="Aller aux cas"
              >
                <Play className="h-4 w-4 mr-2" />
                Nouvelle station
              </button>
            </div>
            {/* Mobile icon-only actions with original colors */}
            <div className="flex lg:hidden items-center gap-2">
              <button
                onClick={onShowReplay}
                className="h-10 w-10 inline-flex items-center justify-center rounded-full border-2 border-[#F39C12] text-[#F39C12] hover:bg-orange-50"
                aria-label="Voir le replay"
              >
                <PlayCircle className="h-5 w-5" />
              </button>
              {!hideResetStation && (
                <button
                  onClick={() => {
                    if (window.confirm('Recommencer cette station ? Votre progression locale sera effacée.')) onResetStation();
                  }}
                  className="h-10 w-10 inline-flex items-center justify-center rounded-full border-2 border-[#4299F6] text-[#4299F6] hover:bg-blue-50"
                  aria-label="Recommencer la station"
                >
                  <RotateCcw className="h-5 w-5" />
                </button>
              )}
              <button
                onClick={() => (window.location.href = "/cases")}
                className="h-10 w-10 inline-flex items-center justify-center rounded-full border-2 border-[#2ECC71] text-[#2ECC71] hover:bg-green-50"
                aria-label="Nouvelle station"
              >
                <Play className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-8">
        <EvaluationResults
          result={evaluationResult}
          stationTitle={caseData.sdd_titre || `Station ${caseData.sdd_id}`}
          stationId={String(caseData.sdd_id)}
          ednItemNumber={caseData.item_edn}
          ednItemName={caseData.item_edn_name}
        />
      </div>
    </div>
  );
};

export default EvaluationView;
