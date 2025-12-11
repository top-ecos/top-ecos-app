import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/shared/components/ui/card-premium";
import { ChevronLeft, FileText, Maximize2, Minimize2, ExternalLink, Download, ZoomIn, ZoomOut, ChevronRight, X, File, Image as ImageIcon } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/shared/components/ui/tabs";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";

interface Document {
  url: string;
  type: 'pdf' | 'jpg' | 'jpeg' | 'png';
  nom: string;
}

interface ConsignesPanelProps {
  caseData: any;
  onLayoutChange?: (width: number) => void;
  onExpandedChange?: (isExpanded: boolean) => void;
  onCollapse?: () => void;
}

const ConsignesPanel = ({
  caseData,
  onLayoutChange,
  onExpandedChange,
  onCollapse
}: ConsignesPanelProps) => {
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [documentZoom, setDocumentZoom] = useState(100);
  const [currentDocumentIndex, setCurrentDocumentIndex] = useState(0);

  // Safety check - if no caseData, don't render
  if (!caseData) {
    return null;
  }

  // Extract documents from caseData
  const getDocuments = useCallback((): Document[] => {
    const documents: Document[] = [];
    
    // First check if this SDD has documents
    // Check both has_documents and include_documents (field name might vary)
    const hasDocumentsFlag = caseData.has_documents || caseData.include_documents;
    
    if (hasDocumentsFlag === false) {
      return documents; // Return empty array if no documents flag
    }
    
    // Check for individual document fields (corrected field names based on schema)
    const documentFields = [
      'lien_document_externe_1',
      'lien_document_externe_2', 
      'lien_document_externe_3',
      'lien_document_externe_4',
      'lien_document_externe_5'
    ];

    documentFields.forEach((field, index) => {
      const url = caseData[field];
      
      if (url && url.trim() !== '') {
        const extension = url.split('.').pop()?.toLowerCase() || '';
        const type = (['jpg', 'jpeg', 'png'].includes(extension) ? extension : 'pdf') as 'pdf' | 'jpg' | 'jpeg' | 'png';
        documents.push({
          url: url,
          type: type,
          nom: `Document ${index + 1}.${extension}`
        });
      }
    });

    // Also check for liens_documents_externes JSON field (existing format for backward compatibility)
    if (caseData.liens_documents_externes) {
      try {
        const parsedDoc = JSON.parse(caseData.liens_documents_externes);
        if (parsedDoc.url && parsedDoc.nom) {
          documents.push({
            url: parsedDoc.url,
            type: parsedDoc.type || 'pdf',
            nom: parsedDoc.nom
          });
        }
      } catch (e) {
        // If not JSON, treat as direct URL
        if (typeof caseData.liens_documents_externes === 'string' && caseData.liens_documents_externes.trim() !== '') {
          const url = caseData.liens_documents_externes;
          const extension = url.split('.').pop()?.toLowerCase() || '';
          const type = ['jpg', 'jpeg', 'png'].includes(extension) ? extension as 'jpg' | 'jpeg' | 'png' : 'pdf';
          documents.push({
            url: url,
            type: type,
            nom: `Document externe.${extension}`
          });
        }
      }
    }

    return documents;
  }, [caseData]);

  const documents = getDocuments();

  // Marquer comme vu quand l'utilisateur ouvre le volet
  const handleExpandConsignes = () => {
    setIsCollapsed(false);
    // Marquer comme vu dans localStorage pour que l'indicateur disparaisse définitivement
    if (caseData?.sdd_id) {
      localStorage.setItem(`hasSeenConsignes_${caseData.sdd_id}`, 'true');
    }
  };

  // Fonction pour fermer le panel
  const handleCollapse = useCallback(() => {
    setIsCollapsed(true);
    onCollapse?.();
  }, [onCollapse]);

  // Notifier le parent des changements de largeur
  useEffect(() => {
    const width = isCollapsed ? 64 : isExpanded ? 576 : 448;
    onLayoutChange?.(width);
  }, [isCollapsed, isExpanded, onLayoutChange]);

  // Notifier le parent des changements d'expansion
  useEffect(() => {
    onExpandedChange?.(isExpanded);
  }, [isExpanded, onExpandedChange]);

  // Document viewer functions
  const openDocument = (doc: Document, index: number) => {
    setSelectedDocument(doc);
    setCurrentDocumentIndex(index);
    setDocumentZoom(100);
  };

  const closeDocumentViewer = () => {
    setSelectedDocument(null);
    setDocumentZoom(100);
  };

  const navigateDocument = (direction: 'prev' | 'next') => {
    if (documents.length <= 1) return;
    
    let newIndex: number;
    if (direction === 'prev') {
      newIndex = currentDocumentIndex > 0 ? currentDocumentIndex - 1 : documents.length - 1;
    } else {
      newIndex = currentDocumentIndex < documents.length - 1 ? currentDocumentIndex + 1 : 0;
    }
    
    setCurrentDocumentIndex(newIndex);
    setSelectedDocument(documents[newIndex]);
  };

  const adjustZoom = (direction: 'in' | 'out') => {
    setDocumentZoom(prev => {
      if (direction === 'in') {
        return Math.min(prev + 25, 200);
      } else {
        return Math.max(prev - 25, 50);
      }
    });
  };

  const getFileIcon = (type: string) => {
    if (['jpg', 'jpeg', 'png'].includes(type)) {
      return <ImageIcon className="h-4 w-4 text-blue-500" />;
    }
    return <File className="h-4 w-4 text-red-500" />;
  };

  const formatFileName = (doc: Document, index: number) => {
    if (doc.nom && doc.nom !== '') {
      return doc.nom;
    }
    // Generate a descriptive name based on context
    const today = new Date().toLocaleDateString('fr-FR');
    const fileTypes: { [key: string]: string } = {
      pdf: 'Document médical',
      jpg: 'Image médicale',
      jpeg: 'Image médicale', 
      png: 'Image médicale'
    };
    return `${fileTypes[doc.type] || 'Document'} ${index + 1} du ${today}`;
  };

  // Vérifier si c'est une station avec documents externes (avec fallback)
  const hasExternalDocuments = documents.length > 0;
  const isStationSeche = (caseData?.Type_de_station || caseData?.type_de_station)?.includes('Sèche');
  
  return (
    <>
      {/* Panel normal */}
      <div className={`fixed left-0 top-0 bottom-0 bg-surface-alt border-r-2 border-border shadow-2xl transition-all duration-300 z-50 ${isCollapsed ? 'w-16' : isExpanded ? 'w-[36rem]' : 'w-[28rem]'}`}>
        {isCollapsed ? (
          <div className="p-2 pt-20 relative flex flex-col items-center">
            <button 
              onClick={handleExpandConsignes} 
              className="w-12 h-12 bg-surface hover:bg-surface-alt border border-border rounded-lg flex items-center justify-center transition-colors duration-200 shadow-lg"
              title="Ouvrir le dossier patient"
            >
              <FileText className="h-6 w-6 text-accent" />
            </button>
          </div>
        ) : (
          <div className="h-full flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-border bg-surface">
              <h3 className="font-semibold text-text flex items-center text-lg">
                <FileText className="h-5 w-5 mr-3 text-accent" />
                Dossier Patient
              </h3>
              <div className="flex items-center space-x-2">
                <button 
                  onClick={handleCollapse} 
                  className="w-8 h-8 bg-surface-alt hover:bg-surface rounded-lg flex items-center justify-center transition-colors duration-200"
                  title="Fermer le dossier patient"
                >
                  <ChevronLeft className="h-4 w-4 text-text" />
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto">
              <Tabs defaultValue="consignes" className="h-full">
                <TabsList className={`grid w-full m-4 ${(caseData.has_documents || caseData.include_documents) ? 'grid-cols-2' : 'grid-cols-1'}`}>
                  <TabsTrigger value="consignes">Consignes</TabsTrigger>
                  {(caseData.has_documents || caseData.include_documents) && (
                    <TabsTrigger value="documents" className="relative">
                      Documents
                      {hasExternalDocuments && (
                        <Badge variant="secondary" className="ml-2 h-5 text-xs">
                          {documents.length}
                        </Badge>
                      )}
                    </TabsTrigger>
                  )}
                </TabsList>

                <TabsContent value="consignes" className="px-6 pb-4 mt-0">
                  <Card className="border-0 shadow-none bg-transparent">
                    <CardContent className="px-0">
                      <div className="space-y-6">
                        <div>
                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <p className="text-blue-800 whitespace-pre-line leading-relaxed text-sm">
                              {caseData?.consignes_etudiant || 'Consignes non disponibles pour cette station.'}
                            </p>
                          </div>
                        </div>
                        
                        {/* Document externe pour stations sèches (compatibilité rétrograde) */}
                        {hasExternalDocuments && isStationSeche && caseData.liens_documents_externes && (
                          <div>
                            <div className="flex items-center justify-between mb-3">
                              <h5 className="font-medium text-text flex items-center">
                                <ExternalLink className="h-4 w-4 mr-2 text-accent" />
                                Document à analyser
                              </h5>
                              <button 
                                onClick={() => setIsExpanded(true)}
                                className="px-2 py-1 bg-surface hover:bg-surface-alt text-subtext text-xs rounded flex items-center transition-colors duration-200"
                                title="Agrandir le document"
                              >
                                <Maximize2 className="h-3 w-3 mr-1" />
                                Agrandir
                              </button>
                            </div>
                            <div className="border border-border rounded-lg overflow-hidden bg-surface">
                              <iframe
                                src={typeof caseData.liens_documents_externes === 'string' ? caseData.liens_documents_externes : JSON.parse(caseData.liens_documents_externes).url}
                                className="w-full h-48"
                                title="Document médical à analyser"
                                sandbox=""
                                referrerPolicy="no-referrer"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {(caseData.has_documents || caseData.include_documents) && (
                  <TabsContent value="documents" className="px-6 pb-4 mt-0">
                    {hasExternalDocuments ? (
                      <div className="space-y-3">
                        {documents.map((doc, index) => (
                          <div
                            key={index}
                            className="flex items-center p-3 bg-surface border border-border rounded-lg hover:bg-surface-alt cursor-pointer transition-colors duration-200"
                            onClick={() => openDocument(doc, index)}
                          >
                            <div className="mr-3">
                              {getFileIcon(doc.type)}
                            </div>
                            <div className="flex-1">
                              <p className="text-text font-medium text-sm">
                                {formatFileName(doc, index)}
                              </p>
                              <p className="text-subtext text-xs">
                                {doc.type.toUpperCase()}
                              </p>
                            </div>
                            <ChevronRight className="h-4 w-4 text-subtext" />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <File className="h-12 w-12 text-subtext mx-auto mb-4" />
                        <p className="text-subtext">Documents en cours de chargement pour cette station...</p>
                      </div>
                    )}
                  </TabsContent>
                )}
              </Tabs>
            </div>
          </div>
        )}
      </div>

      {/* Modal pleine largeur pour consignes */}
      {isExpanded && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-6">
          <div className="bg-surface rounded-xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden border border-border">
            <div className="flex items-center justify-between p-6 border-b border-border bg-surface-alt">
              <h3 className="text-2xl font-semibold text-text flex items-center">
                <FileText className="h-6 w-6 mr-3 text-accent" />
                Dossier Patient - Station {caseData?.sdd_id || 'N/A'}
              </h3>
              <button 
                onClick={() => setIsExpanded(false)} 
                className="w-8 h-8 bg-surface-alt hover:bg-surface rounded-lg flex items-center justify-center transition-colors duration-200"
                title="Fermer le mode plein écran"
              >
                <Minimize2 className="h-5 w-5 text-text" />
              </button>
            </div>
            <div className="p-8 overflow-y-auto max-h-[calc(90vh-100px)]">
              <div className="space-y-8">
                <div>
                  <h4 className="font-semibold text-text mb-4 text-xl">Consignes :</h4>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                    <p className="text-blue-800 whitespace-pre-line text-lg leading-relaxed">
                      {caseData?.consignes_etudiant || 'Consignes non disponibles pour cette station.'}
                    </p>
                  </div>
                </div>
                
                {/* Document externe agrandi pour stations sèches */}
                {hasExternalDocuments && isStationSeche && caseData.liens_documents_externes && (
                  <div className="pt-4 border-t border-border">
                    <h4 className="font-semibold text-text mb-4 text-xl flex items-center">
                      <ExternalLink className="h-5 w-5 mr-2 text-accent" />
                      Document à analyser
                    </h4>
                    <div className="border border-border rounded-lg overflow-hidden bg-surface">
                      <iframe
                        src={typeof caseData.liens_documents_externes === 'string' ? caseData.liens_documents_externes : JSON.parse(caseData.liens_documents_externes).url}
                        className="w-full h-96"
                        title="Document médical à analyser"
                        sandbox=""
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  </div>
                )}

                <div className="pt-4 border-t border-border">
                  <h4 className="font-semibold text-text mb-4 text-xl">Informations :</h4>
                  <div className="bg-surface-alt rounded-lg p-6 border border-border">
                    <ul className="space-y-3 text-text text-lg">
                      <li className="flex items-center">
                        <span className="w-3 h-3 bg-blue-500 rounded-full mr-4"></span>
                        <span><strong>Durée :</strong> 10 minutes</span>
                      </li>
                      <li className="flex items-center">
                        <span className="w-3 h-3 bg-green-500 rounded-full mr-4"></span>
                        <span><strong>Type :</strong> {caseData?.Type_de_station || caseData?.type_de_station || 'Non spécifié'}</span>
                      </li>
                      <li className="flex items-center">
                        <span className="w-3 h-3 bg-purple-500 rounded-full mr-4"></span>
                        <span><strong>Item EDN :</strong> #{caseData?.item_EDN || caseData?.item_edn || 'Non spécifié'}</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Document Viewer Modal */}
      <Dialog open={!!selectedDocument} onOpenChange={() => closeDocumentViewer()}>
        <DialogContent className="max-w-6xl w-full h-[90vh] p-0">
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border bg-surface-alt">
              <div className="flex items-center space-x-3">
                {selectedDocument && getFileIcon(selectedDocument.type)}
                <div>
                  <DialogTitle className="text-lg font-semibold">
                    {selectedDocument && formatFileName(selectedDocument, currentDocumentIndex)}
                  </DialogTitle>
                  <DialogDescription className="text-sm text-subtext">
                    Document {currentDocumentIndex + 1} sur {documents.length}
                  </DialogDescription>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                {/* Navigation */}
                {documents.length > 1 && (
                  <div className="flex items-center space-x-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigateDocument('prev')}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigateDocument('next')}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
                
                {/* Zoom controls */}
                <div className="flex items-center space-x-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => adjustZoom('out')}
                    disabled={documentZoom <= 50}
                  >
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                  <span className="text-sm text-subtext min-w-[3rem] text-center">
                    {documentZoom}%
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => adjustZoom('in')}
                    disabled={documentZoom >= 200}
                  >
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                </div>

                {/* Download */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (!selectedDocument) return;
                    const w = window.open(selectedDocument.url, '_blank', 'noopener,noreferrer');
                    if (w) w.opener = null;
                  }}
                >
                  <Download className="h-4 w-4" />
                </Button>

                {/* Close */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={closeDocumentViewer}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Document Content */}
            <div className="flex-1 bg-gray-100 flex items-center justify-center overflow-auto">
              {selectedDocument && (
                <div 
                  className="transition-transform duration-200"
                  style={{ transform: `scale(${documentZoom / 100})` }}
                >
                  {['jpg', 'jpeg', 'png'].includes(selectedDocument.type) ? (
                    <img
                      src={selectedDocument.url}
                      alt={formatFileName(selectedDocument, currentDocumentIndex)}
                      className="max-w-none"
                    />
                  ) : (
                    <iframe
                      src={selectedDocument.url}
                      className="w-[800px] h-[600px] border-0"
                      title={formatFileName(selectedDocument, currentDocumentIndex)}
                      sandbox=""
                      referrerPolicy="no-referrer"
                    />
                  )}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ConsignesPanel;
