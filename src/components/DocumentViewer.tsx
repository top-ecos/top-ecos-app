import { useState } from 'react';
import { File, Image as ImageIcon } from 'lucide-react';
import { extractDocuments, type DocumentLink } from '@/shared/lib/documents';
import { CaseData } from '@/features/station/types/sdd.types';

// Define a type for our document data
interface DocumentViewerProps {
  caseData: CaseData;
}

const DocumentViewer = ({ caseData }: DocumentViewerProps) => {
  const documents = extractDocuments(caseData);

  // State to track the currently selected document index. Default to the first document.
  const [selectedDocumentIndex, setSelectedDocumentIndex] = useState<number>(0);

  // Find the selected document
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

  // Handler to change the selected document
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

  // If no documents available, don't render anything
  if (documents.length === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 flex flex-col gap-5 h-full">
      {/* Header section displaying the current document's title */}
      <div>
        <h2 className="text-lg font-bold text-gray-800 flex items-center">
          {getFileIcon(getFileType(selectedDocument.url))}
          <span className="ml-2">{formatFileName(selectedDocument, selectedDocumentIndex)}</span>
        </h2>
        <p className="text-sm text-gray-500">Cliquer sur le document pour zoomer</p>
      </div>

      {/* Document display area */}
      <div className="flex-shrink-0">
        {getFileType(selectedDocument.url) === 'image' ? (
          <img 
            src={selectedDocument.url}
            alt={formatFileName(selectedDocument, selectedDocumentIndex)}
            className="w-full h-auto rounded-lg object-contain border border-gray-200 cursor-pointer hover:shadow-md transition-shadow duration-200"
            onClick={() => {
              const w = window.open(selectedDocument.url, '_blank', 'noopener,noreferrer');
              if (w) w.opener = null;
            }}
          />
        ) : (
          <div className="w-full h-64 border border-gray-200 rounded-lg flex items-center justify-center bg-gray-50">
            <iframe
              src={selectedDocument.url}
              className="w-full h-full rounded-lg"
              title={formatFileName(selectedDocument, selectedDocumentIndex)}
              sandbox=""
              referrerPolicy="no-referrer"
            />
          </div>
        )}
      </div>

      {/* Spacer to push document selectors to the bottom */}
      <div className="flex-grow"></div>

      {/* List of other documents that can be selected */}
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
