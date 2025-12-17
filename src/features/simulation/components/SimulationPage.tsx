
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import SimulationRouter from "./SimulationRouter";
import { useStationProgress } from "@/shared/hooks/useStationProgress";
import type { CaseData } from "@/features/station/types/sdd.types";
import type { EvaluationResult } from "@/features/evaluation/types/evaluation.types";
import { StorageManager } from "@/shared/lib/storage";

const Simulation = () => {
  const navigate = useNavigate();
  const [caseData, setCaseData] = useState<CaseData | null>(null);
  const [initialPatientMessage, setInitialPatientMessage] = useState<string | null>(null);
  const [preloadedEvaluation, setPreloadedEvaluation] = useState<EvaluationResult | null>(null);
  const { resetStationProgress } = useStationProgress();

  const validateCaseData = (data: unknown): data is CaseData => {
    return typeof data === 'object' && 
           data !== null && 
           'sdd_id' in data && 
           typeof (data as CaseData).sdd_id === 'string';
  };

  useEffect(() => {
    // Récupérer les données stockées dans sessionStorage
    const storedCase = StorageManager.getSelectedCase();
    const storedMessage = StorageManager.getInitialPatientMessage();
    const storedEvaluationData = StorageManager.getPreloadedEvaluation();

    if (!storedCase) {
      navigate('/');
      return;
    }

    // Case data handling
    if (storedCase) {
      if (validateCaseData(storedCase)) {
        setCaseData(storedCase);
      } else {
        console.error('Invalid case data structure');
        StorageManager.removeSelectedCase();
        navigate('/');
        return;
      }
    }

    if (storedMessage) {
      setInitialPatientMessage(storedMessage);
    }

    if (storedEvaluationData) {
      setPreloadedEvaluation(storedEvaluationData);
    }
  }, [navigate]);

  const handleBack = async () => {
    // Réinitialiser les données de la station
    if (caseData && validateCaseData(caseData)) {
      try {
        await resetStationProgress(caseData.sdd_id);
        StorageManager.clearStationData(caseData.sdd_id);
      } catch (error) {
        console.error('Error during cleanup:', error);
      }
    }
    
    // Nettoyer les données stockées
    StorageManager.clearSimulationSession();
    navigate('/cases');
  };

  if (!caseData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent mx-auto mb-4"></div>
          <p className="text-subtext">Chargement de la simulation...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <SimulationRouter 
        caseData={caseData} 
        onBack={handleBack}
        initialPatientMessage={initialPatientMessage}
        preloadedEvaluation={preloadedEvaluation || undefined}
      />
    </>
  );
};

export default Simulation;
