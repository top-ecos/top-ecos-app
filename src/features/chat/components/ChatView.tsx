import React, { useState, useRef, useEffect } from "react";
import { User, X, ZoomIn, Info, FileText, Lightbulb } from "lucide-react";
import ChatHeader from "./ChatHeader";
import ChatMessages from "./ChatMessages";
import ChatInput from "./ChatInput";
import { extractDocuments } from "@/shared/lib/documents";
import { StationTypeManager } from "@/features/station/lib/stationTypeManager";

// --- DOCUMENT MODAL (full-screen zoom) ---
interface DocumentModalProps {
  documentUrl: string;
  documentName?: string;
  onClose: () => void;
}

const getFileType = (url: string): 'image' | 'pdf' => {
  try {
    const clean = url.split('#')[0].split('?')[0];
    const ext = clean.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') return 'pdf';
    if (ext && ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'svg'].includes(ext)) return 'image';
  } catch {}
  return url.toLowerCase().includes('pdf') ? 'pdf' : 'image';
};

const DocumentModal: React.FC<DocumentModalProps> = ({ documentUrl, documentName, onClose }) => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const type = getFileType(documentUrl);

  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-6"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
        aria-label="Fermer"
      >
        <X size={20} />
      </button>
      <div className="max-w-full max-h-full" onClick={(e) => e.stopPropagation()}>
        {type === 'pdf' ? (
          <iframe
            src={documentUrl}
            title={documentName || 'Document PDF'}
            className="bg-white rounded-xl w-[min(95vw,1200px)] h-[90vh] shadow-2xl"
          />
        ) : (
          <img
            src={documentUrl}
            alt={documentName || 'Document'}
            className="max-w-full max-h-[90vh] object-contain rounded-xl shadow-2xl"
          />
        )}
      </div>
    </div>
  );
};


// --- INTERACTIVE DOCUMENT VIEWER ---
interface InteractiveDocumentViewerProps {
  documents: { url: string; name?: string }[];
}

const InteractiveDocumentViewer: React.FC<InteractiveDocumentViewerProps> = ({ documents }) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);

  if (!documents || documents.length === 0) {
    return (
      <div className="flex items-center justify-center h-full bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <p className="text-gray-500">No documents available.</p>
      </div>
    );
  }

  const selectedDocument = documents[selectedIndex];
  const documentName = selectedDocument.name || `Document ${selectedIndex + 1}`;
  const selectedType = getFileType(selectedDocument.url);
  const pdfPreviewUrl = `${selectedDocument.url}#toolbar=0&view=Fit`;

  return (
    <>
      {isModalOpen && (
        <DocumentModal
          documentUrl={selectedDocument.url}
          documentName={documentName}
          onClose={() => setIsModalOpen(false)}
        />
      )}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex flex-col h-full">
        <div>
          <h3 className="text-sm font-semibold text-gray-800">{documentName}</h3>
          <p className="text-xs text-gray-400 mt-0.5">Appuyer pour zoomer</p>
        </div>

        <div
          className="my-3 flex-1 flex items-center justify-center relative cursor-pointer group overflow-hidden"
          onClick={() => setIsModalOpen(true)}
        >
          {selectedType === 'pdf' ? (
            <div className="w-full h-full min-h-[12rem]">
              <iframe
                src={pdfPreviewUrl}
                title={`${documentName} (aperçu)`}
                className="w-full h-full rounded-lg border border-gray-100 bg-white"
              />
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <img
                src={selectedDocument.url}
                alt={`Aperçu de ${documentName}`}
                className="max-h-full max-w-full object-contain rounded-lg"
              />
            </div>
          )}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all duration-200 flex items-center justify-center rounded-lg">
            <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-white/90 rounded-full p-2.5 shadow">
              <ZoomIn className="h-5 w-5 text-gray-800" />
            </div>
          </div>
        </div>

        {documents.length > 1 && (
          <div className="pt-3 border-t border-gray-100">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {documents.map((doc, index) => (
                <button
                  key={index}
                  onClick={() => setSelectedIndex(index)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-full border whitespace-nowrap transition-colors ${
                    selectedIndex === index
                      ? 'bg-gray-900 border-gray-900 text-white'
                      : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {doc.name || `Doc ${index + 1}`}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
};


// --- TYPES ---
interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

import { CaseData } from "@/features/station/types/sdd.types";

interface ChatViewProps {
  caseData: CaseData;
  messages: Message[];
  inputMessage: string;
  isLoading: boolean;
  timeRemaining: number;
  isPaused: boolean;
  isTimeUp: boolean;
  isEvaluating: boolean;
  onInputChange: (value: string) => void;
  onSendMessage: () => void;
  onBack: () => void;
  onEvaluate: () => void;
  onTogglePause: () => void;
  onResetStation: () => void;
  examMode?: boolean;
  examProgress?: string;
}


// --- MAIN CHAT VIEW ---
const ChatView = React.memo(({
  caseData,
  messages,
  inputMessage,
  isLoading,
  timeRemaining,
  isPaused,
  isTimeUp,
  isEvaluating,
  onInputChange,
  onSendMessage,
  onBack,
  onEvaluate,
  onTogglePause,
  onResetStation,
  examMode = false,
  examProgress,
}: ChatViewProps) => {

  const [showConsignes, setShowConsignes] = useState(false);
  const [showDocuments, setShowDocuments] = useState(false);

  const documents = extractDocuments(caseData);
  const hasDocuments = documents.length > 0;

  return (
    <div
      className="flex flex-col bg-gray-50 overflow-hidden"
      style={{ height: '100dvh' }}
    >
      {/* Header */}
      <div className="flex-shrink-0 z-40">
        <ChatHeader
          caseData={caseData}
          timeRemaining={timeRemaining}
          isPaused={isPaused}
          isTimeUp={isTimeUp}
          isEvaluating={isEvaluating}
          messagesLength={messages.length}
          onBack={onBack}
          onEvaluate={onEvaluate}
          onTogglePause={onTogglePause}
          onReset={onResetStation}
          onShowConsignes={() => setShowConsignes(true)}
          examMode={examMode}
          examProgress={examProgress}
        />
      </div>

      {/* Main content */}
      <main className="flex-1 min-h-0 flex p-2 sm:p-4 lg:p-8 lg:py-6">
        <div className="flex-1 flex min-h-0 max-w-7xl mx-auto w-full">

          {/* Desktop: side-by-side with documents */}
          {hasDocuments ? (
            <div className="flex-1 flex flex-col lg:flex-row gap-4 min-h-0">
              {/* Document panel — desktop only */}
              <div className="hidden lg:flex lg:w-2/5 flex-shrink-0 flex-col" style={{ maxHeight: 'calc(100dvh - 120px)' }}>
                <InteractiveDocumentViewer documents={documents} />
              </div>
              {/* Chat card */}
              <div className="flex-1 min-h-0 flex flex-col bg-white rounded-2xl overflow-hidden border border-gray-200 shadow-sm lg:max-h-[calc(100dvh-120px)]">
                <ChatInterface
                  caseData={caseData}
                  messages={messages}
                  isLoading={isLoading}
                  inputMessage={inputMessage}
                  isPaused={isPaused}
                  isTimeUp={isTimeUp}
                  showConsignes={showConsignes}
                  hasDocuments={hasDocuments}
                  onShowConsignes={() => setShowConsignes(prev => !prev)}
                  onHideConsignes={() => setShowConsignes(false)}
                  onShowDocuments={() => setShowDocuments(true)}
                  onInputChange={onInputChange}
                  onSendMessage={onSendMessage}
                />
              </div>
            </div>
          ) : (
            /* Chat only */
            <div className="flex-1 min-h-0 flex flex-col bg-white rounded-2xl overflow-hidden border border-gray-200 shadow-sm lg:max-h-[calc(100dvh-120px)]">
              <ChatInterface
                caseData={caseData}
                messages={messages}
                isLoading={isLoading}
                inputMessage={inputMessage}
                isPaused={isPaused}
                isTimeUp={isTimeUp}
                showConsignes={showConsignes}
                hasDocuments={false}
                onShowConsignes={() => setShowConsignes(prev => !prev)}
                onHideConsignes={() => setShowConsignes(false)}
                onShowDocuments={() => {}}
                onInputChange={onInputChange}
                onSendMessage={onSendMessage}
              />
            </div>
          )}

        </div>
      </main>

      {/* Documents bottom sheet — mobile only */}
      {hasDocuments && showDocuments && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowDocuments(false)}
          />
          <div className="absolute inset-x-0 bottom-0 bg-white rounded-t-3xl shadow-2xl flex flex-col max-h-[85dvh]">
            {/* Drag handle */}
            <div className="pt-3 pb-1 flex justify-center flex-shrink-0">
              <div className="w-10 h-1 bg-gray-300 rounded-full" />
            </div>
            {/* Sheet header */}
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
            {/* Document viewer */}
            <div className="flex-1 overflow-y-auto p-4" style={{ paddingBottom: 'env(safe-area-inset-bottom, 16px)' }}>
              <InteractiveDocumentViewer documents={documents} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
ChatView.displayName = "ChatView";


// --- CHAT INTERFACE SUB-COMPONENT ---
interface ChatInterfaceProps {
  caseData: CaseData;
  messages: Message[];
  isLoading: boolean;
  showConsignes: boolean;
  hasDocuments: boolean;
  onShowConsignes: () => void;
  onHideConsignes: () => void;
  onShowDocuments: () => void;
  [key: string]: unknown;
}

const ChatInterface = ({
  caseData,
  messages,
  isLoading,
  showConsignes,
  hasDocuments,
  onShowConsignes,
  onHideConsignes,
  onShowDocuments,
  ...chatInputProps
}: ChatInterfaceProps) => {
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    const el = scrollAreaRef.current;
    if (!el) return;
    const onScroll = () => {
      const threshold = 24;
      const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight <= threshold;
      setIsAtBottom(atBottom);
    };
    el.addEventListener('scroll', onScroll);
    onScroll();
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  const scrollToLatest = () => {
    const el = scrollAreaRef.current;
    if (!el) return;
    try {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    } catch {
      el.scrollTop = el.scrollHeight;
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Patient header — desktop only */}
      <div className="hidden lg:block">
        <PatientHeader caseData={caseData} onShowConsignes={onShowConsignes} />
      </div>

      {/* Messages area */}
      <div className="relative flex-1 min-h-0">
        {/* Scroll area */}
        <div ref={scrollAreaRef} className="h-full overflow-y-auto">
          <ChatMessages
            messages={messages}
            isLoading={isLoading}
            consignes={caseData?.consignes_etudiant}
          />
        </div>

        {/* Scroll-to-bottom button */}
        {!isAtBottom && (
          <button
            onClick={scrollToLatest}
            className="absolute right-3 bottom-3 z-10 rounded-full border border-gray-200 bg-white/95 backdrop-blur-sm px-4 py-2 text-xs font-medium text-gray-700 shadow-md hover:bg-white transition-all active:scale-95"
            aria-label="Aller au dernier message"
          >
            ↓ Dernier message
          </button>
        )}

        {/* Floating pills — mobile only */}
        <div className="absolute left-3 bottom-3 z-10 flex flex-col gap-1.5 lg:hidden pointer-events-none">
          <div className="pointer-events-auto flex flex-col gap-1.5">
            {caseData?.consignes_etudiant && (
              <button
                onClick={onShowConsignes}
                className="flex items-center gap-1.5 bg-white/95 backdrop-blur-sm border border-gray-200 rounded-full pl-2 pr-3 py-1.5 shadow-md text-xs font-medium text-gray-700 hover:bg-white active:scale-95 transition-all"
                aria-label="Voir les consignes"
              >
                <div className="w-5 h-5 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                  <Info className="h-3 w-3 text-blue-600" />
                </div>
                <span>Consignes</span>
              </button>
            )}
            {hasDocuments && (
              <button
                onClick={onShowDocuments}
                className="flex items-center gap-1.5 bg-white/95 backdrop-blur-sm border border-gray-200 rounded-full pl-2 pr-3 py-1.5 shadow-md text-xs font-medium text-gray-700 hover:bg-white active:scale-95 transition-all"
                aria-label="Voir les documents"
              >
                <div className="w-5 h-5 rounded-full bg-purple-50 flex items-center justify-center flex-shrink-0">
                  <FileText className="h-3 w-3 text-purple-500" />
                </div>
                <span>Documents</span>
              </button>
            )}
          </div>
        </div>

        {/* Consignes overlay — mobile bottom sheet */}
        {showConsignes && caseData?.consignes_etudiant && (
          <>
            {/* Mobile: bottom sheet */}
            <div className="fixed inset-0 z-50 lg:hidden">
              <div
                className="absolute inset-0 bg-black/40"
                onClick={onHideConsignes}
                aria-hidden="true"
              />
              <div
                className="absolute inset-x-0 bottom-0 bg-white rounded-t-3xl shadow-2xl border-t border-blue-100"
                role="dialog"
                aria-modal="true"
                aria-label="Consignes de la station"
                style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
              >
                {/* Handle */}
                <div className="pt-3 flex justify-center">
                  <div className="w-10 h-1 bg-gray-300 rounded-full" />
                </div>
                <div className="px-6 pt-3 pb-6 max-h-[70vh] overflow-y-auto">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Info className="h-4 w-4 text-blue-600" />
                    </div>
                    <div className="text-sm text-gray-800 leading-relaxed whitespace-pre-line flex-1">
                      <p className="font-semibold text-blue-700 mb-2">Consignes de la station</p>
                      <p className="text-gray-700">{caseData?.consignes_etudiant}</p>
                    </div>
                  </div>
                  <div className="mt-5 flex justify-center">
                    <button
                      onClick={onHideConsignes}
                      className="h-10 px-6 rounded-full bg-gray-100 hover:bg-gray-200 text-sm font-medium text-gray-700 transition-colors"
                      aria-label="Fermer les consignes"
                    >
                      Fermer
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Desktop: overlay panel */}
            <div className="absolute left-0 right-0 top-4 z-20 px-6 hidden lg:block">
              <div className="relative bg-blue-50 border border-blue-200 rounded-xl shadow-xl">
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
                  onClick={onHideConsignes}
                  className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-blue-50 text-blue-700 border border-blue-200 flex items-center justify-center hover:bg-blue-100"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Input bar */}
      <div className="border-t border-gray-100 flex-shrink-0">
        <ChatInput
          {...chatInputProps}
          onSend={chatInputProps.onSendMessage}
          placeholderText={StationTypeManager.getChatPlaceholder(caseData)}
        />
      </div>
    </div>
  );
};


// --- PATIENT HEADER (desktop only) ---
// Themed by station type: PS = blue, PSS = purple, Document = pink
const PatientHeader = ({ caseData, onShowConsignes }: { caseData: CaseData; onShowConsignes: () => void }) => {
  const displayName = StationTypeManager.getCharacterDisplayName(caseData);
  const isDocs = StationTypeManager.isDocumentStation(caseData);
  const isPSS = StationTypeManager.isSimulatedProfessional(caseData);

  // ── Theme per station type ──
  const theme = isDocs
    ? { bg: 'rgba(255, 75, 214, 0.10)', iconBg: 'bg-[#FF4BD6]/15', iconColor: 'text-[#FF4BD6]' }
    : isPSS
      ? { bg: 'rgba(145, 5, 248, 0.10)', iconBg: 'bg-[#9105F8]/15', iconColor: 'text-[#9105F8]' }
      : { bg: 'rgba(66, 153, 246, 0.10)', iconBg: 'bg-[#4299F6]/15', iconColor: 'text-[#4299F6]' };

  return (
    <div
      className="p-4 border-b border-gray-100 rounded-t-2xl flex-shrink-0"
      style={{ backgroundColor: theme.bg }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className={`w-10 h-10 ${theme.iconBg} rounded-full flex items-center justify-center`}>
            {isDocs ? (
              <Lightbulb className={`h-5 w-5 ${theme.iconColor}`} />
            ) : (
              <User className={`h-5 w-5 ${theme.iconColor}`} />
            )}
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 text-base">{displayName}</h3>
            {!isDocs && !isPSS && (
              <p className="text-sm text-gray-500">Patient(e) standardisé(e)</p>
            )}
          </div>
        </div>
        {caseData?.consignes_etudiant && (
          <button
            type="button"
            onClick={onShowConsignes}
            className="inline-flex items-center gap-1.5 text-gray-700 bg-white hover:bg-gray-50 border border-gray-200 rounded-full px-3 py-1 text-xs font-medium transition-colors"
            aria-label="Afficher les consignes de la station"
          >
            <Info className="h-3.5 w-3.5" />
            <span>Consignes</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default ChatView;
