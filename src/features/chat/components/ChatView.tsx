import React, { useState, useRef, useEffect } from "react";
import { User, X, ZoomIn, Info } from "lucide-react";
import ChatHeader from "./ChatHeader";
import ChatMessages from "./ChatMessages";
import ChatInput from "./ChatInput";
import { extractDocuments } from "@/shared/lib/documents";
import BottomActionBar from "./BottomActionBar";
import { StationTypeManager } from "@/features/station/lib/stationTypeManager";

// --- MODAL COMPONENT FOR FULL-SCREEN DOCUMENT VIEW ---
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
  // Heuristic fallback: treat as PDF if "pdf" appears in URL
  return url.toLowerCase().includes('pdf') ? 'pdf' : 'image';
};

const DocumentModal: React.FC<DocumentModalProps> = ({ documentUrl, documentName, onClose }) => {
  // Close modal on 'Escape' key press
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const type = getFileType(documentUrl);

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-8"
      onClick={onClose} // Close modal on background click
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white hover:text-gray-300 transition-opacity"
        aria-label="Close document viewer"
      >
        <X size={32} />
      </button>
      <div 
        className="max-w-full max-h-full"
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking on the content itself
      >
        {type === 'pdf' ? (
          <iframe
            src={documentUrl}
            title={documentName || 'Document PDF'}
            className="bg-white rounded-md w-[min(95vw,1200px)] h-[90vh] shadow-2xl"
          />
        ) : (
          <img
            src={documentUrl}
            alt={documentName || 'Document full screen view'}
            className="max-w-full max-h-[90vh] object-contain rounded-md shadow-2xl"
          />
        )}
      </div>
    </div>
  );
};


// --- INTERACTIVE DOCUMENT VIEWER COMPONENT ---
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


  const openModal = () => setIsModalOpen(true);
  const closeModal = () => setIsModalOpen(false);

  return (
    <>
      {isModalOpen && (
        <DocumentModal documentUrl={selectedDocument.url} documentName={documentName} onClose={closeModal} />
      )}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 flex flex-col h-full">
        {/* Document Title */}
        <div>
          <h3 className="font-semibold text-lg text-gray-800">{documentName}</h3>
          <p className="text-sm text-gray-500">Cliquer sur le document pour zoomer</p>
        </div>
        
        {/* Document Preview */}
        <div 
          className="my-4 flex-1 flex items-center justify-center relative cursor-pointer group overflow-hidden max-h-[42dvh] lg:max-h-none"
          onClick={openModal}
        >
          {selectedType === 'pdf' ? (
            <div className="w-full h-full min-h-[14rem] lg:min-h-[18rem]">
              <iframe
                src={pdfPreviewUrl}
                title={`${documentName} (aperçu)`}
                className="w-full h-full rounded-md border border-gray-200 bg-white"
              />
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center">
                <img
                src={selectedDocument.url}
                alt={`Preview of ${documentName}`}
                className="max-h-full max-w-full object-contain rounded-md"
                />
            </div>
          )}
          <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all duration-300 flex items-center justify-center rounded-md">
            <ZoomIn className="text-white h-12 w-12 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          </div>
        </div>

        {/* Selector: horizontal chips on mobile; grid on desktop */}
        <div className="pt-4 border-t border-gray-200">
          <div className="lg:hidden -mx-2 px-2 overflow-x-auto">
            <div className="flex gap-2 w-max">
              {documents.map((doc, index) => (
                <button
                  key={index}
                  onClick={() => setSelectedIndex(index)}
                  className={`px-4 h-10 min-w-[44px] text-sm font-medium rounded-full border transition-colors duration-200 ${
                    selectedIndex === index
                      ? 'bg-gray-100 border-gray-400 text-gray-900'
                      : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {doc.name || `Document ${index + 1}`}
                </button>
              ))}
            </div>
          </div>
          <div className="hidden lg:grid grid-cols-2 gap-3">
            {documents.map((doc, index) => (
              <button
                key={index}
                onClick={() => setSelectedIndex(index)}
                className={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors duration-200 ${
                  selectedIndex === index
                    ? 'bg-gray-100 border-gray-400 text-gray-900'
                    : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                {doc.name || `Document ${index + 1}`}
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
};


// --- MAIN CHAT VIEW COMPONENT ---

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

interface Document {
  url: string;
  name?: string;
}

interface ChatViewProps {
  caseData: any;
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
}

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
  onResetStation
}: ChatViewProps) => {

  // Local UI state for showing/hiding pinned consignes
  const [showConsignes, setShowConsignes] = useState(false);

  const documents = extractDocuments(caseData);
  const hasDocuments = documents.length > 0;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="sticky top-0 z-40">
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
        />
      </div>

      <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 flex pb-28 lg:pb-0">
        <div className="mx-auto max-w-7xl w-full flex flex-col gap-6">
          {hasDocuments ? (
            <div className="flex flex-col gap-6 lg:flex-row lg:items-stretch">
              <div className="w-full lg:w-2/5 flex-shrink-0 min-h-[16rem] lg:h-[640px] lg:max-h-[calc(100vh-160px)]">
                <InteractiveDocumentViewer documents={documents} />
              </div>
              <div className="flex-1">
                <div className="flex min-h-[24rem] lg:h-[85vh] lg:max-h-[calc(100vh-160px)] flex-col bg-white rounded-xl border border-gray-200 shadow-sm">
                  <ChatInterface
                    caseData={caseData}
                    messages={messages}
                    isLoading={isLoading}
                    inputMessage={inputMessage}
                    isPaused={isPaused}
                    isTimeUp={isTimeUp}
                    showConsignes={showConsignes}
                    onShowConsignes={() => setShowConsignes(prev => !prev)}
                    onHideConsignes={() => setShowConsignes(false)}
                    onInputChange={onInputChange}
                    onSendMessage={onSendMessage}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="flex">
              <div className="flex min-h-[24rem] lg:h-[85vh] lg:max-h-[calc(100vh-160px)] flex-col bg-white rounded-xl border border-gray-200 shadow-sm w-full">
                <ChatInterface
                  caseData={caseData}
                  messages={messages}
                  isLoading={isLoading}
                  inputMessage={inputMessage}
                  isPaused={isPaused}
                  isTimeUp={isTimeUp}
                  showConsignes={showConsignes}
                  onShowConsignes={() => setShowConsignes(prev => !prev)}
                  onHideConsignes={() => setShowConsignes(false)}
                  onInputChange={onInputChange}
                  onSendMessage={onSendMessage}
                />
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Mobile thumb-first bottom action bar */}
      <BottomActionBar
        isPaused={isPaused}
        isTimeUp={isTimeUp}
        isEvaluating={isEvaluating}
        messagesLength={messages.length}
        onTogglePause={onTogglePause}
        onEvaluate={onEvaluate}
      />
    </div>
  );
});
ChatView.displayName = "ChatView";

// --- SUB-COMPONENTS FOR CLEANLINESS ---
const ChatInterface = ({ caseData, messages, isLoading, showConsignes, onShowConsignes, onHideConsignes, ...chatInputProps }: any) => {
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);

  // This hook ensures the message area automatically scrolls to the bottom
  // whenever new messages are added, making the latest message visible.
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollElement = scrollAreaRef.current;
      scrollElement.scrollTop = scrollElement.scrollHeight;
    }
  }, [messages]); // Dependency on `messages` triggers this effect on change.

  useEffect(() => {
    const el = scrollAreaRef.current;
    if (!el) return;
    const onScroll = () => {
      const threshold = 24; // px from bottom
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
      {/* Desktop patient header; mobile shows compact info in top bar */}
      <div className="hidden lg:block">
        <PatientHeader caseData={caseData} onShowConsignes={onShowConsignes} />
      </div>
      <div className="relative flex-1 min-h-0">
        <div 
          ref={scrollAreaRef} 
          className="h-full overflow-y-auto"
        >
          <ChatMessages
            messages={messages}
            isLoading={isLoading}
            consignes={caseData?.consignes_etudiant}
          />
        </div>

        {!isAtBottom && (
          <button
            onClick={scrollToLatest}
            className="absolute right-4 bottom-24 lg:bottom-6 z-10 rounded-full border border-gray-300 bg-white/90 backdrop-blur px-4 py-2 text-sm shadow-md hover:bg-white"
            aria-label="Aller au dernier message"
          >
            Aller au dernier message
          </button>
        )}

        {showConsignes && caseData?.consignes_etudiant && (
          <>
            {/* Mobile: bottom sheet */}
            <div className="fixed inset-0 z-50 lg:hidden">
              {/* Backdrop */}
              <div
                className="absolute inset-0 bg-black/40"
                onClick={onHideConsignes}
                aria-hidden="true"
              />
              {/* Bottom sheet */}
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
                      onClick={onHideConsignes}
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
      <div className="border-t border-gray-200 rounded-b-lg">
        <ChatInput 
          {...chatInputProps} 
          onSend={chatInputProps.onSendMessage}
          placeholderText={StationTypeManager.getChatPlaceholder(caseData)}
        />
      </div>
    </div>
  );
};

const PatientHeader = ({ caseData, onShowConsignes }: { caseData: any, onShowConsignes: () => void }) => {
  // Use StationTypeManager for consistent character display name
  const displayName = StationTypeManager.getCharacterDisplayName(caseData);
  const isDocs = StationTypeManager.isDocumentStation(caseData);
  const isPSS = StationTypeManager.isSimulatedProfessional(caseData);

  return (
    <div className="p-4 border-b border-gray-200 bg-gray-50 rounded-t-xl flex-shrink-0">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gray-400 rounded-full flex items-center justify-center">
            <User className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">{displayName}</h3>
            {!isDocs && !isPSS && (
              <p className="text-sm text-gray-600">Patient(e) standardisé(e)</p>
            )}
          </div>
        </div>
        {caseData?.consignes_etudiant && (
          <button
            type="button"
            onClick={onShowConsignes}
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
  );
};

export default ChatView;
