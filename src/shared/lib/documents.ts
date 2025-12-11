import { CaseData } from "@/features/station/types/sdd.types";

export type DocumentLink = { url: string; name?: string };

// Extracts document links from a case data object, handling both individual
// URL fields and a JSON-encoded aggregate field. Removes duplicates by URL.
export const extractDocuments = (caseData: CaseData): DocumentLink[] => {
  if (!caseData) return [];

  // Explicit opt-out flags
  if (caseData.has_documents === false || caseData.include_documents === false) {
    return [];
  }

  const results: DocumentLink[] = [];

  // Individual fields 1..5
  const fields = [
    'lien_document_externe_1',
    'lien_document_externe_2',
    'lien_document_externe_3',
    'lien_document_externe_4',
    'lien_document_externe_5',
  ];

  fields.forEach((field, idx) => {
    const url = caseData?.[field];
    if (typeof url === 'string' && url.trim() !== '') {
      results.push({ url, name: `Document ${idx + 1}` });
    }
  });

  // Aggregate field: can be JSON array, JSON object, or plain string URL
  const ext = caseData?.liens_documents_externes;
  if (ext) {
    try {
      const parsed = typeof ext === 'string' ? JSON.parse(ext) : ext;
      if (Array.isArray(parsed)) {
        parsed.forEach((doc) => {
          if (doc && typeof doc.url === 'string' && doc.url.trim() !== '') {
            results.push({ url: doc.url, name: doc.name || doc.nom });
          }
        });
      } else if (parsed && typeof parsed === 'object' && typeof parsed.url === 'string') {
        results.push({ url: parsed.url, name: parsed.name || parsed.nom });
      }
    } catch {
      if (typeof ext === 'string' && ext.trim() !== '') {
        results.push({ url: ext, name: 'Document externe' });
      }
    }
  }

  // Deduplicate by URL
  const deduped = results.filter((doc, i, arr) => arr.findIndex((d) => d.url === doc.url) === i);
  return deduped;
};

