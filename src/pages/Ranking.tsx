import { useEffect, useMemo, useState } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent } from '@/shared/components/ui/card-premium';
import { Button } from '@/shared/components/ui/button-premium';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/shared/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { Info, Medal, Lock } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useAuth } from '@/shared/contexts/AuthContext';
import { Alert, AlertDescription } from '@/shared/components/ui/alert';
import { useProfile } from '@/shared/hooks/useProfile';
import { useNavigate } from 'react-router-dom';
import { isUserPremium, isSddPremium } from '@/shared/lib/premium';
// ── New imports for RankedSection integration ──
import RankedSection from '@/components/RankedSection';
import { useSDD, SDD } from '@/shared/hooks/useSDD';
import { useStationProgress } from '@/shared/hooks/useStationProgress';
import { startSimulation } from '@/features/simulation/lib/simulation';
import { deriveTypeLabel } from '@/features/station/lib/station';
import { toast } from '@/shared/components/ui/sonner';

type RankingRow = {
  user_id: string;
  pseudo: string | null;
  emoji?: string | null;
  average_score: number | null;
  completed_ranked_tests?: number | null;
};

const formatScore = (n: number | null | undefined) => {
  if (n === null || n === undefined || isNaN(n as any)) return '—';
  return (Math.round((n as number) * 100) / 100).toFixed(2);
};

const TopCard = ({
  rank,
  pseudo,
  emoji,
  score,
  color,
  highlight,
}: {
  rank: number;
  pseudo: string;
  emoji?: string | null;
  score: number | null;
  color: 'gold' | 'silver' | 'bronze';
  highlight?: boolean;
}) => {
  const palette = {
    gold: {
      text: 'text-amber-600',
      border: 'border-amber-200',
      bg: 'bg-amber-50',
      icon: 'text-amber-500',
      badgeText: 'text-amber-700',
      badgeBg: 'bg-amber-50',
      badgeBorder: 'border border-amber-200 shadow-sm',
    },
    silver: {
      text: 'text-gray-600',
      border: 'border-gray-200',
      bg: 'bg-gray-50',
      icon: 'text-gray-400',
      badgeText: 'text-gray-600',
      badgeBg: 'bg-gray-50',
      badgeBorder: 'border border-gray-200 shadow-sm',
    },
    bronze: {
      text: 'text-orange-700',
      border: 'border-orange-200',
      bg: 'bg-orange-50',
      icon: 'text-orange-600',
      badgeText: 'text-orange-700',
      badgeBg: 'bg-orange-50',
      badgeBorder: 'border border-orange-200 shadow-sm',
    },
  } as const;

  const p = palette[color];

  const nameClass = highlight
    ? 'font-bold text-green-600 truncate'
    : 'font-semibold text-[var(--text)] truncate';

  return (
    <Card className={`bg-white ${p.border}`}>
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          <div className={`inline-flex items-center gap-1.5 ${p.badgeBg} ${p.badgeBorder} ${p.badgeText} rounded-full px-2.5 py-1 text-xs font-semibold w-fit`}>
            <Medal size={16} className={p.icon} />
            <span>{`top ${rank}`}</span>
          </div>
          <div className="w-9 h-9 rounded-full bg-gray-200 shrink-0 flex items-center justify-center">
            <span className="text-2xl" role="img" aria-label="avatar">
              {emoji && emoji.trim() ? emoji : '⭐'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className={nameClass}>{pseudo}</div>
          </div>
          <div className="text-right font-semibold text-[var(--text)] min-w-[64px]">
            {formatScore(score)}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const getWeekStart = (d = new Date()) => {
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1 - day);
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
};

// ── Badge styles (same as Home) ──
const getBadgeStyles = (type: string, content: string) => {
  const styles: { color: string; backgroundColor: string; border?: string } = {
    color: '#707070',
    backgroundColor: '#70707033',
  };

  switch (type) {
    case 'status':
      if (content === 'Terminée') {
        styles.color = '#2ECC71';
        styles.backgroundColor = '#2ECC7133';
      } else if (content === 'À faire') {
        styles.color = '#707070';
        styles.backgroundColor = '#70707033';
      }
      break;
    case 'document':
      styles.color = '#FF4BD6';
      styles.backgroundColor = '#FF4BD633';
      break;
    case 'type':
      if (content === 'Patient Standardisé' || content === 'PS') {
        styles.color = '#4299F6';
        styles.backgroundColor = '#4299F633';
      } else if (content === 'Patient Semi-Standardisé' || content === 'PSS') {
        styles.color = '#9105F8';
        styles.backgroundColor = '#9105F833';
      } else if (content === 'Documents' || content === 'Document(s)') {
        styles.color = '#FF4BD6';
        styles.backgroundColor = '#FF4BD633';
      } else if (content === 'Station sèche' || content === 'Sèche') {
        styles.color = '#934F00';
        styles.backgroundColor = '#934F0033';
      } else if (content === 'Procédure') {
        styles.color = '#28A745';
        styles.backgroundColor = '#28A74533';
      }
      break;
    case 'edn':
    case 'time':
      styles.color = '#707070';
      styles.backgroundColor = '#FFFFFF';
      styles.border = '1px solid #E0E0E0';
      break;
    case 'specialty':
      styles.color = '#F39C12';
      styles.backgroundColor = '#F39C1233';
      break;
    default:
      break;
  }

  return styles;
};

const Ranking = () => {
  const { profile, loading: profileLoading, hasPremiumAccess, updateTokens } = useProfile();
  
  const [cachedHasPremium, setCachedHasPremium] = useState<boolean | null>(() => {
    const cache = typeof StorageManager?.getProfileCache === 'function'
      ? StorageManager.getProfileCache()
      : null;
    return cache ? isUserPremium(cache.data) : null;
  });
  
  const isPremiumEffective = hasPremiumAccess ?? cachedHasPremium ?? false;
  
  useEffect(() => {
    if (!profile) return;
    setCachedHasPremium(hasPremiumAccess);
  }, [profile, hasPremiumAccess]);

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<RankingRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const [myRow, setMyRow] = useState<RankingRow | null>(null);
  const [totalRankedCount, setTotalRankedCount] = useState<number | null>(null);
  const [myRank, setMyRank] = useState<number | null>(null);
  const navigate = useNavigate();

  // ── New hooks for RankedSection ──
  const { sddList } = useSDD();
  const { isStationCompleted, updateLastAttempt } = useStationProgress() as any;
  const [startingStationId, setStartingStationId] = useState<string | null>(null);
  const hasTokens = !profile || profile.tokens > 0;

  // ── Start simulation handler (same logic as Home) ──
  const handleStartSimulation = async (sdd: SDD) => {
    if (!isPremiumEffective && isSddPremium(sdd)) {
      toast.error('Cette station est réservée aux membres Premium.');
      navigate('/pricing');
      return;
    }
    if (!isPremiumEffective && !hasTokens) {
      toast.error("Tu n'as plus de sessions gratuites cette semaine. Abonne-toi à top ECOS Premium pour continuer l'entraînement.");
      navigate('/pricing');
      return;
    }
    if (!user) {
      console.error('User not authenticated');
      return;
    }

    setStartingStationId(sdd.id);

    try {
      await startSimulation(sdd, {
        updateTokens,
        updateLastAttempt,
        sanitizeMessage: false,
      });
      navigate('/simulation');
    } catch (error: unknown) {
      console.error('Error starting station:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erreur lors du démarrage de la simulation. Veuillez réessayer.';
      toast.error(errorMessage);
      if (profile && user) {
        try {
          const { data: refreshedProfile, error: refreshError } = await supabase
            .from('profiles')
            .select('tokens')
            .eq('user_id', user.id)
            .single();
          if (!refreshError && refreshedProfile) {
            updateTokens(refreshedProfile.tokens);
          }
        } catch (refreshError) {
          console.error('Error refreshing profile:', refreshError);
        }
      }
    } finally {
      setStartingStationId(null);
    }
  };

  useEffect(() => {
    if (!isPremiumEffective) {
      setLoading(false);
      return;
    }
    let active = true;
    const fetchData = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('user_ranking')
          .select('user_id,pseudo,emoji,average_score')
          .gte('completed_ranked_tests', 3)
          .order('average_score', { ascending: false })
          .limit(10);
        if (error) throw error;
        if (!active) return;
        setRows((data ?? []) as RankingRow[]);
        setError(null);

        try {
          const { count: total, error: countErr } = await supabase
            .from('user_ranking')
            .select('user_id', { count: 'exact', head: true })
            .gte('completed_ranked_tests', 3);
          if (countErr) {
            console.warn('Count error:', countErr.message);
            if (active) setTotalRankedCount(null);
          } else if (active) {
            setTotalRankedCount(total ?? 0);
          }
        } catch (e: unknown) {
          const errorMessage = e instanceof Error ? e.message : 'Unknown error';
          console.warn('Unexpected count error:', errorMessage);
          if (active) setTotalRankedCount(null);
        }

        if (user?.id) {
          const { data: mine, error: myErr } = await supabase
            .from('user_ranking')
            .select('user_id,pseudo,emoji,average_score,completed_ranked_tests')
            .eq('user_id', user.id)
            .maybeSingle();
          if (myErr) {
            console.warn('Could not fetch current user ranking:', myErr.message);
            setMyRow(null);
            setMyRank(null);
          } else {
            setMyRow((mine as any) || null);
            if ((mine?.completed_ranked_tests ?? 0) >= 3 && mine?.average_score != null) {
              try {
                const { count: ahead, error: aheadErr } = await supabase
                  .from('user_ranking')
                  .select('user_id', { count: 'exact', head: true })
                  .gte('completed_ranked_tests', 3)
                  .gt('average_score', mine.average_score as number);
                if (aheadErr) {
                  console.warn('Ahead count error:', aheadErr.message);
                  if (active) setMyRank(null);
                } else if (active) {
                  setMyRank(((ahead ?? 0) + 1));
                }
              } catch (e: unknown) {
                const errorMessage = e instanceof Error ? e.message : 'Unknown error';
                console.warn('Unexpected ahead count error:', errorMessage);
                if (active) setMyRank(null);
              }
            } else {
              setMyRank(null);
            }
          }
        } else {
          setMyRow(null);
          setMyRank(null);
        }
      } catch (e: unknown) {
        if (!active) return;
        const errorMessage = e instanceof Error ? e.message : 'Erreur lors du chargement du classement.';
        setError(errorMessage);
        setRows([]);
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchData();
    return () => {
      active = false;
    };
  }, [user?.id, isPremiumEffective]);

  const top3 = useMemo(() => rows.slice(0, 3), [rows]);
  const others = useMemo(() => rows.slice(3), [rows]);
  const topPercent = useMemo(() => {
    if (!totalRankedCount || !myRank) return null;
    if (totalRankedCount <= 0) return null;
    return Math.round((myRank / totalRankedCount) * 100);
  }, [myRank, totalRankedCount]);

  const weekLabel = useMemo(() => {
    const monday = getWeekStart();
    try {
      return `Semaine du ${format(monday, 'd MMMM yyyy', { locale: fr })}`;
    } catch {
      return 'Classement de la semaine';
    }
  }, []);

  // Premium gate: non-premium users see the lock screen
  const premiumKnown = profile !== null || cachedHasPremium !== null;
  if (premiumKnown && !isPremiumEffective) {
    return (
      <Layout>
        <div className="flex flex-col min-h-screen">
          <div className="flex-1 py-6 px-4 md:py-10 md:px-8 lg:px-12 flex items-center justify-center">
            <div className="w-full max-w-2xl">
              <Card className="bg-surface border border-border">
                <CardContent className="p-8 text-center space-y-4">
                  <div className="flex items-center justify-center mb-2">
                    <Lock className="h-10 w-10 text-primary" />
                  </div>
                  <h1 className="text-2xl md:text-3xl font-semibold text-text">
                    Accès au classement réservé aux abonnés
                  </h1>
                  <p className="text-subtext">
                    Passe à top ECOS Premium pour comparer tes performances à celles des autres étudiants. Chaque semaine, 3 nouvelles stations classées t'attendent parmi les 10 nouvelles ajoutées à la plateforme.
                  </p>
                  <div className="pt-2">
                    <Button
                      variant="primary"
                      size="lg"
                      className="w-full md:w-auto md:px-6 md:min-w-[260px] text-white bg-[var(--accent)] hover:bg-[var(--accent-hover)] border border-[var(--accent)]"
                      onClick={() => navigate('/pricing')}
                    >
                      Découvrir top ECOS Premium
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="flex flex-col min-h-screen">
        <div className="flex-1 py-6 px-4 md:py-10 md:px-8 lg:px-12">
          <div className="max-w-5xl mx-auto w-full">
            {/* Header */}
            <div className="flex items-start justify-between mb-6 md:mb-8">
              <div>
                <h1 className="text-3xl md:text-4xl font-bold text-text tracking-tight mb-2">Classement</h1>
                <p className="text-subtext">{weekLabel}</p>
              </div>

              <Dialog>
                <DialogTrigger asChild>
                  <Button
                    variant="secondary"
                    className="border border-blue-300 text-blue-600 bg-white hover:bg-blue-50"
                  >
                    <Info size={16} className="mr-2" />
                    Comment ça marche ?
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-white">
                  <DialogHeader>
                    <DialogTitle>Comment ça marche ?</DialogTitle>
                    <DialogDescription>
                      Les stations classées te permettent de comparer tes performances à celles des autres utilisateurs de top ECOS. Toutes les semaines, 3 nouvelles stations classées sont ajoutées à top ECOS. Fais-toi évaluer par l'IA top ECOS sur ces 3 nouvelles stations et vois comment tu te situes par rapport aux autres étudiants. Le classement est réinitialisé toutes les semaines.
                    </DialogDescription>
                  </DialogHeader>
                </DialogContent>
              </Dialog>
            </div>

            {/* Leaderboard Content */}
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent mx-auto mb-4"></div>
                  <p className="text-subtext">Chargement du classement...</p>
                </div>
              </div>
            ) : error ? (
              <Card className="bg-white border-border">
                <CardContent className="p-8 text-center">
                  <p className="text-subtext mb-4">{error}</p>
                  <Button onClick={() => window.location.reload()} variant="secondary">Réessayer</Button>
                </CardContent>
              </Card>
            ) : user?.id && myRow && (myRow.completed_ranked_tests ?? 0) < 3 ? (
              /* ── State: < 3 stations done ── */
              <div className="space-y-8">
                <Card className="bg-white border-border">
                  <CardContent className="p-8 text-center space-y-4">
                    <div className="flex items-center justify-center mb-2">
                      <Info className="h-10 w-10 text-blue-600" />
                    </div>
                    <h2 className="text-2xl md:text-3xl font-semibold text-text">
                      Termine les 3 stations classées
                    </h2>
                    <p className="text-subtext">
                      Tu as complété {myRow.completed_ranked_tests ?? 0} station{(myRow.completed_ranked_tests ?? 0) > 1 ? 's' : ''} sur 3. Complète les {3 - (myRow.completed_ranked_tests ?? 0)} station{(3 - (myRow.completed_ranked_tests ?? 0)) > 1 ? 's' : ''} restante{(3 - (myRow.completed_ranked_tests ?? 0)) > 1 ? 's' : ''} pour voir ton classement et te comparer aux autres étudiants.
                    </p>
                  </CardContent>
                </Card>

                {/* Ranked stations so user can launch them directly */}
                <RankedSection
                  isStationCompleted={isStationCompleted}
                  isPremiumEffective={isPremiumEffective}
                  hasTokens={hasTokens}
                  startingStationId={startingStationId}
                  onStart={handleStartSimulation}
                  getBadgeStyles={getBadgeStyles}
                  fallbackFromAll={sddList}
                  hideInfoButton
                />
              </div>
            ) : (
              /* ── State: 3 stations done → full leaderboard + ranked stations ── */
              <div className="space-y-8">
                <div className="space-y-4 animate-fade-in-slide-up">
                  {/* Top 1/2/3 */}
                  {top3.map((row, idx) => (
                    <TopCard
                      key={row.user_id}
                      rank={idx + 1}
                      pseudo={row.pseudo || 'Utilisateur'}
                      emoji={row.emoji}
                      score={row.average_score}
                      highlight={user?.id === row.user_id}
                      color={idx === 0 ? 'gold' : idx === 1 ? 'silver' : 'bronze'}
                    />
                  ))}

                  {/* 4-10 */}
                  <Card className="bg-white border-border">
                    <CardContent className="p-0">
                      {others.length === 0 ? (
                        <div className="p-8 text-center text-subtext">Pas encore d'autres participants cette semaine.</div>
                      ) : (
                        <div className="divide-y divide-gray-200">
                          {others.map((row, i) => {
                            const rank = i + 4;
                            return (
                              <div key={row.user_id} className="flex items-center gap-4 px-6 py-4">
                                <div className="w-8 text-[var(--text)] font-semibold">{rank}.</div>
                                <div className="flex-1 min-w-0 text-center text-[var(--text)]">
                                  <span className={`truncate inline-block max-w-full ${user?.id === row.user_id ? 'text-green-600 font-bold' : ''}`}>{row.pseudo || 'Utilisateur'}</span>
                                </div>
                                <div className="w-16 text-right font-semibold text-[var(--text)]">
                                  {formatScore(row.average_score)}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Personal ranking (if not in top 10) */}
                  {user?.id && !rows.some(r => r.user_id === user.id) && myRow && (myRow.completed_ranked_tests ?? 0) >= 3 && (
                    <Card className="bg-white border-border">
                      <CardContent className="px-6 py-4">
                        <div className="flex items-center">
                          <div className="flex-1 text-left font-semibold text-[var(--text)]">Ton classement</div>
                          <div className="flex-1 text-center text-subtext">{topPercent != null ? `top ${topPercent}%` : '—'}</div>
                          <div className="flex-1 text-right font-semibold text-[var(--text)]">
                            {formatScore(myRow?.average_score ?? null)}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>

                {/* ── Ranked stations of the week ── */}
                <RankedSection
                  isStationCompleted={isStationCompleted}
                  isPremiumEffective={isPremiumEffective}
                  hasTokens={hasTokens}
                  startingStationId={startingStationId}
                  onStart={handleStartSimulation}
                  getBadgeStyles={getBadgeStyles}
                  fallbackFromAll={sddList}
                  hideInfoButton
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Ranking;
