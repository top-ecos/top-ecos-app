import React from "react";
import { PlayCircle, RotateCcw, Play } from "lucide-react";
import { useNavigate } from "react-router-dom";
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
}

const EvaluationView = ({ 
  caseData, 
  evaluationResult, 
  onShowReplay, 
  onResetStation, 
  onBackToHome 
}: EvaluationViewProps) => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <h1 className="text-lg sm:text-2xl font-bold text-[#222223] truncate max-w-[60vw] sm:max-w-none">
                {caseData.sdd_titre || `Station`}
              </h1>
              <p className="text-xs sm:text-sm text-[#707070] truncate">
                {`SDD ${caseData?.official_id ?? caseData?.sdd_id}`}
              </p>
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
              <button
                onClick={() => {
                  if (window.confirm('Recommencer cette station ? Votre progression locale sera effacée.')) onResetStation();
                }}
                className="h-10 w-10 inline-flex items-center justify-center rounded-full border-2 border-[#4299F6] text-[#4299F6] hover:bg-blue-50"
                aria-label="Recommencer la station"
              >
                <RotateCcw className="h-5 w-5" />
              </button>
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
        />
      </div>
    </div>
  );
};

export default EvaluationView;
