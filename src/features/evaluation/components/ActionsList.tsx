import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Skeleton } from "@/shared/components/ui/stat-tile";
import { useProfile } from "@/shared/hooks/useProfile";
import { isUserPremium } from "@/shared/lib/premium";
import { Button } from "@/shared/components/ui/button";
import { Link } from "react-router-dom";

interface ActionsListProps {
  actions_reussies: (string | { action: string; extrait: string })[];
  actions_manquees: string[];
}

const LockIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

export const ActionsList = ({ actions_reussies, actions_manquees }: ActionsListProps) => {
  const { profile } = useProfile();
  const premium = isUserPremium(profile);
  const getActionData = (action: string | { action: string; extrait: string }) => {
    if (typeof action === 'string') {
      return { action, extrait: '' };
    }
    return action;
  };

  const hasMissedActions = actions_manquees.length > 0;
  const remainingActions = actions_manquees.slice(1);
  const remainingActionsCount = remainingActions.length;
  const placeholdersToShow = Math.min(remainingActionsCount, 4); // Show a max of 4 placeholders

  return (
    <div className="space-y-4">
      {/* Actions réussies (No changes here) */}
      <Card className="text-[#03BB26]">
        <CardHeader>
          <CardTitle className="text-[#03BB26]">
            Actions cliniques réussies ({actions_reussies.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {actions_reussies.map((action, index) => {
              const { action: actionText, extrait } = getActionData(action);
              return (
                <div key={index} className="p-4 bg-[#03BB26]/10 rounded-md">
                  <p className="text-large font-bold text-foreground">{actionText}</p>
                  {extrait && (
                    <p className="text-m text-muted-foreground italic mt-1">{`« ${extrait} »`}</p>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Actions manquées - With Static Fade-out */}
      {hasMissedActions && (
        <Card className="text-[#E74C3C]">
          <CardHeader>
            <CardTitle className="text-[#E74C3C]">
              Actions cliniques manquées ({actions_manquees.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {/* --- VISIBLE TEASER ITEM --- */}
              <div className="p-4 bg-[#E74C3C]/10 rounded-md">
                <p className="text-large font-bold text-foreground">{actions_manquees[0]}</p>
              </div>

              {/* --- LOCKED & PREMIUM CONTENT CONTAINER --- */}
              {remainingActionsCount > 0 && (
                <div className="relative">
                  {/* The blurred, fading skeleton items in the background */}
                  {!premium && (
                    <div className="space-y-3 blur-sm select-none" style={{ maskImage: 'linear-gradient(to bottom, black 50%, transparent 100%)' }}>
                      {Array(placeholdersToShow).fill('').map((_, index) => (
                        <div key={index} className="p-4 bg-[#E74C3C]/10 rounded-md">
                          <div className="space-y-2" aria-hidden="true">
                            {([['w-5/6','w-2/3'], ['w-4/5','w-3/5','w-1/2'], ['w-3/4','w-1/3']][index % 3]).map((w, i) => (
                              <Skeleton key={i} className={`h-3 ${w}`} />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* The Upsell Module overlays everything for non-premium users */}
                  {!premium && (
                    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/50 p-6 text-center backdrop-blur-sm">
                       <LockIcon className="h-10 w-10 text-slate-700" />
                       <h3 className="mt-4 text-2xl font-bold text-slate-800">
                         Avec top ECOS Premium, découvre les {remainingActionsCount} actions manquées de cette station et identifie précisément tes points d'amélioration.
                       </h3>
                       <Button asChild size="lg" className="mt-2 w-full max-w-xs shadow-lg">
                         <Link to="/pricing">Je m'abonne</Link>
                       </Button>
                    </div>
                  )}

                   {/* Renders the actual content for premium users */}
                   {premium && (
                    <div className="space-y-3">
                      {remainingActions.map((action, index) => (
                        <div key={index} className="p-4 bg-[#E74C3C]/10 rounded-md">
                          <p className="text-large font-bold text-foreground">{action}</p>
                        </div>
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
