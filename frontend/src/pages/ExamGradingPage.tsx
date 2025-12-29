// src/pages/ExamGradingPage.tsx
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ExamStartPanel from "@/components/exam/ExamStartPanel";


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

  const [sheetByPartId, setSheetByPartId] = useState<Record<number, GradingSheet | null>>({});
  const [itemsByPartId, setItemsByPartId] = useState<Record<number, LocalItem[]>>({});
  const [loadingSheetByPartId, setLoadingSheetByPartId] = useState<Record<number, boolean>>({});

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
    if (!selectedPartId) return;

    // schon geladen? dann nicht nochmal laden
    if (sheetByPartId[selectedPartId]) return;
    if (loadingSheetByPartId[selectedPartId]) return;

    const loadSheet = async () => {
      try {
        setLoadingSheetByPartId((prev) => ({ ...prev, [selectedPartId]: true }));

        const s = await fetchMyGradingSheet(selectedPartId);

        setSheetByPartId((prev) => ({ ...prev, [selectedPartId]: s }));
        setItemsByPartId((prev) => ({
          ...prev,
          [selectedPartId]: (s.items || []).map((it) => ({ ...it, _dirty: false })),
        }));
      } catch (err: any) {
        console.error(err);
        toast.error("Bewertungsbogen konnte nicht geladen werden.");
        setSheetByPartId((prev) => ({ ...prev, [selectedPartId]: null }));
        setItemsByPartId((prev) => ({ ...prev, [selectedPartId]: [] }));
      } finally {
        setLoadingSheetByPartId((prev) => ({ ...prev, [selectedPartId]: false }));
      }
    };

  loadSheet();
}, [selectedPartId, sheetByPartId, loadingSheetByPartId]);


  const handleGradeChange = (itemId: number, value: string) => {
    if (!selectedPartId) return;

    setItemsByPartId((prev) => ({
      ...prev,
      [selectedPartId]: (prev[selectedPartId] || []).map((it) =>
        it.exam_grading_item_id === itemId
          ? { ...it, grade: value === "" ? null : Number(value), _dirty: true }
          : it
      ),
    }));
  };

  const handlePointsChange = (itemId: number, value: string) => {
    if (!selectedPartId) return;

    setItemsByPartId((prev) => ({
      ...prev,
      [selectedPartId]: (prev[selectedPartId] || []).map((it) =>
        it.exam_grading_item_id === itemId
          ? { ...it, points: value === "" ? null : Number(value), _dirty: true }
          : it
      ),
    }));
  };

  const handleCommentChange = (itemId: number, value: string) => {
    if (!selectedPartId) return;

    setItemsByPartId((prev) => ({
      ...prev,
      [selectedPartId]: (prev[selectedPartId] || []).map((it) =>
        it.exam_grading_item_id === itemId
          ? { ...it, comment: value, _dirty: true }
          : it
      ),
    }));
  };

  const handleSave = async () => {
    if (!selectedPartId) return;

    const partSheet = sheetByPartId[selectedPartId] ?? null;
    const partItems = itemsByPartId[selectedPartId] ?? [];
    if (!partSheet) return;

    const changed: GradingItemUpdate[] = partItems
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
      await updateGradingSheetItemsApi(partSheet.exam_grading_sheet_id, { items: changed });

      setItemsByPartId((prev) => ({
        ...prev,
        [selectedPartId]: (prev[selectedPartId] || []).map((it) => ({ ...it, _dirty: false })),
      }));

      toast.success("Bewertung gespeichert.");
    } catch (err: any) {
      console.error(err);
      toast.error("Bewertung konnte nicht gespeichert werden.");
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedPartId) return;

    const partSheet = sheetByPartId[selectedPartId] ?? null;
    if (!partSheet) return;

    try {
      setSubmitting(true);
      const res = await submitMyGradingSheet(partSheet.exam_grading_sheet_id);
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

      {/* Start/Check-in */}
      <ExamStartPanel
        exam={exam}
        examId={examIdNum}
        onChanged={async () => {
          const data = await fetchExamWithParts(examIdNum);
          setExam(data);
        }}
      />


      {/* Teile-Auswahl */}
      <div className="w-full">
        {loadingExam && <span>Prüfung wird geladen …</span>}

        {exam?.parts?.length ? (
          <Tabs
            value={selectedPartId ? String(selectedPartId) : undefined}
            onValueChange={(v) => setSelectedPartId(Number(v))}
            className="w-full"
          >
            <TabsList className="w-full justify-start">
              {exam.parts.map((part) => (
                <TabsTrigger key={part.exam_part_id} value={String(part.exam_part_id)}>
                  Teil {part.part_number}
                  {part.part_mode ? ` (${part.part_mode})` : ""}
                </TabsTrigger>
              ))}
            </TabsList>

            {exam.parts.map((part) => {
              const isActive = selectedPartId === part.exam_part_id;
              const partSheet = sheetByPartId[part.exam_part_id] ?? null;
              const partItems = itemsByPartId[part.exam_part_id] ?? [];
              const partLoading = !!loadingSheetByPartId[part.exam_part_id];

              const partHasDirty = partItems.some((it) => it._dirty);
              
              return (
                <TabsContent
                  key={part.exam_part_id}
                  value={String(part.exam_part_id)}
                  className="mt-4"
                >
                  {!isActive ? null : (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                        <div>
                          <h2 className="font-semibold text-lg">Bewertungsbogen</h2>
                          {partSheet && (
                            <p className="text-xs text-gray-500">
                              Sheet #{partSheet.exam_grading_sheet_id} · Status: {partSheet.status}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={handleSave}
                            disabled={!partSheet || saving || !partHasDirty}
                            className="px-3 py-1.5 text-sm rounded-md border border-gray-300 bg-white disabled:opacity-60"
                          >
                            {saving ? "Speichern …" : "Speichern"}
                          </button>

                          <button
                            type="button"
                            onClick={handleSubmit}
                            disabled={!partSheet || submitting}
                            className="px-4 py-1.5 text-sm rounded-md bg-green-600 text-white disabled:opacity-60"
                          >
                            {submitting ? "Einreichen …" : "Einreichen"}
                          </button>
                        </div>
                      </div>

                      <div className="p-4">
                        {partLoading && <div>Bewertungsbogen wird geladen …</div>}

                        {!partLoading && !partSheet && (
                          <div className="text-sm text-gray-500">
                            Für diesen Prüfungsteil ist noch kein Bewertungsbogen vorhanden.
                          </div>
                        )}

                        {!partLoading && partSheet && (
                          <div className="space-y-3">
                            {partItems.map((item) => (
                              <div
                                key={item.exam_grading_item_id}
                                className="border border-gray-200 rounded-lg p-3 flex flex-col gap-2"
                              >
                                <div className="flex items-center justify-between gap-4">
                                  <div className="text-sm font-medium">
                                    Kriterium #{item.grading_criterion_definition_id}
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
                                    <label className="block text-xs text-gray-500 mb-1">Punkte</label>
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
                                  <label className="block text-xs text-gray-500 mb-1">Kommentar</label>
                                  <textarea
                                    rows={2}
                                    value={item.comment ?? ""}
                                    onChange={(e) =>
                                      handleCommentChange(item.exam_grading_item_id, e.target.value)
                                    }
                                    className="w-full border rounded-md px-2 py-1 text-sm"
                                  />
                                </div>
                              </div>
                            ))}

                            {partItems.length === 0 && (
                              <div className="text-sm text-gray-500">
                                Für diesen Prüfungsteil sind noch keine Kriterien hinterlegt.
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </TabsContent>
              );
            })}
          </Tabs>
        ) : (
          <div className="text-sm text-gray-500">Keine Prüfungsteile vorhanden.</div>
        )}
      </div>
    </div>
  );
}
