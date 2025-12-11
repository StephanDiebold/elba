//src/pages/ScheduleListPage.tsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchExamDays, type ExamDay } from "@/lib/api/exam.api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ScheduleListPage() {
  const [days, setDays] = useState<ExamDay[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchExamDays().then(d => { setDays(d); setLoading(false); });
  }, []);

  if (loading) return <div className="p-4">Lädt…</div>;

  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Prüfungstage</h1>
      </div>

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {days.map(d => (
          <Card key={d.pruefungstag_id}>
            <CardHeader>
              <CardTitle>
                {new Date(d.datum).toLocaleDateString()} – {d.ort}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground">
                Start {d.start_time?.slice(0,5)} · max. {d.max_exams} Prüfungen
              </div>
              <div className="mt-3">
                <Button asChild variant="secondary">
                  <Link to={`/admin/schedule/${d.pruefungstag_id}`}>Öffnen</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
