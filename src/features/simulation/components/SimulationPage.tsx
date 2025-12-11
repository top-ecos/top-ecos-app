
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import SimulationRouter from "./SimulationRouter";
import { useStationProgress } from "@/shared/hooks/useStationProgress";
import type { CaseData } from "@/features/station/types/sdd.types";
import type { EvaluationResult } from "@/features/evaluation/types/evaluation.types";
import { supabase } from "@/integrations/supabase/client";
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
    const simMode = StorageManager.getSimulationMode();
    const storedResultId = StorageManager.getResultId();

    if (!storedCase && simMode !== 'evaluation') {
      // No case and not in evaluation mode → go home
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
        if (simMode !== 'evaluation') {
          navigate('/');
          return;
        }
      }
    }

    if (storedMessage) {
      setInitialPatientMessage(storedMessage);
    }

    if (storedEvaluationData) {
      setPreloadedEvaluation(storedEvaluationData);
    }

    // If in evaluation mode and missing preloaded evaluation, reconstruct from resultId
    if (simMode === 'evaluation' && !storedEvaluationData) {
      if (!storedResultId) {
        console.error('Evaluation mode enabled but missing resultId');
        navigate('/history');
        return;
      }
      (async () => {
        try {
          const { data: fullRow, error } = await supabase
            .from('mock_results')
            .select(
              `score, feedback, transcript_json, score_clinique, score_communication, score_phase_1, score_phase_2, evaluation_details, station_id, station_title, typologie`
            )
            .eq('id', storedResultId)
            .single();

          if (error || !fullRow) {
            console.error('Failed to fetch evaluation for reconstruction', error);
            navigate('/history');
            return;
          }

          const preloaded: EvaluationResult = {
            score_clinique: (fullRow as any)?.score_clinique ?? 0,
            score_communication: (fullRow as any)?.score_communication ?? 0,
            note_finale: (fullRow as any)?.score ?? 0,
            actions_reussies: (fullRow as any)?.evaluation_details?.actions_reussies ?? [],
            actions_manquees: (fullRow as any)?.evaluation_details?.actions_manquees ?? [],
            communication_details: (fullRow as any)?.evaluation_details?.communication_details ?? {},
            feedback: (fullRow as any)?.feedback ?? '',
            transcript_json: (fullRow as any)?.transcript_json ?? []
          } as any;

          setPreloadedEvaluation(preloaded);
          StorageManager.setPreloadedEvaluation(preloaded);

          // If case data missing, build a minimal case from result row
          if (!storedCase) {
            const minimalCase = {
              sdd_id: String((fullRow as any).station_id),
              sdd_titre: (fullRow as any).station_title,
              Type_de_station: (fullRow as any).typologie || 'PS',
              consignes_etudiant: null,
              include_documents: null,
              sdd_type: null,
            } as any;
            setCaseData(minimalCase);
            StorageManager.setSelectedCase(minimalCase);
          }
        } catch (e) {
          console.error('Error reconstructing evaluation on refresh:', e);
          navigate('/history');
        }
      })();
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
