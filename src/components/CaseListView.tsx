
import { Button } from "@/components/ui/button-premium";
import { Badge } from "@/components/ui/badge-premium";
import { Clock, Play, CheckCircle, RotateCcw } from "lucide-react";

interface Profile {
  id: string;
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  level: string;
  tokens: number;
  created_at: string;
  updated_at: string;
}

interface CaseListViewProps {
  cases: any[];
  onStartSimulation: (caseData: any) => void;
  onResetStation: (caseData: any) => void;
  startingStationId: string | null;
  isStationCompleted: (stationId: number) => boolean;
  profile: Profile | null;
}

const CaseListView = ({ cases, onStartSimulation, onResetStation, startingStationId, isStationCompleted, profile }: CaseListViewProps) => {
  const getStatusBadge = (caseData: any) => {
    const isCompleted = isStationCompleted(caseData.sdd_id);
    
    return isCompleted ? (
      <Badge variant="success">
        <CheckCircle className="h-3 w-3 mr-1" />
        Fait
      </Badge>
    ) : (
      <Badge variant="secondary">
        Non fait
      </Badge>
    );
  };

  return (
    <div className="space-y-3">
      {cases.map((caseData) => (
        <div 
          key={caseData.sdd_id}
          className="bg-surface border border-border rounded-lg p-4 hover:border-accent hover:shadow-md transition-all duration-200"
        >
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-3 mb-2">
                <Badge variant="secondary" className="font-mono">
                  SDD {caseData.sdd_id}
                </Badge>
                {getStatusBadge(caseData)}
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
                {caseData.specialite && (
                  <Badge variant="secondary" size="sm">
                    {caseData.specialite}
                  </Badge>
                )}
              </div>
              
              <h3 className="font-medium text-text truncate mb-1">
                {caseData.sdd_titre || `Station ${caseData.sdd_id}`}
              </h3>
              
              <div className="flex items-center space-x-4 text-sm text-subtext">
                <div className="flex items-center">
                  <Clock className="h-3 w-3 mr-1" />
                  10 min
                </div>
                <div>
                  Item EDN: #{caseData.item_EDN || 'Non spécifié'}
                </div>
              </div>
            </div>

            <div className="flex-shrink-0 ml-4 flex space-x-2">
              <Button 
                variant="primary"
                onClick={() => onStartSimulation(caseData)}
                disabled={startingStationId === caseData.sdd_id || !profile || profile.tokens <= 0}
              >
                {startingStationId === caseData.sdd_id ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Initialisation...
                  </>
                ) : !profile || profile.tokens <= 0 ? (
                  <>
                    Tokens insuffisants
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Commencer
                  </>
                )}
              </Button>
              
              <Button 
                variant="secondary"
                onClick={() => onResetStation(caseData)}
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default CaseListView;
