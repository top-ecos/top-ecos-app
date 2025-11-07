
import { Card, CardContent } from "@/components/ui/card-premium";
import { Loader2, BarChart3 } from "lucide-react";

const LoadingEvaluation = () => {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Card className="w-full max-w-md mx-4 shadow-lg bg-surface border-border">
        <CardContent className="p-8 text-center">
          <div className="flex justify-center mb-6">
            <div className="relative">
              <BarChart3 className="h-16 w-16 text-accent" />
              <Loader2 className="h-8 w-8 text-accent animate-spin absolute -top-2 -right-2" />
            </div>
          </div>
          
          <h2 className="text-xl font-semibold text-text mb-3">
            Évaluation en cours...
          </h2>
          
          <p className="text-subtext mb-6 leading-relaxed">
            Analyse de ta performance clinique et de tes compétences de communication en cours.
          </p>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-subtext">Performance clinique</span>
              <Loader2 className="h-4 w-4 animate-spin text-accent" />
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-subtext">Évaluation de la communication</span>
              <Loader2 className="h-4 w-4 animate-spin text-accent" />
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-subtext">Génération du feedback pédagogique</span>
              <Loader2 className="h-4 w-4 animate-spin text-accent" />
            </div>
          </div>
          
          <div className="mt-6 p-4 bg-[#4299F6]/30 border border-blue-200 rounded-lg">
            <p className="text-sm text-[#4299F6]">
              Patiente un instant, cette opération peut prendre quelques secondes.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default LoadingEvaluation;
