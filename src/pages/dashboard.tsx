/*
 * @/pages/Dashboard.tsx
 *
 * This version updates the "Note moyenne" KPI to reflect the selected
 * time filter (Global, 30d, 7d), using the updated user_dashboard_stats view.
 */
import { useState, useEffect } from 'react';
import { Layout } from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card-premium";
import { Button } from "@/components/ui/button-premium";
import { useResults } from "@/hooks/useResults";
import { useSDD } from "@/hooks/useSDD";
import { useNavigate, Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import RecentSessions from "@/components/RecentSessions";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';

// --- 1. TYPE DEFINITIONS ---
type TimeFilter = 'global' | '30d' | '7d';

interface DashboardKPIs {
  average_score: number; // This will now hold the dynamically selected average
  total_study_hours: number;
  total_sessions: number;
  current_streak_days: number;
}

interface DailyProgressPoint {
  date: string;
  score: number;
}

interface SpecialtyPerformance {
  sdd_specialite: string;
  specialty_average_score: number;
}

interface DashboardData {
  kpis: DashboardKPIs;
  dailyProgress: DailyProgressPoint[];
  specialtyPerformance: SpecialtyPerformance[];
}

// --- 2. FETCHER HOOK (MODIFIED to handle dynamic average score) ---
const useDashboardData = (userId: string | undefined, timeFilter: TimeFilter) => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        let startDate: string | null = null;
        if (timeFilter === '30d') {
          const date = new Date();
          date.setDate(date.getDate() - 30);
          startDate = date.toISOString();
        } else if (timeFilter === '7d') {
          const date = new Date();
          date.setDate(date.getDate() - 7);
          startDate = date.toISOString();
        }

        let progressQuery = supabase
          .from('user_daily_cumulative_progress')
          .select('full_date,cumulative_average_score')
          .eq('user_id', userId)
          .order('full_date');

        if (startDate) {
          progressQuery = progressQuery.gte('full_date', startDate);
        }

        // Fetch from the updated stats view
        const statsQuery = supabase
          .from('user_dashboard_stats')
          .select('average_score_global, average_score_30d, average_score_7d, total_study_hours, total_sessions')
          .eq('user_id', userId)
          .single();

        const [statsRes, streakRes, progressRes, specialtyRes] = await Promise.all([
          statsQuery,
          supabase.from('user_training_streaks').select('current_streak_days').eq('user_id', userId).single(),
          progressQuery,
          supabase.from('user_specialty_performance').select('sdd_specialite,specialty_average_score').eq('user_id', userId)
        ]);
        
        if (statsRes.error || streakRes.error || progressRes.error || specialtyRes.error) {
            const errorMsg = statsRes.error?.message || streakRes.error?.message || progressRes.error?.message || specialtyRes.error?.message;
            throw new Error(`Failed to fetch dashboard data: ${errorMsg}`);
        }

        // --- NEW: Logic to select the correct average score based on the filter ---
        let selectedAverageScore = 0;
        if (statsRes.data) {
            switch (timeFilter) {
                case '30d':
                    selectedAverageScore = statsRes.data.average_score_30d ?? 0;
                    break;
                case '7d':
                    selectedAverageScore = statsRes.data.average_score_7d ?? 0;
                    break;
                case 'global':
                default:
                    selectedAverageScore = statsRes.data.average_score_global ?? 0;
                    break;
            }
        }

        const formattedData: DashboardData = {
          kpis: {
            average_score: selectedAverageScore,
            total_study_hours: statsRes.data?.total_study_hours ?? 0,
            total_sessions: statsRes.data?.total_sessions ?? 0,
            current_streak_days: streakRes.data?.current_streak_days ?? 0,
          },
          dailyProgress: (progressRes.data || []).map(d => ({
            date: new Date(d.full_date).toLocaleString('fr-FR', { day: 'numeric', month: 'short' }).replace('.', ''),
            score: d.cumulative_average_score,
          })),
          specialtyPerformance: specialtyRes.data || [],
        };
        
        setData(formattedData);

      } catch (e: any) {
        setError(e.message);
        console.error("Error fetching dashboard data:", e);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [userId, timeFilter]);

  return { data, loading, error };
};


// --- 3. HELPER COMPONENTS (Unchanged) ---
const SkeletonLoader = ({ className }: { className?: string }) => (
  <div className={`bg-gray-200 rounded animate-pulse ${className}`} />
);

const getSpecialtyScoreColor = (score: number) => {
  if (score >= 15) return 'bg-green-500';
  if (score >= 10) return 'bg-yellow-500';
  return 'bg-red-500';
};


// --- 4. MAIN DASHBOARD COMPONENT (Unchanged, but will now re-render the KPI card correctly) ---

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

    navigate('/simulation');
  } catch (e) {
    console.error('Error preparing evaluation view:', e);
    toast.error("Impossible d'ouvrir la grille d'évaluation.");
  }
}
const Dashboard = () => {
  const { user } = useAuth();
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('global');
  const { data, loading } = useDashboardData(user?.id, timeFilter);
  const { results, loading: resultsLoading } = useResults({ lite: true, limit: 5 });
  const { sddList } = useSDD();
  const navigate = useNavigate();

  const pageDescription = "Analyse tes performances, tes progres et identifie tes points d'amelioration";

  return (
    <Layout>
      <div className="p-8 bg-gray-50/50 min-h-screen">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800">Tableau de bord</h1>
          <p className="text-gray-500 mt-1">{pageDescription}</p>
        </header>

        <div className="flex items-center space-x-2 mb-8">
          {(['global', '30d', '7d'] as const).map(filter => (
            <button
              key={filter}
              onClick={() => setTimeFilter(filter)}
              className={`px-4 py-2 rounded-full font-semibold text-sm transition-colors ${
                timeFilter === filter
                  ? 'bg-[#03BB26] text-white shadow'
                  : 'bg-white text-gray-600 hover:bg-gray-100'
              }`}
            >
              {filter === 'global' && 'Global'}
              {filter === '30d' && '30 derniers jours'}
              {filter === '7d' && '7 derniers jours'}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
          {/* This KPICard will now show the filtered average score */}
          <KPICard title="Note moyenne" value={data?.kpis?.average_score ? `${data.kpis.average_score.toFixed(2)}/20` : 'N/A'} loading={loading} />
          
          <KPICard title="Série d'entraînement" value={data?.kpis ? `${data.kpis.current_streak_days} jours consécutifs` : 'N/A'} loading={loading} />
          <KPICard title="Temps d'étude cumulé" value={data?.kpis ? `${Math.round(data.kpis.total_study_hours)} heures` : 'N/A'} loading={loading} />
          <KPICard title="Sessions d'entraînement totales" value={data?.kpis?.total_sessions ?? 'N/A'} loading={loading} />
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <Card className="bg-white shadow-sm border-gray-200">
              <CardContent className="p-6 h-[408px] flex flex-col">
                <h3 className="font-semibold text-gray-700 mb-4">Évolution de la moyenne générale (jour par jour)</h3>
                <div className="flex-1 w-full">
                  {loading ? <SkeletonLoader className="h-full w-full" /> : 
                  (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={data?.dailyProgress}
                        margin={{ top: 5, right: 20, left: -10, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                        <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 12 }} />
                        <YAxis domain={[0, 20]} tick={{ fill: '#6b7280', fontSize: 12 }} />
                        <Tooltip
                          contentStyle={{ borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)', border: '1px solid #e0e0e0' }}
                          labelStyle={{ fontWeight: 'bold' }}
                          formatter={(value: number) => [`${value.toFixed(2)} / 20`, 'Moyenne cumulée']}
                        />
                        <Line type="monotone" dataKey="score" stroke="#22c55e" strokeWidth={2} dot={false} activeDot={{ r: 6 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
          <div className="lg:col-span-1">
            <Card className="bg-white shadow-sm border-gray-200">
              <CardContent className="p-6 h-[408px] flex flex-col">
                <h3 className="font-semibold text-gray-700 mb-4">Moyennes par spécialité</h3>
                {/* Match chart container height and allow scroll if overflow */}
                <div className="space-y-5 flex-1 overflow-y-auto pr-2">
                  {loading ? (
                    <><SkeletonLoader className="h-12 w-full" /><SkeletonLoader className="h-12 w-full" /><SkeletonLoader className="h-12 w-full" /></>
                  ) : data?.specialtyPerformance && data.specialtyPerformance.length > 0 ? (
                    data.specialtyPerformance.map((spec, index) => (
                      <div key={index}>
                        <p className="text-sm font-medium text-gray-600 mb-1">{spec.sdd_specialite}</p>
                        <div className="flex items-center space-x-2">
                          <span className={`text-sm font-bold ${getSpecialtyScoreColor(spec.specialty_average_score).replace('bg-', 'text-')}`}>
                            {spec.specialty_average_score.toFixed(2)}/20
                          </span>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div className={`${getSpecialtyScoreColor(spec.specialty_average_score)} h-2 rounded-full`} style={{ width: `${(spec.specialty_average_score / 20) * 100}%` }}></div>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-gray-400 text-center py-4">Aucune donnée de spécialité disponible.</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

      {/* Sessions récentes */}
      <div className="mt-12">
        <RecentSessions
          results={results as any}
          loading={resultsLoading}
          onViewEvaluation={(r: any) => handleViewEvaluation(r, sddList, navigate)}
          title="Sessions récentes"
          subtitle="Consulte les notes et les évaluations des 5 dernières stations effectuées"
          headerRight={(
            <Link to="/history">
              <Button variant="secondary" className="bg-white text-text border border-border hover:bg-gray-50">
                Voir l'historique complet
                <ChevronRight size={16} className="ml-2" />
              </Button>
            </Link>
          )}
          limit={5}
        />
      </div>
      </div>
    </Layout>
  );
};

const KPICard = ({ title, value, loading }: { title: string; value: string | number; loading: boolean }) => {
  return (
    <Card className="bg-white shadow-sm border-gray-200">
      <CardContent className="p-6 text-center">
        <p className="text-sm font-medium text-gray-500 mb-2">{title}</p>
        {loading ? (
          <SkeletonLoader className="h-9 w-3/4 mx-auto" />
        ) : (
          <p className="text-3xl font-bold text-gray-800">{value}</p>
        )}
      </CardContent>
    </Card>
  );
};

export default Dashboard;
