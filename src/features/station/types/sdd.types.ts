export interface CaseData {
  sdd_id: string;
  sdd_titre?: string | null;
  consignes_etudiant?: string | null;

  // Station type fields (various source shapes)
  sdd_type?: string | null;
  Type_de_station?: string | null;
  type_de_station?: string | null;

  // Metadata
  official_id?: string | null;
  item_edn_name?: string | null;
  item_edn?: string | null;
  station_code?: string | null;
  created_at?: string | null;
  sdd_specialite?: string | null;
  specialite?: string | null;

  // Document flags and links
  include_documents?: boolean | null;
  has_documents?: boolean | null;
  lien_document_externe_1?: string | null;
  lien_document_externe_2?: string | null;
  lien_document_externe_3?: string | null;
  lien_document_externe_4?: string | null;
  lien_document_externe_5?: string | null;
  liens_documents_externes?: unknown;

  // Optional patient info
  [key: string]: unknown;
}

