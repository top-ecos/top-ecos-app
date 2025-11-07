import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card-premium";
import { Badge } from "@/components/ui/badge-premium";
import { Button } from "@/components/ui/button-premium";
import { EmptyState, Skeleton } from "@/components/ui/stat-tile";
import { Clock, CheckCircle, Play, ChevronRight, Filter, BookOpen, Coins, Zap } from "lucide-react";
import { useProfile } from "@/hooks/useProfile";
import { useAuth } from "@/contexts/AuthContext";
import { useResults } from "@/hooks/useResults";
import { useSDD, SDD } from "@/hooks/useSDD";
import { useStationProgress } from "@/hooks/useStationProgress";
import { deriveTypeLabel } from "@/lib/station";
import RecommendedSddSection from "@/components/RecommendedSddSection";
import RankedSection from "@/components/RankedSection";
import { Layout } from "@/components/Layout";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { startSimulation } from "@/lib/simulation";
import { toast } from "@/components/ui/sonner";
import { isSddPremium } from "@/lib/premium";
import RecentSessions from "@/components/RecentSessions";

// PHOENIX: A new component for displaying token status clearly.
const TokenStatus = ({ tokens }: { tokens: number }) => {
  const count = Math.max(0, Number.isFinite(tokens) ? tokens : 0);
  const label = count > 1 ? 'stations' : 'station';
  return (
    <div className="flex items-center justify-center gap-3 bg-surface-alt border border-border rounded-full px-4 py-2 max-w-md mx-auto mb-10">
      <Coins className="h-5 w-5 text-yellow-500" />
      <p className="text-text font-semibold">
        Il te reste {count} {label} jouable{count > 1 ? 's' : ''} gratuite{count > 1 ? 's' : ''} cette semaine
      </p>
    </div>
  );
};

// PHOENIX: A unified skeleton for the entire hero section.
// This prevents layout shifts and provides a stable, immediate UI.
const HeroSkeleton = () => (
  <div className="w-full max-w-4xl animate-pulse">
    <Card className="border-0 shadow-none bg-transparent mb-8">
      <CardContent className="p-0 text-center">
        {/* Skeleton for "Bonjour {name} !" */}
        <Skeleton className="h-12 w-72 mx-auto mb-4" />
        {/* Skeleton for "C’est parti..." */}
        <Skeleton className="h-7 w-96 mx-auto mb-10" />
        {/* Skeleton for TokenStatus */}
        <Skeleton className="h-12 max-w-md mx-auto rounded-full mb-10" />

        {/* Skeleton for Station du jour card */}
        <div className="max-w-2xl mx-auto">
          <Card className="bg-surface border border-border">
            <CardContent className="p-8 space-y-4">
               <Skeleton className="h-6 w-32 mx-auto rounded-full" />
               <Skeleton className="h-10 w-full max-w-md mx-auto rounded" />
               <div className="flex justify-center gap-3 pt-2">
                  <Skeleton className="h-6 w-20 rounded-full" />
                  <Skeleton className="h-6 w-24 rounded-full" />
                  <Skeleton className="h-6 w-28 rounded-full" />
               </div>
               <Skeleton className="h-12 w-64 mx-auto rounded mt-4" />
            </CardContent>
          </Card>
        </div>
      </CardContent>
    </Card>
  </div>
);


const Dashboard = () => {
  const { profile, loading: profileLoading, updateTokens } = useProfile();
  const { user } = useAuth();
  const { results, loading: resultsLoading } = useResults({ lite: true, limit: 5 });
  const { sddList, loading: sddLoading, error: sddError } = useSDD();
  const { isStationCompleted, updateLastAttempt, loading: progressLoading } = useStationProgress() as any;
  const navigate = useNavigate();
  const [startingStationId, setStartingStationId] = useState<string | null>(null);

  // PHOENIX: Centralized loading state for the entire hero section.
  const isHeroLoading = profileLoading || sddLoading || progressLoading;

  // --- User Profile & Premium Status ---
  // PHOENIX: Caching premium status is a good strategy to prevent UI flicker on reloads.
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


  // --- Greeting Name ---
  // PHOENIX: Cache-first approach for the user's name remains effective for a personalized feel.
  const [displayName, setDisplayName] = useState<string | null>(() => {
    try {
      const raw = localStorage.getItem('lastFirstNameCache');
      if (!raw) return null;
      const obj = JSON.parse(raw);
      if (obj && typeof obj.name === 'string' && (Date.now() - obj.ts) < 30 * 24 * 60 * 60 * 1000) {
        return obj.name;
      }
    } catch {}
    return null;
  });
  useEffect(() => {
    if (profile?.first_name) {
      setDisplayName(profile.first_name);
      try { localStorage.setItem('lastFirstNameCache', JSON.stringify({ name: profile.first_name, ts: Date.now() })); } catch {}
    }
  }, [profile?.first_name]);


  // PHOENIX: Centralized check for available tokens for free users.
  const hasTokens = !profile || profile.tokens > 0;
  const visibleSdds = sddList;

  // ---------- Recommendation logic (Station du jour) ----------
  // PHOENIX: Caching the last recommended SDD avoids jarring changes on page re-visits.
  const [heroSdd, setHeroSdd] = useState<SDD | null>(() => {
    try {
      const raw = localStorage.getItem('lastRecommendedSddV2');
      if (!raw) return null;
      const obj = JSON.parse(raw);
      if (obj && obj.data && (Date.now() - obj.ts) < 12 * 60 * 60 * 1000) { // 12h TTL
        return obj.data as SDD;
      }
    } catch {}
    return null;
  });

  // Prefer first non-completed SDD; fallback to first available among visible.
  const recommendedSdd = visibleSdds.find((s) => !isStationCompleted(s.sdd_id)) || visibleSdds[0];

  useEffect(() => {
    if (recommendedSdd) {
      setHeroSdd(recommendedSdd);
      try { localStorage.setItem('lastRecommendedSddV2', JSON.stringify({ ts: Date.now(), data: recommendedSdd })); } catch {}
    }
  }, [recommendedSdd]);

  // Use the calculated recommended SDD if available, otherwise stick with the cached one.
  const currentSdd = recommendedSdd || heroSdd;

  const handleViewEvaluation = async (result: any) => {
    try {
      // Prepare minimal case data for Simulation page
      const sddMatch = (sddList || []).find((s) => String(s.sdd_id) === String(result.station_id));
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

      // Fetch full result row on demand (lite mode used on Home)
      const { data: fullRow, error } = await supabase
        .from('mock_results')
        .select(`
          score,
          feedback,
          transcript_json,
          score_clinique,
          score_communication,
          score_phase_1,
          score_phase_2,
          evaluation_details
        `)
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
  };

  const handleStartSimulation = async (sdd: SDD) => {
    if (!isPremiumEffective && isSddPremium(sdd)) {
      toast.error('Cette station est réservée aux membres Premium.');
      navigate('/pricing');
      return;
    }
    // PHOENIX: Updated token check logic for free users
    if (!isPremiumEffective && !hasTokens) {
      toast.error("Vous n'avez plus de sessions gratuites. Passez à Premium pour continuer.");
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
    } catch (error: any) {
      console.error('Error starting station:', error);
      toast.error(error?.message || 'Erreur lors du démarrage de la simulation. Veuillez réessayer.');
      // Refresh profile to get current token state
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

  // Score styling and date formatting moved into RecentSessions component

  // Custom badge styles based on type and content
  const getBadgeStyles = (type: string, content: string) => {
    const styles: { color: string; backgroundColor: string; border?: string } = {
      color: '#707070',
      backgroundColor: '#70707033'
    };

    switch (type) {
      case 'status':
        if (content === 'Terminée') {
          styles.color = '#2ECC71';
          styles.backgroundColor = '#2ECC7133'; // 20% opacity
        } else if (content === 'À faire') {
          styles.color = '#707070';
          styles.backgroundColor = '#70707033'; // 20% opacity
        }
        break;
      
      case 'document':
        styles.color = '#FF4BD6';
        styles.backgroundColor = '#FF4BD633'; // 20% opacity
        break;
      
      case 'type':
        if (content === 'Patient Standardisé' || content === 'PS') {
          styles.color = '#4299F6';
          styles.backgroundColor = '#4299F633'; // 20% opacity
        } else if (content === 'Patient Semi-Standardisé' || content === 'PSS') {
          styles.color = '#9105F8';
          styles.backgroundColor = '#9105F833'; // 20% opacity
        } else if (content === 'Documents' || content === 'Document(s)') {
          styles.color = '#FF4BD6';
          styles.backgroundColor = '#FF4BD633'; // 20% opacity
        } else if (content === 'Station sèche' || content === 'Sèche') {
          styles.color = '#934F00';
          styles.backgroundColor = '#934F0033'; // 20% opacity
        } else if (content === 'Procédure') {
          styles.color = '#28A745';
          styles.backgroundColor = '#28A74533'; // 20% opacity
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
        styles.backgroundColor = '#F39C1233'; // 20% opacity
        break;
        
      default:
        // Keep default gray styling
        break;
    }

    return styles;
  };

  // For the recommendations grid: prioritize for free users
  // Order: free + à faire -> free + done -> premium + à faire -> premium + done
  const recommendedGridItems = (() => {
    const list = visibleSdds || [];
    if (!list.length) return [] as SDD[];
    const freeTodo: SDD[] = [];
    const freeDone: SDD[] = [];
    const premiumTodo: SDD[] = [];
    const premiumDone: SDD[] = [];
    for (const s of list) {
      const premium = isSddPremium(s);
      const todo = !isStationCompleted(s.sdd_id);
      if (!premium && todo) freeTodo.push(s);
      else if (!premium && !todo) freeDone.push(s);
      else if (premium && todo) premiumTodo.push(s);
      else premiumDone.push(s);
    }
    return [...freeTodo, ...freeDone, ...premiumTodo, ...premiumDone].slice(0, 9);
  })();

  return (
    <Layout>
      <div className="flex flex-col min-h-screen">
        {/* Central Hero Section */}
        <div className="flex-1 flex items-center justify-center py-6 px-4 md:py-12 md:px-6">
          {isHeroLoading ? (
            <HeroSkeleton />
          ) : (
            <div className="w-full max-w-4xl animate-fade-in-slide-up">
              <Card className="border-0 shadow-none bg-transparent mb-8">
                <CardContent className="p-0 text-center">
                  <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-text tracking-tight mb-3 md:mb-4">
                    Bonjour {displayName || profile?.first_name || 'Étudiant'} !
                  </h1>
                  <p className="text-lg sm:text-xl md:text-2xl text-text font-bold mb-6 md:mb-10">
                    C’est parti pour une session d’entraînement ?
                  </p>

                  {/* PHOENIX: Display token status only for free users */}
                  {!isPremiumEffective && profile && (
                    <TokenStatus tokens={profile.tokens} />
                  )}

                  {/* Station du jour card */}
                  <div className="max-w-2xl mx-auto">
                    <Card className="bg-surface border border-border">
                      <CardContent className="p-8">
                        {/* PHOENIX: Conditional rendering based on token availability for free users */}
                        {!isPremiumEffective && !hasTokens ? (
                          <>
                            <div className="mb-4">
                              <Zap className="h-10 w-10 text-primary mx-auto" />
                            </div>
                            <h2 className="text-2xl sm:text-3xl font-semibold text-text mb-2">
                              Continuez votre entraînement en illimité
                            </h2>
                            <p className="text-subtext mb-8">
                              Vous avez utilisé toutes vos sessions gratuites de la semaine. Passez à Premium pour débloquer toutes les stations et obtenir des analyses de performance détaillées.
                            </p>
                            <Button
                              variant="primary"
                              size="lg"
                              className="w-full md:w-auto md:px-6 md:min-w-[260px] text-white bg-[var(--accent)] hover:bg-[var(--accent-hover)] border border-[var(--accent)]"
                              onClick={() => navigate('/pricing')}
                            >
                              <span className="font-bold">Découvrir l'offre Premium</span>
                              <ChevronRight size={18} className="ml-2" />
                            </Button>
                          </>
                        ) : currentSdd ? (
                          <>
                            <div className="mb-4">
                              <Badge variant="secondary" className="rounded-full px-3.5 py-1.5 text-sm">
                                Station du jour
                              </Badge>
                            </div>
                            <h2 className="text-2xl sm:text-3xl font-semibold text-text mb-2">
                              {currentSdd.name}
                            </h2>
                        <div className="flex items-center justify-start md:justify-center gap-3 mb-6 md:mb-8 overflow-x-auto px-1 md:px-0">
                        {(() => {
                          const t = deriveTypeLabel(currentSdd as any);
                          const label = t === 'Documents' ? 'Document(s)' : t;
                          return (
                            <Badge 
                              className="text-sm border-0 font-bold" 
                              style={getBadgeStyles('type', label)}
                            >
                              {label}
                            </Badge>
                          );
                        })()}
                              {(currentSdd as any)?.specialite && (
                                <Badge
                                  className="text-sm border-0 font-bold"
                                  style={getBadgeStyles('specialty', (currentSdd as any).specialite)}
                                >
                                  {(currentSdd as any).specialite}
                                </Badge>
                              )}
                              <Badge
                                className="text-sm font-bold"
                                style={getBadgeStyles('edn', `item EDN ${currentSdd.item_EDN ?? '—'}`)}
                              >
                                Item EDN {currentSdd.item_EDN ?? '—'}
                              </Badge>
                            </div>
                            <div>
                              {(!isPremiumEffective && isSddPremium(currentSdd)) ? (
                                <Button
                                  variant="secondary"
                                  size="lg"
                                  className="w-full md:w-auto md:px-6 md:min-w-[260px] bg-white text-text border border-[var(--border)] hover:bg-[var(--accent)] hover:text-white hover:border-[var(--accent)] min-h-[48px]"
                                  onClick={() => navigate('/pricing')}
                                >
                                  <span className="font-bold">Je m'abonne</span>
                                </Button>
                              ) : (
                                <Button
                                  variant="primary"
                                  size="lg"
                                  className="w-full md:w-auto md:px-6 md:min-w-[260px] text-white bg-[var(--accent)] hover:bg-[var(--accent-hover)] border border-[var(--accent)] min-h-[48px]"
                                  onClick={() => handleStartSimulation(currentSdd)}
                                  disabled={startingStationId === currentSdd.id}
                                >
                                  {startingStationId === currentSdd.id ? (
                                    <>
                                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                                      Initialisation...
                                    </>
                                  ) : (
                                    <>
                                      <span className="font-bold">Lancer la station</span>
                                      <ChevronRight size={18} className="ml-2" />
                                    </>
                                  )}
                                </Button>
                              )}
                            </div>
                          </>
                        ) : (
                           <EmptyState
                             icon={<BookOpen size={24} />}
                             title="Aucune station à recommander"
                             description="Consultez la bibliothèque pour trouver une station."
                           />
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        {/* Scroll indicator */}
        <div className="text-center pb-20 md:pb-8">
          <p className="text-2xl text-subtext mb-2">Voir d’autres SDD & Stations</p>
          <div className="animate-bounce">
            <ChevronRight size={20} className="rotate-90 mx-auto text-subtext" />
          </div>
        </div>
      </div>
      
      {/* PHOENIX: The rest of the page remains the same, as its loading is handled separately. */}
      {/* Secondary Content - Scrollable */}
      <div className="p-6 space-y-8 bg-surface-alt">

        {/* Explore SDD Section */}
        <RecommendedSddSection
          loading={sddLoading}
          error={sddError}
          items={recommendedGridItems}
          isStationCompleted={isStationCompleted}
          isPremiumEffective={isPremiumEffective}
          hasTokens={hasTokens}
          startingStationId={startingStationId}
          onStart={handleStartSimulation}
          getBadgeStyles={getBadgeStyles}
        />

        {/* Ranked stations of the week */}
        <RankedSection
          isStationCompleted={isStationCompleted}
          isPremiumEffective={isPremiumEffective}
          hasTokens={hasTokens}
          startingStationId={startingStationId}
          onStart={handleStartSimulation}
          getBadgeStyles={getBadgeStyles}
          fallbackFromAll={sddList}
        />

        {/* Recent History */}
        <RecentSessions
          results={results as any}
          loading={resultsLoading}
          onViewEvaluation={handleViewEvaluation as any}
          title="Sessions récentes"
          subtitle="Consulte les notes et les évaluations des 5 dernières stations effectuées"
          limit={5}
        />
      </div>
    </Layout>
  );
};

export default Dashboard;
