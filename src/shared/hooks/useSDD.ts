// src/hooks/useSDD.ts
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type SDD = {
  id: string;                    // React key
  name: string;                  // from sdd_titre
  description: string;           // from consignes_etudiant
  created_at?: string;           // from sdds.created_at
  sdd_id: string;                // UUID -> string
  sdd_titre: string | null;
  Type_de_station: string | null; // derived from sdd_type
  item_EDN: string | null;        // sdds.item_edn is TEXT
  consignes_etudiant: string | null;
  official_id: string | null;
  specialite: string | null;      // from sdd_specialite
  sdd_type: string | null;        // raw sdd_type value
  include_documents: boolean | null; // for document badge logic
  premium?: boolean | null;       // premium-only station
  ranked?: boolean | null;        // marked as ranked (to exclude from general list)
};

const deriveTypeDeStation = (sdd_type: string | null): string | null => {
  if (!sdd_type) return null;
  // Map the normalized sdds.sdd_type values to the labels your UI used before
  // sdds constraint allows: 'PS', 'PSS', 'Document(s)', 'Procédure'
  switch (sdd_type) {
    case "PS":
      return "PS";
    case "PSS":
      return "PSS";
    case "Procédure":
      return "Procédure";
    case "Document(s)":
      return "Document(s)";
    default:
      return sdd_type; // fallback: show raw value
  }
};

// Bump cache key to avoid serving stale (non-live) cached items
const SDD_CACHE_KEY = 'sddCacheV2';
const SDD_CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

export const useSDD = () => {
  const [sddList, setSddList] = useState<SDD[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefetching, setIsRefetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSDD = useCallback(async (opts?: { withLoading?: boolean }) => {
    try {
      const useLoading = opts?.withLoading !== false;
      if (useLoading) {
        setLoading(true);
      } else {
        setIsRefetching(true);
      }

      // Pull only what the UI needs from public.sdds
      const { data, error } = await supabase
        .from("sdds")
        .select(`
          sdd_id,
          created_at,
          sdd_titre,
          consignes_etudiant,
          sdd_type,
          sdd_specialite,
          official_id,
          item_edn,
          include_documents,
          premium,
          ranked,
          status
        `)
        .eq('status', 'live');

      if (error) throw error;

      const rows = (data ?? []).map((row: any) => {
        const sddId = String(row.sdd_id); // UUID -> string
        const sddType = row?.sdd_type ?? null;
        const premiumFlag = typeof row?.premium === 'boolean'
          ? row.premium
          : (typeof row?.premium === 'string'
              ? ['true', '1', 'yes'].includes(String(row.premium).trim().toLowerCase())
              : (typeof row?.premium === 'number' ? row.premium !== 0 : false));

        return {
          id: sddId,
          sdd_id: sddId,
          created_at: row?.created_at ?? undefined,
          name: row?.sdd_titre ?? `SDD ${sddId.slice(0, 8)}`,
          description: row?.consignes_etudiant ?? "Aucune description disponible",
          sdd_titre: row?.sdd_titre ?? null,
          Type_de_station: deriveTypeDeStation(sddType),
          item_EDN: row?.item_edn ?? null,             // TEXT in sdds
          consignes_etudiant: row?.consignes_etudiant ?? null,
          specialite: row?.sdd_specialite ?? null,
          official_id: row?.official_id ?? null,
          sdd_type: sddType,                           // raw sdd_type value
          include_documents: row?.include_documents ?? null, // for document badge logic
          premium: premiumFlag,
          ranked: typeof row?.ranked === 'boolean' ? row.ranked : (
            typeof row?.ranked === 'string'
              ? ['true', '1', 'yes'].includes(String(row.ranked).trim().toLowerCase())
              : (typeof row?.ranked === 'number' ? row.ranked !== 0 : null)
          ),
        } as SDD;
      });

      setSddList(rows);
      // cache the fresh list
      try { localStorage.setItem(SDD_CACHE_KEY, JSON.stringify({ ts: Date.now(), data: rows })); } catch {}
      setError(null);
    } catch (err: any) {
      console.error("Error fetching SDD:", err);
      setError(err?.message ?? "Une erreur est survenue lors du chargement des SDD.");
      const useLoading = opts?.withLoading !== false;
      if (useLoading) {
        // On cold-load failure, clear list so error empty state can show
        setSddList([]);
      } else {
        // On background refetch failure, keep previous data
      }
    } finally {
      const useLoading = opts?.withLoading !== false;
      if (useLoading) {
        setLoading(false);
      }
      setIsRefetching(false);
    }
  }, []);

  useEffect(() => {
    // Try cache-first for instant load
    let usedCache = false;
    try {
      const raw = localStorage.getItem(SDD_CACHE_KEY);
      if (raw) {
        const obj = JSON.parse(raw);
        if (obj && typeof obj.ts === 'number' && Array.isArray(obj.data)) {
          const isFresh = (Date.now() - obj.ts) < SDD_CACHE_TTL_MS;
          if (isFresh) {
            setSddList(obj.data as SDD[]);
            setLoading(false);
            usedCache = true;
          }
          // If stale, ignore it to avoid flashing outdated SDDs
        }
      }
    } catch {}

    // Always revalidate in background; avoid toggling loading if we had cache
    fetchSDD({ withLoading: usedCache ? false : true });
  }, [fetchSDD]);

  return {
    sddList,
    loading,
    error,
    refetch: fetchSDD,
    isRefetching,
  };
};

export const useSddFiltering = (
  sddList: SDD[],
  // Update your caller to pass a function that accepts a string id now
  isStationCompleted?: (stationId: string | number) => boolean
) => {
  const [filteredSDD, setFilteredSDD] = useState<SDD[]>([]);
  const [searchValue, setSearchValue] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "done" | "todo">("all");
  const [typeFilter, setTypeFilter] = useState<"all" | "ps" | "pss" | "seche" | "procedure" | "documents">("all");
  const [specialiteFilter, setSpecialiteFilter] = useState("all");

  const setStatusFilterWrapper = (value: string) => {
    setStatusFilter(value as "all" | "done" | "todo");
  };

  const setTypeFilterWrapper = (value: string) => {
    setTypeFilter(value as "all" | "ps" | "pss" | "seche" | "procedure" | "documents");
  };

  const applyFilters = useCallback(() => {
    let filtered = [...sddList];

    // Search by title, ids, and EDN (with numeric normalization for SDD official id)
    if (searchValue) {
      const qRaw = searchValue.trim().toLowerCase();
      const normalizeNum = (val: string) => val.replace(/\D/g, '').replace(/^0+/, '');
      const qNum = normalizeNum(qRaw);

      filtered = filtered.filter((sdd) => {
        const name = (sdd.name ?? "").toLowerCase();
        const itemEdn = (sdd.item_EDN ?? "").toLowerCase();
        const officialRaw = (sdd.official_id ?? "").toLowerCase();
        const officialNum = normalizeNum(officialRaw);

        const matchesText =
          name.includes(qRaw) ||
          itemEdn.includes(qRaw) ||
          officialRaw.includes(qRaw);

        const matchesNumber = qNum !== "" && officialNum.includes(qNum);

        return matchesText || matchesNumber;
      });
    }

    // Status (done/todo) via caller-provided completion fn (now expects string)
    if (statusFilter !== "all" && isStationCompleted) {
      filtered = filtered.filter((sdd) => {
        const done = isStationCompleted(sdd.sdd_id);
        return statusFilter === "done" ? done : !done;
      });
    }

    // Type filter mapped to derived Type_de_station
    if (typeFilter !== "all") {
      filtered = filtered.filter((sdd) => {
        const t = sdd.Type_de_station ?? "";
        switch (typeFilter) {
          case "ps":
            return t.includes("PS") && !t.includes("PSS");
          case "pss":
            return t.includes("PSS");
          case "procedure":
            return t.includes("Procédure");
          case "documents":
            return t.includes("Document") || t.includes("Sèche");
          case "seche":
            return t.includes("Document") || t.includes("Sèche");
          default:
            return true;
        }
      });
    }

    // Specialité filter
    if (specialiteFilter !== "all") {
      filtered = filtered.filter((sdd) => sdd.specialite === specialiteFilter);
    }

    setFilteredSDD(filtered);
  }, [sddList, searchValue, statusFilter, typeFilter, specialiteFilter, isStationCompleted]);

  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  const getAvailableSpecialites = useCallback(() => {
    const list = sddList
      .map((s) => s.specialite)
      .filter((v): v is string => !!v && v.trim() !== "");
    return Array.from(new Set(list)).sort((a, b) => a.localeCompare(b, "fr"));
  }, [sddList]);

  return {
    filteredSDD,
    searchValue,
    statusFilter,
    typeFilter,
    specialiteFilter,
    setSearchValue,
    setStatusFilter: setStatusFilterWrapper,
    setTypeFilter: setTypeFilterWrapper,
    setSpecialiteFilter,
    getAvailableSpecialites,
    resetFilters: () => {
      setSearchValue("");
      setStatusFilter("all");
      setTypeFilter("all");
      setSpecialiteFilter("all");
    },
  };
};
