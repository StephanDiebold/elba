// src/components/exam/PlannerDetail.tsx

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  getExamDay,
  listExamDayTeams,
  createExamDayTeam,
  deleteExamDayTeam,
  generateSlotsForTeam,
  deleteSlotsForTeam,
  listExamSlots,
  createExam,
} from "@/lib/api/planner.api";

import type { ExamDay, ExamDayTeam, ExamSlot, ExamType } from "@/lib/api/planner.api";

import { Button } from "@/components/ui/button";
import {
  Dialog,
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

import { ExamDayTeamsTabs } from "@/components/exam/ExamDayTeamsTabs";

interface PlannerDetailProps {
  examDayId: number;
}

export default function PlannerDetail({ examDayId }: PlannerDetailProps) {
  const navigate = useNavigate();

  const [examDay, setExamDay] = useState<ExamDay | null>(null);
  const [teams, setTeams] = useState<ExamDayTeam[]>([]);
  const [slots, setSlots] = useState<ExamSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // --- Team anlegen ---
  const [teamDialogOpen, setTeamDialogOpen] = useState(false);
  const [teamForm, setTeamForm] = useState<{
    name: string;
    time_scheme_id: string;
    user_ids: string; // CSV
  }>({
    name: "",
    time_scheme_id: "",
    user_ids: "",
  });
  const [teamError, setTeamError] = useState<string | null>(null);
  const [savingTeam, setSavingTeam] = useState(false);

  // --- Slots busy state ---
  const [slotsBusyTeamId, setSlotsBusyTeamId] = useState<number | null>(null);

  // --- Candidate assign ---
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

  const formatTime = (t: string) => t?.slice(0, 5) || t;

  // ------------------------------------------------------
  // Load
  // ------------------------------------------------------
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const day = await getExamDay(examDayId);
        if (!cancelled) setExamDay(day);
      } catch {
        if (!cancelled) {
          setError("Prüfungstag konnte nicht geladen werden.");
          setLoading(false);
        }
        return;
      }

      try {
        const t = await listExamDayTeams(examDayId);
        if (!cancelled) setTeams(t);
      } catch {
        if (!cancelled) setTeams([]);
      }

      try {
        const s = await listExamSlots(examDayId);
        if (!cancelled) setSlots(s);
      } catch {
        if (!cancelled) setSlots([]);
      }

      if (!cancelled) setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [examDayId]);

  const reloadTeamsAndSlots = async () => {
    const [t, s] = await Promise.all([
      listExamDayTeams(examDayId),
      listExamSlots(examDayId),
    ]);
    setTeams(t);
    setSlots(s);
  };

  // ------------------------------------------------------
  // Team create
  // ------------------------------------------------------
  const handleCreateTeam = async () => {
    setTeamError(null);

    const userIds = teamForm.user_ids
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean)
      .map(Number);

    if (userIds.length !== 3 || userIds.some((x) => Number.isNaN(x))) {
      setTeamError(
        "Ein Ausschuss muss genau 3 Prüfer enthalten (User-IDs, Komma-separiert)."
      );
      return;
    }

    try {
      setSavingTeam(true);

      await createExamDayTeam(examDayId, {
        name: teamForm.name || undefined,
        time_scheme_id: teamForm.time_scheme_id
          ? Number(teamForm.time_scheme_id)
          : undefined,
        user_ids: userIds,
      });

      await reloadTeamsAndSlots();
      setTeamDialogOpen(false);
      setTeamForm({ name: "", time_scheme_id: "", user_ids: "" });
    } catch (err: any) {
      setTeamError(
        err?.response?.data?.detail || "Ausschuss konnte nicht angelegt werden."
      );
    } finally {
      setSavingTeam(false);
    }
  };

  // ------------------------------------------------------
  // Slots (Team)
  // ------------------------------------------------------
  const handleGenerateSlots = async (team: ExamDayTeam) => {
    try {
      setSlotsBusyTeamId(team.exam_day_team_id);
      await generateSlotsForTeam(team.exam_day_team_id);
      await reloadTeamsAndSlots();
    } finally {
      setSlotsBusyTeamId(null);
    }
  };

  const handleDeleteSlots = async (team: ExamDayTeam) => {
    try {
      setSlotsBusyTeamId(team.exam_day_team_id);
      await deleteSlotsForTeam(team.exam_day_team_id);
      await reloadTeamsAndSlots();
    } finally {
      setSlotsBusyTeamId(null);
    }
  };

  const handleDeleteTeam = async (team: ExamDayTeam) => {
    try {
      setSlotsBusyTeamId(team.exam_day_team_id);
      await deleteExamDayTeam(team.exam_day_team_id);
      await reloadTeamsAndSlots();
    } catch (err) {
      console.error("Fehler beim Entfernen:", err);
    } finally {
      setSlotsBusyTeamId(null);
    }
  };

  // ------------------------------------------------------
  // Candidate assign
  // ------------------------------------------------------
  const openAssignDialog = (slot: ExamSlot) => {
    setAssignSlot(slot);
    setAssignForm({ candidate_id: "", exam_type: "aevo" });
    setAssignError(null);
    setAssignDialogOpen(true);
  };

  const handleAssignCandidate = async () => {
    if (!assignSlot || !assignForm.candidate_id) {
      setAssignError("Bitte Kandidaten-ID angeben.");
      return;
    }

    try {
      setAssignSaving(true);
      setAssignError(null);

      await createExam({
        candidate_id: Number(assignForm.candidate_id),
        exam_day_id: examDayId,
        exam_slot_id: assignSlot.exam_slot_id,
        exam_type: assignForm.exam_type,
      });

      await reloadTeamsAndSlots();
      setAssignDialogOpen(false);
      setAssignSlot(null);
    } catch (err: any) {
      setAssignError(err?.response?.data?.detail || "Zuweisung fehlgeschlagen.");
    } finally {
      setAssignSaving(false);
    }
  };

  // ------------------------------------------------------
  // Render
  // ------------------------------------------------------
  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-6 text-sm text-muted-foreground">
        Lade Prüfungstag …
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

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 space-y-6">
      {/* Kopfbereich */}
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
            OrgUnit-ID: {examDay.org_unit_id} · Subject-ID: {examDay.subject_id} ·
            Zeitschema-ID: {examDay.time_scheme_id}
          </p>
        </div>
      </div>

      {/* Tabs pro Ausschuss */}
      <ExamDayTeamsTabs
        examDayId={examDayId}
        teams={teams}
        slots={slots}
        onAddTeam={() => setTeamDialogOpen(true)}
        onGenerateSlots={handleGenerateSlots}
        onDeleteSlots={handleDeleteSlots}
        onDeleteTeam={handleDeleteTeam}
        onOpenAssign={openAssignDialog}
        onNavigateToExam={(examId: number) => navigate(`/exams/${examId}`)}
        slotsBusyTeamId={slotsBusyTeamId}
      />

      {/* Dialog: Ausschuss anlegen */}
      <Dialog open={teamDialogOpen} onOpenChange={setTeamDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ausschuss anlegen</DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label>Name (optional)</Label>
              <Input
                value={teamForm.name}
                onChange={(e) =>
                  setTeamForm((p) => ({ ...p, name: e.target.value }))
                }
                placeholder="z. B. Ausschuss 1"
              />
            </div>

            <div className="space-y-1">
              <Label>Zeitschema-ID (optional)</Label>
              <Input
                type="number"
                value={teamForm.time_scheme_id}
                onChange={(e) =>
                  setTeamForm((p) => ({
                    ...p,
                    time_scheme_id: e.target.value,
                  }))
                }
                placeholder="leer = Standard"
              />
            </div>

            <div className="space-y-1">
              <Label>Prüfer (User-IDs, Komma-separiert)</Label>
              <Input
                placeholder="z. B. 12,34,56"
                value={teamForm.user_ids}
                onChange={(e) =>
                  setTeamForm((p) => ({ ...p, user_ids: e.target.value }))
                }
              />
            </div>

            {teamError && <p className="text-sm text-red-600">{teamError}</p>}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setTeamDialogOpen(false)}
              disabled={savingTeam}
            >
              Abbrechen
            </Button>
            <Button size="sm" onClick={handleCreateTeam} disabled={savingTeam}>
              {savingTeam ? "Speichern…" : "Speichern"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Kandidat einem Slot zuweisen */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Kandidat einem Slot zuweisen</DialogTitle>
          </DialogHeader>

          {assignSlot && (
            <div className="space-y-3 py-2 text-sm">
              <p className="text-muted-foreground">
                Prüfungstag {examDay.exam_day_id} – Slot {assignSlot.slot_index} (
                {formatTime(assignSlot.start_time)} – {formatTime(assignSlot.end_time)})
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

              {assignError && <p className="text-sm text-red-600">{assignError}</p>}
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
