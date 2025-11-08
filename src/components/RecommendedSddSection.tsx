import React from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader } from "@/components/ui/card-premium";
import { Badge } from "@/components/ui/badge-premium";
import { Button } from "@/components/ui/button-premium";
import { EmptyState, Skeleton } from "@/components/ui/stat-tile";
import { User, BookOpen, ChevronRight } from "lucide-react";
import { deriveTypeLabel } from "@/lib/station";
import { isSddPremium } from "@/lib/premium";
import type { SDD } from "@/hooks/useSDD";

export interface RecommendedSddSectionProps {
  loading: boolean;
  error?: any;
  items: SDD[];
  isStationCompleted: (sddId: string | number) => boolean;
  isPremiumEffective: boolean;
  hasTokens: boolean;
  startingStationId: string | null;
  onStart: (sdd: SDD) => void;
  getBadgeStyles: (type: string, content: string) => React.CSSProperties;
}

export const RecommendedSddSection: React.FC<RecommendedSddSectionProps> = ({
  loading,
  error,
  items,
  isStationCompleted,
  isPremiumEffective,
  hasTokens,
  startingStationId,
  onStart,
  getBadgeStyles,
}) => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold text-text">Situations de Départ & Stations recommandées</h2>
          <p className="text-subtext">
            Des stations jamais (ou peu) évaluées t'attendent ici
          </p>
        </div>
        <Link to="/cases">
          <Button variant="secondary" className="bg-white text-text border border-border hover:bg-gray-50">
            Explorer la bibliothèque
            <ChevronRight size={16} className="ml-2" />
          </Button>
        </Link>
      </div>

      <Card className="bg-surface border-border">
        <CardHeader>{/* Active filters placeholder */}</CardHeader>
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
              description="Une erreur est survenue lors du chargement des SDD."
              action={<Button variant="secondary" onClick={() => window.location.reload()}>Réessayer</Button>}
            />
          ) : items.length === 0 ? (
            <EmptyState icon={<BookOpen size={24} />} title="Aucun SDD à faire" />
          ) : (
            <div className="flex md:grid md:grid-cols-3 gap-4 items-stretch overflow-x-auto md:overflow-visible snap-x snap-mandatory -mx-4 px-4 pb-2">
              {items.map((sdd) => {
                const completed = isStationCompleted(sdd.sdd_id);
                const premiumSdd = isSddPremium(sdd);

                return (
                  <Card
                    key={sdd.id}
                    className="flex flex-col h-full hover:shadow-md transition-all duration-150 bg-surface border-border min-w-[85%] md:min-w-0 snap-start"
                  >
                    <CardContent className="p-4 flex flex-col h-full">
                      <div className="flex flex-col space-y-2 flex-1">
                        <h3 className="font-semibold text-text text-lg leading-tight line-clamp-2 min-h-[3rem] -mb-2">
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
                        <Link to="/pricing" className="w-full">
                          <Button
                            variant="secondary"
                            size="sm"
                            className="w-full mt-4 bg-white text-text border border-[var(--border)] hover:bg-[var(--accent)] hover:text-white hover:border-[var(--accent)] min-h-[44px]"
                          >
                            je m'abonne
                          </Button>
                        </Link>
                      ) : (
                        <Button
                          variant="primary"
                          size="sm"
                          className="w-full text-white mt-4 bg-[var(--accent)] hover:bg-[var(--accent-hover)] border border-[var(--accent)] min-h-[44px]"
                          onClick={() => onStart(sdd)}
                          disabled={startingStationId === sdd.id}
                        >
                          {startingStationId === sdd.id ? (
                            'Initialisation...'
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

export default RecommendedSddSection;
