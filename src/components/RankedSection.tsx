import React, { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader } from "@/shared/components/ui/card-premium";
import { Badge } from "@/shared/components/ui/badge-premium";
import { Button } from "@/shared/components/ui/button-premium";
import { EmptyState, Skeleton } from "@/shared/components/ui/stat-tile";
import { User, BookOpen, ChevronRight, Info } from "lucide-react";
import { deriveTypeLabel } from "@/features/station/lib/station";
import { isSddPremium } from "@/shared/lib/premium";
import type { SDD } from "@/shared/hooks/useSDD";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader as UIDialogHeader, DialogTitle, DialogTrigger } from "@/shared/components/ui/dialog";

type RankedSdd = SDD & { ranked?: boolean | null };

interface SDDRow {
  sdd_id: string;
  created_at?: string;
  sdd_titre?: string | null;
  consignes_etudiant?: string | null;
  sdd_type?: string | null;
  sdd_specialite?: string | null;
  official_id?: string | null;
  item_edn?: string | null;
  include_documents?: boolean | null;
  premium?: boolean | string | number | null;
  ranked?: boolean | string | number | null;
}

export interface RankedSectionProps {
  isStationCompleted: (sddId: string | number) => boolean;
  isPremiumEffective: boolean;
  hasTokens: boolean;
  startingStationId: string | null;
  onStart: (sdd: SDD) => void;
  getBadgeStyles: (type: string, content: string) => React.CSSProperties;
  // Optional list of all SDDs from parent; used as fallback for visibility
  fallbackFromAll?: SDD[];
}

const mapRowToSdd = (row: SDDRow): RankedSdd => {
  const sddId = String(row.sdd_id);
  const sddType = row?.sdd_type ?? null;
  const premiumFlag = typeof row?.premium === 'boolean'
    ? row.premium
    : (typeof row?.premium === 'string'
        ? ['true', '1', 'yes'].includes(String(row.premium).trim().toLowerCase())
        : (typeof row?.premium === 'number' ? row.premium !== 0 : false));

  return {
    id: sddId,
    sdd_id: sddId,
    created_at: row?.created_at ?? undefined,
    name: row?.sdd_titre ?? `SDD ${sddId.slice(0, 8)}`,
    description: row?.consignes_etudiant ?? "Aucune description disponible",
    sdd_titre: row?.sdd_titre ?? null,
    Type_de_station: sddType ?? null,
    item_EDN: row?.item_edn ?? null,
    consignes_etudiant: row?.consignes_etudiant ?? null,
    specialite: row?.sdd_specialite ?? null,
    official_id: row?.official_id ?? null,
    sdd_type: sddType,
    include_documents: row?.include_documents ?? null,
    premium: premiumFlag,
    ranked: row?.ranked ?? null,
  } as RankedSdd;
};

export const RankedSection: React.FC<RankedSectionProps> = ({
  isStationCompleted,
  isPremiumEffective,
  hasTokens,
  startingStationId,
  onStart,
  getBadgeStyles,
  fallbackFromAll,
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<RankedSdd[]>([]);

  const fetchRanked = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('sdds')
        .select(`
          sdd_id,
          created_at,
          sdd_titre,
          consignes_etudiant,
          sdd_type,
          sdd_specialite,
          official_id,
          item_edn,
          include_documents,
          premium,
          ranked
        `)
        .eq('ranked', true);

      if (error) throw error;
      const mapped = (data ?? []).map(mapRowToSdd);
      // If nothing returned (e.g., due to permissions), fall back to parent list
      if (!mapped.length && Array.isArray(fallbackFromAll) && fallbackFromAll.length) {
        const sorted = [...fallbackFromAll]
          .sort((a, b) => {
            const da = a.created_at ? new Date(a.created_at).getTime() : 0;
            const db = b.created_at ? new Date(b.created_at).getTime() : 0;
            return db - da;
          })
          .slice(0, 5);
        const fallbackMapped: RankedSdd[] = sorted.map((s) => ({ ...s, ranked: true } as RankedSdd));
        setItems(fallbackMapped);
      } else {
        setItems(mapped);
      }
      setError(null);
    } catch (e: unknown) {
      console.error('Error fetching ranked SDDs:', e);
      // On error: try to supply a best-effort fallback
      if (Array.isArray(fallbackFromAll) && fallbackFromAll.length) {
        const sorted = [...fallbackFromAll]
          .sort((a, b) => {
            const da = a.created_at ? new Date(a.created_at).getTime() : 0;
            const db = b.created_at ? new Date(b.created_at).getTime() : 0;
            return db - da;
          })
          .slice(0, 5);
        const fallbackMapped: RankedSdd[] = sorted.map((s) => ({ ...s, ranked: true } as RankedSdd));
        setItems(fallbackMapped);
        setError(null);
      } else {
        setError(e?.message || 'Erreur lors du chargement des stations classées.');
        setItems([]);
      }
    } finally {
      setLoading(false);
    }
  }, [fallbackFromAll]);

  useEffect(() => {
    fetchRanked();
  }, [fetchRanked]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold text-text">Stations classées de la semaine</h2>
          <p className="text-subtext">Obtiens la meilleure moyenne sur ces 3 stations pour concourir au top 10 hebdomadaire</p>
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
            <UIDialogHeader>
              <DialogTitle>Comment ça marche ?</DialogTitle>
              <DialogDescription>
                Les stations classées te permettent de comparer tes performances à celles des autres utilisateurs de top ECOS. Toutes les semaines, 3 nouvelles stations classées sont ajoutées à top ECOS. Fais-toi évaluer par l'IA top ECOS sur ces 3 nouvelles stations et vois comment tu te situes par rapport aux autres étudiants. Le classement est réinitialisé toutes les semaines.
              </DialogDescription>
            </UIDialogHeader>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="bg-surface border-border">
        <CardHeader>{/* Placeholder for future filters */}</CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex md:grid md:grid-cols-3 gap-4 overflow-x-auto md:overflow-visible -mx-4 px-4 pb-2">
              {[...Array(9)].map((_, i) => (
                <div key={i} className="space-y-3 min-w-[85%] md:min-w-0 snap-start">
                  <div className="flex justify-between">
                    <Skeleton className="h-5 w-16" />
                    <Skeleton className="h-5 w-12" />
                  </div>
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ))}
            </div>
          ) : error ? (
            <EmptyState
              icon={<User size={24} />}
              title="Erreur de chargement"
              description={error}
              action={<Button variant="secondary" onClick={fetchRanked}>Réessayer</Button>}
            />
          ) : items.length === 0 ? (
            <EmptyState icon={<BookOpen size={24} />} title="Aucune station classée" />
          ) : (
            <div className="flex md:grid md:grid-cols-3 gap-4 items-stretch overflow-x-auto md:overflow-visible snap-x snap-mandatory -mx-4 px-4 pb-2">
              {items.map((sdd) => {
                const completed = isStationCompleted(sdd.sdd_id);
                const premiumSdd = isSddPremium(sdd);

                return (
                  <Card
                    key={sdd.id}
                    className="flex flex-col h-full hover:shadow-md transition-all duration-150 bg-surface border-border min-w-[85%] md:min-w-0 snap-start"
                    style={{ borderColor: '#E74C3C' }}
                  >
                    <CardContent className="p-4 flex flex-col h-full">
                      <div className={`flex flex-col space-y-2 flex-1 ${!completed ? 'filter blur-md pointer-events-none select-none' : ''}`}>
                        <h3 className="font-semibold text-text text-lg leading-tight line-clamp-2 min-h-[2.5rem] -mb-2">
                          {sdd.name}
                        </h3>
                        <p className="text-sm text-subtext line-clamp-1 min-h-[1rem]">SDD {sdd.official_id}</p>

                        <div className="flex justify-start">
                          <Badge size="sm" className="text-xs font-bold" style={getBadgeStyles('edn', `Item EDN ${sdd.item_EDN ?? '—'}`)}>
                            Item EDN {sdd.item_EDN ?? '—'}
                          </Badge>
                        </div>

                        <div className="flex gap-2 overflow-x-auto md:flex-wrap md:overflow-visible">
                          {(() => { const t = deriveTypeLabel(sdd); const label = t === 'Documents' ? 'Document(s)' : t; return (
                            <Badge size="sm" className="text-xs border-0 font-bold" style={getBadgeStyles('type', label)}>
                              {label}
                            </Badge>
                          ); })()}
                          {(sdd as any).specialite && (
                            <Badge size="sm" className="text-xs border-0 font-bold" style={getBadgeStyles('specialty', (sdd as any).specialite)}>
                              {(sdd as any).specialite}
                            </Badge>
                          )}
                        </div>

                        <div className="flex gap-2">
                          {(((sdd as any).sdd_type === 'PS' || (sdd as any).sdd_type === 'PSS') && (sdd as any).include_documents === true) && (
                            <Badge size="sm" className="text-xs border-0 font-bold" style={getBadgeStyles('document', 'document')}>
                              Document(s)
                            </Badge>
                          )}
                          <Badge size="sm" className="text-xs border-0 font-bold" style={getBadgeStyles('status', completed ? 'Terminée' : 'À faire')}>
                            {completed ? 'Terminée' : 'À faire'}
                          </Badge>
                        </div>
                      </div>

                      {(!isPremiumEffective && premiumSdd) ? (
                        <a href="/pricing" className="w-full">
                          <Button
                            variant="secondary"
                            size="sm"
                            className="w-full mt-4 bg-white text-text border border-[var(--border)] hover:bg-[var(--accent)] hover:text-white hover:border-[var(--accent)] min-h-[44px]"
                          >
                            Je m'abonne
                          </Button>
                        </a>
                      ) : (
                        <Button
                          variant="primary"
                          size="sm"
                          className="w-full text-white mt-4 bg-[var(--accent)] hover:bg-[var(--accent-hover)] border border-[var(--accent)] min-h-[44px]"
                          onClick={() => onStart(sdd)}
                          disabled={startingStationId === sdd.id}
                        >
                          {startingStationId === sdd.id ? (
                            'Lancement de la station classée...'
                          ) : !isPremiumEffective && !hasTokens ? (
                            'Passer Premium'
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
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default RankedSection;
