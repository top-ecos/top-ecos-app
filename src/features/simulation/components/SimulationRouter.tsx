import React from "react";
import { StationTypeManager } from "@/features/station/lib/stationTypeManager";
import InteractiveSimulation from "./InteractiveSimulation";
import DocumentSimulation from "./DocumentSimulation";
import type { CaseData } from "@/features/station/types/sdd.types";
import type { EvaluationResult } from "@/features/evaluation/types/evaluation.types";

interface SimulationRouterProps {
  caseData: CaseData;
  onBack: () => void;
  initialPatientMessage?: string | null;
  preloadedEvaluation?: EvaluationResult;
}

/**
 * SimulationRouter - Routes to the appropriate simulation component based on station type
 * 
 * This component acts as a dispatcher that:
 * - Determines the station type (Interactive PS/PSS or Document/Sèche)
 * - Renders the appropriate simulation component
 * - Keeps concerns separated and components focused
 */
const SimulationRouter = React.memo(({
  caseData,
  onBack,
  initialPatientMessage,
  preloadedEvaluation
}: SimulationRouterProps) => {
  // Use centralized station type detection
  const isDocumentStation = StationTypeManager.isDocumentStation(caseData);

  // Route to appropriate simulation component
  if (isDocumentStation) {
    return (
      <DocumentSimulation
        caseData={caseData}
        onBack={onBack}
        preloadedEvaluation={preloadedEvaluation}
      />
    );
  }

  // Default to interactive simulation (PS/PSS)
  return (
    <InteractiveSimulation
      caseData={caseData}
      onBack={onBack}
      initialPatientMessage={initialPatientMessage}
      preloadedEvaluation={preloadedEvaluation}
    />
  );
});

SimulationRouter.displayName = "SimulationRouter";

export default SimulationRouter;
