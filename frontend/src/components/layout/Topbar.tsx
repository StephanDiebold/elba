import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, ChevronDown } from "lucide-react";
import { useDebouncedValue } from "@/components/shared/useDebouncedValue";

export type TopbarProps = {
  placeholder?: string;
  onSearch?: (q: string) => void;
  filters?: { label: string; value: string }[];
  currentFilter?: string;
  onFilterChange?: (value: string) => void;
  onNew?: () => void;
  rightSlot?: React.ReactNode; // z. B. Theme Toggle
};

export default function Topbar({
  placeholder = "Suche…",
  onSearch,
  filters = [],
  currentFilter,
  onFilterChange,
  onNew,
  rightSlot,
}: TopbarProps) {
  const [q, setQ] = useState("");
  const debounced = useDebouncedValue(q, 300);

  useEffect(() => {
    onSearch?.(debounced);
    // absichtlich ohne onSearch als Dependency, damit kein Reset bei jedem Render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  const current = filters.find((f) => f.value === currentFilter) ?? filters[0];

  return (
    <div className="flex flex-wrap items-center gap-3 w-full">
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={placeholder}
        className="max-w-lg"
        aria-label="Suche"
      />

      {filters.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="gap-2">
              {current?.label ?? "Filter"}
              <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuLabel>Filter</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {filters.map((f) => (
              <DropdownMenuItem key={f.value} onClick={() => onFilterChange?.(f.value)}>
                {f.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <div className="ml-auto flex flex-wrap items-center gap-2">
        {rightSlot}
        {onNew && (
          <Button onClick={onNew} className="gap-2">
            <Plus className="h-4 w-4" /> Neu
          </Button>
        )}
      </div>
    </div>
  );
}
