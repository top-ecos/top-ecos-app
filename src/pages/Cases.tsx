
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card-premium";
import { Badge } from "@/components/ui/badge-premium";
import { Button } from "@/components/ui/button-premium";
import { SearchInput } from "@/components/ui/input-premium";
import { EmptyState, Skeleton } from "@/components/ui/stat-tile";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Clock, CheckCircle, User, Play, Filter, BookOpen, ArrowLeft, Coins, ChevronRight } from "lucide-react";
import { useProfile } from "@/hooks/useProfile";
import { useAuth } from "@/contexts/AuthContext";
import { useSDD, useSddFiltering, SDD } from "@/hooks/useSDD";
import { deriveTypeLabel } from "@/lib/station";
import { useStationProgress } from "@/hooks/useStationProgress";
import { Layout } from "@/components/Layout";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { startSimulation } from "@/lib/simulation";
import { toast } from "@/components/ui/sonner";
import { isSddPremium, isUserPremium } from "@/lib/premium";

// Security utility functions
const sanitizeText = (text: string | null | undefined): string => {
  if (!text) return '';
  // Remove potentially dangerous characters and limit length
  return text.replace(/[<>"'&]/g, '').substring(0, 200);
};

// (validateCaseData, sanitizeMessage) no longer needed; startSimulation performs validation

const Cases = () => {
  const { profile, loading: profileLoading, updateTokens } = useProfile();
  const { user } = useAuth();
  const { sddList, loading: sddLoading, error: sddError } = useSDD();
  const { isStationCompleted, updateLastAttempt } = useStationProgress();
  const isPremiumUser = isUserPremium(profile);
  const {
    filteredSDD,
    searchValue,
    statusFilter,
    typeFilter,
    specialiteFilter,
    setSearchValue,
    setStatusFilter,
    setTypeFilter,
    setSpecialiteFilter,
    getAvailableSpecialites,
    resetFilters
  } = useSddFiltering(sddList, isStationCompleted);
  const navigate = useNavigate();
  const [startingStationId, setStartingStationId] = useState<string | null>(null);
  // --- Client-side pagination (load more) ---
  const PAGE_SIZE = 9;
  const [visibleCount, setVisibleCount] = useState<number>(PAGE_SIZE);

  // --- Debounced search input ---
  const [searchTerm, setSearchTerm] = useState<string>(searchValue);
  useEffect(() => {
    const h = setTimeout(() => setSearchValue(searchTerm), 200);
    return () => clearTimeout(h);
  }, [searchTerm, setSearchValue]);

  // No persistence: filters reset when leaving this page

  // Reset visible count when filters/search change
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [searchValue, statusFilter, typeFilter, specialiteFilter]);

  // --- Progressive skeletons for SDD grid ---
  // Immediately show an empty layout skeleton, and after 250ms show detailed skeletons.
  const [showDetailedSkeleton, setShowDetailedSkeleton] = useState(false);
  useEffect(() => {
    let t: any;
    if (sddLoading) {
      setShowDetailedSkeleton(false);
      t = setTimeout(() => setShowDetailedSkeleton(true), 250);
    } else {
      setShowDetailedSkeleton(false);
    }
    return () => { if (t) clearTimeout(t); };
  }, [sddLoading]);

  // --- Fade-in on data arrival ---
  const [gridVisible, setGridVisible] = useState(false);
  useEffect(() => {
    if (!sddLoading) {
      setGridVisible(false);
      const raf = requestAnimationFrame(() => setGridVisible(true));
      return () => cancelAnimationFrame(raf);
    } else {
      setGridVisible(false);
    }
  }, [sddLoading]);

  const handleStartSimulation = async (sdd: SDD) => {
    // Gate premium stations for free users
    if (!isPremiumUser && isSddPremium(sdd)) {
      toast.error('Fonctionnalité premium');
      return;
    }
    // Check tokens before starting
    if (!profile || profile.tokens <= 0) {
      toast.error("Désolé, vous avez atteint la limite de votre compte. Veuillez réessayer plus tard ou modifier votre abonnement.");
      return;
    }

    if (!user) {
      toast.error("Erreur d'authentification. Veuillez vous reconnecter.");
      return;
    }
    
    setStartingStationId(sdd.id);
    
    try {
      await startSimulation(sdd, {
        updateTokens,
        updateLastAttempt,
        sanitizeMessage: true,
      });
      navigate('/simulation');
    } catch (error: any) {
      toast.error(error?.message || 'Erreur lors du démarrage de la simulation. Veuillez réessayer.');
      // Refresh profile to get current token state
      // (Token refund would need to be handled by a separate Edge Function if required)
      if (profile && user) {
        try {
          // Refresh the profile to get the current token count
          const { data: refreshedProfile, error: refreshError } = await supabase
            .from('profiles')
            .select('tokens')
            .eq('user_id', user.id)
            .single();
          
          if (!refreshError && refreshedProfile) {
            updateTokens(refreshedProfile.tokens);
          }
        } catch (refreshError) {
          // Handle refresh error silently
        }
      }
    } finally {
      setStartingStationId(null);
    }
  };

  // Station type and labels are centralized in lib/station

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

  const handleBack = () => {
    navigate('/');
  };

  // Dynamically size the title so long names fit on one line
  const getTitleSize = (name: string | undefined) => {
    const n = (name || '').length;
    if (n > 60) return 'text-sm';
    if (n > 40) return 'text-base';
    return 'text-lg';
  };

  return (
    <Layout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div>
              <h1 className="text-3xl font-bold text-text">Bibliothèque des Stations</h1>
            </div>
          </div>
        </div>

        {/* Token warning banners removed as requested */}

        {/* Filters */}
        <Card className="bg-surface border-border">
          <CardHeader>
            <div className="flex items-center gap-2 mb-4">
              <Filter size={16} className="text-subtext" />
              <span className="font-medium text-text">Filtres</span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="flex flex-col gap-2">
                <span className="text-sm italic text-subtext">Mots-clés</span>
                <SearchInput
                  placeholder="Toux, ictère, méléna…"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-sm italic text-subtext">Statut</span>
                <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as "all" | "done" | "todo")}>
                  <SelectTrigger>
                    <SelectValue placeholder="Toutes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes</SelectItem>
                    <SelectItem value="done">Terminée</SelectItem>
                    <SelectItem value="todo">À faire</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-sm italic text-subtext">Typologies de stations</span>
                <Select value={typeFilter} onValueChange={(value) => setTypeFilter(value as "all" | "ps" | "pss" | "seche" | "procedure" | "documents")}>
                  <SelectTrigger>
                    <SelectValue placeholder="Toutes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes</SelectItem>
                    <SelectItem value="ps">PS</SelectItem>
                    <SelectItem value="pss">PSS</SelectItem>
                    <SelectItem value="documents">Document(s)</SelectItem>
                    <SelectItem value="procedure">Procédure</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-sm italic text-subtext">Spécialités médicales</span>
                <Select value={specialiteFilter} onValueChange={setSpecialiteFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Toutes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes</SelectItem>
                    {getAvailableSpecialites().map((specialite) => (
                      <SelectItem key={specialite} value={specialite}>
                        {specialite}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Active filters */}
            {(searchValue || statusFilter !== "all" || typeFilter !== "all" || specialiteFilter !== "all") && (
              <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-[var(--border)]">
                 {searchValue && (
                   <Badge variant="secondary">
                     Recherche: "{sanitizeText(searchValue)}"
                     <button 
                       onClick={() => setSearchValue("")}
                       className="ml-2 hover:bg-black hover:bg-opacity-10 rounded-full transition-colors"
                     >
                       ×
                     </button>
                   </Badge>
                 )}
                {statusFilter !== "all" && (
                  <Badge variant="secondary">
                    {statusFilter === "done" ? "Terminée" : "À faire"}
                    <button 
                      onClick={() => setStatusFilter("all")}
                      className="ml-2 hover:bg-black hover:bg-opacity-10 rounded-full transition-colors"
                    >
                      ×
                    </button>
                  </Badge>
                )}
                {typeFilter !== "all" && (
                  <Badge variant="secondary">
                    {typeFilter === "ps" 
                      ? "PS" 
                      : typeFilter === "pss" 
                      ? "PSS" 
                      : typeFilter === "documents"
                      ? "Document(s)"
                      : typeFilter === "seche" 
                      ? "Sèche" 
                      : "Procédure"}
                    <button 
                      onClick={() => setTypeFilter("all")}
                      className="ml-2 hover:bg-black hover:bg-opacity-10 rounded-full transition-colors"
                    >
                      ×
                    </button>
                  </Badge>
                )}
                 {specialiteFilter !== "all" && (
                   <Badge variant="secondary">
                     Spécialité: {sanitizeText(specialiteFilter)}
                     <button 
                       onClick={() => setSpecialiteFilter("all")}
                       className="ml-2 hover:bg-black hover:bg-opacity-10 rounded-full transition-colors"
                     >
                       ×
                     </button>
                   </Badge>
                 )}
                <Button variant="secondary" size="sm" onClick={resetFilters}>
                  Réinitialiser
                </Button>
              </div>
            )}
          </CardHeader>

          <CardContent>
            {sddLoading ? (
              // Progressive skeletons: empty layout immediately, detailed after 250ms
              <div className="grid lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
                {showDetailedSkeleton
                  ? [...Array(9)].map((_, i) => (
                      <div key={i} className="space-y-3">
                        <div className="flex justify-between">
                          <Skeleton className="h-5 w-16" />
                          <Skeleton className="h-5 w-12" />
                        </div>
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-8 w-full" />
                        <Skeleton className="h-10 w-full" />
                      </div>
                    ))
                  : [...Array(9)].map((_, i) => (
                      <div key={i} className="w-full h-48">
                        <Skeleton className="w-full h-full" />
                      </div>
                    ))}
              </div>
            ) : sddError ? (
              <EmptyState
                icon={<User size={24} />}
                title="Erreur de chargement"
                description="Une erreur est survenue lors du chargement des SDD."
                action={
                  <Button variant="secondary" onClick={() => window.location.reload()}>
                    Réessayer
                  </Button>
                }
              />
            ) : (() => { const nonRanked = filteredSDD.filter((s:any) => s?.ranked !== true); return nonRanked.length === 0; })() ? (
              <EmptyState
                icon={<BookOpen size={24} />}
                title="Aucune station ne correspond à tes critères de recherche"
                action={
                  <Button variant="secondary" onClick={resetFilters}>
                    Réinitialiser les filtres
                  </Button>
                }
              />
            ) : (
              <>
              <div className={`grid lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 items-stretch transition-opacity duration-300 ${gridVisible ? 'opacity-100' : 'opacity-0'}`}>
                {(
                  // Free users: prioritize free stations (premium=false)
                  isPremiumUser
                    ? filteredSDD
                    : [...filteredSDD].sort((a, b) => {
                        const ap = isSddPremium(a);
                        const bp = isSddPremium(b);
                        if (ap === bp) return 0;
                        return ap ? 1 : -1; // free first
                      })
                ).filter((s:any) => s?.ranked !== true).slice(0, visibleCount).map((sdd) => {
                  const isCompleted = isStationCompleted(sdd.sdd_id);
                  const showDocumentBadge = ((sdd as any).sdd_type === 'PS' || (sdd as any).sdd_type === 'PSS') &&
                    ( (sdd as any).include_documents === true );
                  const premiumSdd = isSddPremium(sdd);
                  const isFreeUser = !isPremiumUser;
                  const typeLabel = (deriveTypeLabel(sdd) === 'Documents') ? 'Document(s)' : deriveTypeLabel(sdd);

                  return (
                    <Card key={sdd.id} className="flex flex-col h-full hover:shadow-md transition-all duration-150 bg-surface border-border">
                      <CardContent className="p-4 flex flex-col h-full">
                        <div className="flex flex-col space-y-2 flex-1">
                          {/* Title */}
                          <h3 className={`font-semibold text-text ${getTitleSize(sdd.name)} leading-6 whitespace-normal break-words overflow-hidden max-h-[3rem] min-h-[2.5rem] -mb-3`}>
                            {sdd.name}
                          </h3>

                          {/* Subtitle - SDD info */}
                          <p className="text-sm text-subtext line-clamp-1 min-h-[1rem]">
                            SDD {sdd.official_id}
                          </p>

                          {/* Item EDN Badge */}
                          <div className="flex justify-start">
                            <Badge 
                              size="sm" 
                              className="text-xs font-bold" 
                              style={getBadgeStyles('edn', `Item EDN ${sdd.item_EDN ?? '—'}`)}
                            >
                              Item EDN {sdd.item_EDN ?? '—'}
                            </Badge>
                          </div>

                          {/* Colored badges row - Station type and Specialty */}
                          <div className="flex gap-2 flex-wrap">
                            <Badge 
                              size="sm" 
                              className="text-xs border-0 font-bold" 
                              style={getBadgeStyles('type', typeLabel)}
                            >
                              {typeLabel}
                            </Badge>
                            {(sdd as any).specialite && (
                              <Badge 
                                size="sm" 
                                className="text-xs border-0 font-bold" 
                                style={getBadgeStyles('specialty', (sdd as any).specialite)}
                              >
                                {sanitizeText((sdd as any).specialite)}
                              </Badge>
                            )}
                          </div>

                          {/* Status badges row - Document badge then Completion status */}
                          <div className="flex gap-2 flex-wrap">
                            {showDocumentBadge && (
                              <Badge 
                                size="sm" 
                                className="text-xs border-0 font-bold" 
                                style={getBadgeStyles('document', 'document')}
                              >
                                Document(s)
                              </Badge>
                            )}
                            <Badge 
                              size="sm" 
                              className="text-xs border-0 font-bold" 
                              style={getBadgeStyles('status', isCompleted ? 'Terminée' : 'À faire')}
                            >
                              {isCompleted ? 'Terminée' : 'À faire'}
                            </Badge>
                          </div>
                        </div>

                        {/* Button */}
                        {isFreeUser && premiumSdd ? (
                          <Button
                            variant="secondary"
                            size="sm"
                            className="w-full mt-4 bg-white text-text border border-[var(--border)] hover:bg-[var(--accent)] hover:text-white hover:border-[var(--accent)]"
                            onClick={() => navigate('/pricing')}
                          >
                            Je m'abonne
                          </Button>
                        ) : (
                          <Button
                            variant="primary"
                            size="sm"
                            className="w-full text-white mt-4 bg-[var(--accent)] hover:bg-[var(--accent-hover)] border border-[var(--accent)]"
                            onClick={() => handleStartSimulation(sdd)}
                            disabled={startingStationId === sdd.id || !profile || profile.tokens <= 0}
                          >
                            {startingStationId === sdd.id ? (
                              <>
                                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-2"></div>
                                Initialisation...
                              </>
                            ) : !profile || profile.tokens <= 0 ? (
                              <>
                                Tokens insuffisants
                              </>
                            ) : (
                              <>
                                Lancer la station
                                <ChevronRight size={14} className="ml-2" />
                              </>
                            )}
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
              {filteredSDD.filter((s:any) => s?.ranked !== true).length > visibleCount && (
                <div className="flex justify-center mt-6">
                  <Button
                    variant="secondary"
                    onClick={() => setVisibleCount((c) => Math.min(c + PAGE_SIZE, filteredSDD.filter((s:any) => s?.ranked !== true).length))}
                  >
                    Voir plus de stations
                  </Button>
                </div>
              )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default Cases;
