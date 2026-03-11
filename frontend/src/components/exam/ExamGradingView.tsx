// src/components/exam/ExamGradingView.tsx
//
// Bewertungslogik als wiederverwendbare Komponente (prop statt useParams).
//
// Phase 3: Part1Mode Labels, Badges, Guard, Cache-Reset
// Phase 4: ExamPartTimerBar – per-Part Timer (sticky)
//
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import ExamStartPanel from "@/components/exam/ExamStartPanel";
import ExpertDiscussionForm from "@/components/exam/ExpertDiscussionForm";
import ExamPartTimerBar from "@/components/exam/ExamPartTimerBar";
import { PointsPicker, type GradeMode } from "@/components/exam/GradePicker";

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
  Part1Mode,
} from "@/lib/api/exam.api";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

type LocalCriterion = MemberCriterionItem & { _dirty?: boolean };
type LocalArea = Omit<MemberArea, "criteria"> & { criteria: LocalCriterion[] };
type LocalView = Omit<MemberGradingSheetView, "areas"> & { areas: LocalArea[] };

const LS_MODE_KEY = "elba.grading.mode";

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
  try { localStorage.setItem(LS_MODE_KEY, mode); } catch { /* ignore */ }
}

function estimatePointsFromGrade(grade: number, maxPoints: number): number {
  const factor = (6 - grade) / 5;
  return Math.round(maxPoints * factor * 100) / 100;
}

function fmtPoints(value: number): string {
  return value.toFixed(2).replace(".", ",");
}

function fmtMaxPoints(value: number): string {
  return value.toFixed(1).replace(".", ",");
}

function formatSchoolGrade(grade: number | null): string {
  if (grade == null || Number.isNaN(grade)) return "—";
  const floor = Math.floor(grade);
  const frac = Math.round((grade - floor) * 100) / 100;
  if (frac === 0) return String(floor);
  if (frac === 0.5) return `${floor},5`;
  if (frac === 0.25) return `${floor}-`;
  if (frac === 0.75) return `${floor + 1}+`;
  return String(grade).replace(".", ",");
}

// ─────────────────────────────────────────────
// Part1-Mode Helpers
// ─────────────────────────────────────────────

function part1ModeLabel(mode: string | null | undefined): string {
  if (mode === "presentation") return "Präsentation";
  if (mode === "demonstration") return "Durchführung";
  return "";
}

function Part1ModeBadge({ mode }: { mode: Part1Mode | string | null | undefined }) {
  if (!mode) return null;
  const label = part1ModeLabel(mode);
  const cls =
    mode === "presentation"
      ? "bg-blue-50 text-blue-700 border-blue-200"
      : "bg-orange-50 text-orange-700 border-orange-200";

  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${cls}`}>
      {mode === "presentation" ? (
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ) : (
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      )}
      {label}
    </span>
  );
}


// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────

interface ExamGradingViewProps {
  examId: number;
  onExamChanged?: (exam: ExamWithParts) => void;
}

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

export default function ExamGradingView({ examId, onExamChanged }: ExamGradingViewProps) {
  const [exam, setExam] = useState<ExamWithParts | null>(null);
  const [loadingExam, setLoadingExam] = useState(false);

  const [viewByPartId, setViewByPartId] = useState<Record<number, LocalView | null>>({});
  const [loadingByPart, setLoadingByPart] = useState<Record<number, boolean>>({});
  const [openAreasByPartId, setOpenAreasByPartId] = useState<Record<number, Set<number>>>({});
  const [openHintsByItemId, setOpenHintsByItemId] = useState<Record<number, boolean>>({});

  const [mode, setMode] = useState<GradeMode>(() => safeReadMode());
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [activeTab, setActiveTab] = useState<"protokoll" | "teil1" | "fachgespraech" | "konsolidierung">("protokoll");

  const viewCacheRef = useRef<Record<number, LocalView | null>>({});
  const loadingCacheRef = useRef<Record<number, boolean>>({});


  // ── Timer ────────────────────────────────────────────────────────────────
  // Wird jetzt von ExamPartTimerBar pro ExamPart gesteuert.

  // Reset bei examId-Wechsel
  useEffect(() => {
    setExam(null);
    setViewByPartId({});
    setLoadingByPart({});
    setOpenAreasByPartId({});
    setOpenHintsByItemId({});
    viewCacheRef.current = {};
    loadingCacheRef.current = {};
  }, [examId]);

  /* ─── Exam laden ─── */
  useEffect(() => {
    if (!examId || Number.isNaN(examId)) return;
    let cancelled = false;

    (async () => {
      try {
        setLoadingExam(true);
        const data = await fetchExamWithParts(examId);
        if (cancelled) return;
        setExam(data);
        onExamChanged?.(data);
      } catch (err) {
        console.error(err);
        toast.error("Prüfung konnte nicht geladen werden.");
      } finally {
        if (!cancelled) setLoadingExam(false);
      }
    })();

    return () => { cancelled = true; };
  }, [examId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { viewCacheRef.current = viewByPartId; }, [viewByPartId]);
  useEffect(() => { loadingCacheRef.current = loadingByPart; }, [loadingByPart]);

  /* ─── Lazy-Load GradingSheet wenn Teil-1-Tab aktiv ─── */
  useEffect(() => {
    if (activeTab !== "teil1") return;
    const part1 = exam?.parts?.find((p) => p.part_number === 1) ?? null;
    if (!part1) return;

    const partId = part1.exam_part_id;

    if (Object.prototype.hasOwnProperty.call(viewCacheRef.current, partId)) return;
    if (loadingCacheRef.current[partId]) return;

    const effectiveMode = part1.part_mode ?? exam?.part1_mode ?? null;
    if (!effectiveMode) return;

    let cancelled = false;

    (async () => {
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
        const firstAreaId = local.areas?.[0]?.grading_area_id;
        setOpenAreasByPartId((prev) => ({
          ...prev,
          [partId]: new Set(firstAreaId ? [firstAreaId] : []),
        }));
      } catch (err) {
        console.error(err);
        toast.error("Bewertungsbogen konnte nicht geladen werden.");
        if (!cancelled) {
          setViewByPartId((prev) => ({ ...prev, [partId]: null }));
          setOpenAreasByPartId((prev) => ({ ...prev, [partId]: new Set() }));
        }
      } finally {
        if (!cancelled) setLoadingByPart((prev) => ({ ...prev, [partId]: false }));
      }
    })();

    return () => { cancelled = true; };
  }, [activeTab, exam]);

  /* ─── Helpers ─── */

  const toggleArea = (partId: number, areaId: number) => {
    setOpenAreasByPartId((prev) => {
      const s = new Set(prev[partId] ?? []);
      s.has(areaId) ? s.delete(areaId) : s.add(areaId);
      return { ...prev, [partId]: s };
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

  const ensureAreaOpen = (partId: number, areaId: number) => {
    setOpenAreasByPartId((prev) => {
      const s = new Set(prev[partId] ?? []);
      s.add(areaId);
      return { ...prev, [partId]: s };
    });
  };

  const getAreaOpenCount = (area: LocalArea) => {
    const missing = area.criteria?.filter((c) =>
      mode === "points" ? c.points == null : c.grade == null
    ).length ?? 0;
    return { missing, total: area.criteria?.length ?? 0 };
  };

  const getCriterionAchievedPoints = (c: LocalCriterion) => {
    if (mode === "points") return typeof c.points === "number" ? c.points : 0;
    if (typeof c.points === "number") return c.points;
    if (typeof c.grade === "number") return estimatePointsFromGrade(c.grade, c.max_points);
    return 0;
  };

  const getAreaPoints = (area: LocalArea) => {
    const sumPoints = area.criteria?.reduce((acc, c) => acc + getCriterionAchievedPoints(c), 0) ?? 0;
    const maxPoints = area.criteria?.reduce((acc, c) => acc + (typeof c.max_points === "number" ? c.max_points : 0), 0) ?? 0;
    return { sumPoints, maxPoints };
  };

  const toggleHint = (itemId: number) =>
    setOpenHintsByItemId((prev) => ({ ...prev, [itemId]: !prev[itemId] }));

  const setModePersisted = (next: GradeMode) => { setMode(next); safeWriteMode(next); };

  /* ─── Change Handler ─── */

  const updateCriterion = (
    partId: number,
    areaId: number,
    itemId: number,
    patch: Partial<Pick<LocalCriterion, "grade" | "points" | "comment">>
  ) => {
    setViewByPartId((prev) => {
      const v = prev[partId];
      if (!v) return prev;
      return {
        ...prev,
        [partId]: {
          ...v,
          areas: v.areas.map((a) =>
            a.grading_area_id !== areaId ? a : {
              ...a,
              criteria: a.criteria.map((c) =>
                c.exam_grading_item_id === itemId ? { ...c, ...patch, _dirty: true } : c
              ),
            }
          ),
        },
      };
    });
    ensureAreaOpen(partId, areaId);
  };

  const handleGradeChanged = (partId: number, areaId: number, c: LocalCriterion, next: number | null) => {
    if (mode !== "grades") return;
    updateCriterion(partId, areaId, c.exam_grading_item_id, {
      grade: next,
      points: next == null ? null : estimatePointsFromGrade(next, c.max_points),
    });
  };

  const handlePointsChanged = (partId: number, areaId: number, c: LocalCriterion, next: number | null) => {
    if (mode !== "points") return;
    updateCriterion(partId, areaId, c.exam_grading_item_id, { points: next, grade: null });
  };

  /* ─── Save / Submit ─── */

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

    if (changed.length === 0) { toast.info("Keine Änderungen zum Speichern."); return; }

    try {
      setSaving(true);
      await updateGradingSheetItemsApi(v.exam_grading_sheet_id, { items: changed });
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

  /* ─── onChanged nach Start ─── */

  const handleAfterStart = async () => {
    const data = await fetchExamWithParts(examId);
    setExam(data);
    onExamChanged?.(data);
    // Cache leeren → korrekter Sheet (Präs. oder Durchf.) wird geladen
    viewCacheRef.current = {};
    setViewByPartId({});
    if (data.started_at && activeTab === "protokoll") setActiveTab("teil1");
  };

  /* ─── Render ─── */

  if (loadingExam) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          Prüfung wird geladen …
        </div>
      </div>
    );
  }

  if (!exam) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
        Keine Prüfung ausgewählt.
      </div>
    );
  }

  const isStarted = !!exam.started_at;
  const tab1Label = exam.part1_mode === "demonstration" ? "Durchführung" : "Präsentation";

  return (
    <div className="space-y-3">

      {/* ── Vor dem Start: Start-Panel prominent ── */}
      {!isStarted && (
        <ExamStartPanel
          exam={exam}
          examId={examId}
          onChanged={handleAfterStart}
        />
      )}

      {/* ── Nach dem Start: Timer + Tabs ── */}
      {isStarted && (
        <>

          {/* Haupt-Tabs */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
            <TabsList className="w-full justify-start border-b border-gray-200 bg-transparent rounded-none h-auto p-0 gap-0">
              {(["protokoll", "teil1", "fachgespraech", "konsolidierung"] as const).map((tab) => {
                const labels: Record<string, string> = {
                  protokoll: "Check-In",
                  teil1: tab1Label,
                  fachgespraech: "Fachgespräch",
                  konsolidierung: "Protokoll",
                };
                return (
                  <TabsTrigger
                    key={tab}
                    value={tab}
                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent data-[state=active]:text-blue-700 px-4 py-2.5 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
                  >
                    {labels[tab]}
                  </TabsTrigger>
                );
              })}
            </TabsList>

            {/* ── Tab: Protokoll ── */}
            <TabsContent value="protokoll" className="mt-4">
              <ExamStartPanel
                exam={exam}
                examId={examId}
                onChanged={handleAfterStart}
              />
            </TabsContent>

            {/* ── Tab: Präsentation / Durchführung ── */}
            <TabsContent value="teil1" className="mt-4">
              {/* Teil-1-Timer */}
              {exam.parts.filter(p => p.part_number === 1).map(p => (
                <ExamPartTimerBar key={p.exam_part_id} part={p} onChanged={handleAfterStart} />
              ))}
              {/* Inhalte aus dem bisherigen Teil-1-Block */}
              {exam.parts.filter(p => p.part_number === 1).map((part) => {
                const partId = part.exam_part_id;
                const effectiveMode = part.part_mode ?? exam.part1_mode ?? null;
                if (!effectiveMode) {
                  return (
                    <div key={partId} className="bg-white rounded-xl shadow-sm border border-gray-200 p-10 text-center space-y-3">
                      <div className="text-4xl">📋</div>
                      <div className="font-semibold text-gray-700">Prüfungsmodus nicht gesetzt</div>
                      <div className="text-sm text-gray-500">Bitte im Protokoll-Tab den Modus wählen.</div>
                    </div>
                  );
                }
                const v = viewByPartId[partId] ?? null;
                const isLoading = !!loadingByPart[partId];
                const openSet = openAreasByPartId[partId] ?? new Set<number>();
                const partHasDirty = v?.areas?.some((a) => a.criteria?.some((c) => c._dirty)) ?? false;
                const totalMaxPoints = v?.areas?.reduce(
                  (acc, a) => acc + a.criteria.reduce((s, c) => s + (c.max_points ?? 0), 0), 0
                ) ?? 0;
                return (
                  <div key={partId} className="bg-white rounded-xl shadow-sm border border-gray-200">
                    <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="font-semibold text-base">Bewertungsbogen</h2>
                        <Part1ModeBadge mode={effectiveMode} />
                        {v && (
                          <span className="text-xs text-gray-500">
                            Sheet #{v.exam_grading_sheet_id} · <span className={v.status === "submitted" ? "text-green-600 font-medium" : ""}>{v.status}</span>
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5 mr-1">
                          <span className="text-xs text-gray-500">Eingabe:</span>
                          <Button type="button" size="sm" variant={mode === "grades" ? "default" : "outline"} onClick={() => setModePersisted("grades")} disabled={isLoading}>Noten</Button>
                          <Button type="button" size="sm" variant={mode === "points" ? "default" : "outline"} onClick={() => setModePersisted("points")} disabled={isLoading}>Punkte</Button>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => openAllAreas(partId)} disabled={!v || isLoading}>Alle öffnen</Button>
                        <Button size="sm" variant="outline" onClick={() => closeAllAreas(partId)} disabled={!v || isLoading}>Alle schließen</Button>
                        <div className="w-px h-6 bg-gray-200" />
                        <Button size="sm" variant="outline" onClick={() => handleSave(partId)} disabled={!v || saving || !partHasDirty}>{saving ? "Speichern …" : "Speichern"}</Button>
                        <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => handleSubmit(partId)} disabled={!v || submitting || v?.status === "submitted"}>
                          {submitting ? "Einreichen …" : v?.status === "submitted" ? "✓ Eingereicht" : "Einreichen"}
                        </Button>
                      </div>
                    </div>
                    <div className="p-4">
                      {isLoading && <div className="flex items-center gap-2 text-sm text-gray-500 py-6 justify-center"><div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />Bewertungsbogen wird geladen …</div>}
                      {!isLoading && !v && <div className="text-sm text-gray-500 py-4 text-center">Kein Bewertungsbogen verfügbar.</div>}
                      {!isLoading && v && (
                        <div className="space-y-3">
                          <div className={["flex items-center gap-2.5 text-xs px-3 py-2.5 rounded-lg border", effectiveMode === "presentation" ? "bg-blue-50 border-blue-100 text-blue-700" : "bg-orange-50 border-orange-100 text-orange-700"].join(" ")}>
                            <Part1ModeBadge mode={effectiveMode} />
                            <span>{effectiveMode === "presentation" ? "Bewertungsbogen Präsentation einer Ausbildungssituation" : "Bewertungsbogen Durchführung einer Ausbildungssituation"}</span>
                            <span className="ml-auto font-semibold">Max. {totalMaxPoints.toFixed(0)} Pkt.</span>
                          </div>
                          {v.areas.map((area) => {
                            const isOpen = openSet.has(area.grading_area_id);
                            const { missing, total } = getAreaOpenCount(area);
                            const { sumPoints, maxPoints } = getAreaPoints(area);
                            return (
                              <div key={area.grading_area_id} className="border border-gray-200 rounded-lg overflow-hidden">
                                <button type="button" onClick={() => toggleArea(partId, area.grading_area_id)} className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 flex items-center justify-between transition-colors">
                                  <div className="text-left">
                                    <div className="font-semibold text-sm">{area.area_number}. {area.title}</div>
                                    {area.description && <div className="text-xs text-gray-500 mt-0.5">{area.description}</div>}
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0 ml-2">
                                    {missing > 0 ? (
                                      <Badge className="bg-amber-50 border border-amber-200 text-amber-700 text-xs font-normal">{missing} offen</Badge>
                                    ) : total > 0 ? (
                                      <Badge className="bg-green-50 border border-green-200 text-green-700 text-xs font-normal">✓</Badge>
                                    ) : null}
                                    <Badge className="bg-transparent border border-gray-300 text-gray-600 text-xs font-normal">{fmtPoints(sumPoints)} / {fmtMaxPoints(maxPoints)} Pkt.</Badge>
                                    <span className="text-gray-400 text-xs">{isOpen ? "▲" : "▼"}</span>
                                  </div>
                                </button>
                                {isOpen && (
                                  <div className="divide-y divide-gray-100">
                                    {area.criteria.map((c) => {
                                      const achieved = getCriterionAchievedPoints(c);
                                      const hintOpen = !!openHintsByItemId[c.exam_grading_item_id];
                                      const hasGrade = c.grade != null;
                                      const hasPoints = c.points != null;
                                      const hasValue = mode === "grades" ? hasGrade : hasPoints;
                                      return (
                                        <div key={c.exam_grading_item_id} className={["transition-colors", hasValue ? "bg-white" : "bg-gray-50/50"].join(" ")}>
                                          <div className="flex items-center gap-2 px-3 py-2.5">
                                            <div className="flex-1 min-w-0">
                                              <span className="text-sm font-medium text-gray-800">{c.criterion_number}. {c.criterion_title}</span>
                                              <span className="ml-2 text-xs text-gray-400">max. {fmtMaxPoints(c.max_points)} Pkt.</span>
                                              {c._dirty && <span className="ml-1.5 inline-block w-1.5 h-1.5 rounded-full bg-amber-400 align-middle" title="Nicht gespeichert" />}
                                            </div>
                                            {hasValue && (
                                              <div className="text-xs font-semibold text-gray-600 shrink-0 w-16 text-right">
                                                {mode === "grades" ? <span className="text-blue-700">Note {formatSchoolGrade(c.grade ?? null)}</span> : <span>{fmtPoints(achieved)} Pkt.</span>}
                                              </div>
                                            )}
                                            {mode === "grades" && (
                                              <div className="flex gap-1 shrink-0">
                                                {[1, 2, 3, 4, 5, 6].map((g) => {
                                                  const selected = c.grade === g;
                                                  return (
                                                    <button key={g} type="button" onClick={() => handleGradeChanged(partId, area.grading_area_id, c, selected ? null : g)}
                                                      className={["w-8 h-8 rounded-md text-sm font-semibold border transition-all",
                                                        selected ? g <= 2 ? "bg-green-600 border-green-600 text-white" : g <= 4 ? "bg-blue-600 border-blue-600 text-white" : "bg-red-500 border-red-500 text-white"
                                                          : "bg-white border-gray-200 text-gray-600 hover:border-gray-400 hover:bg-gray-50"].join(" ")}>
                                                      {g}
                                                    </button>
                                                  );
                                                })}
                                              </div>
                                            )}
                                            {mode === "points" && (
                                              <div className="flex items-center gap-1 shrink-0">
                                                <PointsPicker value={c.points ?? null} maxPoints={c.max_points} onChange={(next) => handlePointsChanged(partId, area.grading_area_id, c, next)} />
                                              </div>
                                            )}
                                            <button type="button" title="Kommentar / Begründung" onClick={() => toggleHint(c.exam_grading_item_id)}
                                              className={["shrink-0 w-8 h-8 rounded-md border flex items-center justify-center text-sm transition-all",
                                                (hintOpen || c.comment) ? "bg-blue-50 border-blue-300 text-blue-600" : "bg-white border-gray-200 text-gray-400 hover:border-gray-400"].join(" ")}>
                                              💬
                                            </button>
                                          </div>
                                          {hintOpen && (
                                            <div className="px-3 pb-3 grid gap-2 grid-cols-1 lg:grid-cols-[1fr_auto]">
                                              <textarea rows={2} autoFocus value={c.comment ?? ""} onChange={(e) => updateCriterion(partId, area.grading_area_id, c.exam_grading_item_id, { comment: e.target.value })}
                                                className="w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                                                placeholder="Begründung der Bewertung …" />
                                              {c.criterion_description && (
                                                <div className="border rounded-md bg-amber-50 border-amber-200 px-3 py-2 text-xs text-amber-800 max-w-xs">
                                                  <div className="font-semibold mb-1 uppercase tracking-wide text-amber-600">Hinweis</div>
                                                  {c.criterion_description.trim()}
                                                </div>
                                              )}
                                            </div>
                                          )}
                                          {!hintOpen && c.comment && (
                                            <div className="px-3 pb-2"><p className="text-xs text-gray-500 italic truncate">{c.comment}</p></div>
                                          )}
                                        </div>
                                      );
                                    })}
                                    {area.criteria.length === 0 && <div className="text-sm text-gray-500 py-2 px-3">Keine Kriterien in diesem Bereich.</div>}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </TabsContent>

            {/* ── Tab: Fachgespräch ── */}
            <TabsContent value="fachgespraech" className="mt-4">
              {/* Teil-2-Timer */}
              {(() => {
                const p2 = exam.parts.find(p => p.part_number === 2);
                const p1done = exam.parts.find(p => p.part_number === 1)?.status === "done";
                return p2 ? (
                  <ExamPartTimerBar
                    part={p2}
                    locked={!p1done}
                    onChanged={handleAfterStart}
                  />
                ) : null;
              })()}
              <ExpertDiscussionForm examId={examId} />
            </TabsContent>

            {/* ── Tab: Protokoll (Gesamtergebnis) ── */}
            <TabsContent value="konsolidierung" className="mt-4">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-10 text-center space-y-3">
                <div className="text-4xl">📋</div>
                <div className="font-semibold text-gray-700">Protokoll & Gesamtergebnis</div>
                <div className="text-sm text-gray-500 max-w-xs mx-auto leading-relaxed">
                  Zusammenführung aller Bewertungen, Gesamtpunktzahl und finale Note.<br />
                  <span className="text-xs text-gray-400 mt-1 block">Wird in einem späteren Release freigeschaltet.</span>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </>
      )}

    </div>
  );
}
// End of src/components/exam/ExamGradingView.tsx
