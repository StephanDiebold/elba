// frontend/src/components/exam/ExamStartPanel.tsx
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  startExam,
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


type Props = {
  exam: ExamWithParts | null;
  examId: number;
  onChanged?: () => Promise<void> | void;
};

export default function ExamStartPanel({ exam, examId, onChanged }: Props) {
  const [part1Mode, setPart1Mode] = useState<Part1Mode>("presentation");

  const [checkin, setCheckin] = useState<ExamCheckin | null>(null);
  const [checkinLoading, setCheckinLoading] = useState(false);
  const [checkinSavingKey, setCheckinSavingKey] = useState<string | null>(null);

  const [starting, setStarting] = useState(false);

  // wenn Exam bereits part1_mode kennt, im UI vorauswählen (optional)
  useEffect(() => {
    const mode = exam?.part1_mode ?? null;
    if (mode === "presentation" || mode === "demonstration") {
      setPart1Mode(mode);
    }
  }, [exam?.part1_mode]);

  // Checkin laden
  useEffect(() => {
    if (!examId || Number.isNaN(examId)) return;

    const load = async () => {
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
    };

    load();
  }, [examId]);

  const isStarted = exam?.status === "in_progress" || exam?.status === "done";
  const isPlanned = exam?.status === "planned";

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

  async function handleStart() {
    if (!examId) return;

    if (!mandatoryOk) {
      toast.error("Bitte zuerst alle Pflichtpunkte im Check-in bestätigen.");
      return;
    }

    try {
      setStarting(true);
      await startExam(examId, part1Mode);
      toast.success("Prüfung wurde gestartet.");
      await onChanged?.();
    } catch (e) {
      console.error(e);
      toast.error("Prüfung konnte nicht gestartet werden.");
    } finally {
      setStarting(false);
    }
  }

  if (!exam) return null;

  // Optional: wenn du nach Start das Panel einklappen willst, dann hier früh returnen.
  // Für MVP lassen wir es sichtbar, aber disabled.
  const defaultOpen = isPlanned ? "start" : undefined;

  return (
    <Accordion
      type="single"
      collapsible
      defaultValue={defaultOpen}
      className="bg-white rounded-xl shadow-sm border border-gray-200"
    >
      <AccordionItem value="start" className="border-none">
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <AccordionTrigger className="p-0 hover:no-underline flex-1">
            <div className="text-left">
              <div className="font-semibold">Start &amp; Check-in</div>
              <div className="text-xs text-gray-500 mt-1">
                Erst Check-in durchführen, dann Teil 1 (Präsentation/Durchführung) festlegen und starten.
              </div>
            </div>
          </AccordionTrigger>

          <button
            type="button"
            onClick={handleStart}
            disabled={!isPlanned || starting || !mandatoryOk}
            className="ml-4 px-4 py-2 rounded-md bg-blue-600 text-white disabled:opacity-60"
            title={
              !isPlanned
                ? "Prüfung ist bereits gestartet."
                : !mandatoryOk
                ? "Bitte zuerst alle Pflichtpunkte im Check-in erfüllen."
                : ""
            }
          >
            {starting ? "Starten …" : "Starten"}
          </button>
        </div>

        <AccordionContent className="p-0">
          <div className="p-4 space-y-4">
            {/* Teil 1 Modus */}
            <div>
              <div className="text-sm font-medium mb-2">Teil 1 bewerten als</div>
              <div className="flex gap-6 text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="part1Mode"
                    value="presentation"
                    checked={part1Mode === "presentation"}
                    onChange={() => setPart1Mode("presentation")}
                    disabled={isStarted}
                  />
                  Präsentation
                </label>

                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="part1Mode"
                    value="demonstration"
                    checked={part1Mode === "demonstration"}
                    onChange={() => setPart1Mode("demonstration")}
                    disabled={isStarted}
                  />
                  Durchführung
                </label>
              </div>

              {isStarted && (
                <div className="text-xs text-gray-500 mt-2">
                  Hinweis: Nach dem Start kann Teil 1 im MVP nicht mehr umgestellt werden.
                </div>
              )}
            </div>

            {/* Checkin */}
            <div className="border border-gray-200 rounded-lg">
              <div className="px-3 py-2 border-b border-gray-200 flex items-center justify-between">
                <div className="font-medium">Check-in</div>
                <div className={`text-xs ${mandatoryOk ? "text-green-700" : "text-gray-500"}`}>
                  {mandatoryOk ? "Pflichtpunkte erfüllt ✓" : "Pflichtpunkte offen"}
                </div>
              </div>

              <div className="p-3 space-y-3">
                {checkinLoading && <div className="text-sm text-gray-500">Check-in wird geladen …</div>}

                {!checkinLoading && !checkin && (
                  <div className="text-sm text-gray-500">Kein Check-in gefunden.</div>
                )}

                {!checkinLoading && checkin && (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                      <CheckItem
                        label="Identität geprüft"
                        value={checkin.identity_checked}
                        disabled={false}
                        saving={checkinSavingKey === "identity_checked"}
                        onChange={(v) => patchCheckin({ identity_checked: v }, "identity_checked")}
                      />
                      <CheckItem
                        label="Prüfungsfähigkeit abgefragt"
                        value={checkin.fit_for_exam_confirmed}
                        disabled={false}
                        saving={checkinSavingKey === "fit_for_exam_confirmed"}
                        onChange={(v) => patchCheckin({ fit_for_exam_confirmed: v }, "fit_for_exam_confirmed")}
                      />
                      <CheckItem
                        label="Befangenheit geklärt"
                        value={checkin.conflict_of_interest_cleared}
                        disabled={false}
                        saving={checkinSavingKey === "conflict_of_interest_cleared"}
                        onChange={(v) =>
                          patchCheckin({ conflict_of_interest_cleared: v }, "conflict_of_interest_cleared")
                        }
                      />
                      <CheckItem
                        label="Ablauf/Regeln erläutert"
                        value={checkin.procedure_info_given}
                        disabled={false}
                        saving={checkinSavingKey === "procedure_info_given"}
                        onChange={(v) => patchCheckin({ procedure_info_given: v }, "procedure_info_given")}
                      />
                      <CheckItem
                        label="Handy-/Gerätehinweis gegeben"
                        value={checkin.phone_notice_given}
                        disabled={false}
                        saving={checkinSavingKey === "phone_notice_given"}
                        onChange={(v) => patchCheckin({ phone_notice_given: v }, "phone_notice_given")}
                      />
                      <CheckItem
                        label="Gastbeobachter zugestimmt (optional)"
                        value={!!checkin.guest_observer_consent}
                        disabled={false}
                        saving={checkinSavingKey === "guest_observer_consent"}
                        onChange={(v) => patchCheckin({ guest_observer_consent: v }, "guest_observer_consent")}
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Notiz (optional)</label>
                      <textarea
                        rows={3}
                        value={checkin.notes ?? ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          setCheckin((prev) => (prev ? { ...prev, notes: val } : prev));
                        }}
                        onBlur={async () => {
                          await patchCheckin({ notes: checkin.notes ?? "" }, "notes");
                        }}
                        className="w-full border rounded-md px-2 py-1 text-sm"
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

/* ---------------- helper ---------------- */

function CheckItem(props: {
  label: string;
  value: boolean;
  disabled: boolean;
  saving?: boolean;
  onChange: (v: boolean) => void;
}) {
  const { label, value, disabled, saving, onChange } = props;

  return (
    <label className="flex items-center justify-between gap-3 border border-gray-200 rounded-md px-3 py-2">
      <span>{label}</span>
      <span className="flex items-center gap-2">
        {saving && <span className="text-xs text-gray-400">…</span>}
        <input
          type="checkbox"
          checked={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
        />
      </span>
    </label>
  );
}
