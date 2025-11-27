// src/components/exam/PlannerDetail.tsx

import { useEffect, useState } from "react";
import type React from "react";

import {
  getExamDay,
  listExamDayCommittees,
  createExamDayCommittee,
  generateSlotsForCommittee,
  listExamSlots,
  createExam,
  deleteExam
} from "@/lib/api/planner.api";
import type {
  ExamDay,
  ExamDayCommittee,
  ExamDayCommitteeCreate,
  ExamSlot,
  ExamType,
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
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

interface PlannerDetailProps {
  examDayId: number;
}

export default function PlannerDetail({ examDayId }: PlannerDetailProps) {
  const [examDay, setExamDay] = useState<ExamDay | null>(null);
  const [committees, setCommittees] = useState<ExamDayCommittee[]>([]);
  const [slots, setSlots] = useState<ExamSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCommitteeId, setSelectedCommitteeId] = useState<
    number | "all"
  >("all");

  const [committeeDialogOpen, setCommitteeDialogOpen] = useState(false);
  const [committeeForm, setCommitteeForm] = useState<{
    committee_id: string;
    room: string;
    location: string;
    time_scheme_id: string;
  }>({
    committee_id: "",
    room: "",
    location: "",
    time_scheme_id: "",
  });
  const [committeeError, setCommitteeError] = useState<string | null>(null);
  const [savingCommittee, setSavingCommittee] = useState(false);
  const [slotsGeneratingId, setSlotsGeneratingId] = useState<number | null>(
    null,
  );

  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [assignSlot, setAssignSlot] = useState<ExamSlot | null>(null);
  const [assignForm, setAssignForm] = useState<{
    candidate_id: string;
    exam_type: ExamType;
  }>({
    candidate_id: "",
    exam_type: "aevo",
  });
  const [assignError, setAssignError] = useState<string | null>(null);
  const [assignSaving, setAssignSaving] = useState(false);

  // Prüfungstag + Ausschüsse + Slots laden
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const [day, comms, s] = await Promise.all([
          getExamDay(examDayId),
          listExamDayCommittees(examDayId),
          listExamSlots(examDayId),
        ]);

        if (!cancelled) {
          setExamDay(day);
          setCommittees(comms);
          setSlots(s);
        }
      } catch (err) {
        console.error("Fehler beim Laden des Prüfungstags:", err);
        if (!cancelled) {
          setError("Der Prüfungstag konnte nicht geladen werden.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [examDayId]);

  const handleCommitteeChange =
    (field: keyof typeof committeeForm) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setCommitteeForm((prev) => ({
        ...prev,
        [field]: e.target.value,
      }));
    };

  const handleAddCommittee = async () => {
    setCommitteeError(null);

    if (!committeeForm.committee_id || !committeeForm.time_scheme_id) {
      setCommitteeError(
        "Bitte mindestens Ausschuss-ID und Zeitschema-ID ausfüllen.",
      );
      return;
    }

    const payload: ExamDayCommitteeCreate = {
      committee_id: Number(committeeForm.committee_id),
      room: committeeForm.room || null,
      location: committeeForm.location || null,
      time_scheme_id: Number(committeeForm.time_scheme_id),
    };

    try {
      setSavingCommittee(true);
      const created = await createExamDayCommittee(examDayId, payload);
      setCommittees((prev) => [...prev, created]);

      setCommitteeForm({
        committee_id: "",
        room: "",
        location: "",
        time_scheme_id: "",
      });
      setCommitteeDialogOpen(false);
    } catch (err) {
      console.error("Fehler beim Anlegen eines Ausschusses:", err);
      setCommitteeError(
        "Der Ausschuss konnte nicht angelegt werden. Bitte IDs prüfen.",
      );
    } finally {
      setSavingCommittee(false);
    }
  };

  const handleGenerateSlots = async (entry: ExamDayCommittee) => {
    try {
      setSlotsGeneratingId(entry.exam_day_committee_id);
      const res = await generateSlotsForCommittee(entry.exam_day_committee_id);
      console.log("Slots erzeugt:", res.created_slots);

      // Slots nach Generierung neu laden
      const updatedSlots = await listExamSlots(examDayId);
      setSlots(updatedSlots);
    } catch (err) {
      console.error("Fehler beim Generieren der Slots:", err);
    } finally {
      setSlotsGeneratingId(null);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-6 text-sm text-muted-foreground">
        Prüfungstag wird geladen …
      </div>
    );
  }

  if (error || !examDay) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-6 text-sm text-red-600">
        {error ?? "Prüfungstag nicht gefunden."}
      </div>
    );
  }

  const dateLabel = (() => {
    try {
      return new Date(examDay.date).toLocaleDateString("de-DE");
    } catch {
      return examDay.date;
    }
  })();

  const formatTime = (t: string) => t?.slice(0, 5) || t;

  const openAssignDialog = (slot: ExamSlot) => {
    setAssignSlot(slot);
    setAssignForm({
      candidate_id: "",
      exam_type: "aevo",
    });
    setAssignError(null);
    setAssignDialogOpen(true);
  };

  const handleAssignCandidate = async () => {
    if (!assignSlot) return;

    if (!assignForm.candidate_id) {
      setAssignError("Bitte Kandidaten-ID eintragen.");
      return;
    }

    try {
      setAssignSaving(true);
      setAssignError(null);

      await createExam({
        candidate_id: Number(assignForm.candidate_id),
        exam_day_id: examDay.exam_day_id,
        exam_slot_id: assignSlot.exam_slot_id,
        exam_type: assignForm.exam_type,
      });

      // Slots neu laden, damit Status 'booked' angezeigt wird
      const updatedSlots = await listExamSlots(examDayId);
      setSlots(updatedSlots);

      setAssignDialogOpen(false);
      setAssignSlot(null);
    } catch (err) {
      console.error("Fehler beim Zuordnen des Kandidaten:", err);
      setAssignError(
        "Die Prüfung konnte nicht angelegt werden. Bitte ID prüfen.",
      );
    } finally {
      setAssignSaving(false);
    }
  };

  // Slots nach ausgewähltem Ausschuss filtern
  const filteredSlots =
    selectedCommitteeId === "all"
      ? slots
      : slots.filter((s) => s.committee_id === selectedCommitteeId);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 space-y-6">
      {/* Kopfbereich Prüfungstag */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide">
            Planung
          </p>
          <h1 className="text-xl font-semibold">
            Prüfungstag {examDay.exam_day_id} – {dateLabel}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Ort:{" "}
            {examDay.location || (
              <span className="text-muted-foreground/80">–</span>
            )}
            {examDay.default_room && (
              <>
                {" · "}
                Raum: {examDay.default_room}
              </>
            )}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            OrgUnit-ID: {examDay.org_unit_id} · Fach-ID: {examDay.subject_id} ·
            Zeitschema-ID: {examDay.time_scheme_id}
          </p>
        </div>
      </div>

      {/* Abschnitt: Ausschüsse */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Ausschüsse am Prüfungstag</h2>

          <Dialog
            open={committeeDialogOpen}
            onOpenChange={setCommitteeDialogOpen}
          >
            <DialogTrigger asChild>
              <Button size="sm">+ Ausschuss hinzufügen</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Ausschuss zu Prüfungstag hinzufügen</DialogTitle>
              </DialogHeader>

              <div className="space-y-3 py-2">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="committee_id">Ausschuss-ID</Label>
                    <Input
                      id="committee_id"
                      type="number"
                      value={committeeForm.committee_id}
                      onChange={handleCommitteeChange("committee_id")}
                      placeholder="z. B. 1"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="time_scheme_id">Zeitschema-ID</Label>
                    <Input
                      id="time_scheme_id"
                      type="number"
                      value={committeeForm.time_scheme_id}
                      onChange={handleCommitteeChange("time_scheme_id")}
                      placeholder="z. B. 1"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="room">Raum</Label>
                  <Input
                    id="room"
                    value={committeeForm.room}
                    onChange={handleCommitteeChange("room")}
                    placeholder="z. B. 101"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="location">Ort (optional)</Label>
                  <Input
                    id="location"
                    value={committeeForm.location}
                    onChange={handleCommitteeChange("location")}
                    placeholder="z. B. IHK Region Stuttgart"
                  />
                </div>

                {committeeError && (
                  <p className="text-sm text-red-600">{committeeError}</p>
                )}
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCommitteeDialogOpen(false)}
                  disabled={savingCommittee}
                >
                  Abbrechen
                </Button>
                <Button
                  size="sm"
                  onClick={handleAddCommittee}
                  disabled={savingCommittee}
                >
                  {savingCommittee ? "Speichern …" : "Speichern"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {committees.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Es sind noch keine Ausschüsse für diesen Prüfungstag angelegt.
          </p>
        ) : (
          <div className="overflow-hidden rounded-md border bg-white">
            <table className="w-full text-sm">
              <thead className="bg-muted/60">
                <tr className="text-left">
                  <th className="border-b px-3 py-2">ID</th>
                  <th className="border-b px-3 py-2">Ausschuss-ID</th>
                  <th className="border-b px-3 py-2">Ort</th>
                  <th className="border-b px-3 py-2">Raum</th>
                  <th className="border-b px-3 py-2">Zeitschema-ID</th>
                  <th className="border-b px-3 py-2 text-right">Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {committees.map((c) => (
                  <tr
                    key={c.exam_day_committee_id}
                    className="hover:bg-muted/40"
                  >
                    <td className="border-b px-3 py-2">
                      {c.exam_day_committee_id}
                    </td>
                    <td className="border-b px-3 py-2">{c.committee_id}</td>
                    <td className="border-b px-3 py-2">
                      {c.location || (
                        <span className="text-muted-foreground">–</span>
                      )}
                    </td>
                    <td className="border-b px-3 py-2">
                      {c.room || (
                        <span className="text-muted-foreground">–</span>
                      )}
                    </td>
                    <td className="border-b px-3 py-2">
                      {c.time_scheme_id ?? (
                        <span className="text-muted-foreground">–</span>
                      )}
                    </td>
                    <td className="border-b px-3 py-2 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleGenerateSlots(c)}
                        disabled={
                          slotsGeneratingId === c.exam_day_committee_id
                        }
                      >
                        {slotsGeneratingId === c.exam_day_committee_id
                          ? "Slots werden erzeugt…"
                          : "Slots generieren"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Abschnitt: Slots */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Slots</h2>

          {committees.length > 0 && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Ausschuss:</span>
              <Button
                size="sm"
                variant={selectedCommitteeId === "all" ? "default" : "outline"}
                onClick={() => setSelectedCommitteeId("all")}
                className="h-7 px-3"
              >
                Alle
              </Button>
              {committees.map((c) => (
                <Button
                  key={c.exam_day_committee_id}
                  size="sm"
                  variant={
                    selectedCommitteeId === c.committee_id
                      ? "default"
                      : "outline"
                  }
                  onClick={() => setSelectedCommitteeId(c.committee_id)}
                  className="h-7 px-3"
                >
                  {c.committee_id}
                </Button>
              ))}
            </div>
          )}
        </div>

        {slots.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Es sind noch keine Slots generiert.
          </p>
        ) : (
          <div className="overflow-hidden rounded-md border bg-white">
            <table className="w-full text-sm">
              <thead className="bg-muted/60">
                <tr className="text-left">
                  <th className="border-b px-3 py-2">ID</th>
                  <th className="border-b px-3 py-2">Ausschuss-ID</th>
                  <th className="border-b px-3 py-2">Slot</th>
                  <th className="border-b px-3 py-2">Zeit</th>
                  <th className="border-b px-3 py-2">Prüfkandidat</th>
                  <th className="border-b px-3 py-2">Status</th>
                  <th className="border-b px-3 py-2 text-right">Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {filteredSlots.map((s) => {
                  const name =
                    `${s.candidate_last_name ?? ""}, ${s.candidate_first_name ?? ""}`
                      .replace(/^,|\s,$/, "")     // überflüssiges Komma weg
                      .trim();

                  return (
                    <tr key={s.exam_slot_id} className="hover:bg-muted/40">
                      <td className="border-b px-3 py-2">{s.exam_slot_id}</td>
                      <td className="border-b px-3 py-2">{s.committee_id}</td>
                      <td className="border-b px-3 py-2">{s.slot_index}</td>
                      <td className="border-b px-3 py-2">
                        {formatTime(s.start_time)} – {formatTime(s.end_time)}
                      </td>

                      {/* 🧑‍🎓 Kandidat */}
                      <td className="border-b px-3 py-2">
                        {s.candidate_id ? (
                          <span>
                            {name || `Prüfkandidat ${s.candidate_id}`}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">–</span>
                        )}
                      </td>

                      <td className="border-b px-3 py-2">
                        <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs">
                          {s.status}
                        </span>
                      </td>

                      <td className="border-b px-3 py-2 text-right">
                        {s.status === "booked" ? (
                          <div className="inline-flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openAssignDialog(s)}
                            >
                              Ändern
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={async () => {
                                if (!s.exam_id) return;
                                await deleteExam(s.exam_id);
                                const updated = await listExamSlots(examDayId);
                                setSlots(updated);
                              }}
                            >
                              Löschen
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openAssignDialog(s)}
                          >
                            Kandidat zuweisen
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Dialog: Kandidat einem Slot zuweisen */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Kandidat einem Slot zuweisen</DialogTitle>
          </DialogHeader>

          {assignSlot && (
            <div className="space-y-3 py-2 text-sm">
              <p className="text-muted-foreground">
                Prüfungstag {examDay.exam_day_id} – Slot {assignSlot.slot_index}{" "}
                ({formatTime(assignSlot.start_time)} –{" "}
                {formatTime(assignSlot.end_time)})
              </p>

              <div className="space-y-1">
                <Label htmlFor="candidate_id">Kandidaten-ID</Label>
                <Input
                  id="candidate_id"
                  type="number"
                  value={assignForm.candidate_id}
                  onChange={(e) =>
                    setAssignForm((prev) => ({
                      ...prev,
                      candidate_id: e.target.value,
                    }))
                  }
                  placeholder="z. B. 123"
                />
              </div>

              <div className="space-y-1">
                <Label>Prüfungsart</Label>
                <Select
                  value={assignForm.exam_type}
                  onValueChange={(value: ExamType) =>
                    setAssignForm((prev) => ({ ...prev, exam_type: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Prüfungsart wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="aevo">AEVO</SelectItem>
                    <SelectItem value="wfw">Wirtschaftsfachwirte</SelectItem>
                    <SelectItem value="it">IT-Berufe</SelectItem>
                    <SelectItem value="custom">Sonstige</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {assignError && (
                <p className="text-sm text-red-600">{assignError}</p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAssignDialogOpen(false)}
              disabled={assignSaving}
            >
              Abbrechen
            </Button>
            <Button
              size="sm"
              onClick={handleAssignCandidate}
              disabled={assignSaving || !assignSlot}
            >
              {assignSaving ? "Speichern …" : "Speichern"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// End of file: frontend/src/components/exam/PlannerDetail.tsx
