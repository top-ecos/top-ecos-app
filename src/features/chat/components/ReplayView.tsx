import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { ChevronLeft, User, MessageSquare, RotateCcw, Play, PlayCircle, Info, X, FileText } from "lucide-react";
import { useState } from "react";
import { Message } from "@/features/chat/types/message.types";
import { CaseData } from "@/features/station/types/sdd.types";
import { StorageManager } from "@/shared/lib/storage";
import { extractDocuments } from "@/shared/lib/documents";
import InteractiveDocumentViewer from "./InteractiveDocumentViewer";

interface ReplayViewProps {
  caseData: CaseData;
  messages: Message[];
  onBack: () => void;
  onShowEvaluation: () => void;
  onResetStation: () => void;
  onBackToHome: () => void;
  backLabel?: string;
  hideResetStation?: boolean;
  showBackButton?: boolean;
}

const ReplayView = ({ 
  caseData, 
  messages, 
  onBack, 
  onShowEvaluation, 
  onResetStation, 
  onBackToHome,
  backLabel = "Retour",
  hideResetStation = false,
  showBackButton = true,
}: ReplayViewProps) => {
  const conversationMessages = messages.filter(m => m.role !== 'system');
  const [showConsignes, setShowConsignes] = useState(false);
  const [showDocuments, setShowDocuments] = useState(false);

  const documents = extractDocuments(caseData);
  const hasDocuments = documents.length > 0;
  
  return (
    <div className="min-h-screen bg-gray-50">
      
      <header className="bg-white shadow-sm border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex items-center gap-3">
              {showBackButton && (
                <button
                  onClick={onBack}
                  className="h-10 w-10 sm:h-auto sm:w-auto inline-flex items-center justify-center sm:justify-start rounded-full border-2 border-gray-200 text-gray-700 hover:bg-gray-50 transition px-0 sm:px-4 py-0 sm:py-2"
                  aria-label={backLabel}
                  title={backLabel}
                >
                  <ChevronLeft className="h-5 w-5 sm:h-4 sm:w-4 sm:mr-2" />
                  <span className="hidden sm:inline">{backLabel}</span>
                </button>
              )}
              <h1 className="text-lg sm:text-xl font-semibold text-gray-900 truncate">Replay pédagogique</h1>
            </div>

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
              {!hideResetStation && (
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
              )}
              <button
                onClick={() => (window.location.href = "/cases")}
                className="inline-flex items-center rounded-full border-2 px-4 py-2 text-sm font-medium border-[#2ECC71] text-[#2ECC71] hover:bg-green-50 transition"
                aria-label="Aller aux cas"
              >
                <Play className="h-4 w-4 mr-2" />
                Nouvelle station
              </button>
            </div>

            {/* Mobile icon-only actions */}
            <div className="flex lg:hidden items-center gap-2">
              <button
                onClick={onShowEvaluation}
                className="h-10 w-10 inline-flex items-center justify-center rounded-full border-2 border-[#F39C12] text-[#F39C12] hover:bg-orange-50"
                aria-label="Voir l'évaluation"
              >
                <PlayCircle className="h-5 w-5" />
              </button>
              {!hideResetStation && (
                <button
                  onClick={() => {
                    if (window.confirm('Recommencer cette station ? Votre progression locale sera effacée.')) onResetStation();
                  }}
                  className="h-10 w-10 inline-flex items-center justify-center rounded-full border-2 border-[#4299F6] text-[#4299F6] hover:bg-blue-50"
                  aria-label="Recommencer la station"
                >
                  <RotateCcw className="h-5 w-5" />
                </button>
              )}
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

      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-8">
        {/* Desktop: side-by-side layout when documents exist */}
        <div className={`${hasDocuments ? 'flex flex-col lg:flex-row gap-6' : ''}`}>
          
          {/* Document panel — desktop only */}
          {hasDocuments && (
            <div className="hidden lg:block lg:w-2/5 flex-shrink-0">
              <div className="sticky top-[88px]" style={{ maxHeight: 'calc(100vh - 120px)' }}>
                <InteractiveDocumentViewer documents={documents} />
              </div>
            </div>
          )}

          {/* Replay card */}
          <div className={`${hasDocuments ? 'flex-1 min-w-0' : 'max-w-6xl'}`}>
            <div className="relative">
              <Card className="shadow-lg">
                <CardHeader className="bg-gray-50 border-b">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center space-x-3 text-xl">
                      <MessageSquare className="h-5 w-5 text-blue-600" />
                      <span>
                        {(() => {
                          const displayId = caseData?.official_id ?? caseData?.station_code ?? null;
                          return `Historique complet${displayId ? ` - Station ${displayId}` : ""}`;
                        })()}
                      </span>
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      {/* Mobile: document button */}
                      {hasDocuments && (
                        <button
                          type="button"
                          onClick={() => setShowDocuments(true)}
                          className="inline-flex lg:hidden items-center gap-1.5 text-[#FF4BD6] bg-[#FF4BD6]/10 hover:bg-[#FF4BD6]/20 border border-[#FF4BD6]/30 rounded-full px-3 py-1 text-sm font-medium transition-colors"
                          aria-label="Voir les documents"
                        >
                          <FileText className="h-4 w-4" />
                          <span>Documents</span>
                        </button>
                      )}
                      {caseData?.consignes_etudiant && (
                        <button
                          type="button"
                          onClick={() => {
                            setShowConsignes(prev => !prev);
                            if (caseData?.sdd_id) {
                              StorageManager.setConsignesSeen(caseData.sdd_id);
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
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="space-y-6">
                    {conversationMessages.map((message) => (
                      <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-3xl px-4 py-3 rounded-xl ${
                          message.role === 'user' 
                            ? 'bg-[#4299F6] text-white shadow-md' 
                            : 'bg-gray-100 border border-gray-200 shadow-sm text-[#222223]'
                        }`}>
                          <div className="flex items-start space-x-3">
                            {message.role === 'assistant' && (
                              <User className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                            )}
                            <div>
                              <p className="text-xs font-semibold mb-1 opacity-80">
                                {message.role === 'user' ? 'Toi' : 'PS / PSS'}
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

              {/* Consignes overlays */}
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

                  {/* Desktop: blue panel */}
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
      </div>

      {/* Documents bottom sheet — mobile only */}
      {hasDocuments && showDocuments && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowDocuments(false)}
          />
          <div className="absolute inset-x-0 bottom-0 bg-white rounded-t-3xl shadow-2xl flex flex-col max-h-[85dvh]">
            <div className="pt-3 pb-1 flex justify-center flex-shrink-0">
              <div className="w-10 h-1 bg-gray-300 rounded-full" />
            </div>
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 flex-shrink-0">
              <h3 className="font-semibold text-gray-900">Documents</h3>
              <button
                onClick={() => setShowDocuments(false)}
                className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
                aria-label="Fermer"
              >
                <X className="h-4 w-4 text-gray-600" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4" style={{ paddingBottom: 'env(safe-area-inset-bottom, 16px)' }}>
              <InteractiveDocumentViewer documents={documents} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReplayView;
