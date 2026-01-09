import { useState, useEffect } from 'react';
import { Layout } from "@/components/Layout";
import { Button } from "@/shared/components/ui/button-premium";
import { useResults } from "@/shared/hooks/useResults";
import { useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import RecentSessions from "@/components/RecentSessions";
import { SessionResult } from "@/shared/types/results.types";

const HistoryPage = () => {
  const { results, loading: resultsLoading } = useResults({ lite: true });
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
            <p className="text-gray-500 mt-1">Consulte toutes tes stations jouées et leurs évaluations</p>
          </div>
          <Button variant="secondary" className="bg-white text-text border border-border hover:bg-gray-50" onClick={() => navigate(-1)}>
            <ChevronLeft size={16} className="mr-2" />
            Retour
          </Button>
        </header>

        <RecentSessions
          results={(results || []) as any}
          loading={resultsLoading}
          onViewEvaluation={(r: SessionResult) => navigate(`/history-evaluation/${r.id}`)}
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
