
import { SearchInput } from "@/shared/components/ui/input-premium";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { Badge } from "@/shared/components/ui/badge-premium";
import { Filter } from "lucide-react";

interface CaseFiltersProps {
  onSearchChange: (search: string) => void;
  onStatusFilter: (status: string) => void;
  onTypeFilter: (type: string) => void;
  onSpecialiteFilter: (specialite: string) => void;
  searchValue: string;
  statusFilter: string;
  typeFilter: string;
  specialiteFilter: string;
  availableSpecialites: string[];
}

const CaseFilters = ({ 
  onSearchChange, 
  onStatusFilter, 
  onTypeFilter,
  onSpecialiteFilter,
  searchValue,
  statusFilter,
  typeFilter,
  specialiteFilter,
  availableSpecialites
}: CaseFiltersProps) => {
  return (
    <div className="bg-surface p-4 rounded-lg border border-border mb-6 space-y-4">
      <div className="flex items-center space-x-2 mb-4">
        <Filter className="h-4 w-4 text-subtext" />
        <h3 className="font-medium text-text">Filtres</h3>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Barre de recherche */}
        <SearchInput
          placeholder="Rechercher par titre ou numéro SDD..."
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
        />

        {/* Filtre statut */}
        <Select value={statusFilter} onValueChange={onStatusFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous</SelectItem>
            <SelectItem value="done">Fait</SelectItem>
            <SelectItem value="todo">Non fait</SelectItem>
          </SelectContent>
        </Select>

        {/* Filtre type */}
        <Select value={typeFilter} onValueChange={onTypeFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous</SelectItem>
            <SelectItem value="ps">PS (Patient Standardisé)</SelectItem>
            <SelectItem value="pss">PSS (Professionnel de Santé Standardisé)</SelectItem>
            <SelectItem value="seche">Sèche (Analyse document médical)</SelectItem>
            <SelectItem value="procedure">Procédure</SelectItem>
          </SelectContent>
        </Select>

        {/* Filtre spécialité */}
        <Select value={specialiteFilter} onValueChange={onSpecialiteFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Spécialité" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes</SelectItem>
            {availableSpecialites.map((specialite) => (
              <SelectItem key={specialite} value={specialite}>
                {specialite}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Affichage des filtres actifs */}
      {(searchValue || statusFilter !== "all" || typeFilter !== "all" || specialiteFilter !== "all") && (
        <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
          {searchValue && (
            <Badge variant="secondary" className="flex items-center gap-1">
              Recherche: "{searchValue}"
              <button 
                onClick={() => onSearchChange("")}
                className="ml-1 hover:bg-black hover:bg-opacity-10 rounded-full p-0.5 transition-colors"
              >
                ×
              </button>
            </Badge>
          )}
          {statusFilter !== "all" && (
            <Badge variant="secondary" className="flex items-center gap-1">
              Statut: {statusFilter === "done" ? "Fait" : "Non fait"}
              <button 
                onClick={() => onStatusFilter("all")}
                className="ml-1 hover:bg-black hover:bg-opacity-10 rounded-full p-0.5 transition-colors"
              >
                ×
              </button>
            </Badge>
          )}
          {typeFilter !== "all" && (
            <Badge variant="secondary" className="flex items-center gap-1">
              Type: {
                typeFilter === "ps" ? "PS" : 
                typeFilter === "pss" ? "PSS" : 
                typeFilter === "seche" ? "Sèche" : 
                typeFilter === "procedure" ? "Procédure" : 
                "Autre"
              }
              <button 
                onClick={() => onTypeFilter("all")}
                className="ml-1 hover:bg-black hover:bg-opacity-10 rounded-full p-0.5 transition-colors"
              >
                ×
              </button>
            </Badge>
          )}
          {specialiteFilter !== "all" && (
            <Badge variant="secondary" className="flex items-center gap-1">
              Spécialité: {specialiteFilter}
              <button 
                onClick={() => onSpecialiteFilter("all")}
                className="ml-1 hover:bg-black hover:bg-opacity-10 rounded-full p-0.5 transition-colors"
              >
                ×
              </button>
            </Badge>
          )}
        </div>
      )}
    </div>
  );
};

export default CaseFilters;
