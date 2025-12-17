import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/shared/components/ui/sonner";
import type { CaseData } from "@/features/station/types/sdd.types";
import type { EvaluationResult, TranscriptMessage } from "@/features/evaluation/types/evaluation.types";
import type { Message, MessageRole } from "@/features/chat/types/message.types";
import EvaluationView from "@/features/evaluation/components/EvaluationView";
import ReplayView from "@/features/chat/components/ReplayView";
import { startSimulation, SimulationError } from "@/features/simulation/lib/simulation";
import { useProfile } from "@/shared/hooks/useProfile";
import { useStationProgress } from "@/shared/hooks/useStationProgress";
import type { SDD } from "@/shared/hooks/useSDD";

type MockResultRow = {
  score: number | null;
  feedback: string | null;
  transcript_json: TranscriptMessage[] | null;
  score_clinique: number | null;
  score_communication: number | null;
  score_phase_1: number | null;
  score_phase_2: number | null;
  evaluation_details: {
    actions_reussies?: EvaluationResult["actions_reussies"];
    actions_manquees?: EvaluationResult["actions_manquees"];
    communication_details?: EvaluationResult["communication_details"];
  } | null;
  station_id: string | number;
  station_title: string | null;
  typologie: string | null;
};

type SddLiteRow = {
  official_id: string | null;
  sdd_titre: string | null;
  consignes_etudiant: string | null;
  include_documents: boolean | null;
  sdd_type: string | null;
};

const isMessageRole = (role: unknown): role is MessageRole =>
  role === "user" || role === "assistant" || role === "system";

const HistoryEvaluationPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { resultId } = useParams<{ resultId: string }>();
  const { updateTokens } = useProfile();
  const { updateLastAttempt } = useStationProgress() as any;

  const [loading, setLoading] = useState(true);
  const [caseData, setCaseData] = useState<CaseData | null>(null);
  const [evaluationResult, setEvaluationResult] = useState<EvaluationResult | null>(null);
  const [showReplay, setShowReplay] = useState(false);
  const [isStarting, setIsStarting] = useState(false);

  const backTo = useMemo(() => {
    const from = (location.state as { from?: unknown } | null)?.from;
    return typeof from === "string" && from.length > 0 ? from : "/history";
  }, [location.state]);

  const handleBack = () => {
    navigate(backTo);
  };

  const handleRestartStation = async () => {
    if (!caseData || isStarting) return;
    setIsStarting(true);
    try {
      const sdd: SDD = {
        id: String(caseData.sdd_id),
        sdd_id: String(caseData.sdd_id),
        name: caseData.sdd_titre || `SDD ${String(caseData.sdd_id).slice(0, 8)}`,
        description: caseData.consignes_etudiant || "",
        sdd_titre: caseData.sdd_titre ?? null,
        Type_de_station: (caseData.Type_de_station ?? caseData.sdd_type ?? null) as any,
        item_EDN: (caseData as any)?.item_EDN ?? null,
        consignes_etudiant: caseData.consignes_etudiant ?? null,
        official_id: (caseData as any)?.official_id ?? null,
        specialite: (caseData as any)?.specialite ?? (caseData as any)?.sdd_specialite ?? null,
        sdd_type: caseData.sdd_type ?? null,
        include_documents: caseData.include_documents ?? null,
        premium: null,
        ranked: null,
      };

      await startSimulation(sdd, {
        updateTokens,
        updateLastAttempt,
        sanitizeMessage: false,
      } as any);

      navigate("/simulation");
    } catch (e) {
      console.error("Failed to restart station from history evaluation:", e);
      if (e instanceof SimulationError) {
        toast.error(e.message);
        if (e.code === "INSUFFICIENT_TOKENS_UPGRADE") {
          navigate("/pricing");
        }
        return;
      }
      toast.error("Impossible de relancer cette station.");
    } finally {
      setIsStarting(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    const fetchResult = async () => {
      if (!resultId) {
        navigate("/history");
        return;
      }

      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("mock_results")
          .select(
            "score, feedback, transcript_json, score_clinique, score_communication, score_phase_1, score_phase_2, evaluation_details, station_id, station_title, typologie"
          )
          .eq("id", resultId)
          .single();

        if (error || !data) {
          console.error("Error fetching history evaluation:", error);
          toast.error("Impossible de charger cette évaluation.");
          navigate("/history");
          return;
        }

        const row = data as unknown as MockResultRow;
        const stationUuid = String(row.station_id);

        const { data: sddRow, error: sddError } = await supabase
          .from("sdds")
          .select("official_id, sdd_titre, consignes_etudiant, include_documents, sdd_type")
          .eq("sdd_id", stationUuid)
          .maybeSingle();

        if (sddError) {
          console.error("Error fetching station metadata for history evaluation:", sddError);
        }

        const stationMeta = (sddRow ?? null) as SddLiteRow | null;

        const builtCase: CaseData = {
          sdd_id: stationUuid,
          sdd_titre: row.station_title ?? stationMeta?.sdd_titre ?? null,
          Type_de_station: row.typologie || stationMeta?.sdd_type || "PS",
          consignes_etudiant: stationMeta?.consignes_etudiant ?? null,
          include_documents: stationMeta?.include_documents ?? null,
          sdd_type: stationMeta?.sdd_type ?? null,
          official_id: stationMeta?.official_id ?? null,
        };

        const builtEvaluation: EvaluationResult = {
          score_clinique: row.score_clinique ?? 0,
          score_communication: row.score_communication ?? 0,
          note_finale: row.score ?? 0,
          actions_reussies: row.evaluation_details?.actions_reussies ?? [],
          actions_manquees: row.evaluation_details?.actions_manquees ?? [],
          communication_details: row.evaluation_details?.communication_details ?? {},
          feedback: row.feedback ?? "",
          score_phase_1: row.score_phase_1 ?? null,
          score_phase_2: row.score_phase_2 ?? null,
          transcript_json: Array.isArray(row.transcript_json) ? row.transcript_json : [],
        };

        if (!isMounted) return;
        setCaseData(builtCase);
        setEvaluationResult(builtEvaluation);
      } catch (e) {
        console.error("Unexpected error fetching history evaluation:", e);
        toast.error("Impossible de charger cette évaluation.");
        navigate("/history");
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchResult();
    return () => {
      isMounted = false;
    };
  }, [navigate, resultId]);

  const replayMessages: Message[] = useMemo(() => {
    const transcript = evaluationResult?.transcript_json ?? [];
    if (!Array.isArray(transcript) || transcript.length === 0) return [];

    return transcript.map((m, idx) => ({
      id: String(idx),
      role: isMessageRole(m.role) ? m.role : "assistant",
      content: String(m.content ?? ""),
      timestamp: m.timestamp ? new Date(m.timestamp) : new Date(),
    }));
  }, [evaluationResult?.transcript_json]);

  if (loading || !caseData || !evaluationResult) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent mx-auto mb-4"></div>
          <p className="text-subtext">Chargement de l&apos;évaluation...</p>
        </div>
      </div>
    );
  }

  if (showReplay) {
    return (
      <ReplayView
        caseData={caseData}
        messages={replayMessages}
        onBack={handleBack}
        backLabel="Retour"
        onShowEvaluation={() => setShowReplay(false)}
        onResetStation={handleRestartStation}
        onBackToHome={handleBack}
      />
    );
  }

  return (
    <EvaluationView
      caseData={caseData}
      evaluationResult={evaluationResult}
      onBack={handleBack}
      backLabel="Retour"
      showBackButton
      onShowReplay={() => setShowReplay(true)}
      onResetStation={handleRestartStation}
      onBackToHome={handleBack}
    />
  );
};

export default HistoryEvaluationPage;
