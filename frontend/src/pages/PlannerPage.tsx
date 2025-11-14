import { useEffect, useState } from "react";
import PlannerList from "@/components/exam/PlannerList";
import PlannerDetail from "@/components/exam/PlannerDetail";
import { Card } from "@/components/ui/card";
import ErrorBoundary from "@/components/shared/ErrorBoundary";

export default function PlannerPage() {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return <Card className="p-6 text-sm text-muted-foreground">Lade…</Card>;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 p-4">
      <div className="lg:col-span-1">
        <ErrorBoundary>
          <PlannerList onSelect={setSelectedId} selectedId={selectedId} />
        </ErrorBoundary>
      </div>
      <div className="lg:col-span-2">
        <ErrorBoundary>
          {selectedId ? (
            <PlannerDetail pruefungstagId={selectedId} />
          ) : (
            <Card className="p-6 text-sm text-muted-foreground">
              Bitte links einen Prüfungstag auswählen oder neu anlegen.
            </Card>
          )}
        </ErrorBoundary>
      </div>
    </div>
  );
}
