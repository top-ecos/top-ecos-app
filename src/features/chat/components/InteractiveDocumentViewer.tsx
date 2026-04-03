import React, { useState, useEffect } from "react";
import { X, ZoomIn, File, ExternalLink } from "lucide-react";

/* ── iOS / iPadOS detection ── */
const getIsIOSorIPadOS = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  if (/iPhone|iPod/.test(ua)) return true;
  if (/iPad/.test(ua)) return true;
  if (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) return true;
  return false;
};

const getFileType = (url: string): 'image' | 'pdf' => {
  try {
    const clean = url.split('#')[0].split('?')[0];
    const ext = clean.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') return 'pdf';
    if (ext && ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'svg'].includes(ext)) return 'image';
  } catch {}
  return url.toLowerCase().includes('pdf') ? 'pdf' : 'image';
};

/* ── Full-screen document modal ── */
interface DocumentModalProps {
  documentUrl: string;
  documentName?: string;
  onClose: () => void;
}

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

/* ── Interactive Document Viewer ── */
export interface InteractiveDocumentViewerProps {
  documents: { url: string; name?: string }[];
}

const InteractiveDocumentViewer: React.FC<InteractiveDocumentViewerProps> = ({ documents }) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    setIsIOS(getIsIOSorIPadOS());
  }, []);

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

  const handleOpenDocument = () => {
    const w = window.open(selectedDocument.url, '_blank', 'noopener,noreferrer');
    if (w) w.opener = null;
  };

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
          <p className="text-xs text-gray-400 mt-0.5">
            {isIOS && selectedType === 'pdf' ? 'Appuyer pour ouvrir le PDF' : 'Appuyer pour zoomer'}
          </p>
        </div>

        <div
          className="my-3 flex-1 flex items-center justify-center relative cursor-pointer group overflow-hidden"
          onClick={isIOS && selectedType === 'pdf' ? handleOpenDocument : () => setIsModalOpen(true)}
        >
          {selectedType === 'pdf' ? (
            isIOS ? (
              <div className="w-full h-full min-h-[12rem] flex flex-col items-center justify-center gap-3 bg-gray-50 rounded-lg border border-gray-100">
                <File className="h-10 w-10 text-red-400" />
                <div className="text-center px-4">
                  <p className="text-gray-800 font-semibold text-sm">{documentName}</p>
                  <p className="text-gray-500 text-xs mt-1">PDF — Appuie pour ouvrir</p>
                </div>
                <div className="inline-flex items-center gap-1.5 bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs font-medium text-gray-700 shadow-sm">
                  <ExternalLink className="h-3.5 w-3.5" />
                  Ouvrir le PDF
                </div>
              </div>
            ) : (
              <div className="w-full h-full min-h-[12rem]">
                <iframe
                  src={pdfPreviewUrl}
                  title={`${documentName} (aperçu)`}
                  className="w-full h-full rounded-lg border border-gray-100 bg-white"
                />
              </div>
            )
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <img
                src={selectedDocument.url}
                alt={`Aperçu de ${documentName}`}
                className="max-h-full max-w-full object-contain rounded-lg"
              />
            </div>
          )}
          {!(isIOS && selectedType === 'pdf') && (
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all duration-200 flex items-center justify-center rounded-lg">
              <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-white/90 rounded-full p-2.5 shadow">
                <ZoomIn className="h-5 w-5 text-gray-800" />
              </div>
            </div>
          )}
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

export default InteractiveDocumentViewer;
