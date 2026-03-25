import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Skeleton } from "@/shared/components/ui/stat-tile";
import { useProfile } from "@/shared/hooks/useProfile";
import { isUserPremium } from "@/shared/lib/premium";
import { Button } from "@/shared/components/ui/button";
import { Link } from "react-router-dom";
import type { ActionStatus } from "../types/evaluation.types";

/* ──────────────────────────── Props ──────────────────────────── */

interface ActionsListProps {
  actions_reussies: (string | { action: string; extrait: string })[];
  actions_partielles: (string | { action: string; extrait?: string })[];
  actions_manquees: string[];
  onReclassify?: (actionText: string, fromStatus: ActionStatus, toStatus: ActionStatus) => void;
}

/* ──────────────────────────── Helpers ─────────────────────────── */

const getActionData = (action: string | { action: string; extrait?: string }) => {
  if (typeof action === 'string') return { action, extrait: '' };
  return { action: action.action, extrait: action.extrait || '' };
};

/* ──────────────────────────── Icons ──────────────────────────── */

const LockIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

const ChevronIcon = ({ open }: { open: boolean }) => (
  <svg
    className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`}
    viewBox="0 0 20 20"
    fill="currentColor"
  >
    <path
      fillRule="evenodd"
      d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
      clipRule="evenodd"
    />
  </svg>
);

/* ──────────────────────── Status badge config ────────────────── */

const STATUS_CONFIG: Record<ActionStatus, {
  label: string;
  icon: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
  hoverBgClass: string;
}> = {
  reussie: {
    label: 'Réussie',
    icon: '✓',
    bgClass: 'bg-green-50',
    textClass: 'text-green-700',
    borderClass: 'border-green-200',
    hoverBgClass: 'hover:bg-green-50',
  },
  partielle: {
    label: 'Partielle',
    icon: '~',
    bgClass: 'bg-orange-50',
    textClass: 'text-orange-700',
    borderClass: 'border-orange-200',
    hoverBgClass: 'hover:bg-orange-50',
  },
  manquee: {
    label: 'Manquée',
    icon: '✗',
    bgClass: 'bg-red-50',
    textClass: 'text-red-700',
    borderClass: 'border-red-200',
    hoverBgClass: 'hover:bg-red-50',
  },
};

/* ──────────────────────── StatusBadge component ──────────────── */

const StatusBadge = ({
  status,
  onChangeStatus,
}: {
  status: ActionStatus;
  onChangeStatus: (s: ActionStatus) => void;
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const current = STATUS_CONFIG[status];

  return (
    <div className="relative flex-shrink-0" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors cursor-pointer ${current.bgClass} ${current.textClass} ${current.borderClass} hover:opacity-80`}
        title="Cliquer pour modifier le statut"
      >
        <span>{current.icon}</span>
        <span>{current.label}</span>
        <ChevronIcon open={open} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-20 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[150px]">
          {(Object.entries(STATUS_CONFIG) as [ActionStatus, typeof current][])
            .filter(([key]) => key !== status)
            .map(([key, cfg]) => (
              <button
                key={key}
                onClick={() => {
                  onChangeStatus(key);
                  setOpen(false);
                }}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2 ${cfg.textClass}`}
              >
                <span>{cfg.icon}</span>
                <span>{cfg.label}</span>
              </button>
            ))}
        </div>
      )}
    </div>
  );
};

/* ──────────────────── Single action row component ────────────── */

const ActionRow = ({
  action,
  status,
  bgColorClass,
  onReclassify,
}: {
  action: string | { action: string; extrait?: string };
  status: ActionStatus;
  bgColorClass: string;
  onReclassify?: (actionText: string, fromStatus: ActionStatus, toStatus: ActionStatus) => void;
}) => {
  const { action: actionText, extrait } = getActionData(action);

  return (
    <div className={`p-4 ${bgColorClass} rounded-md flex items-start justify-between gap-3`}>
      <div className="flex-1 min-w-0">
        <p className="text-large font-bold text-foreground">{actionText}</p>
        {extrait && (
          <p className="text-m text-muted-foreground italic mt-1">{`« ${extrait} »`}</p>
        )}
      </div>
      {onReclassify && (
        <StatusBadge
          status={status}
          onChangeStatus={(newStatus) => onReclassify(actionText, status, newStatus)}
        />
      )}
    </div>
  );
};

/* ──────────────────────── Main component ─────────────────────── */

export const ActionsList = ({
  actions_reussies,
  actions_partielles,
  actions_manquees,
  onReclassify,
}: ActionsListProps) => {
  const { profile } = useProfile();
  const premium = isUserPremium(profile);

  const hasPartialActions = actions_partielles.length > 0;
  const hasMissedActions = actions_manquees.length > 0;
  const remainingMissed = actions_manquees.slice(1);
  const remainingMissedCount = remainingMissed.length;
  const placeholdersToShow = Math.min(remainingMissedCount, 4);

  return (
    <div className="space-y-4">
      {/* ═══════════ ACTIONS RÉUSSIES (vert) ═══════════ */}
      <Card className="text-[#03BB26] bg-white">
        <CardHeader>
          <CardTitle className="text-[#03BB26]">
            Actions cliniques réussies ({actions_reussies.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {actions_reussies.map((action, index) => (
              <ActionRow
                key={`reussie-${index}`}
                action={action}
                status="reussie"
                bgColorClass="bg-[#03BB26]/10"
                onReclassify={onReclassify}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ═══════════ ACTIONS PARTIELLEMENT RÉUSSIES (orange) ═══════════ */}
      {hasPartialActions && (
        <Card className="text-[#F39C12] bg-white">
          <CardHeader>
            <CardTitle className="text-[#F39C12]">
              Actions cliniques partiellement réussies ({actions_partielles.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {actions_partielles.map((action, index) => (
                <ActionRow
                  key={`partielle-${index}`}
                  action={action}
                  status="partielle"
                  bgColorClass="bg-[#F39C12]/10"
                  onReclassify={onReclassify}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ═══════════ ACTIONS MANQUÉES (rouge) ═══════════ */}
      {hasMissedActions && (
        <Card className="text-[#E74C3C] bg-white">
          <CardHeader>
            <CardTitle className="text-[#E74C3C]">
              Actions cliniques manquées ({actions_manquees.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {/* ── Premier item manqué (toujours visible) ── */}
              <ActionRow
                action={actions_manquees[0]}
                status="manquee"
                bgColorClass="bg-[#E74C3C]/10"
                onReclassify={onReclassify}
              />

              {/* ── Items restants (gate premium) ── */}
              {remainingMissedCount > 0 && (
                <div className="relative">
                  {/* Placeholders floutés pour non-premium */}
                  {!premium && (
                    <div
                      className="space-y-3 blur-sm select-none"
                      style={{ maskImage: 'linear-gradient(to bottom, black 50%, transparent 100%)' }}
                    >
                      {Array(placeholdersToShow)
                        .fill('')
                        .map((_, index) => (
                          <div key={index} className="p-4 bg-[#E74C3C]/10 rounded-md">
                            <div className="space-y-2" aria-hidden="true">
                              {(
                                [
                                  ['w-5/6', 'w-2/3'],
                                  ['w-4/5', 'w-3/5', 'w-1/2'],
                                  ['w-3/4', 'w-1/3'],
                                ][index % 3]
                              ).map((w, i) => (
                                <Skeleton key={i} className={`h-3 ${w}`} />
                              ))}
                            </div>
                          </div>
                        ))}
                    </div>
                  )}

                  {/* Module upsell pour non-premium */}
                  {!premium && (
                    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/50 p-6 text-center backdrop-blur-sm">
                      <LockIcon className="h-10 w-10 text-slate-700" />
                      <h3 className="mt-4 text-2xl font-bold text-slate-800">
                        Avec top ECOS Premium, découvre les {remainingMissedCount} actions
                        manquées de cette station et identifie précisément tes points
                        d'amélioration.
                      </h3>
                      <Button asChild size="lg" className="mt-2 w-full max-w-xs shadow-lg">
                        <Link to="/pricing">Je m'abonne</Link>
                      </Button>
                    </div>
                  )}

                  {/* Contenu réel pour premium */}
                  {premium && (
                    <div className="space-y-3">
                      {remainingMissed.map((action, index) => (
                        <ActionRow
                          key={`manquee-rest-${index}`}
                          action={action}
                          status="manquee"
                          bgColorClass="bg-[#E74C3C]/10"
                          onReclassify={onReclassify}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
