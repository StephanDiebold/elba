// src/components/exam/PlannerList.tsx

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  listExamDays,
  createExamDay,
  type ExamDay,
  type ExamDayCreate,
} from "@/lib/api/planner.api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function PlannerList() {
  const [examDays, setExamDays] = useState<ExamDay[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [form, setForm] = useState<{
    date: string;
    org_unit_id: string;
    subject_id: string;
    time_scheme_id: string;
    location: string;
    default_room: string;
  }>({
    date: "",
    org_unit_id: "",
    subject_id: "",
    time_scheme_id: "",
    location: "",
    default_room: "",
  });

  const navigate = useNavigate();

  // --- Liste laden ---
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);
        const data = await listExamDays();
        if (!cancelled) {
          setExamDays(data);
        }
      } catch (err) {
        console.error("Fehler beim Laden der Prüfungstage:", err);
        if (!cancelled) {
          setError("Die Prüfungstage konnten nicht geladen werden.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // --- Formular-Handler ---
  const handleChange =
    (field: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setForm((prev) => ({
        ...prev,
        [field]: e.target.value,
      }));
    };

  const handleCreate = async () => {
    setCreateError(null);

    const missing: string[] = [];
    if (!form.date) missing.push("Datum");
    if (!form.org_unit_id) missing.push("OrgUnit-ID");
    if (!form.subject_id) missing.push("Fach-ID");
    if (!form.time_scheme_id) missing.push("Zeitschema-ID");

    if (missing.length) {
      setCreateError(
        "Bitte folgende Felder ausfüllen: " + missing.join(", ")
      );
      return;
    }

    const payload: ExamDayCreate = {
      date: form.date,
      org_unit_id: Number(form.org_unit_id),
      subject_id: Number(form.subject_id),
      time_scheme_id: Number(form.time_scheme_id),
      location: form.location || null,
      default_room: form.default_room || null,
      status: "planned",
      is_active: true,
    };

    try {
      setCreating(true);
      const created = await createExamDay(payload);

      // Liste aktualisieren (sortiert nach Datum)
      setExamDays((prev) =>
        [...prev, created].sort((a, b) =>
          a.date === b.date
            ? a.exam_day_id - b.exam_day_id
            : a.date.localeCompare(b.date)
        )
      );

      // Dialog schließen und Formular zurücksetzen
      setForm({
        date: "",
        org_unit_id: "",
        subject_id: "",
        time_scheme_id: "",
        location: "",
        default_room: "",
      });
      setCreateOpen(false);
    } catch (err) {
      console.error("Fehler beim Anlegen eines Prüfungstags:", err);
      setCreateError("Der Prüfungstag konnte nicht angelegt werden.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      {/* Kopfbereich */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide">
            Planung
          </p>
          <h1 className="text-xl font-semibold">Prüfungstage</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Übersicht aller angelegten Prüfungstage. Hier kannst du
            Ausschüsse, Slots und Prüfungen pro Tag planen.
          </p>
        </div>

        {/* Button – Neuer Prüfungstag (Dialog) */}
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm">+ Neuer Prüfungstag</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Neuen Prüfungstag anlegen</DialogTitle>
            </DialogHeader>

            <div className="space-y-3 py-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="date">Datum</Label>
                  <Input
                    id="date"
                    type="date"
                    value={form.date}
                    onChange={handleChange("date")}
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="org_unit_id">OrgUnit-ID</Label>
                  <Input
                    id="org_unit_id"
                    type="number"
                    value={form.org_unit_id}
                    onChange={handleChange("org_unit_id")}
                    placeholder="z. B. 1"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="subject_id">Fach-ID (subject_id)</Label>
                  <Input
                    id="subject_id"
                    type="number"
                    value={form.subject_id}
                    onChange={handleChange("subject_id")}
                    placeholder="z. B. 1"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="time_scheme_id">Zeitschema-ID</Label>
                  <Input
                    id="time_scheme_id"
                    type="number"
                    value={form.time_scheme_id}
                    onChange={handleChange("time_scheme_id")}
                    placeholder="z. B. 1"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="location">Ort</Label>
                <Input
                  id="location"
                  value={form.location}
                  onChange={handleChange("location")}
                  placeholder="z. B. IHK Stuttgart"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="default_room">Standardraum</Label>
                <Input
                  id="default_room"
                  value={form.default_room}
                  onChange={handleChange("default_room")}
                  placeholder="z. B. Raum 101"
                />
              </div>

              {createError && (
                <p className="text-sm text-red-600">{createError}</p>
              )}
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCreateOpen(false)}
                disabled={creating}
              >
                Abbrechen
              </Button>
              <Button
                size="sm"
                onClick={handleCreate}
                disabled={creating}
              >
                {creating ? "Speichern …" : "Speichern"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Inhalt */}
      {loading && (
        <div className="text-sm text-muted-foreground">
          Prüfungstage werden geladen …
        </div>
      )}

      {error && (
        <div className="text-sm text-red-600 mb-3">{error}</div>
      )}

      {!loading && !error && examDays.length === 0 && (
        <div className="text-sm text-muted-foreground">
          Es sind noch keine Prüfungstage angelegt.
        </div>
      )}

      {!loading && !error && examDays.length > 0 && (
        <div className="border rounded-md overflow-hidden bg-white">
          <table className="w-full text-sm">
            <thead className="bg-muted/60">
              <tr className="text-left">
                <th className="px-3 py-2 border-b">ID</th>
                <th className="px-3 py-2 border-b">Datum</th>
                <th className="px-3 py-2 border-b">Ort</th>
                <th className="px-3 py-2 border-b">Standardraum</th>
                <th className="px-3 py-2 border-b">OrgUnit-ID</th>
                <th className="px-3 py-2 border-b">Fach-ID</th>
                <th className="px-3 py-2 border-b">Status</th>
                <th className="px-3 py-2 border-b text-right">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {examDays.map((day) => (
                <tr key={day.exam_day_id} className="hover:bg-muted/40">
                  <td className="px-3 py-2 border-b">{day.exam_day_id}</td>
                  <td className="px-3 py-2 border-b">{day.date}</td>
                  <td className="px-3 py-2 border-b">
                    {day.location || (
                      <span className="text-muted-foreground">–</span>
                    )}
                  </td>
                  <td className="px-3 py-2 border-b">
                    {day.default_room || (
                      <span className="text-muted-foreground">–</span>
                    )}
                  </td>
                  <td className="px-3 py-2 border-b">{day.org_unit_id}</td>
                  <td className="px-3 py-2 border-b">{day.subject_id}</td>
                  <td className="px-3 py-2 border-b">
                    <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs">
                      {day.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 border-b text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        navigate(`/pruefungstage/${day.exam_day_id}`)
                      }
                    >
                      Details
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
// End of src/components/exam/PlannerList.tsx