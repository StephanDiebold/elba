// src/components/exam/ExamStartPanel.tsx
//
// Änderungen ggü. Original:
//   - Stop-Button wenn Prüfung in_progress
//   - Neustart-Button wenn Prüfung gestoppt/geplant (nach Stop)
//   - Visuelles Feedback (Status-Badge)
//   - stopExam / resetExam aus exam.api
//
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  startExam,
  stopExam,
  resetExam,
  fetchExamCheckin,
  updateExamCheckin,
} from "@/lib/api/exam.api";

import type {
  ExamWithParts,
  Part1Mode,
  ExamCheckin,
  ExamCheckinUpdatePayload,
} from "@/lib/api/exam.api";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

// ─────────────────────────────────────────────
// Status-Badge
// ─────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { label: string; cls: string }> = {
    planned:     { label: "Geplant",        cls: "bg-gray-100 text-gray-600 border-gray-200" },
    in_progress: { label: "Läuft",          cls: "bg-green-50 text-green-700 border-green-200" },
    done:        { label: "Abgeschlossen",  cls: "bg-blue-50 text-blue-700 border-blue-200" },
    paused:      { label: "Pausiert",       cls: "bg-amber-50 text-amber-700 border-amber-200" },
    canceled:    { label: "Abgebrochen",    cls: "bg-red-50 text-red-600 border-red-200" },
    no_show:     { label: "Nicht erschienen", cls: "bg-orange-50 text-orange-700 border-orange-200" },
  };
  const { label, cls } = cfg[status] ?? { label: status, cls: "bg-gray-100 text-gray-600 border-gray-200" };
  return (
    <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full border ${cls}`}>
      {label}
    </span>
  );
}

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────

type Props = {
  exam: ExamWithParts | null;
  examId: number;
  onChanged?: () => Promise<void> | void;
};

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

export default function ExamStartPanel({ exam, examId, onChanged }: Props) {
  const [part1Mode, setPart1Mode] = useState<Part1Mode>("presentation");

  const [checkin, setCheckin] = useState<ExamCheckin | null>(null);
  const [checkinLoading, setCheckinLoading] = useState(false);
  const [checkinSavingKey, setCheckinSavingKey] = useState<string | null>(null);

  const [starting, setStarting] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [resetting, setResetting] = useState(false);

  // Confirmation state für Stopp
  const [confirmStop, setConfirmStop] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    const mode = exam?.part1_mode ?? null;
    if (mode === "presentation" || mode === "demonstration") {
      setPart1Mode(mode);
    }
  }, [exam?.part1_mode]);

  useEffect(() => {
    if (!examId || Number.isNaN(examId)) return;
    (async () => {
      try {
        setCheckinLoading(true);
        const c = await fetchExamCheckin(examId);
        setCheckin(c);
      } catch (e) {
        console.error(e);
        toast.error("Check-in konnte nicht geladen werden.");
      } finally {
        setCheckinLoading(false);
      }
    })();
  }, [examId]);

  const isStarted    = exam?.status === "in_progress";
  const isDone       = exam?.status === "done";
  const isPaused     = exam?.status === "paused";
  const isPlanned    = exam?.status === "planned";
  const canStart     = isPlanned || isPaused;
  const canStop      = isStarted;
  const canReset     = isStarted || isPaused || isDone;

  const mandatoryOk = useMemo(() => {
    if (!checkin) return false;
    return (
      checkin.identity_checked &&
      checkin.fit_for_exam_confirmed &&
      checkin.conflict_of_interest_cleared &&
      checkin.procedure_info_given &&
      checkin.phone_notice_given
    );
  }, [checkin]);

  /* ─── Start ─── */
  async function handleStart() {
    if (!mandatoryOk) {
      toast.error("Bitte zuerst alle Pflichtpunkte im Check-in bestätigen.");
      return;
    }
    try {
      setStarting(true);
      await startExam(examId, part1Mode);
      toast.success("Prüfung gestartet.");
      await onChanged?.();
    } catch (e) {
      console.error(e);
      toast.error("Prüfung konnte nicht gestartet werden.");
    } finally {
      setStarting(false);
    }
  }

  /* ─── Stop ─── */
  async function handleStop() {
    if (!confirmStop) {
      setConfirmStop(true);
      // Auto-Reset nach 4s
      setTimeout(() => setConfirmStop(false), 4000);
      return;
    }
    setConfirmStop(false);
    try {
      setStopping(true);
      await stopExam(examId);
      toast.success("Prüfung gestoppt.");
      await onChanged?.();
    } catch (e: any) {
      console.error(e);
      // Fallback: wenn /stop noch nicht existiert
      toast.error(
        e?.status === 404
          ? "Stop-Endpoint fehlt noch im Backend (POST /exam/exams/:id/stop)."
          : "Prüfung konnte nicht gestoppt werden."
      );
    } finally {
      setStopping(false);
    }
  }

  /* ─── Reset ─── */
  async function handleReset() {
    if (!confirmReset) {
      setConfirmReset(true);
      setTimeout(() => setConfirmReset(false), 4000);
      return;
    }
    setConfirmReset(false);
    try {
      setResetting(true);
      await resetExam(examId);
      toast.success("Prüfung zurückgesetzt – Timer startet neu beim nächsten Start.");
      await onChanged?.();
    } catch (e: any) {
      console.error(e);
      toast.error(
        e?.status === 404
          ? "Reset-Endpoint fehlt noch im Backend (POST /exam/exams/:id/reset)."
          : "Prüfung konnte nicht zurückgesetzt werden."
      );
    } finally {
      setResetting(false);
    }
  }

  async function patchCheckin(patch: ExamCheckinUpdatePayload, key: string) {
    if (!examId) return;
    try {
      setCheckinSavingKey(key);
      const updated = await updateExamCheckin(examId, patch);
      setCheckin(updated);
    } catch (e) {
      console.error(e);
      toast.error("Check-in konnte nicht gespeichert werden.");
    } finally {
      setCheckinSavingKey(null);
    }
  }

  if (!exam) return null;

  const defaultOpen = canStart ? "start" : undefined;

  return (
    <Accordion
      type="single"
      collapsible
      defaultValue={defaultOpen}
      className="bg-white rounded-xl shadow-sm border border-gray-200"
    >
      <AccordionItem value="start" className="border-none">

        {/* ── Header ── */}
        <div className="px-4 py-3 border-b border-gray-200 flex items-center gap-3 flex-wrap">
          <AccordionTrigger className="p-0 hover:no-underline flex-1 min-w-0">
            <div className="text-left">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold">Start &amp; Check-in</span>
                <StatusBadge status={exam.status} />
              </div>
              <div className="text-xs text-gray-500 mt-0.5">
                {isStarted
                  ? "Prüfung läuft – Timer aktiv."
                  : isPaused
                  ? "Prüfung pausiert – Timer angehalten."
                  : isDone
                  ? "Prüfung abgeschlossen."
                  : "Check-in durchführen, Modus wählen, dann starten."}
              </div>
            </div>
          </AccordionTrigger>

          {/* ── Action Buttons ── */}
          <div className="flex items-center gap-2 shrink-0 ml-auto flex-wrap">

            {/* Start */}
            {canStart && (
              <button
                type="button"
                onClick={handleStart}
                disabled={starting || !mandatoryOk}
                className="px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium disabled:opacity-50 transition-colors"
                title={!mandatoryOk ? "Erst alle Pflichtpunkte im Check-in erfüllen." : ""}
              >
                {starting ? "Starten …" : isPaused ? "▶ Fortsetzen" : "▶ Starten"}
              </button>
            )}

            {/* Stop */}
            {canStop && (
              <button
                type="button"
                onClick={handleStop}
                disabled={stopping}
                className={[
                  "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                  confirmStop
                    ? "bg-orange-500 hover:bg-orange-600 text-white animate-pulse"
                    : "bg-white border border-orange-300 text-orange-600 hover:bg-orange-50",
                ].join(" ")}
              >
                {stopping ? "Stopp …" : confirmStop ? "Nochmal drücken ✓" : "⏸ Stopp"}
              </button>
            )}

            {/* Reset */}
            {canReset && (
              <button
                type="button"
                onClick={handleReset}
                disabled={resetting}
                className={[
                  "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                  confirmReset
                    ? "bg-red-500 hover:bg-red-600 text-white animate-pulse"
                    : "bg-white border border-red-200 text-red-500 hover:bg-red-50",
                ].join(" ")}
                title="Setzt den Timer zurück – Prüfung kann neu gestartet werden"
              >
                {resetting ? "Reset …" : confirmReset ? "Sicher? Nochmal ✓" : "↺ Neustart"}
              </button>
            )}
          </div>
        </div>

        {/* ── Content ── */}
        <AccordionContent className="p-0">
          <div className="p-4 space-y-4">

            {/* Teil 1 Modus */}
            <div>
              <div className="text-sm font-medium mb-2">Teil 1 bewerten als</div>
              <div className="flex gap-6 text-sm">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name={`part1Mode-${examId}`}
                    value="presentation"
                    checked={part1Mode === "presentation"}
                    onChange={() => setPart1Mode("presentation")}
                    disabled={isStarted || isDone}
                  />
                  Präsentation
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name={`part1Mode-${examId}`}
                    value="demonstration"
                    checked={part1Mode === "demonstration"}
                    onChange={() => setPart1Mode("demonstration")}
                    disabled={isStarted || isDone}
                  />
                  Durchführung einer Ausbildungssituation
                </label>
              </div>
              {(isStarted || isDone) && (
                <div className="text-xs text-gray-400 mt-1.5">
                  Modus nach Start gesperrt. Für Änderung → Neustart verwenden.
                </div>
              )}
            </div>

            {/* Check-in */}
            <div className="border border-gray-200 rounded-lg">
              <div className="px-3 py-2 border-b border-gray-200 flex items-center justify-between">
                <div className="font-medium text-sm">Check-in</div>
                <div className={`text-xs ${mandatoryOk ? "text-green-700 font-medium" : "text-gray-500"}`}>
                  {mandatoryOk ? "✓ Pflichtpunkte erfüllt" : "Pflichtpunkte offen"}
                </div>
              </div>

              <div className="p-3 space-y-3">
                {checkinLoading && <div className="text-sm text-gray-500">Wird geladen …</div>}
                {!checkinLoading && !checkin && (
                  <div className="text-sm text-gray-500">Kein Check-in gefunden.</div>
                )}

                {!checkinLoading && checkin && (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                      <CheckItem label="Identität geprüft" value={checkin.identity_checked} saving={checkinSavingKey === "identity_checked"} onChange={(v) => patchCheckin({ identity_checked: v }, "identity_checked")} />
                      <CheckItem label="Prüfungsfähigkeit abgefragt" value={checkin.fit_for_exam_confirmed} saving={checkinSavingKey === "fit_for_exam_confirmed"} onChange={(v) => patchCheckin({ fit_for_exam_confirmed: v }, "fit_for_exam_confirmed")} />
                      <CheckItem label="Befangenheit geklärt" value={checkin.conflict_of_interest_cleared} saving={checkinSavingKey === "conflict_of_interest_cleared"} onChange={(v) => patchCheckin({ conflict_of_interest_cleared: v }, "conflict_of_interest_cleared")} />
                      <CheckItem label="Ablauf / Regeln erläutert" value={checkin.procedure_info_given} saving={checkinSavingKey === "procedure_info_given"} onChange={(v) => patchCheckin({ procedure_info_given: v }, "procedure_info_given")} />
                      <CheckItem label="Handy-/Gerätehinweis gegeben" value={checkin.phone_notice_given} saving={checkinSavingKey === "phone_notice_given"} onChange={(v) => patchCheckin({ phone_notice_given: v }, "phone_notice_given")} />
                      <CheckItem label="Gastbeobachter zugestimmt (optional)" value={!!checkin.guest_observer_consent} saving={checkinSavingKey === "guest_observer_consent"} onChange={(v) => patchCheckin({ guest_observer_consent: v }, "guest_observer_consent")} />
                    </div>

                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Notiz (optional)</label>
                      <textarea
                        rows={2}
                        value={checkin.notes ?? ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          setCheckin((prev) => (prev ? { ...prev, notes: val } : prev));
                        }}
                        onBlur={async () => {
                          await patchCheckin({ notes: checkin.notes ?? "" }, "notes");
                        }}
                        className="w-full border rounded-md px-2 py-1.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

// ─────────────────────────────────────────────
// CheckItem helper
// ─────────────────────────────────────────────

function CheckItem(props: {
  label: string;
  value: boolean;
  saving?: boolean;
  onChange: (v: boolean) => void;
}) {
  const { label, value, saving, onChange } = props;
  return (
    <label className="flex items-center justify-between gap-3 border border-gray-200 rounded-md px-3 py-2 cursor-pointer hover:bg-gray-50 transition-colors">
      <span className="text-sm">{label}</span>
      <span className="flex items-center gap-2 shrink-0">
        {saving && <span className="text-xs text-gray-400">…</span>}
        <input
          type="checkbox"
          checked={value}
          onChange={(e) => onChange(e.target.checked)}
          className="w-4 h-4 accent-blue-600"
        />
      </span>
    </label>
  );
}
// End of src/components/exam/ExamStartPanel.tsx
