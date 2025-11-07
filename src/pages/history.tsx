import { useState, useEffect } from 'react';
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button-premium";
import { useResults } from "@/hooks/useResults";
import { useSDD } from "@/hooks/useSDD";
import { useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import RecentSessions from "@/components/RecentSessions";

async function handleViewEvaluation(result: any, sddList: any[] | undefined, navigate: any) {
  try {
    const sddMatch = (sddList || []).find((s: any) => String(s.sdd_id) === String(result.station_id));
    const minimalCase = {
      sdd_id: String(result.station_id),
      sdd_titre: result.station_title,
      Type_de_station: result.typologie || 'PS',
      consignes_etudiant: sddMatch?.consignes_etudiant || null,
      include_documents: sddMatch?.include_documents ?? null,
      sdd_type: sddMatch?.sdd_type ?? null
    } as any;
    sessionStorage.setItem('selectedCase', JSON.stringify(minimalCase));
    sessionStorage.removeItem('initialPatientMessage');

    const { data: fullRow, error } = await supabase
      .from('mock_results')
      .select(`score, feedback, transcript_json, score_clinique, score_communication, score_phase_1, score_phase_2, evaluation_details`)
      .eq('id', result.id)
      .single();

    if (error) {
      console.error('Error fetching full result for evaluation view:', error);
    }

    const preloaded = {
      score_clinique: fullRow?.score_clinique ?? 0,
      score_communication: fullRow?.score_communication ?? 0,
      note_finale: fullRow?.score ?? (result.score ?? 0),
      actions_reussies: fullRow?.evaluation_details?.actions_reussies ?? [],
      actions_manquees: fullRow?.evaluation_details?.actions_manquees ?? [],
      communication_details: fullRow?.evaluation_details?.communication_details ?? {},
      feedback: fullRow?.feedback ?? '',
      transcript_json: fullRow?.transcript_json ?? []
    };
    sessionStorage.setItem('preloadedEvaluation', JSON.stringify(preloaded));
    // Flag evaluation mode so the simulation page can reconstruct state on refresh
    sessionStorage.setItem('simMode', 'evaluation');
    sessionStorage.setItem('resultId', String(result.id));

    navigate('/simulation');
  } catch (e) {
    console.error('Error preparing evaluation view:', e);
    toast.error("Impossible d'ouvrir la grille d'évaluation.");
  }
}

const HistoryPage = () => {
  const { results, loading: resultsLoading } = useResults({ lite: true });
  const { sddList } = useSDD();
  const navigate = useNavigate();
  const PAGE_SIZE = 10;
  const [visibleCount, setVisibleCount] = useState<number>(PAGE_SIZE);
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [resultsLoading]);

  return (
    <Layout>
      <div className="p-8 bg-gray-50/50 min-h-screen">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Historique des sessions</h1>
            <p className="text-gray-500 mt-1">Consulte toutes tes sessions passées et leurs évaluations</p>
          </div>
          <Button variant="secondary" className="bg-white text-text border border-border hover:bg-gray-50" onClick={() => navigate(-1)}>
            <ChevronLeft size={16} className="mr-2" />
            Retour
          </Button>
        </header>

        <RecentSessions
          results={(results || []) as any}
          loading={resultsLoading}
          onViewEvaluation={(r: any) => handleViewEvaluation(r, sddList, navigate)}
          limit={visibleCount}
          showLoadMore
          canLoadMore={Boolean(results && results.length > visibleCount)}
          onLoadMore={() => setVisibleCount((c) => Math.min(c + PAGE_SIZE, results ? results.length : c + PAGE_SIZE))}
        />
      </div>
    </Layout>
  );
};

export default HistoryPage;
