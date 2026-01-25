// src/pages/ExamGradingPage.tsx
import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import ExamStartPanel from "@/components/exam/ExamStartPanel";
import ExpertDiscussionForm from "@/components/exam/ExpertDiscussionForm";
import ExamPart1Form, {
  type LocalView,
  type LocalCriterion,
} from "@/components/exam/ExamPart1Form";
import { type GradeMode } from "@/components/exam/GradePicker";

import {
  fetchExamWithParts,
  fetchMyGradingSheetView,
  updateGradingSheetItemsApi,
  submitMyGradingSheet,
} from "@/lib/api/exam.api";

import type {
  ExamWithParts,
  GradingItemUpdate,
} from "@/lib/api/exam.api";

type RouteParams = { examId?: string };

const LS_MODE_KEY = "elba.grading.mode"; // Toggle pro Prüfer (Browser/User)

function safeReadMode(): GradeMode {
  try {
    const v = localStorage.getItem(LS_MODE_KEY);
    if (v === "points" || v === "grades") return v;
    return "grades";
  } catch {
    return "grades";
  }
}

function safeWriteMode(mode: GradeMode) {
  try {
    localStorage.setItem(LS_MODE_KEY, mode);
  } catch {
    // ignore
  }
}

export default function ExamGradingPage() {
  const { examId } = useParams<RouteParams>();
  const examIdNum = examId ? Number(examId) : NaN;

  const [exam, setExam] = useState<ExamWithParts | null>(null);
  const [loadingExam, setLoadingExam] = useState(false);

  const [selectedPartId, setSelectedPartId] = useState<number | null>(null);

  // View-State pro Part (grouped)
  const [viewByPartId, setViewByPartId] = useState<Record<number, LocalView | null>>({});
  const [loadingByPart, setLoadingByPart] = useState<Record<number, boolean>>({});

  // Accordion open-state pro Part: Set<grading_area_id>
  const [openAreasByPartId, setOpenAreasByPartId] = useState<Record<number, Set<number>>>({});

  // Hinweise (rechts) pro Item
  const [openHintsByItemId, setOpenHintsByItemId] = useState<Record<number, boolean>>({});

  // Toggle Noten ↔ Punkte (pro Prüfer via localStorage)
  const [mode, setMode] = useState<GradeMode>(() => safeReadMode());

  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Cache-Refs (gegen doppelte Loads)
  const viewCacheRef = useRef<Record<number, LocalView | null>>({});
  const loadingCacheRef = useRef<Record<number, boolean>>({});

  /* ----------------------------- Exam laden ----------------------------- */

  useEffect(() => {
    if (!examIdNum || Number.isNaN(examIdNum)) return;

    let cancelled = false;

    const loadExam = async () => {
      try {
        setLoadingExam(true);
        const data = await fetchExamWithParts(examIdNum);
        if (cancelled) return;

        setExam(data);
        if (data.parts.length > 0) setSelectedPartId(data.parts[0].exam_part_id);
      } catch (err) {
        console.error(err);
        toast.error("Prüfung konnte nicht geladen werden.");
      } finally {
        if (!cancelled) setLoadingExam(false);
      }
    };

    loadExam();

    return () => {
      cancelled = true;
    };
  }, [examIdNum]);

  /* -------- Refs immer aktuell halten (wichtig für Cache-Check) -------- */

  useEffect(() => {
    viewCacheRef.current = viewByPartId;
  }, [viewByPartId]);

  useEffect(() => {
    loadingCacheRef.current = loadingByPart;
  }, [loadingByPart]);

  /* ------------------- Part-View lazy laden (Teil 1) ------------------- */

  useEffect(() => {
    const partId = selectedPartId;
    if (!partId) return;

    // Cache-Check (keine doppelte Fetches)
    const isCached = Object.prototype.hasOwnProperty.call(viewCacheRef.current, partId);
    if (isCached) return;

    if (loadingCacheRef.current[partId]) return;

    // ✅ Teil 2 (Fachgespräch) nutzt NICHT den klassischen GradingSheet-View
    const selectedPart = exam?.parts?.find((p) => p.exam_part_id === partId) ?? null;
    if (selectedPart?.part_number === 2) {
      // Sentinel, damit kein Reload versucht wird
      setViewByPartId((prev) => ({ ...prev, [partId]: null }));
      setOpenAreasByPartId((prev) => ({ ...prev, [partId]: new Set() }));
      return;
    }

    let cancelled = false;

    const loadViewForPart = async () => {
      try {
        setLoadingByPart((prev) => ({ ...prev, [partId]: true }));

        const v = await fetchMyGradingSheetView(partId);
        if (cancelled) return;

        const local: LocalView = {
          ...v,
          areas: (v.areas || []).map((a) => ({
            ...a,
            criteria: (a.criteria || []).map((c) => ({ ...c, _dirty: false })),
          })),
        };

        setViewByPartId((prev) => ({ ...prev, [partId]: local }));

        // Default: nur erste Area offen
        const firstAreaId = local.areas?.[0]?.grading_area_id;
        setOpenAreasByPartId((prev) => ({
          ...prev,
          [partId]: new Set(firstAreaId ? [firstAreaId] : []),
        }));
      } catch (err) {
        console.error(err);
        toast.error("Bewertungsbogen konnte nicht geladen werden.");
        if (cancelled) return;

        setViewByPartId((prev) => ({ ...prev, [partId]: null }));
        setOpenAreasByPartId((prev) => ({ ...prev, [partId]: new Set() }));
      } finally {
        if (!cancelled) setLoadingByPart((prev) => ({ ...prev, [partId]: false }));
      }
    };

    loadViewForPart();

    return () => {
      cancelled = true;
    };
  }, [selectedPartId, exam]);

  /* -------------------------- Helpers / Derived ------------------------- */

  const toggleArea = (partId: number, areaId: number) => {
    setOpenAreasByPartId((prev) => {
      const existing = prev[partId] ? new Set(prev[partId]) : new Set<number>();
      if (existing.has(areaId)) existing.delete(areaId);
      else existing.add(areaId);
      return { ...prev, [partId]: existing };
    });
  };

  const openAllAreas = (partId: number) => {
    const v = viewByPartId[partId];
    if (!v) return;
    setOpenAreasByPartId((prev) => ({
      ...prev,
      [partId]: new Set(v.areas.map((a) => a.grading_area_id)),
    }));
  };

  const closeAllAreas = (partId: number) => {
    setOpenAreasByPartId((prev) => ({ ...prev, [partId]: new Set() }));
  };

  // wenn User tippt -> Area geöffnet halten
  const ensureAreaOpen = (partId: number, areaId: number) => {
    setOpenAreasByPartId((prev) => {
      const existing = prev[partId] ? new Set(prev[partId]) : new Set<number>();
      existing.add(areaId);
      return { ...prev, [partId]: existing };
    });
  };

  const toggleHint = (itemId: number) => {
    setOpenHintsByItemId((prev) => ({ ...prev, [itemId]: !prev[itemId] }));
  };

  const setModePersisted = (next: GradeMode) => {
    setMode(next);
    safeWriteMode(next);
  };

  /* --------------------------- Change Handler --------------------------- */

  const updateCriterion = (
    partId: number,
    areaId: number,
    itemId: number,
    patch: Partial<Pick<LocalCriterion, "grade" | "points" | "comment">>
  ) => {
    setViewByPartId((prev) => {
      const v = prev[partId];
      if (!v) return prev;

      const updatedAreas = v.areas.map((a) => {
        if (a.grading_area_id !== areaId) return a;
        return {
          ...a,
          criteria: a.criteria.map((c) =>
            c.exam_grading_item_id === itemId ? { ...c, ...patch, _dirty: true } : c
          ),
        };
      });

      return { ...prev, [partId]: { ...v, areas: updatedAreas } };
    });

    ensureAreaOpen(partId, areaId);
  };

  /* ------------------------------- Save -------------------------------- */

  const handleSave = async (partId: number) => {
    const v = viewByPartId[partId];
    if (!v) return;

    const changed: GradingItemUpdate[] = [];
    for (const a of v.areas) {
      for (const c of a.criteria) {
        if (c._dirty) {
          changed.push({
            exam_grading_item_id: c.exam_grading_item_id,
            grade: c.grade ?? null,
            points: c.points ?? null,
            comment: c.comment ?? null,
          });
        }
      }
    }

    if (changed.length === 0) {
      toast.info("Keine Änderungen zum Speichern.");
      return;
    }

    try {
      setSaving(true);
      await updateGradingSheetItemsApi(v.exam_grading_sheet_id, { items: changed });

      // dirty zurücksetzen
      setViewByPartId((prev) => {
        const cur = prev[partId];
        if (!cur) return prev;
        return {
          ...prev,
          [partId]: {
            ...cur,
            areas: cur.areas.map((a) => ({
              ...a,
              criteria: a.criteria.map((c) => ({ ...c, _dirty: false })),
            })),
          },
        };
      });

      toast.success("Bewertung gespeichert.");
    } catch (err) {
      console.error(err);
      toast.error("Bewertung konnte nicht gespeichert werden.");
    } finally {
      setSaving(false);
    }
  };

  /* ------------------------------ Submit ------------------------------- */

  const handleSubmit = async (partId: number) => {
    const v = viewByPartId[partId];
    if (!v) return;

    try {
      setSubmitting(true);
      const res = await submitMyGradingSheet(v.exam_grading_sheet_id);

      toast.success(
        res.all_submitted_for_part
          ? "Bewertung eingereicht. Alle Prüfer haben eingereicht."
          : "Bewertung eingereicht."
      );

      // Status lokal aktualisieren
      setViewByPartId((prev) => {
        const cur = prev[partId];
        if (!cur) return prev;
        return { ...prev, [partId]: { ...cur, status: "submitted" as any } };
      });
    } catch (err) {
      console.error(err);
      toast.error("Einreichen fehlgeschlagen.");
    } finally {
      setSubmitting(false);
    }
  };

  /* ------------------------------- Render ------------------------------ */

  if (loadingExam) return <div className="p-4">Prüfung wird geladen …</div>;
  if (!exam) return <div className="p-4">Keine Prüfung gefunden.</div>;

  return (
    <div className="p-4 space-y-4">
      <ExamStartPanel exam={exam} examId={examIdNum} />

      <Tabs
        value={selectedPartId ? String(selectedPartId) : ""}
        onValueChange={(v) => setSelectedPartId(Number(v))}
      >
        <TabsList>
          {exam.parts.map((part) => {
            const label =
              part.part_number === 1 ? "Teil 1" : part.part_number === 2 ? "Teil 2" : `Teil ${part.part_number}`;
            return (
              <TabsTrigger key={part.exam_part_id} value={String(part.exam_part_id)}>
                {label}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {exam.parts.map((part) => {
          const partId = part.exam_part_id;

          // ✅ Teil 2: Fachgespräch
          if (part.part_number === 2) {
            return (
              <TabsContent key={partId} value={String(partId)} className="mt-4">
                {Number.isFinite(examIdNum) ? (
                  <ExpertDiscussionForm examId={examIdNum} />
                ) : (
                  <div className="text-sm text-gray-500">Ungültige Prüfung.</div>
                )}
              </TabsContent>
            );
          }

          // Teil 1 (klassischer Bewertungsbogen)
          const v = viewByPartId[partId] ?? null;
          const isLoading = !!loadingByPart[partId];
          const openSet = openAreasByPartId[partId] ?? new Set<number>();

          const partHasDirty =
            v?.areas?.some((a) => a.criteria?.some((c) => c._dirty)) ?? false;

          return (
            <TabsContent key={partId} value={String(partId)} className="mt-4">
              <ExamPart1Form
                partId={partId}
                view={v}
                isLoading={isLoading}
                mode={mode}
                onModeChange={setModePersisted}
                openAreas={openSet}
                onToggleArea={(areaId) => toggleArea(partId, areaId)}
                onOpenAll={() => openAllAreas(partId)}
                onCloseAll={() => closeAllAreas(partId)}
                openHintsByItemId={openHintsByItemId}
                onToggleHint={(itemId) => toggleHint(itemId)}
                onUpdateCriterion={(areaId, itemId, patch) =>
                  updateCriterion(partId, areaId, itemId, patch)
                }
                onSave={() => handleSave(partId)}
                onSubmit={() => handleSubmit(partId)}
                saving={saving}
                submitting={submitting}
                partHasDirty={partHasDirty}
              />
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
// End of src/pages/ExamGradingPage.tsx