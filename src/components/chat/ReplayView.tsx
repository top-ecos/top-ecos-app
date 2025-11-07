
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { User, MessageSquare, RotateCcw, Play, PlayCircle, Info, X } from "lucide-react";
import { useState } from "react";

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

interface ReplayViewProps {
  caseData: any;
  messages: Message[];
  onBack: () => void;
  onShowEvaluation: () => void;
  onResetStation: () => void;
  onBackToHome: () => void;
}

const ReplayView = ({ 
  caseData, 
  messages, 
  onBack, 
  onShowEvaluation, 
  onResetStation, 
  onBackToHome 
}: ReplayViewProps) => {
  const conversationMessages = messages.filter(m => m.role !== 'system');
  const [showConsignes, setShowConsignes] = useState(false);
  
  return (
    <div className="min-h-screen bg-gray-50">
      
      <header className="bg-white shadow-sm border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-lg sm:text-xl font-semibold text-gray-900 truncate">Replay pédagogique</h1>

            {/* Desktop controls */}
            <div className="hidden lg:flex items-center gap-3">
              <button
                onClick={onShowEvaluation}
                className="inline-flex items-center rounded-full border-2 px-4 py-2 text-sm font-medium border-[#F39C12] text-[#F39C12] hover:bg-orange-50 transition"
                aria-label="Voir l'évaluation"
              >
                <Play className="h-4 w-4 mr-2" />
                Voir l'évaluation
              </button>
              <button
                onClick={() => {
                  if (window.confirm('Recommencer cette station ? Votre progression locale sera effacée.')) onResetStation();
                }}
                className="inline-flex items-center rounded-full border-2 px-4 py-2 text-sm font-medium border-[#4299F6] text-[#4299F6] hover:bg-blue-50 transition"
                aria-label="Recommencer la station"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Recommencer
              </button>
              <button
                onClick={() => (window.location.href = "/cases")}
                className="inline-flex items-center rounded-full border-2 px-4 py-2 text-sm font-medium border-[#2ECC71] text-[#2ECC71] hover:bg-green-50 transition"
                aria-label="Aller aux cas"
              >
                <Play className="h-4 w-4 mr-2" />
                Nouvelle station
              </button>
            </div>

            {/* Mobile icon-only actions with original colors (same pattern as EvaluationView) */}
            <div className="flex lg:hidden items-center gap-2">
              <button
                onClick={onShowEvaluation}
                className="h-10 w-10 inline-flex items-center justify-center rounded-full border-2 border-[#F39C12] text-[#F39C12] hover:bg-orange-50"
                aria-label="Voir l'évaluation"
              >
                <PlayCircle className="h-5 w-5" />
              </button>
              <button
                onClick={() => {
                  if (window.confirm('Recommencer cette station ? Votre progression locale sera effacée.')) onResetStation();
                }}
                className="h-10 w-10 inline-flex items-center justify-center rounded-full border-2 border-[#4299F6] text-[#4299F6] hover:bg-blue-50"
                aria-label="Recommencer la station"
              >
                <RotateCcw className="h-5 w-5" />
              </button>
              <button
                onClick={() => (window.location.href = "/cases")}
                className="h-10 w-10 inline-flex items-center justify-center rounded-full border-2 border-[#2ECC71] text-[#2ECC71] hover:bg-green-50"
                aria-label="Nouvelle station"
              >
                <Play className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 lg:px-8 py-8">
        <div className="relative">
        <Card className="shadow-lg">
          <CardHeader className="bg-gray-50 border-b">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center space-x-3 text-xl">
                <MessageSquare className="h-5 w-5 text-blue-600" />
                <span>Historique complet - Station {caseData?.official_id ?? caseData.sdd_id}</span>
              </CardTitle>
              {caseData?.consignes_etudiant && (
                <button
                  type="button"
                  onClick={() => {
                    setShowConsignes(prev => !prev);
                    if (caseData?.sdd_id) {
                      try { localStorage.setItem(`hasSeenConsignes_${caseData.sdd_id}`, 'true'); } catch {}
                    }
                  }}
                  className="inline-flex items-center gap-2 text-blue-700 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-full px-3 py-1 text-sm"
                  aria-label="Afficher les consignes de la station"
                  title="Consignes de la station"
                >
                  <Info className="h-4 w-4" />
                  <span>Consignes</span>
                </button>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-6">
              {conversationMessages.map((message) => (
                <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-3xl px-4 py-3 rounded-xl ${
                    message.role === 'user' 
                      ? 'bg-blue-600 text-white shadow-md' 
                      : 'bg-gray-100 border border-gray-200 shadow-sm'
                  }`}>
                    <div className="flex items-start space-x-3">
                      {message.role === 'assistant' && (
                        <User className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                      )}
                      <div>
                        <p className="text-xs font-semibold mb-1 opacity-80">
                          {message.role === 'user' ? 'Étudiant' : 'Patient'}
                        </p>
                        <p className="leading-relaxed">{message.content}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        {showConsignes && caseData?.consignes_etudiant && (
          <>
            {/* Mobile: bottom sheet */}
            <div className="fixed inset-0 z-50 lg:hidden">
              <div
                className="absolute inset-0 bg-black/40"
                onClick={() => setShowConsignes(false)}
                aria-hidden="true"
              />
              <div
                className="absolute inset-x-0 bottom-0 bg-white rounded-t-2xl shadow-2xl border-t border-blue-200"
                role="dialog"
                aria-modal="true"
                aria-label="Consignes de la station"
                style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
              >
                <div className="px-6 pt-4 pb-6 max-h-[70vh] overflow-y-auto">
                  <div className="flex items-start gap-3">
                    <Info className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-gray-800 leading-relaxed whitespace-pre-line w-full">
                      <p className="font-semibold text-blue-700 mb-2">Consignes de la station</p>
                      <p>{caseData?.consignes_etudiant}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex justify-center">
                    <button
                      onClick={() => setShowConsignes(false)}
                      className="h-10 px-4 rounded-lg border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 text-sm font-medium"
                      aria-label="Fermer les consignes"
                    >
                      Fermer
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Desktop: full-width blue panel matching chat consignes */}
            <div className="absolute left-0 right-0 top-4 z-20 px-6 hidden lg:block">
              <div className="relative bg-blue-50 border border-blue-200 rounded-xl shadow-xl w-full">
                <div className="p-4 max-h-[60vh] overflow-y-auto">
                  <div className="flex items-start space-x-3">
                    <Info className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-blue-800 leading-relaxed whitespace-pre-line w-full">
                      <p className="font-semibold text-blue-700 mb-1">Consignes de la station</p>
                      <p>{caseData?.consignes_etudiant}</p>
                    </div>
                  </div>
                </div>
                <button
                  aria-label="Fermer les consignes"
                  onClick={() => setShowConsignes(false)}
                  className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-blue-50 text-blue-700 border border-blue-200 flex items-center justify-center hover:bg-blue-100"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          </>
        )}
        </div>
      </div>
    </div>
  );
};

export default ReplayView;
