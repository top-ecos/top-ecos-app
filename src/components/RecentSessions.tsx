import React from 'react';
import { Card, CardContent } from "@/components/ui/card-premium";
import { Badge } from "@/components/ui/badge-premium";
import { Button } from "@/components/ui/button-premium";
import { EmptyState, Skeleton } from "@/components/ui/stat-tile";
import { deriveTypeLabel } from "@/lib/station";
import { formatDistance } from "date-fns";
import { fr } from "date-fns/locale";
import { Link } from "react-router-dom";

type ResultItem = {
  id: string | number;
  station_title: string;
  typologie: string | null;
  sdd_specialite?: string | null;
  created_at: string | null;
  score: number;
  station_id: string | number;
};

interface RecentSessionsProps {
  results: ResultItem[];
  loading: boolean;
  onViewEvaluation: (result: ResultItem) => void;
  title?: string;
  subtitle?: string;
  headerRight?: React.ReactNode;
  limit?: number; // slice results to this count if provided
  showLoadMore?: boolean;
  canLoadMore?: boolean;
  onLoadMore?: () => void;
  emptyAction?: React.ReactNode;
}

function getScoreColor(score: number) {
  if (score >= 15) return "text-primary";
  if (score >= 12) return "text-primary";
  if (score >= 10) return "text-[#F39C12]";
  return "text-danger";
}

function formatLastSession(dateString: string | null) {
  if (!dateString) return "Aucune session";
  try {
    return formatDistance(new Date(dateString), new Date(), { addSuffix: true, locale: fr });
  } catch {
    return "Date inconnue";
  }
}

function getBadgeStyles(type: string, content: string) {
  const styles: { color: string; backgroundColor: string; border?: string } = {
    color: '#707070',
    backgroundColor: '#70707033'
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
}

export default function RecentSessions({
  results,
  loading,
  onViewEvaluation,
  title,
  subtitle,
  headerRight,
  limit = 5,
  showLoadMore,
  canLoadMore,
  onLoadMore,
  emptyAction,
}: RecentSessionsProps) {
  const sliced = typeof limit === 'number' ? results.slice(0, limit) : results;

  return (
    <div className="space-y-6">
      {title ? (
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold text-text">{title}</h2>
            {subtitle ? <p className="text-subtext">{subtitle}</p> : null}
          </div>
          {headerRight}
        </div>
      ) : null}

      <div className="space-y-4">
        {loading ? (
          <>
            {[1, 2, 3].map((idx) => (
              <Card key={idx} className="bg-surface border-border p-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div className="flex-1">
                    <Skeleton className="h-5 w-1/3 mb-3" />
                    <div className="flex items-center space-x-3">
                      <Skeleton className="h-6 w-24" />
                      <Skeleton className="h-6 w-28" />
                      <Skeleton className="h-4 w-24" />
                    </div>
                  </div>
                  <div className="flex-shrink-0 text-center md:mx-8">
                    <Skeleton className="h-8 w-16" />
                    <Skeleton className="h-4 w-20 mt-2" />
                  </div>
                  <div className="flex-shrink-0">
                    <Skeleton className="h-8 w-52" />
                  </div>
                </div>
              </Card>
            ))}
          </>
        ) : sliced && sliced.length > 0 ? (
          sliced.map((result) => (
            <Card key={result.id} className="bg-surface border-border p-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                {/* Left side: Station info and badges */}
                <div className="flex-1">
                  <h4 className="text-base sm:text-lg font-bold text-text mb-1 md:mb-3">{result.station_title}</h4>
                  <div className="flex items-center flex-wrap gap-2 sm:space-x-3">
                    {(() => {
                      const t = deriveTypeLabel({ Type_de_station: result.typologie } as any);
                      const label = t === 'Documents' ? 'Document(s)' : t;
                      return (
                        <Badge className="text-sm border-0 font-bold" style={getBadgeStyles('type', label)}>
                          {label}
                        </Badge>
                      );
                    })()}
                    {result.sdd_specialite ? (
                      <Badge className="text-sm border-0 font-bold" style={getBadgeStyles('specialty', String(result.sdd_specialite))}>
                        {result.sdd_specialite}
                      </Badge>
                    ) : null}
                    <span className="text-sm text-subtext">{formatLastSession(result.created_at)}</span>
                  </div>
                </div>

                {/* Center: Score display */}
                <div className="flex-shrink-0 text-center md:mx-8">
                  <div className={`inline-flex items-center justify-center px-3 py-1 rounded-full border border-border text-base md:text-3xl font-bold ${getScoreColor(result.score)}`}>
                    {Math.round(result.score * 10) / 10}/20
                  </div>
                  <div className="text-sm text-subtext mt-1">
                    {result.score >= 15 ? 'Excellent' : result.score >= 12 ? 'Bien' : result.score >= 10 ? 'Satisfaisant' : 'À améliorer'}
                  </div>
                </div>

                {/* Right side: Evaluation button */}
                <div className="flex-shrink-0">
                  <Button variant="secondary" className="w-full md:w-auto min-h-[44px]" onClick={() => onViewEvaluation(result)}>
                    Consulter la grille d'évaluation
                  </Button>
                </div>
              </div>
            </Card>
          ))
        ) : (
          <Card className="bg-surface border-border">
            <CardContent className="p-8">
              <EmptyState
                title="Aucune session réalisée"
                description="Commence ton entraînement pour voir tes premiers résultats ici"
                action={
                  emptyAction ?? (
                    <Link to="/cases">
                      <Button variant="primary">Commencer l'entraînement</Button>
                    </Link>
                  )
                }
              />
            </CardContent>
          </Card>
        )}
      </div>

      {showLoadMore && canLoadMore ? (
        <div className="flex justify-center mt-2">
          <Button variant="secondary" onClick={onLoadMore}>Voir plus de sessions</Button>
        </div>
      ) : null}
    </div>
  );
}

