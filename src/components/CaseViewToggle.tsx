
import { Button } from "@/shared/components/ui/button-premium";
import { Grid3X3, List } from "lucide-react";

interface CaseViewToggleProps {
  viewMode: 'grid' | 'list';
  onViewChange: (mode: 'grid' | 'list') => void;
}

const CaseViewToggle = ({ viewMode, onViewChange }: CaseViewToggleProps) => {
  return (
    <div className="flex items-center space-x-2 bg-surface-alt rounded-lg p-1 border border-border">
      <Button
        variant={viewMode === 'grid' ? 'primary' : 'ghost'}
        size="sm"
        onClick={() => onViewChange('grid')}
        className="h-8"
      >
        <Grid3X3 className="h-4 w-4 mr-1" />
        Grille
      </Button>
      <Button
        variant={viewMode === 'list' ? 'primary' : 'ghost'}
        size="sm"
        onClick={() => onViewChange('list')}
        className="h-8"
      >
        <List className="h-4 w-4 mr-1" />
        Liste
      </Button>
    </div>
  );
};

export default CaseViewToggle;
