// src/pages/ScheduleDetailPage.tsx
import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
  fetchExamDay,
  fetchExamSlots,
  generateSlots,
  clearSlots,
  type ExamDay,
  type ExamSlot,
  ApiError,
} from "@/lib/api/exam.api";
import { generateExamSlotsPreview } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function ScheduleDetailPage() {
  const { dayId } = useParams();
  const id = Number(dayId);

  const [day, setDay] = useState<ExamDay | null>(null);
  const [slots, setSlots] = useState<ExamSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [clearing, setClearing] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      const [d, s] = await Promise.all([fetchExamDay(id), fetchExamSlots(id)]);
      setDay(d);
      setSlots(s);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const cfg = useMemo(
    () =>
      day && {
        date: new Date(day.datum).toISOString().slice(0, 10),
        startTime: day.start_time.slice(0, 5),
        examMinutes: day.exam_minutes,
        debriefMinutes: day.debrief_minutes,
        breakStart: day.break_start.slice(0, 5),
        breakEnd: day.break_end.slice(0, 5),
        maxExams: day.max_exams,
      },
    [day]
  );

  const preview = useMemo(
    () => (cfg ? generateExamSlotsPreview(cfg) : []),
    [cfg]
  );

  const hasExisting = slots.length > 0;

  async function onGenerate() {
    setGenerating(true);
    try {
      await generateSlots(id);
      await refresh();
      toast.success("Slots wurden erzeugt.");
    } catch (e: any) {
      if (e instanceof ApiError && e.status === 409) {
        toast.warning(
          "Für diesen Prüfungstag existieren bereits Prüfungen. Bitte löschen Sie diese zuerst."
        );
      } else {
        toast.error("Fehler beim Generieren der Slots.");
        console.error(e);
      }
    } finally {
      setGenerating(false);
    }
  }

  async function onClearAll() {
    if (!hasExisting) return;
    const ok = window.confirm(
      "Alle Prüfungen für diesen Tag löschen? Dies kann nicht rückgängig gemacht werden."
    );
    if (!ok) return;

    setClearing(true);
    try {
      const res = await clearSlots(id);
      toast.success(`Gelöscht: ${res.deleted} Prüfungen.`);
      await refresh();
    } catch (e) {
      toast.error("Löschen fehlgeschlagen.");
      console.error(e);
    } finally {
      setClearing(false);
    }
  }

  if (loading || !day) return <div className="p-4">Lädt…</div>;

  return (
    <div className="p-4 space-y-6">
      <h1 className="text-2xl font-semibold">
        {new Date(day.datum).toLocaleDateString()} – {day.ort}
      </h1>

      <Card>
        <CardHeader>
          <CardTitle>Zeitschema</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <Label>Start</Label>
              <Input value={cfg!.startTime} readOnly />
            </div>
            <div>
              <Label>Dauer (min)</Label>
              <Input value={cfg!.examMinutes} readOnly />
            </div>
            <div>
              <Label>Besprechung (min)</Label>
              <Input value={cfg!.debriefMinutes} readOnly />
            </div>
            <div>
              <Label>Pause von</Label>
              <Input value={cfg!.breakStart} readOnly />
            </div>
            <div>
              <Label>bis</Label>
              <Input value={cfg!.breakEnd} readOnly />
            </div>
            <div>
              <Label>Max. Prüfungen</Label>
              <Input value={cfg!.maxExams} readOnly />
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2">
            <Button onClick={onGenerate} disabled={generating || hasExisting}>
              {generating ? "Generiere…" : "Slots generieren"}
            </Button>
            <Button
              variant="destructive"
              onClick={onClearAll}
              disabled={clearing || !hasExisting}
            >
              {clearing ? "Lösche…" : "Alle Prüfungen löschen"}
            </Button>
          </div>

          {hasExisting && (
            <p className="mt-2 text-sm text-muted-foreground">
              Es sind bereits Prüfungen vorhanden. Zum erneuten Generieren bitte
              zuerst alle Prüfungen löschen.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Vorschau (lokal)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-2">#</th>
                  <th>Beginn</th>
                  <th>Ende</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((s, i) => (
                  <tr key={i} className="border-b">
                    <td className="py-2">{i + 1}</td>
                    <td>
                      {new Date(s.beginn).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td>
                      {new Date(s.ende).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Prüfungen</CardTitle>
        </CardHeader>
        <CardContent>
          {slots.length === 0 && (
            <div className="text-sm text-muted-foreground">
              Noch keine Prüfungen angelegt.
            </div>
          )}
          {slots.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b">
                    <th className="py-2">#</th>
                    <th>Beginn</th>
                    <th>Ende</th>
                    <th>Kandidat</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {slots.map((e, i) => (
                    <tr key={e.pruefung_id} className="border-b">
                      <td className="py-2">{i + 1}</td>
                      <td>
                        {e.start_at
                          ? new Date(e.start_at).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "-"}
                      </td>
                      <td>
                        {e.end_at
                          ? new Date(e.end_at).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "-"}
                      </td>
                      <td>{e.kandidat_name ?? "-"}</td>
                      <td>{e.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
