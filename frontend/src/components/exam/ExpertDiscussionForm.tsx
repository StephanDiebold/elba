// frontend/src/components/exam/ExpertDiscussionForm.tsx
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GradePicker, PointsPicker, type GradeMode } from "@/components/exam/GradePicker";

import {
  fetchExpertDiscussionBundle,
  updateExpertDiscussionAreaScore,
  createExpertDiscussionItem,
  updateExpertDiscussionItem,
  deleteExpertDiscussionItem,
  submitExpertDiscussion,
  type ExpertDiscussionBundleOut,
  type ExamExpertDiscussionAreaOut,
  type ExamExpertDiscussionItemOut,
} from "@/lib/api/exam.api";

/**
 * Fachgespräch (Teil 2) – Option A
 * - Server liefert Bundle per examId (inkl. subject_id + part2)
 * - Server macht Lazy-Init (Areas + min. 1 Item pro Area)
 * - Area-Bewertung: Punkte/Noten, Umrechnung serverseitig
 */

type ExpertDiscussionFormProps = {
  examId: number;
  /**
   * Optional: beim ersten Öffnen soll eine erste Area "geöffnet" werden.
   * (Die Area wird serverseitig ohnehin erzeugt; hier nur UX.)
   */
  initialOpenAreaIndex?: number; // default 0
};

type LocalItem = ExamExpertDiscussionItemOut & { _dirty?: boolean };
type LocalArea = Omit<ExamExpertDiscussionAreaOut, "items"> & {
  items: LocalItem[];
  _open?: boolean;
  _dirty?: boolean;
};

const LS_ED_MODE_KEY = "elba.expertdiscussion.mode";

function safeReadEdMode(): GradeMode {
  try {
    const v = localStorage.getItem(LS_ED_MODE_KEY);
    if (v === "points" || v === "grades") return v;
  } catch {}
  return "grades";
}

function safeWriteEdMode(mode: GradeMode) {
  try {
    localStorage.setItem(LS_ED_MODE_KEY, mode);
  } catch {}
}

function fmtPoints(n: number | null | undefined): string {
  if (typeof n !== "number" || Number.isNaN(n)) return "—";
  return n.toFixed(2).replace(".", ",");
}

/**
 * 2.00 => "2"
 * 2.50 => "2,5"
 * 2.25 => "2-"
 * 1.75 => "2+"
 */
function formatSchoolGrade(grade: number | null | undefined): string {
  if (grade == null || Number.isNaN(grade)) return "—";

  const floor = Math.floor(grade);
  const frac = Math.round((grade - floor) * 100) / 100;

  if (frac === 0) return String(floor);
  if (frac === 0.5) return `${floor},5`;
  if (frac === 0.25) return `${floor}-`;
  if (frac === 0.75) return `${floor + 1}+`;

  return String(grade).replace(".", ",");
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

/** Gesamtpunkte = Durchschnitt der bewerteten Areas (points_100 vorhanden) */
function computeTotalPoints100(areas: LocalArea[]): { total: number | null; counted: number } {
  const rated = areas.filter((a) => typeof a.points_100 === "number" && !Number.isNaN(a.points_100));
  if (rated.length === 0) return { total: null, counted: 0 };

  const sum = rated.reduce((acc, a) => acc + clamp(Number(a.points_100), 0, 100), 0);
  const avg = sum / rated.length;
  const rounded = Math.round(avg * 100) / 100;
  return { total: rounded, counted: rated.length };
}

export default function ExpertDiscussionForm({ examId, initialOpenAreaIndex = 0 }: ExpertDiscussionFormProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [mode, setMode] = useState<GradeMode>(() => safeReadEdMode());
  const setModePersisted = (next: GradeMode) => {
    setMode(next);
    safeWriteEdMode(next);
  };

  const [bundle, setBundle] = useState<ExpertDiscussionBundleOut | null>(null);
  const [areas, setAreas] = useState<LocalArea[]>([]);

  /* ----------------------------- Load ----------------------------- */

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);

        const data = await fetchExpertDiscussionBundle(examId);
        if (cancelled) return;

        setBundle(data);

        const local: LocalArea[] = (data.areas ?? []).map((a, idx) => ({
          ...a,
          _open: idx === initialOpenAreaIndex,
          _dirty: false,
          items: (a.items ?? []).map((it) => ({ ...it, _dirty: false })),
        }));

        setAreas(local);
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          toast.error("Fachgespräch konnte nicht geladen werden.");
          setBundle(null);
          setAreas([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [examId, initialOpenAreaIndex]);

  /* ----------------------------- Derived ----------------------------- */

  const totals = useMemo(() => {
    const { total, counted } = computeTotalPoints100(areas);

    const graded = areas.filter((a) => typeof a.grade === "number" && !Number.isNaN(a.grade)) as Array<
      LocalArea & { grade: number }
    >;

    const avgGrade =
      graded.length > 0
        ? Math.round((graded.reduce((acc, a) => acc + Number(a.grade), 0) / graded.length) * 100) / 100
        : null;

    return { totalPoints100: total, counted, avgGrade };
  }, [areas]);

  const hasDirty = useMemo(() => {
    return areas.some((a) => a._dirty || a.items.some((i) => i._dirty));
  }, [areas]);

  /* ----------------------------- UI helpers ----------------------------- */

  const toggleOpen = (examAreaId: number) => {
    setAreas((prev) =>
      prev.map((a) =>
        a.exam_expert_discussion_area_id === examAreaId ? { ...a, _open: !a._open } : a
      )
    );
  };

  const openAllAreas = () => setAreas((prev) => prev.map((a) => ({ ...a, _open: true })));
  const closeAllAreas = () => setAreas((prev) => prev.map((a) => ({ ...a, _open: false })));

  const updateAreaLocal = (examAreaId: number, patch: Partial<LocalArea>) => {
    setAreas((prev) =>
      prev.map((a) =>
        a.exam_expert_discussion_area_id === examAreaId ? { ...a, ...patch, _dirty: true } : a
      )
    );
  };

  const updateItemLocal = (itemId: number, patch: Partial<LocalItem>) => {
    setAreas((prev) =>
      prev.map((a) => ({
        ...a,
        items: a.items.map((it) =>
          it.exam_expert_discussion_item_id === itemId ? { ...it, ...patch, _dirty: true } : it
        ),
      }))
    );
  };

  /* ----------------------------- CRUD ----------------------------- */

  const handleAddQuestion = async (examAreaId: number) => {
    try {
      const created = await createExpertDiscussionItem(examId, examAreaId, {
        question_text: "",
        answer_text: "",
        examiner_comment: "",
      });

      setAreas((prev) =>
        prev.map((a) =>
          a.exam_expert_discussion_area_id === examAreaId
            ? { ...a, items: [...a.items, { ...created, _dirty: false }], _open: true }
            : a
        )
      );

      toast.success("Frage hinzugefügt.");
    } catch (err) {
      console.error(err);
      toast.error("Frage konnte nicht hinzugefügt werden.");
    }
  };

  const handleDeleteQuestion = async (itemId: number) => {
    const ok = confirm("Frage wirklich löschen?");
    if (!ok) return;

    try {
      await deleteExpertDiscussionItem(examId, itemId);

      setAreas((prev) =>
        prev.map((a) => ({
          ...a,
          items: a.items.filter((it) => it.exam_expert_discussion_item_id !== itemId),
        }))
      );

      toast.success("Frage gelöscht.");
    } catch (err) {
      console.error(err);
      toast.error("Frage konnte nicht gelöscht werden.");
    }
  };

  const handleSave = async () => {
    try {
      const dirtyAreas = areas.filter((a) => a._dirty);
      const dirtyItems: LocalItem[] = [];
      for (const a of areas) {
        for (const it of a.items) if (it._dirty) dirtyItems.push(it);
      }

      if (dirtyAreas.length === 0 && dirtyItems.length === 0) {
        toast.info("Keine Änderungen zum Speichern.");
        return;
      }

      setSaving(true);

      // 1) Areas: serverseitig konvertieren (mode entscheidet, welches Feld "input" ist)
      for (const a of dirtyAreas) {
        await updateExpertDiscussionAreaScore(examId, a.exam_expert_discussion_area_id, {
          mode,
          points_100: mode === "points" ? (a.points_100 ?? null) : null,
          grade: mode === "grades" ? (a.grade ?? null) : null,
        });
      }

      // 2) Items
      for (const it of dirtyItems) {
        await updateExpertDiscussionItem(examId, it.exam_expert_discussion_item_id, {
          template_item_id: it.template_item_id ?? null,
          question_text: it.question_text ?? null,
          answer_text: it.answer_text ?? null,
          examiner_comment: it.examiner_comment ?? null,
          sort_order: it.sort_order ?? 1,
        });
      }

      // danach Bundle neu laden (damit umgerechnete Werte sauber sind)
      const fresh = await fetchExpertDiscussionBundle(examId);
      setBundle(fresh);
      setAreas(
        (fresh.areas ?? []).map((a, idx) => ({
          ...a,
          _open: idx === 0,
          _dirty: false,
          items: (a.items ?? []).map((x) => ({ ...x, _dirty: false })),
        }))
      );

      toast.success("Fachgespräch gespeichert.");
    } catch (err) {
      console.error(err);
      toast.error("Speichern fehlgeschlagen.");
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      await submitExpertDiscussion(examId);
      toast.success("Fachgespräch eingereicht.");
    } catch (err) {
      console.error(err);
      toast.error("Einreichen fehlgeschlagen.");
    } finally {
      setSubmitting(false);
    }
  };

  /* ----------------------------- Render ----------------------------- */

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h2 className="font-semibold text-lg">Fachgespräch</h2>
          <p className="text-xs text-gray-500">
            Teil 2 · Bewertung pro Area · Gesamt: Durchschnitt über bewertete Areas
          </p>
          {bundle && (
            <p className="text-xs text-gray-400">
              Exam #{bundle.exam_id} · Subject #{bundle.subject_id} · Part #{bundle.exam_part_id}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap justify-end">
          <Badge variant="secondary" className="bg-transparent border border-gray-300 text-gray-700">
            Σ {totals.totalPoints100 == null ? "—" : fmtPoints(totals.totalPoints100)} / 100,00 Punkte
            <span className="ml-2 text-gray-500">({totals.counted} Areas)</span>
          </Badge>

          <Badge variant="secondary" className="bg-transparent border border-gray-300 text-gray-700">
            Ø Note: {formatSchoolGrade(totals.avgGrade)}
          </Badge>

          <div className="w-px h-6 bg-gray-200 mx-1" />

          {/* Toggle Noten ↔ Punkte */}
          <div className="flex items-center gap-2 mr-2">
            <span className="text-xs text-gray-500">Modus:</span>
            <Button
              type="button"
              size="sm"
              variant={mode === "grades" ? "default" : "outline"}
              onClick={() => setModePersisted("grades")}
              disabled={loading || saving || submitting}
            >
              Noten
            </Button>
            <Button
              type="button"
              size="sm"
              variant={mode === "points" ? "default" : "outline"}
              onClick={() => setModePersisted("points")}
              disabled={loading || saving || submitting}
            >
              Punkte
            </Button>
          </div>

          <Button size="sm" variant="outline" onClick={openAllAreas} disabled={loading || areas.length === 0}>
            Alle öffnen
          </Button>
          <Button size="sm" variant="outline" onClick={closeAllAreas} disabled={loading || areas.length === 0}>
            Alle schließen
          </Button>

          <Button size="sm" variant="outline" onClick={handleSave} disabled={loading || saving || submitting || !hasDirty}>
            {saving ? "Speichern …" : "Speichern"}
          </Button>

          <Button
            size="sm"
            variant="default"
            className="bg-green-600 hover:bg-green-700"
            onClick={handleSubmit}
            disabled={loading || saving || submitting}
          >
            {submitting ? "Einreichen …" : "Einreichen"}
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {loading && <div>Fachgespräch wird geladen …</div>}

        {!loading && areas.length === 0 && (
          <div className="text-sm text-gray-500">Noch keine Areas vorhanden (Admin-Setup prüfen).</div>
        )}

        {!loading && areas.length > 0 && (
          <div className="space-y-4">
            {areas.map((a) => {
              const isOpen = !!a._open;
              const title = a.area_title?.trim() ? a.area_title : "Area";

              const areaIsRated =
                (typeof a.points_100 === "number" && !Number.isNaN(a.points_100)) ||
                (typeof a.grade === "number" && !Number.isNaN(a.grade));

              return (
                <div key={a.exam_expert_discussion_area_id} className="border border-gray-200 rounded-lg overflow-hidden">
                  {/* Accordion Header */}
                  <button
                    type="button"
                    onClick={() => toggleOpen(a.exam_expert_discussion_area_id)}
                    className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0 text-left">
                      <div className="text-sm font-medium">
                        <span className="font-semibold">{title}</span>
                        {a._dirty ? <span className="ml-2 text-amber-600 text-xs">geändert</span> : null}
                        {!areaIsRated ? <span className="ml-2 text-gray-400 text-xs">(nicht bewertet)</span> : null}
                      </div>

                      <div className="text-xs text-gray-500">
                        Note: {formatSchoolGrade(a.grade ?? null)} · Punkte: {fmtPoints(a.points_100)} / 100,00
                        <span className="ml-2">· Fragen: {a.items.length}</span>
                      </div>
                    </div>

                    <div className="shrink-0 text-xs text-gray-600">{isOpen ? "▾" : "▸"}</div>
                  </button>

                  {isOpen && (
                    <div className="p-3">
                      {(a.description || a.expected_answer) && (
                        <div className="text-xs text-gray-600 whitespace-pre-wrap mb-3">
                          {a.description ? `Hinweis: ${a.description}` : null}
                          {a.description && a.expected_answer ? "\n" : null}
                          {a.expected_answer ? `Erwartung: ${a.expected_answer}` : null}
                        </div>
                      )}

                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0" />
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleAddQuestion(a.exam_expert_discussion_area_id)}
                            disabled={saving || submitting}
                          >
                            Frage hinzufügen
                          </Button>
                        </div>
                      </div>

                      <div className="mt-3 grid grid-cols-1 md:grid-cols-[360px_1fr] gap-4">
                        {/* LEFT: Bewertung */}
                        <div className="space-y-3">
                          {mode === "grades" ? (
                            <div>
                              <div className="text-xs text-gray-500 mb-1">Note</div>
                              <GradePicker
                                value={a.grade ?? null}
                                onChange={(next) => {
                                  updateAreaLocal(a.exam_expert_discussion_area_id, {
                                    grade: next,
                                  });
                                }}
                              />
                              <div className="text-xs text-gray-400 mt-1">
                                Umrechnung in Punkte erfolgt serverseitig beim Speichern.
                              </div>
                            </div>
                          ) : (
                            <div>
                              <div className="text-xs text-gray-500 mb-1">Punkte (0–100)</div>
                              <PointsPicker
                                value={typeof a.points_100 === "number" ? a.points_100 : null}
                                maxPoints={100}
                                onChange={(next) => {
                                  updateAreaLocal(a.exam_expert_discussion_area_id, {
                                    points_100: next,
                                  });
                                }}
                              />
                              <div className="text-xs text-gray-400 mt-1">
                                Umrechnung in Note erfolgt serverseitig beim Speichern.
                              </div>
                            </div>
                          )}
                        </div>

                        {/* RIGHT: Fragen */}
                        <div className="space-y-3">
                          {a.items.length === 0 && (
                            <div className="text-sm text-gray-500">
                              Noch keine Fragen in dieser Area. Klicke „Frage hinzufügen“.
                            </div>
                          )}

                          {a.items
                            .slice()
                            .sort((x, y) => (x.sort_order ?? 1) - (y.sort_order ?? 1))
                            .map((it, idx) => (
                              <div key={it.exam_expert_discussion_item_id} className="border border-gray-200 rounded-md p-3">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="text-sm font-medium">
                                    Frage {idx + 1}
                                    {it._dirty ? <span className="ml-2 text-amber-600 text-xs">geändert</span> : null}
                                  </div>

                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleDeleteQuestion(it.exam_expert_discussion_item_id)}
                                    disabled={saving || submitting}
                                  >
                                    Löschen
                                  </Button>
                                </div>

                                <div className="mt-2 space-y-3">
                                  <div>
                                    <label className="block text-xs text-gray-500 mb-1">Frage</label>
                                    <input
                                      value={it.question_text ?? ""}
                                      onChange={(e) =>
                                        updateItemLocal(it.exam_expert_discussion_item_id, {
                                          question_text: e.target.value,
                                        })
                                      }
                                      placeholder="Frage / Stichwort"
                                      className="w-full border rounded-md px-2 py-1 text-sm"
                                    />
                                  </div>

                                  <div>
                                    <label className="block text-xs text-gray-500 mb-1">
                                      Antwort / Protokoll (Kandidat)
                                    </label>
                                    <textarea
                                      rows={2}
                                      value={it.answer_text ?? ""}
                                      onChange={(e) =>
                                        updateItemLocal(it.exam_expert_discussion_item_id, {
                                          answer_text: e.target.value,
                                        })
                                      }
                                      className="w-full border rounded-md px-2 py-1 text-sm"
                                    />
                                  </div>

                                  <div>
                                    <label className="block text-xs text-gray-500 mb-1">Kommentar Prüfer</label>
                                    <textarea
                                      rows={2}
                                      value={it.examiner_comment ?? ""}
                                      onChange={(e) =>
                                        updateItemLocal(it.exam_expert_discussion_item_id, {
                                          examiner_comment: e.target.value,
                                        })
                                      }
                                      className="w-full border rounded-md px-2 py-1 text-sm"
                                    />
                                  </div>
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>
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
}
// frontend/src/pages/ExamGradingPage.tsx