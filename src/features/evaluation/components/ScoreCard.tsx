import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { LucideIcon } from "lucide-react";

interface ScoreCardProps {
  title: string;
  score: number;
  maxScore: number;
  icon?: LucideIcon;
  description?: string;
  scoreColor: string;
  badgeColor: string;
  progressColor?: string;
  isPrimary?: boolean;
  additionalInfo?: string;
  secondaryBadgeText?: string; // Added prop for the ranking text
}

export const ScoreCard = ({
  title,
  score,
  maxScore,
  icon: Icon,
  description,
  scoreColor,
  badgeColor,
  progressColor,
  isPrimary = false,
  additionalInfo,
  secondaryBadgeText // Destructure the new prop
}: ScoreCardProps) => {
  const percentage = (score / maxScore) * 100;
  const displayScore = typeof score === 'number' ? score.toFixed(2) : score;
  const primaryHex = '#03BB26';
  const isPrimaryGreenScore = isPrimary && typeof scoreColor === 'string' && scoreColor.includes('text-primary');
  const isPrimaryGreenBadge = isPrimary && typeof badgeColor === 'string' && badgeColor.includes('text-primary');

  return (
    <Card className={`bg-white ${isPrimary ? "border-2 shadow-md" : ""}`} style={isPrimary ? { borderColor: primaryHex } : undefined}>
      <CardHeader className="text-center pb-2">
        <CardTitle className={`text-lg flex items-center justify-center ${isPrimary ? '' : 'text-foreground'}`} style={isPrimary ? { color: primaryHex } : undefined}>
          {Icon && <Icon className="h-5 w-5 mr-2" />}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="text-center">
        <div
          className={`${isPrimary ? 'text-4xl' : 'text-3xl'} font-bold ${scoreColor} mb-2`}
          style={isPrimaryGreenScore ? { color: primaryHex } : undefined}
        >
          {displayScore}/{maxScore}
        </div>
        {percentage !== undefined && (
          <div className="w-full bg-muted rounded-full h-2 mb-3">
            <div
              className={`h-2 rounded-full transition-all duration-500 ${progressColor || 'bg-muted'}`}
              style={{
                width: `${Math.min(percentage, 100)}%`,
                ...(isPrimary && progressColor?.includes('bg-primary') ? { backgroundColor: primaryHex } : {})
              }}
            />
          </div>
        )}

        {/* Container for badges to sit side-by-side */}
        <div className="flex justify-center items-center gap-2 flex-wrap">
          {description && (
            <Badge 
              variant="secondary" 
              className={badgeColor}
              style={isPrimaryGreenBadge ? { 
                color: primaryHex,
                backgroundColor: 'rgba(3, 187, 38, 0.10)',
                borderColor: 'rgba(3, 187, 38, 0.20)'
              } : undefined}
            >
              {description}
            </Badge>
          )}
          {/* Conditionally render the new secondary badge */}
          {secondaryBadgeText && (
            <Badge variant="outline">
              {secondaryBadgeText}
            </Badge>
          )}
        </div>

        {additionalInfo && (
          <p className="text-sm text-muted-foreground mt-2">
            {additionalInfo}
          </p>
        )}
      </CardContent>
    </Card>
  );
};