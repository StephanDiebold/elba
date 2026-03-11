// src/components/exam/ExamStartPanel.tsx
// Check-In Panel: Modus-Wahl + Checkliste. Keine Timer-Logik.

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
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

function CheckItem({
  label, checked, onChange, optional, saving,
}: {
  label: string; checked: boolean; onChange: (v: boolean) => void;
  optional?: boolean; saving?: boolean;
}) {
  return (
    <label className="flex items-center gap-3 cursor-pointer select-none">
      <input
        type="checkbox" checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={saving}
        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
      />
      <span className={`text-sm ${checked ? "text-gray-700" : "text-gray-600"}`}>
        {label}
        {optional && <span className="ml-1 text-xs text-gray-400">(optional)</span>}
      </span>
    </label>
  );
}

export default function ExamStartPanel({ exam, examId, onChanged }: Props) {
  const [part1Mode, setPart1Mode] = useState<Part1Mode>("presentation");
  const [checkin, setCheckin]     = useState<ExamCheckin | null>(null);
  const [checkinLoading, setCheckinLoading] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  useEffect(() => {
    const mode = exam?.part1_mode ?? null;
    if (mode === "presentation" || mode === "demonstration") setPart1Mode(mode);
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

  async function handleModeChange(mode: Part1Mode) {
    setPart1Mode(mode);
    try {
      await updateExamCheckin(examId, { part1_mode: mode } as ExamCheckinUpdatePayload);
      await onChanged?.();
    } catch (e) {
      console.error(e);
      toast.error("Modus konnte nicht gespeichert werden.");
    }
  }

  async function patchCheckin(patch: ExamCheckinUpdatePayload, key: string) {
    if (!examId) return;
    try {
      setSavingKey(key);
      const updated = await updateExamCheckin(examId, patch);
      setCheckin(updated);
    } catch (e) {
      console.error(e);
      toast.error("Check-in konnte nicht gespeichert werden.");
    } finally {
      setSavingKey(null);
    }
  }

  if (!exam) return null;

  return (
    <Accordion type="single" collapsible defaultValue="checkin" className="rounded-xl border border-gray-200 shadow-sm bg-white overflow-hidden">
      <AccordionItem value="checkin" className="border-0">
        <div className="px-4 py-3 border-b border-gray-200 flex items-center gap-3 flex-wrap">
          <AccordionTrigger className="p-0 hover:no-underline flex-1 min-w-0">
            <div className="text-left">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold">Start &amp; Check-in</span>
                {mandatoryOk
                  ? <span className="text-xs text-green-600 font-medium">&#10003; Pflichtpunkte erfüllt</span>
                  : <span className="text-xs text-amber-600 font-medium">Pflichtpunkte ausstehend</span>
                }
              </div>
              <div className="text-xs text-gray-500 mt-0.5">
                Prüfungsmodus wählen und Checkliste abarbeiten.
              </div>
            </div>
          </AccordionTrigger>
        </div>

        <AccordionContent className="p-0">
          <div className="p-4 space-y-5">
            <div>
              <div className="text-sm font-medium text-gray-700 mb-2">Teil 1 bewerten als</div>
              <div className="flex gap-4 flex-wrap">
                {(["presentation", "demonstration"] as Part1Mode[]).map((mode) => (
                  <label key={mode} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio" name="part1mode" value={mode}
                      checked={part1Mode === mode}
                      onChange={() => handleModeChange(mode)}
                      className="w-4 h-4 text-blue-600"
                    />
                    <span className="text-sm text-gray-700">
                      {mode === "presentation" ? "Präsentation" : "Durchführung einer Ausbildungssituation"}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {checkinLoading ? (
              <div className="text-sm text-gray-400">Lade Check-in …</div>
            ) : checkin ? (
              <div>
                <div className="text-sm font-medium text-gray-700 mb-3">Check-in</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <CheckItem label="Identität geprüft" checked={!!checkin.identity_checked}
                    onChange={(v) => patchCheckin({ identity_checked: v }, "identity_checked")}
                    saving={savingKey === "identity_checked"} />
                  <CheckItem label="Prüfungsfähigkeit abgefragt" checked={!!checkin.fit_for_exam_confirmed}
                    onChange={(v) => patchCheckin({ fit_for_exam_confirmed: v }, "fit_for_exam_confirmed")}
                    saving={savingKey === "fit_for_exam_confirmed"} />
                  <CheckItem label="Befangenheit geklärt" checked={!!checkin.conflict_of_interest_cleared}
                    onChange={(v) => patchCheckin({ conflict_of_interest_cleared: v }, "conflict_of_interest_cleared")}
                    saving={savingKey === "conflict_of_interest_cleared"} />
                  <CheckItem label="Ablauf / Regeln erläutert" checked={!!checkin.procedure_info_given}
                    onChange={(v) => patchCheckin({ procedure_info_given: v }, "procedure_info_given")}
                    saving={savingKey === "procedure_info_given"} />
                  <CheckItem label="Handy-/Gerätehinweis gegeben" checked={!!checkin.phone_notice_given}
                    onChange={(v) => patchCheckin({ phone_notice_given: v }, "phone_notice_given")}
                    saving={savingKey === "phone_notice_given"} />
                  <CheckItem label="Gastbeobachter zugestimmt" checked={!!checkin.guest_observer_consent}
                    onChange={(v) => patchCheckin({ guest_observer_consent: v }, "guest_observer_consent")}
                    saving={savingKey === "guest_observer_consent"} optional />
                </div>
                <div className="mt-4">
                  <label className="block text-xs text-gray-500 mb-1">Notiz (optional)</label>
                  <textarea
                    rows={2}
                    value={checkin.notes ?? ""}
                    onChange={(e) => setCheckin({ ...checkin, notes: e.target.value })}
                    onBlur={(e) => patchCheckin({ notes: e.target.value }, "notes")}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none"
                    placeholder="Notiz (optional)"
                  />
                </div>
              </div>
            ) : null}
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
// end of src/components/exam/ExamStartPanel.tsx
