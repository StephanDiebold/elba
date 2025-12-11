// src/pages/ExamGradingPage.tsx
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";

// Werte/Funktionen normal importieren
import {
  fetchExamWithParts,
  fetchMyGradingSheet,
  updateGradingSheetItemsApi,
  submitMyGradingSheet,
} from "@/lib/api/exam.api";

// Typen als type-only importieren
import type {
  ExamWithParts,
  GradingSheet,
  GradingItem,
  GradingItemUpdate,
} from "@/lib/api/exam.api";

type RouteParams = {
  examId?: string;
};

type LocalItem = GradingItem & { _dirty?: boolean };

export default function ExamGradingPage() {
  const { examId } = useParams<RouteParams>();
  const examIdNum = examId ? Number(examId) : NaN;

  const [exam, setExam] = useState<ExamWithParts | null>(null);
  const [loadingExam, setLoadingExam] = useState(false);

  const [selectedPartId, setSelectedPartId] = useState<number | null>(null);

  const [sheet, setSheet] = useState<GradingSheet | null>(null);
  const [items, setItems] = useState<LocalItem[]>([]);
  const [loadingSheet, setLoadingSheet] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!examIdNum || Number.isNaN(examIdNum)) return;

    const loadExam = async () => {
      try {
        setLoadingExam(true);
        const data = await fetchExamWithParts(examIdNum);
        setExam(data);

        if (data.parts.length > 0) {
          setSelectedPartId(data.parts[0].exam_part_id);
        }
      } catch (err: any) {
        console.error(err);
        toast.error("Prüfung konnte nicht geladen werden.");
      } finally {
        setLoadingExam(false);
      }
    };

    loadExam();
  }, [examIdNum]);

  useEffect(() => {
    if (!selectedPartId) {
      setSheet(null);
      setItems([]);
      return;
    }

    const loadSheet = async () => {
      try {
        setLoadingSheet(true);
        const s = await fetchMyGradingSheet(selectedPartId);
        setSheet(s);
        setItems(
          (s.items || []).map((it) => ({
            ...it,
            _dirty: false,
          }))
        );
      } catch (err: any) {
        console.error(err);
        toast.error("Bewertungsbogen konnte nicht geladen werden.");
      } finally {
        setLoadingSheet(false);
      }
    };

    loadSheet();
  }, [selectedPartId]);

  const handleGradeChange = (itemId: number, value: string) => {
    setItems((prev) =>
      prev.map((it) =>
        it.exam_grading_item_id === itemId
          ? {
              ...it,
              grade: value === "" ? null : Number(value),
              _dirty: true,
            }
          : it
      )
    );
  };

  const handlePointsChange = (itemId: number, value: string) => {
    setItems((prev) =>
      prev.map((it) =>
        it.exam_grading_item_id === itemId
          ? {
              ...it,
              points: value === "" ? null : Number(value),
              _dirty: true,
            }
          : it
      )
    );
  };

  const handleCommentChange = (itemId: number, value: string) => {
    setItems((prev) =>
      prev.map((it) =>
        it.exam_grading_item_id === itemId
          ? {
              ...it,
              comment: value,
              _dirty: true,
            }
          : it
      )
    );
  };

  const handleSave = async () => {
    if (!sheet) return;

    const changed: GradingItemUpdate[] = items
      .filter((it) => it._dirty)
      .map((it) => ({
        exam_grading_item_id: it.exam_grading_item_id,
        grade: it.grade ?? null,
        points: it.points ?? null,
        comment: it.comment ?? null,
      }));

    if (changed.length === 0) {
      toast.info("Keine Änderungen zum Speichern.");
      return;
    }

    try {
      setSaving(true);
      await updateGradingSheetItemsApi(sheet.exam_grading_sheet_id, {
        items: changed,
      });

      // nach erfolgreichem Save Dirty-Flag zurücksetzen
      setItems((prev) => prev.map((it) => ({ ...it, _dirty: false })));
      toast.success("Bewertung gespeichert.");
    } catch (err: any) {
      console.error(err);
      toast.error("Bewertung konnte nicht gespeichert werden.");
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    if (!sheet) return;

    try {
      setSubmitting(true);
      const res = await submitMyGradingSheet(sheet.exam_grading_sheet_id);
      toast.success(
        res.all_submitted_for_part
          ? "Bewertung eingereicht. Alle Prüfer haben eingereicht."
          : "Bewertung eingereicht."
      );
    } catch (err: any) {
      console.error(err);
      toast.error("Bewertung konnte nicht eingereicht werden.");
    } finally {
      setSubmitting(false);
    }
  };

  const hasDirty = items.some((it) => it._dirty);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Prüfungsbewertung</h1>
          {exam && (
            <p className="text-sm text-gray-500">
              Prüfung #{exam.exam_id} · Typ: {exam.exam_type.toUpperCase()} ·
              Status: {exam.status}
            </p>
          )}
        </div>
      </div>

      {/* Teile-Auswahl */}
      <div className="flex flex-wrap gap-3">
        {loadingExam && <span>Prüfung wird geladen …</span>}
        {exam?.parts.map((part) => {
          const isActive = part.exam_part_id === selectedPartId;
          return (
            <button
              key={part.exam_part_id}
              type="button"
              onClick={() => setSelectedPartId(part.exam_part_id)}
              className={`px-4 py-2 rounded-lg border text-sm ${
                isActive
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-gray-800 border-gray-300 hover:bg-gray-50"
              }`}
            >
              Teil {part.part_number}: {part.title}
              {part.part_mode && (
                <span className="ml-2 text-xs opacity-80">
                  ({part.part_mode})
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Bewertungsbogen */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-lg">Bewertungsbogen</h2>
            {sheet && (
              <p className="text-xs text-gray-500">
                Sheet #{sheet.exam_grading_sheet_id} · Status: {sheet.status}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={!sheet || saving || !hasDirty}
              className="px-3 py-1.5 text-sm rounded-md border border-gray-300 bg-white disabled:opacity-60"
            >
              {saving ? "Speichern …" : "Speichern"}
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!sheet || submitting}
              className="px-4 py-1.5 text-sm rounded-md bg-green-600 text-white disabled:opacity-60"
            >
              {submitting ? "Einreichen …" : "Einreichen"}
            </button>
          </div>
        </div>

        <div className="p-4">
          {loadingSheet && <div>Bewertungsbogen wird geladen …</div>}

          {!loadingSheet && !sheet && (
            <div className="text-sm text-gray-500">
              Bitte einen Prüfungsteil auswählen.
            </div>
          )}

          {!loadingSheet && sheet && (
            <div className="space-y-3">
              {items.map((item) => (
                <div
                  key={item.exam_grading_item_id}
                  className="border border-gray-200 rounded-lg p-3 flex flex-col gap-2"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="text-sm font-medium">
                        Kriterium #{item.grading_criterion_definition_id}
                      </div>
                    </div>
                    {item._dirty && (
                      <span className="text-xs text-amber-600">
                        geändert, noch nicht gespeichert
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">
                        Note (1 – 6, Schritt 0.25)
                      </label>
                      <input
                        type="number"
                        step={0.25}
                        min={1}
                        max={6}
                        value={item.grade ?? ""}
                        onChange={(e) =>
                          handleGradeChange(item.exam_grading_item_id, e.target.value)
                        }
                        className="w-full border rounded-md px-2 py-1 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">
                        Punkte
                      </label>
                      <input
                        type="number"
                        step={0.5}
                        value={item.points ?? ""}
                        onChange={(e) =>
                          handlePointsChange(item.exam_grading_item_id, e.target.value)
                        }
                        className="w-full border rounded-md px-2 py-1 text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs text-gray-500 mb-1">
                      Kommentar
                    </label>
                    <textarea
                      rows={2}
                      value={item.comment ?? ""}
                      onChange={(e) =>
                        handleCommentChange(
                          item.exam_grading_item_id,
                          e.target.value
                        )
                      }
                      className="w-full border rounded-md px-2 py-1 text-sm"
                    />
                  </div>
                </div>
              ))}

              {items.length === 0 && (
                <div className="text-sm text-gray-500">
                  Für diesen Prüfungsteil sind noch keine Kriterien hinterlegt.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
