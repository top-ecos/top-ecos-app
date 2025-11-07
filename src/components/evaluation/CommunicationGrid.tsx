import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Star } from "lucide-react";
import { useProfile } from "@/hooks/useProfile";
import { isUserPremium } from "@/lib/premium";
import { Skeleton } from "@/components/ui/stat-tile";

interface CommunicationDetails {
  score: number;
  niveau_atteint: string;
  justification: string;
}

interface CommunicationGridProps {
  communication_details: Record<string, number | CommunicationDetails>;
}

export const CommunicationGrid = ({ communication_details }: CommunicationGridProps) => {
  const { profile } = useProfile();
  const premium = isUserPremium(profile);

  const formatSkillName = (skill: string) => {
    let formatted = skill.replace(/_/g, ' ');
    // Attempt to match screenshot's specific formatting
    if (skill.includes('situations_aigues_chroniques')) {
        formatted = formatted.replace('situations aigues chroniques', '(situations aiguës / chroniques)');
    }
    if (skill.includes('patient_le_pair')) {
        formatted = formatted.replace('le pair', '/ le pair');
    }
    return formatted.charAt(0).toUpperCase() + formatted.slice(1).replace(' a ', ' à ');
  };
  
  const getScoreStyle = (score: number) => {
    if (score === 1) return { 
        level: "Excellent", 
        badgeClasses: "bg-green-100 text-green-800",
        textClasses: "text-green-700",
        scoreClasses: "text-green-600",
        justificationBgClasses: "bg-green-50/80"
    };
    if (score >= 0.75) return { 
        level: "Bon", 
        badgeClasses: "bg-green-100 text-green-800",
        textClasses: "text-green-700",
        scoreClasses: "text-green-600", // Changed to green
        justificationBgClasses: "bg-green-50/80"
    };
    if (score >= 0.5) return { 
        level: "Satisfaisant", 
        badgeClasses: "bg-yellow-100 text-yellow-800",
        textClasses: "text-yellow-700",
        scoreClasses: "text-yellow-600",
        justificationBgClasses: "bg-yellow-50/80"
    };
    if (score >= 0.25) return { 
        level: "Limite", 
        badgeClasses: "bg-orange-100 text-orange-800",
        textClasses: "text-orange-700",
        scoreClasses: "text-orange-600",
        justificationBgClasses: "bg-orange-50/80"
    };
    return { 
        level: "Insuffisant", 
        badgeClasses: "bg-red-100 text-red-800",
        textClasses: "text-red-700",
        scoreClasses: "text-red-600",
        justificationBgClasses: "bg-red-50/80"
    };
  };

  const getObservation = (score: number) => {
    if (score >= 0.75) return "Maîtrise excellente de cette compétence";
    if (score >= 0.5) return "Bonne maîtrise avec quelques points d'amélioration";
    if (score >= 0.25) return "Compétence en développement, continue tes efforts";
    return "Compétence nécessitant un travail approfondi";
  };

  const skills = Object.entries(communication_details);

  return (
    <Card className="border-gray-200/90 shadow-sm bg-white">
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-2xl">
          <div className="flex items-center text font-bold">
            Aptitudes de communication ({skills.length})
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {skills.map(([skill, value], idx) => {
            const score = typeof value === 'number' ? value : value.score;
            const niveauAtteint = typeof value === 'object' ? value.niveau_atteint : getObservation(score);
            const justification = typeof value === 'object' ? value.justification : null;
            
            const styles = getScoreStyle(score);
            
            return (
              <div key={skill} className="p-4 rounded-lg border border-gray-200/90 bg-white">
                <div className="flex items-start justify-between">
                  <div className="flex-1 pr-4">
                    <h4 className="font-medium text-gray-900 underline">{formatSkillName(skill)}</h4>
                    {/* Observation on the same row's left side */}
                    <div className="mt-2 flex items-start">
                      <svg
                        className="h-6 w-6 text mr-3"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        xmlns="http://www.w3.org/2000/svg"
                        aria-hidden="true"
                      >
                        <path d="m11.293 17.293 1.414 1.414L19.414 12l-6.707-6.707-1.414 1.414L15.586 11H6v2h9.586z" />
                      </svg>
                      <p className="text-m text">
                        <span className="text">{niveauAtteint}</span>
                      </p>
                    </div>
                  </div>
                  <div className="text-right ml-4 flex-shrink-0">
                    <div className={`flex items-baseline justify-end ${styles.scoreClasses}`}>
                      <span className="text-2xl font-bold">{score.toFixed(2)}</span>
                      <span className="font-normal text-2xl ml-1"> / 1.00</span>
                    </div>
                    <Badge variant="secondary" className={`${styles.badgeClasses} rounded-full px-2.5 py-0.5 text-xs font-semibold mt-1`}>
                      {styles.level}
                    </Badge>
                  </div>
                </div>

                <div className="mt-4">
                  {justification && (
                    <div className={`relative ${styles.justificationBgClasses} p-3 rounded-md`}>
                      {!premium && (
                        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-md bg-white/70">
                          <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">fonctionnalité premium</span>
                        </div>
                      )}
                      <div className={premium ? undefined : "blur-sm select-none"}>
                        <p className={`text-lg font-bold ${styles.textClasses}`}>Feedback de l'IA pédagogique</p>
                        {premium ? (
                          <p className="text-lg text italic mt-3">"{justification}"</p>
                        ) : (
                          <div className="mt-3 space-y-2" aria-hidden="true">
                            {([['w-5/6','w-2/3','w-1/2'], ['w-4/5','w-3/5'], ['w-3/4','w-1/2','w-1/3']][idx % 3]).map((w, i) => (
                              <Skeleton key={i} className={`h-3 ${w}`} />
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};
