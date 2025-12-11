// Central helpers for station type and labels
// These utilities normalize SDD data coming from different shapes

export type StationBaseType = 'PS' | 'PSS' | 'Sèche' | 'Procédure';

// Minimal shape used by helpers; accepts any object with these optional keys
type StationLike = {
  sdd_type?: string | null;
  Type_de_station?: string | null;
  type_de_station?: string | null;
};

// Normalize a raw type string to one of the base station types
export const getStationType = (sdd: StationLike): StationBaseType => {
  const raw = (sdd?.sdd_type || sdd?.Type_de_station || sdd?.type_de_station || '').toString();
  if (/\bPSS\b/i.test(raw)) return 'PSS';
  if (/\bPS\b/i.test(raw)) return 'PS';
  if (/Sèche|Document\(s\)/i.test(raw)) return 'Sèche';
  if (/Procédure/i.test(raw)) return 'Procédure';
  // Default to PS if unknown
  return 'PS';
};

// Human-friendly label for UI badges
// Maps document-like stations to a consistent 'Documents' label
export const deriveTypeLabel = (sdd: StationLike): 'PS' | 'PSS' | 'Documents' | 'Procédure' => {
  const type = getStationType(sdd);
  if (type === 'Sèche') return 'Documents';
  return type;
};

// Predicate: is this station a document-based ("sèche") station?
export const isDocumentStation = (sdd: StationLike): boolean => {
  const type = getStationType(sdd);
  return type === 'Sèche';
};

