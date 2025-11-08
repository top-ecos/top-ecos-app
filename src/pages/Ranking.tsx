import { useEffect, useMemo, useState } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent } from '@/components/ui/card-premium';
import { Button } from '@/components/ui/button-premium';
// no skeletons here; use a simple waiting spinner instead
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { Info, Medal, Lock } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useAuth } from '@/contexts/AuthContext';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useProfile } from '@/hooks/useProfile';
import { useNavigate } from 'react-router-dom';

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
  // Monday as first day of week (FR)
  const day = d.getDay(); // 0..6, 0 = Sunday
  const diff = (day === 0 ? -6 : 1 - day); // how many days to Monday
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
};

const Ranking = () => {
  // Premium gating (align with Home logic)
  const { profile, loading: profileLoading } = useProfile();
  const [cachedPremium, setCachedPremium] = useState<boolean | null>(() => {
    try {
      const raw = localStorage.getItem('profileCacheV1');
      if (raw) return Boolean(JSON.parse(raw)?.data?.premium);
    } catch {}
    return null;
  });
  const isPremiumEffective = typeof profile?.premium === 'boolean' ? Boolean(profile.premium) : Boolean(cachedPremium);
  useEffect(() => {
    if (typeof profile?.premium === 'boolean') {
      try {
        const raw = localStorage.getItem('profileCacheV1');
        const obj = raw ? JSON.parse(raw) : {};
        localStorage.setItem('profileCacheV1', JSON.stringify({ ...obj, data: { ...obj.data, premium: profile.premium } }));
      } catch {}
    }
  }, [profile?.premium]);

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<RankingRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const [myRow, setMyRow] = useState<RankingRow | null>(null);
  const [totalRankedCount, setTotalRankedCount] = useState<number | null>(null);
  const [myRank, setMyRank] = useState<number | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!isPremiumEffective) {
      // Skip fetching when user is not premium
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

        // Fetch current user's row (to display personal placement if not in top 10)
        // Fetch total ranked users (>=3 completed ranked tests)
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
        } catch (e: any) {
          console.warn('Unexpected count error:', e?.message);
          if (active) setTotalRankedCount(null);
        }

        if (user?.id) {
          const { data: mine, error: myErr } = await supabase
            .from('user_ranking')
            .select('user_id,pseudo,emoji,average_score,completed_ranked_tests')
            .eq('user_id', user.id)
            .maybeSingle();
          if (myErr) {
            // Non-blocking for overall page
            console.warn('Could not fetch current user ranking:', myErr.message);
            setMyRow(null);
            setMyRank(null);
          } else {
            setMyRow((mine as any) || null);
            // Compute user's rank only if eligible (>=3) and has score
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
              } catch (e: any) {
                console.warn('Unexpected ahead count error:', e?.message);
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
      } catch (e: any) {
        if (!active) return;
        setError(e?.message || 'Erreur lors du chargement du classement.');
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

  // Premium gate: show instantly for known free users (from cache or profile),
  // even if profile is still loading to avoid any spinner flash.
  const premiumKnown = (typeof profile?.premium === 'boolean') || (typeof cachedPremium === 'boolean');
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
                    Passe à top ECOS Premium pour comparer tes performances à celles des autres étudiants. Chaque semaine, 3 nouvelles stations classées t’attendent parmi les 5 nouvelles ajoutées à la plateforme.
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
                      Les stations classées te permettent de comparer tes performances à celles des autres utilisateurs de top ECOS. Toutes les semaines, 5 nouvelles stations sont ajoutées à top ECOS. Fais-toi évaluer par l'IA top ECOS sur ces 5 nouvelles stations et vois comment tu te situes par rapport à tes concurrents. Le classement est réinitialisé toutes les semaines.
                    </DialogDescription>
                  </DialogHeader>
                </DialogContent>
              </Dialog>
            </div>

            {/* Provisional notice when under 3 ranked tests (only after loading) */}
            {!loading && user?.id && myRow && (myRow.completed_ranked_tests ?? 0) < 3 && (
              <div className="mb-6">
                <Alert className="bg-white border-blue-200 text-blue-700">
                  <AlertDescription>
                    Classement provisoire, finissez {3 - (myRow.completed_ranked_tests ?? 0)} stations ranked pour vous classer
                  </AlertDescription>
                </Alert>
              </div>
            )}

            {/* Content */}
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
            ) : (
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
                {user?.id && !rows.some(r => r.user_id === user.id) && myRow && (
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
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Ranking;
