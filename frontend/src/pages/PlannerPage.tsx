import { useEffect, useState } from "react";
import PlannerList from "@/components/exam/PlannerList";
import PlannerDetail from "@/components/exam/PlannerDetail";
import { Card } from "@/components/ui/card";
import ErrorBoundary from "@/components/shared/ErrorBoundary";

export default function PlannerPage() {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <Card className="p-6 text-sm text-muted-foreground">Lade…</Card>;
  }

  return (
    <div className="flex flex-col md:flex-row gap-4 p-4 h-[calc(100vh-4rem)]">
      {/* Linke Spalte: Prüfungstage-Liste */}
      <div className="w-full md:max-w-xs md:flex-shrink-0">
        <ErrorBoundary>
          <PlannerList onSelect={setSelectedId} selectedId={selectedId} />
        </ErrorBoundary>
      </div>

      {/* Rechte Spalte: Detailbereich */}
      <div className="flex-1 min-w-0">
        <ErrorBoundary>
          {selectedId ? (
            <PlannerDetail pruefungstagId={selectedId} />
          ) : (
            <Card className="p-6 text-sm text-muted-foreground h-full flex items-center justify-center text-center">
              Bitte links einen Prüfungstag auswählen oder neu anlegen.
            </Card>
          )}
        </ErrorBoundary>
      </div>
    </div>
  );
}
