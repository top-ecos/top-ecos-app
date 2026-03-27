import { useState, useEffect } from 'react';
import { File, Image as ImageIcon, ExternalLink } from 'lucide-react';
import { extractDocuments, type DocumentLink } from '@/shared/lib/documents';
import { CaseData } from '@/features/station/types/sdd.types';

interface DocumentViewerProps {
  caseData: CaseData;
}

/**
 * Detect iOS / iPadOS where iframe PDF rendering is not supported.
 * Chrome on iPad also uses WebKit (Apple policy), so it's affected too.
 */
const getIsIOSorIPadOS = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  // iPhone / iPod
  if (/iPhone|iPod/.test(ua)) return true;
  // iPad (old UA string)
  if (/iPad/.test(ua)) return true;
  // iPadOS 13+ reports as Mac but has touch support
  if (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) return true;
  return false;
};

const DocumentViewer = ({ caseData }: DocumentViewerProps) => {
  const documents = extractDocuments(caseData);
  const [selectedDocumentIndex, setSelectedDocumentIndex] = useState<number>(0);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    setIsIOS(getIsIOSorIPadOS());
  }, []);

  const selectedDocument = documents[selectedDocumentIndex];

  const getFileType = (url: string): 'pdf' | 'image' => {
    try {
      const clean = url.split('#')[0].split('?')[0];
      const ext = clean.split('.').pop()?.toLowerCase();
      if (ext === 'pdf') return 'pdf';
      if (ext && ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'svg'].includes(ext)) return 'image';
    } catch {}
    return url.toLowerCase().includes('pdf') ? 'pdf' : 'image';
  };

  const handleDocumentSelect = (index: number) => {
    setSelectedDocumentIndex(index);
  };

  const getFileIcon = (type: 'pdf' | 'image') => {
    if (type === 'image') {
      return <ImageIcon className="h-4 w-4 text-blue-500" />;
    }
    return <File className="h-4 w-4 text-red-500" />;
  };

  const formatFileName = (doc: DocumentLink, index: number) => {
    if (doc.name && doc.name !== '') {
      return doc.name;
    }
    const type = getFileType(doc.url);
    const label = type === 'pdf' ? 'Document médical' : 'Image médicale';
    return `${label} ${index + 1}`;
  };

  /**
   * Open a document URL in the current tab (same behavior as before for "zoom").
   */
  const handleOpenDocument = (url: string) => {
    const w = window.open(url, '_blank', 'noopener,noreferrer');
    if (w) w.opener = null;
  };

  if (documents.length === 0) {
    return null;
  }

  const fileType = getFileType(selectedDocument.url);

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 flex flex-col gap-5 h-full">
      {/* Header section */}
      <div>
        <h2 className="text-lg font-bold text-gray-800 flex items-center">
          {getFileIcon(fileType)}
          <span className="ml-2">{formatFileName(selectedDocument, selectedDocumentIndex)}</span>
        </h2>
        <p className="text-sm text-gray-500">
          {fileType === 'image' ? 'Cliquer sur le document pour zoomer' : 'Cliquer sur le document pour l\'ouvrir en plein écran'}
        </p>
      </div>

      {/* Document display area */}
      <div className="flex-shrink-0">
        {fileType === 'image' ? (
          <img
            src={selectedDocument.url}
            alt={formatFileName(selectedDocument, selectedDocumentIndex)}
            className="w-full h-auto rounded-lg object-contain border border-gray-200 cursor-pointer hover:shadow-md transition-shadow duration-200"
            onClick={() => handleOpenDocument(selectedDocument.url)}
          />
        ) : isIOS ? (
          /* ── iOS / iPadOS fallback ──
           * WebKit does not render PDFs inside iframes.
           * Show a clear CTA to open the PDF in the native viewer. */
          <button
            onClick={() => handleOpenDocument(selectedDocument.url)}
            className="w-full border border-gray-200 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors duration-200 cursor-pointer"
          >
            <div className="flex flex-col items-center justify-center py-12 px-6 gap-4">
              <File className="h-12 w-12 text-red-400" />
              <div className="text-center">
                <p className="text-gray-800 font-semibold text-base">
                  {formatFileName(selectedDocument, selectedDocumentIndex)}
                </p>
                <p className="text-gray-500 text-sm mt-1">PDF — Appuie pour ouvrir le document</p>
              </div>
              <div className="inline-flex items-center gap-2 bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm">
                <ExternalLink className="h-4 w-4" />
                Ouvrir le PDF
              </div>
            </div>
          </button>
        ) : (
          /* ── Desktop & Android: iframe with proper settings ──
           * - Removed empty sandbox="" which blocked PDF rendering
           * - Increased height from h-64 (256px) to h-[70vh] for multi-page PDFs
           * - Added #toolbar=1 for PDF navigation controls
           * - Clickable overlay to open in full view */
          <div
            className="w-full border border-gray-200 rounded-lg overflow-hidden bg-gray-50 relative cursor-pointer group"
            style={{ height: '70vh', minHeight: '400px', maxHeight: '800px' }}
            onClick={() => handleOpenDocument(selectedDocument.url)}
          >
            <iframe
              src={`${selectedDocument.url}#toolbar=1&view=FitH`}
              className="w-full h-full rounded-lg pointer-events-auto"
              title={formatFileName(selectedDocument, selectedDocumentIndex)}
              referrerPolicy="no-referrer"
            />
            {/* Hover overlay for "click to zoom" affordance */}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors duration-200 pointer-events-none flex items-end justify-center pb-3 opacity-0 group-hover:opacity-100">
              <div className="bg-white/90 backdrop-blur-sm rounded-full px-3 py-1.5 text-xs text-gray-600 shadow-sm border border-gray-200 flex items-center gap-1.5">
                <ExternalLink className="h-3 w-3" />
                Ouvrir en plein écran
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Spacer to push document selectors to the bottom */}
      <div className="flex-grow"></div>

      {/* List of other documents */}
      {documents.length > 1 && (
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-medium text-gray-700 border-b border-gray-200 pb-2">
            Autres documents ({documents.length - 1})
          </h3>
          {documents.map((doc, index) => {
            if (index === selectedDocumentIndex) return null;
            return (
              <button
                key={index}
                onClick={() => handleDocumentSelect(index)}
                className="w-full text-left bg-white border border-gray-300 rounded-lg p-3 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-150"
              >
                <div className="flex items-center">
                  <div className="mr-3">
                    {getFileIcon(doc.type)}
                  </div>
                  <div className="flex-1">
                    <p className="text-gray-900 font-medium text-sm">
                      {formatFileName(doc, index)}
                    </p>
                    <p className="text-gray-600 text-xs">
                      {getFileType(doc.url) === 'pdf' ? 'PDF' : 'IMAGE'}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default DocumentViewer;
