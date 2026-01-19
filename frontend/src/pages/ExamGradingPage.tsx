// src/pages/ExamGradingPage.tsx
import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import ExamStartPanel from "@/components/exam/ExamStartPanel";
import ExpertDiscussionForm from "@/components/exam/ExpertDiscussionForm";
import { GradePicker, PointsPicker, type GradeMode } from "@/components/exam/GradePicker";

import {
  fetchExamWithParts,
  fetchMyGradingSheetView,
  updateGradingSheetItemsApi,
  submitMyGradingSheet,
} from "@/lib/api/exam.api";

import type {
  ExamWithParts,
  MemberGradingSheetView,
  MemberArea,
  MemberCriterionItem,
  GradingItemUpdate,
} from "@/lib/api/exam.api";

type RouteParams = { examId?: string };

// Local type: wir ergänzen _dirty
type LocalCriterion = MemberCriterionItem & { _dirty?: boolean };
type LocalArea = Omit<MemberArea, "criteria"> & { criteria: LocalCriterion[] };
type LocalView = Omit<MemberGradingSheetView, "areas"> & { areas: LocalArea[] };

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

/**
 * MVP: einfache Schätzung Punkte aus Note.
 * ACHTUNG: Wenn du später eine IHK-spezifische Tabelle/Formel hast,
 * ersetzen wir diese Funktion zentral.
 */
function estimatePointsFromGrade(grade: number, maxPoints: number): number {
  // linear: 1 => 100%, 6 => 0%
  const factor = (6 - grade) / 5; // 1->1.0, 6->0.0
  const raw = maxPoints * factor;
  // intern auf 2 Dezimalstellen stabilisieren
  return Math.round(raw * 100) / 100;
}

function fmtPoints(value: number): string {
  return value.toFixed(2).replace(".", ",");
}

function fmtMaxPoints(value: number): string {
  return value.toFixed(1).replace(".", ",");
}

/**
 * Anzeigeformat für Schulnoten:
 * 2.00 => "2"
 * 2.50 => "2,5"
 * 2.25 => "2-"
 * 1.75 => "2+"
 */
function formatSchoolGrade(grade: number | null): string {
  if (grade == null || Number.isNaN(grade)) return "—";

  const floor = Math.floor(grade);
  const frac = Math.round((grade - floor) * 100) / 100; // 0 / 0.25 / 0.5 / 0.75

  if (frac === 0) return String(floor);
  if (frac === 0.5) return `${floor},5`;
  if (frac === 0.25) return `${floor}-`;
  if (frac === 0.75) return `${floor + 1}+`;

  return String(grade).replace(".", ",");
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

  /* --------------------- Lazy Loading: View pro Tab -------------------- */
  useEffect(() => {
    if (!selectedPartId) return;

    const partId = selectedPartId;

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
          areas: (v.areas || []).map((a: MemberArea) => ({
            ...a,
            criteria: (a.criteria || []).map((c: MemberCriterionItem) => ({ ...c, _dirty: false })),
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

  const getAreaOpenCount = (area: LocalArea) => {
    const missing =
      area.criteria?.filter((c) => {
        if (mode === "points") return c.points == null;
        return c.grade == null;
      }).length ?? 0;

    const total = area.criteria?.length ?? 0;
    return { missing, total };
  };

  const getCriterionAchievedPoints = (c: LocalCriterion) => {
    if (mode === "points") return typeof c.points === "number" ? c.points : 0;
    if (typeof c.points === "number") return c.points;
    if (typeof c.grade === "number") return estimatePointsFromGrade(c.grade, c.max_points);
    return 0;
  };

  const getAreaPoints = (area: LocalArea) => {
    const sumPoints = area.criteria?.reduce((acc, c) => acc + getCriterionAchievedPoints(c), 0) ?? 0;
    const maxPoints =
      area.criteria?.reduce(
        (acc, c) => acc + (typeof c.max_points === "number" ? c.max_points : 0),
        0
      ) ?? 0;
    return { sumPoints, maxPoints };
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

  const handleGradeChanged = (
    partId: number,
    areaId: number,
    c: LocalCriterion,
    next: number | null
  ) => {
    if (mode !== "grades") return;
    const nextPoints = next == null ? null : estimatePointsFromGrade(next, c.max_points);

    updateCriterion(partId, areaId, c.exam_grading_item_id, {
      grade: next,
      points: nextPoints,
    });
  };

  const handlePointsChanged = (
    partId: number,
    areaId: number,
    c: LocalCriterion,
    next: number | null
  ) => {
    if (mode !== "points") return;

    updateCriterion(partId, areaId, c.exam_grading_item_id, {
      points: next,
      grade: null,
    });
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

      setViewByPartId((prev) => {
        const cur = prev[partId];
        if (!cur) return prev;
        return { ...prev, [partId]: { ...cur, status: "submitted" } };
      });
    } catch (err) {
      console.error(err);
      toast.error("Bewertung konnte nicht eingereicht werden.");
    } finally {
      setSubmitting(false);
    }
  };

  /* -------------------------------- UI -------------------------------- */

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Prüfungsbewertung</h1>
          {exam && (
            <p className="text-sm text-gray-500">
              Prüfung #{exam.exam_id} · Typ: {String(exam.exam_type).toUpperCase()} · Status:{" "}
              {exam.status}
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
          if (!selectedPartId && data.parts.length > 0) {
            setSelectedPartId(data.parts[0].exam_part_id);
          }
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
              {exam.parts.map((part) => {
                const label =
                  part.part_number === 2
                    ? "Teil 2 (Fachgespräch)"
                    : `Teil ${part.part_number}${part.part_mode ? ` (${part.part_mode})` : ""}`;

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
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                    <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                      <div>
                        <h2 className="font-semibold text-lg">Bewertungsbogen</h2>
                        {v && (
                          <p className="text-xs text-gray-500">
                            Sheet #{v.exam_grading_sheet_id} · Status: {v.status}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Toggle Noten ↔ Punkte */}
                        <div className="flex items-center gap-2 mr-2">
                          <span className="text-xs text-gray-500">Modus:</span>
                          <Button
                            type="button"
                            size="sm"
                            variant={mode === "grades" ? "default" : "outline"}
                            onClick={() => setModePersisted("grades")}
                            disabled={isLoading}
                          >
                            Noten
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant={mode === "points" ? "default" : "outline"}
                            onClick={() => setModePersisted("points")}
                            disabled={isLoading}
                          >
                            Punkte
                          </Button>
                        </div>

                        {/* Alle öffnen/schließen */}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openAllAreas(partId)}
                          disabled={!v || isLoading}
                        >
                          Alle öffnen
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => closeAllAreas(partId)}
                          disabled={!v || isLoading}
                        >
                          Alle schließen
                        </Button>

                        <div className="w-px h-6 bg-gray-200 mx-1" />

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleSave(partId)}
                          disabled={!v || saving || !partHasDirty}
                        >
                          {saving ? "Speichern …" : "Speichern"}
                        </Button>

                        <Button
                          size="sm"
                          variant="default"
                          className="bg-green-600 hover:bg-green-700"
                          onClick={() => handleSubmit(partId)}
                          disabled={!v || submitting}
                        >
                          {submitting ? "Einreichen …" : "Einreichen"}
                        </Button>
                      </div>
                    </div>

                    <div className="p-4">
                      {isLoading && <div>Bewertungsbogen wird geladen …</div>}

                      {!isLoading && !v && (
                        <div className="text-sm text-gray-500">
                          Kein Bewertungsbogen verfügbar.
                        </div>
                      )}

                      {!isLoading && v && (
                        <div className="space-y-4">
                          {v.areas.map((area) => {
                            const isOpen = openSet.has(area.grading_area_id);
                            const { missing, total } = getAreaOpenCount(area);
                            const { sumPoints, maxPoints } = getAreaPoints(area);

                            return (
                              <div
                                key={area.grading_area_id}
                                className="border border-gray-200 rounded-lg overflow-hidden"
                              >
                                {/* Area Header */}
                                <button
                                  type="button"
                                  onClick={() => toggleArea(partId, area.grading_area_id)}
                                  className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 flex items-center justify-between"
                                >
                                  <div className="text-left">
                                    <div className="font-semibold">
                                      {area.area_number}. {area.title}
                                    </div>
                                    {area.description && (
                                      <div className="text-xs text-gray-500">
                                        {area.description}
                                      </div>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-2">
                                    <Badge
                                      variant="secondary"
                                      className="bg-transparent border border-gray-300 text-gray-700"
                                    >
                                      offen {missing}/{total}
                                    </Badge>

                                    <Badge
                                      variant="secondary"
                                      className="bg-transparent border border-gray-300 text-gray-700"
                                    >
                                      Σ {fmtPoints(sumPoints)} / {fmtMaxPoints(maxPoints)}
                                    </Badge>
                                  </div>
                                </button>

                                {/* Area Content */}
                                {isOpen && (
                                  <div className="p-4 space-y-3">
                                    {area.criteria.map((c) => {
                                      const achieved = getCriterionAchievedPoints(c);
                                      const hintOpen = !!openHintsByItemId[c.exam_grading_item_id];
                                      const pct =
                                        c.max_points > 0
                                          ? Math.round((achieved / c.max_points) * 100)
                                          : 0;

                                      return (
                                        <div
                                          key={c.exam_grading_item_id}
                                          className="border border-gray-200 rounded-lg p-3"
                                        >
                                          {/* Item header */}
                                          <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                              <div className="text-sm font-medium truncate">
                                                {c.criterion_number}. {c.criterion_title}
                                              </div>

                                              <div className="text-xs text-gray-500">
                                                Punkte: {fmtPoints(achieved)} /{" "}
                                                {fmtMaxPoints(c.max_points)}
                                                {mode === "points" && (
                                                  <span className="ml-2">({pct}%)</span>
                                                )}
                                                {c._dirty ? (
                                                  <span className="ml-2 text-amber-600">
                                                    geändert
                                                  </span>
                                                ) : null}
                                              </div>

                                              {mode === "grades" && (
                                                <div className="text-xs text-gray-500">
                                                  Note: {formatSchoolGrade(c.grade ?? null)}
                                                </div>
                                              )}
                                            </div>

                                            <div className="flex items-center gap-2 shrink-0">
                                              <Button
                                                type="button"
                                                size="sm"
                                                variant="outline"
                                                onClick={() => toggleHint(c.exam_grading_item_id)}
                                              >
                                                Hinweise {hintOpen ? "ausblenden" : "anzeigen"}
                                              </Button>
                                            </div>
                                          </div>

                                          <div
                                            className={[
                                              "mt-3 grid grid-cols-1 gap-4",
                                              hintOpen
                                                ? "md:grid-cols-[1fr_320px]"
                                                : "md:grid-cols-1",
                                            ].join(" ")}
                                          >
                                            {/* LEFT */}
                                            <div className="space-y-3">
                                              {mode === "grades" ? (
                                                <GradePicker
                                                  value={c.grade ?? null}
                                                  onChange={(next) =>
                                                    handleGradeChanged(
                                                      partId,
                                                      area.grading_area_id,
                                                      c,
                                                      next
                                                    )
                                                  }
                                                />
                                              ) : (
                                                <div>
                                                  <div className="text-xs text-gray-500 mb-1">
                                                    Punkte
                                                  </div>
                                                  <PointsPicker
                                                    value={c.points ?? null}
                                                    maxPoints={c.max_points}
                                                    onChange={(next) =>
                                                      handlePointsChanged(
                                                        partId,
                                                        area.grading_area_id,
                                                        c,
                                                        next
                                                      )
                                                    }
                                                  />
                                                </div>
                                              )}

                                              <div>
                                                <label className="block text-xs text-gray-500 mb-1">
                                                  Kommentar
                                                </label>
                                                <textarea
                                                  rows={2}
                                                  value={c.comment ?? ""}
                                                  onChange={(e) =>
                                                    updateCriterion(
                                                      partId,
                                                      area.grading_area_id,
                                                      c.exam_grading_item_id,
                                                      {
                                                        comment: e.target.value,
                                                      }
                                                    )
                                                  }
                                                  className="w-full border rounded-md px-2 py-1 text-sm"
                                                />
                                              </div>
                                            </div>

                                            {/* RIGHT */}
                                            {hintOpen && (
                                              <div className="border rounded-lg bg-gray-50 p-3">
                                                <div className="text-sm font-medium mb-2">
                                                  Hinweise
                                                </div>
                                                <div className="text-sm text-gray-700 whitespace-pre-wrap">
                                                  {c.criterion_description?.trim()
                                                    ? c.criterion_description
                                                    : "Keine Hinweise hinterlegt"}
                                                </div>
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      );
                                    })}

                                    {area.criteria.length === 0 && (
                                      <div className="text-sm text-gray-500">
                                        Keine Kriterien in diesem Bereich.
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}

                          {v.areas.length === 0 && (
                            <div className="text-sm text-gray-500">
                              Für diesen Prüfungsteil sind noch keine Bereiche/Kriterien hinterlegt.
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
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
// Ende src/pages/ExamGradingPage.tsx
