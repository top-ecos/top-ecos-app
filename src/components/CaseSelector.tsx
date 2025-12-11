import { useState, useEffect } from "react";
import { Button } from "@/shared/components/ui/button-premium";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card-premium";
import { Badge } from "@/shared/components/ui/badge-premium";
import { Clock, Play, AlertCircle, CheckCircle, RotateCcw, Coins } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { TokenConsumptionResponse } from "@/shared/types/token.types";
import { useStationProgress } from "@/shared/hooks/useStationProgress";
import { useProfile } from "@/shared/hooks/useProfile";
import { useAuth } from "@/shared/contexts/AuthContext";
import CaseFilters from "./CaseFilters";
import CaseViewToggle from "./CaseViewToggle";
import CaseListView from "./CaseListView";

interface CaseSelectorProps {
  onCaseSelected: (caseData: any, initialPatientMessage?: string) => void;
  onBack: () => void;
}

const CaseSelector = ({ onCaseSelected }: CaseSelectorProps) => {
  const [cases, setCases] = useState<any[]>([]);
  const [filteredCases, setFilteredCases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startingStationId, setStartingStationId] = useState<string | null>(null);
  
  // Station progress hooks
  const { isStationCompleted, resetStationProgress, updateLastAttempt } = useStationProgress();
  
  // Profile and auth hooks for token management
  const { profile, updateTokens } = useProfile();
  const { user } = useAuth();
  
  // États des filtres
  const [searchValue, setSearchValue] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [specialiteFilter, setSpecialiteFilter] = useState("all");
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  useEffect(() => {
    fetchCases();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [cases, searchValue, statusFilter, typeFilter, specialiteFilter]);

  const fetchCases = async () => {
    try {
      console.log('Fetching cases from Supabase...');
      
      // Fetch de toutes les stations depuis les différentes tables existantes dans les types
      const [typeAPS, typeB, typeC, typeProcedure] = await Promise.all([
        supabase.from('SDD_Type_A_PS_MVP').select('*'),
        supabase.from('SDD_Type_B_MVP').select('*'),
        supabase.from('SDD_Type_C_MVP').select('*'),
        supabase.from('sdd_type_procedure_mvp').select('*')
      ]);

      // Fetch manuel pour PSS en attendant que les types soient mis à jour
      const typePSS = await supabase
        .from('SDD_Type_A_PSS_MVP' as any)
        .select('*');

      // Vérifier les erreurs
      if (typeAPS.error || typePSS.error || typeB.error || typeC.error || typeProcedure.error) {
        const error = typeAPS.error || typePSS.error || typeB.error || typeC.error || typeProcedure.error;
        console.error('Supabase error:', error);
        throw error;
      }

      // Combiner toutes les données
      const allCases = [
        ...(typeAPS.data || []),
        ...(typePSS.data || []),
        ...(typeB.data || []),
        ...(typeC.data || []),
        ...(typeProcedure.data || [])
      ];

      console.log('Fetched cases:', allCases);
      setCases(allCases);
    } catch (err) {
      console.error('Error fetching cases:', err);
      setError('Erreur lors du chargement des cas cliniques');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...cases];

    // Filtre de recherche
    if (searchValue) {
      filtered = filtered.filter(caseData => 
        caseData.sdd_titre?.toLowerCase().includes(searchValue.toLowerCase()) ||
        caseData.sdd_id.toString().includes(searchValue)
      );
    }

    // Filtre de statut
    if (statusFilter !== "all") {
      filtered = filtered.filter(caseData => {
        const isCompleted = isStationCompleted(caseData.sdd_id);
        return statusFilter === "done" ? isCompleted : !isCompleted;
      });
    }

    // Filtre de type
    if (typeFilter !== "all") {
      filtered = filtered.filter(caseData => {
        const stationType = caseData.Type_de_station;
        
        switch (typeFilter) {
          case "ps":
            return stationType?.includes('PS') && !stationType?.includes('PSS');
          case "pss":
            return stationType?.includes('PSS');
          case "seche":
            return stationType?.includes('Sèche');
          case "procedure":
            return stationType?.includes('Procédure');
          default:
            return true;
        }
      });
    }

    // Filtre de spécialité
    if (specialiteFilter !== "all") {
      filtered = filtered.filter(caseData => 
        caseData.specialite === specialiteFilter
      );
    }

    setFilteredCases(filtered);
  };

  // Get unique specialites for filter options
  const getAvailableSpecialites = () => {
    const specialites = cases
      .map(caseData => caseData.specialite)
      .filter(specialite => specialite && specialite.trim() !== "")
      .filter((specialite, index, array) => array.indexOf(specialite) === index)
      .sort();
    return specialites;
  };

  const handleStartSimulation = async (caseData: any) => {
    // Check tokens before starting
    if (!profile || profile.tokens <= 0) {
      alert("Désolé, vous avez atteint la limite de votre compte. Veuillez réessayer plus tard ou modifier votre abonnement.");
      return;
    }

    if (!user) {
      console.error('User not authenticated');
      return;
    }
    
    setStartingStationId(caseData.sdd_id);
    
    try {
      // Clear any existing chat history for this station (fresh start)
      localStorage.removeItem(`chat_messages_${caseData.sdd_id}`);
      localStorage.removeItem(`timer_state_${caseData.sdd_id}`);
      localStorage.removeItem(`hasSeenConsignes_${caseData.sdd_id}`);

      console.log('Initializing patient conversation...');
      
      // Use secure server-side token consumption
      const { data: tokenResult, error: tokenError } = await supabase.functions.invoke('consume-token', {
        body: { sdd_id: caseData.sdd_id }
      });
      
      if (tokenError) {
        console.error('Error consuming token:', tokenError);
        setError('Erreur lors de la consommation du token. Veuillez réessayer.');
        return;
      }

      const result = tokenResult as TokenConsumptionResponse;
      
      if (!result?.success) {
        const errorMsg = result?.error || 'Token consumption failed';
        
        switch (result?.code) {
          case 'CONCURRENT_UPDATE':
            setError('Quelqu\'un d\'autre utilise votre compte. Veuillez réessayer.');
            break;
          case 'INSUFFICIENT_TOKENS':
            if (result.requires_upgrade) {
              setError('Vous avez atteint la limite de votre compte gratuit. Veuillez passer à un abonnement premium.');
            } else {
              setError('Tokens insuffisants. Veuillez attendre la recharge ou passer à un abonnement premium.');
            }
            break;
          case 'SDD_NOT_FOUND':
            setError('Ce scénario n\'est plus disponible.');
            break;
          default:
            setError(errorMsg);
        }
        return;
      }
      
      // Update local profile state with server response
      updateTokens(result.tokens_remaining || 0);
      
      // Update last attempt in database
      await updateLastAttempt(caseData.sdd_id);
      
      const { data, error } = await supabase.functions.invoke('chat-with-patient', {
        body: {
          sddData: caseData,
          userMessage: "INIT",
          conversationHistory: []
        }
      });

      if (error) {
        console.error('Error initializing conversation:', error);
        throw error;
      }

      console.log('Patient initialized with message:', data.message);
      onCaseSelected(caseData, data.message);
    } catch (error) {
      console.error('Error starting station:', error);
      setError('Erreur lors du démarrage de la station. Veuillez réessayer.');
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
          console.error('Error refreshing profile:', refreshError);
        }
      }
    } finally {
      setStartingStationId(null);
    }
  };

  const handleResetStation = async (caseData: any) => {
    try {
      // Reset station progress in database
      await resetStationProgress(caseData.sdd_id);
      
      // Clean localStorage data
      localStorage.removeItem(`chat_messages_${caseData.sdd_id}`);
      localStorage.removeItem(`timer_state_${caseData.sdd_id}`);
      localStorage.removeItem(`hasSeenConsignes_${caseData.sdd_id}`);
      
      // Actualiser les filtres pour refléter le changement de statut
      applyFilters();
    } catch (error) {
      console.error('Error resetting station:', error);
    }
  };



  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent mx-auto mb-4"></div>
          <p className="text-subtext">Chargement des stations ECOS...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-danger/20 border-l-4 border-danger p-4 rounded-r-lg">
            <div className="flex items-start">
              <AlertCircle className="h-5 w-5 text-danger mt-0.5 mr-3 flex-shrink-0" />
              <p className="text-danger">{error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-7xl mx-auto">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-text mb-2">
            Stations ECOS ({filteredCases.length})
          </h1>
          <p className="text-subtext mb-4">
            Sélectionnez une station pour commencer votre entraînement
          </p>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center text-lg text-text">
              <Coins size={20} className="mr-2 text-accent" />
              <span>Tokens disponibles: {profile?.tokens || 0}</span>
            </div>
            <CaseViewToggle viewMode={viewMode} onViewChange={setViewMode} />
          </div>
          
          {profile && profile.tokens <= 0 && (
            <div className="bg-danger text-white p-3 rounded-lg mt-4 text-center">
              <p className="text-sm">
                Désolé, vous avez atteint la limite de votre compte. Veuillez réessayer plus tard ou modifier votre abonnement.
              </p>
            </div>
          )}
          
          {profile && profile.tokens > 0 && profile.tokens <= 2 && (
            <div className="bg-orange-500 text-white p-3 rounded-lg mt-4 text-center">
              <p className="text-sm">
                Attention: Il vous reste {profile.tokens} token{profile.tokens > 1 ? 's' : ''} seulement.
              </p>
            </div>
          )}
        </div>
        <CaseFilters
          onSearchChange={setSearchValue}
          onStatusFilter={setStatusFilter}
          onTypeFilter={setTypeFilter}
          onSpecialiteFilter={setSpecialiteFilter}
          searchValue={searchValue}
          statusFilter={statusFilter}
          typeFilter={typeFilter}
          specialiteFilter={specialiteFilter}
          availableSpecialites={getAvailableSpecialites()}
        />

        {filteredCases.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-subtext text-lg">Aucune station trouvée avec ces critères.</p>
            <Button 
              variant="secondary" 
              onClick={() => {
                setSearchValue("");
                setStatusFilter("all");
                setTypeFilter("all");
                setSpecialiteFilter("all");
              }}
              className="mt-4"
            >
              Réinitialiser les filtres
            </Button>
          </div>
        ) : viewMode === 'list' ? (
          <CaseListView 
            cases={filteredCases}
            onStartSimulation={handleStartSimulation}
            onResetStation={handleResetStation}
            startingStationId={startingStationId}
            isStationCompleted={isStationCompleted}
            profile={profile}
          />
        ) : (
          <div className="grid lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 items-stretch">
            {filteredCases.map((caseData) => {
              const isCompleted = isStationCompleted(caseData.sdd_id);
              
              return (
                <Card 
                  key={caseData.sdd_id}
                  className="flex flex-col h-full hover:shadow-md transition-all duration-150 bg-surface border-border"
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between mb-2 min-h-[24px]">
                      <Badge variant="secondary">SDD {caseData.sdd_id}</Badge>
                      {isCompleted ? (
                        <Badge variant="success">
                          <CheckCircle size={12} className="mr-1" />
                          Fait
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Non fait</Badge>
                      )}
                    </div>
                    <CardTitle className="text-base line-clamp-2 leading-tight min-h-[3rem] text-text">
                      {caseData.sdd_titre || `Station ${caseData.sdd_id}`}
                    </CardTitle>
                  </CardHeader>
                  
                  <CardContent className="pt-0 flex-grow flex flex-col">
                    <div className="bg-surface-alt p-2 rounded-lg text-xs min-h-[2.5rem] mb-3 border border-border">
                      <div className="font-medium text-text line-clamp-2">
                        Item EDN #{caseData.item_EDN || 'Non spécifié'}
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs text-subtext min-h-[1.5rem] mb-2">
                      <div className="flex items-center gap-1">
                        <Clock size={12} />
                        <span>10 min</span>
                      </div>
                      {(() => {
                        const stationType = caseData.Type_de_station;
                        if (stationType?.includes('PSS')) {
                          return <Badge variant="secondary" size="sm">PSS</Badge>;
                        } else if (stationType?.includes('PS')) {
                          return <Badge variant="info" size="sm">PS</Badge>;
                        } else if (stationType?.includes('Sèche')) {
                          return <Badge variant="warning" size="sm">Sèche</Badge>;
                        } else if (stationType?.includes('Procédure')) {
                          return <Badge variant="success" size="sm">Procédure</Badge>;
                        } else {
                          return <Badge variant="secondary" size="sm">PS</Badge>;
                        }
                      })()}
                    </div>

                    {caseData.specialite && (
                      <div className="flex justify-center mb-4">
                        <Badge variant="secondary" size="sm" className="text-xs">
                          {caseData.specialite}
                        </Badge>
                      </div>
                    )}

                    <div className="mt-auto flex flex-col space-y-2">
                      <Button 
                        variant="primary"
                        size="sm"
                        className="w-full"
                        onClick={() => handleStartSimulation(caseData)}
                        disabled={startingStationId === caseData.sdd_id || !profile || profile.tokens <= 0}
                      >
                        {startingStationId === caseData.sdd_id ? (
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
                            <Play size={14} className="mr-2" />
                            {isCompleted ? 'Refaire' : 'Démarrer'}
                          </>
                        )}
                      </Button>
                      
                      <Button 
                        variant="secondary"
                        size="sm"
                        className="w-full"
                        onClick={() => handleResetStation(caseData)}
                      >
                        <RotateCcw size={14} className="mr-2" />
                        Réinitialiser
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default CaseSelector;
