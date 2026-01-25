// frontend/src/components/exam/ExpertDiscussionForm.tsx
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GradePicker, PointsPicker, type GradeMode } from "@/components/exam/GradePicker";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import {
  fetchExpertDiscussionBundle,
  updateExpertDiscussionAreaScore,
  createExpertDiscussionItem,
  updateExpertDiscussionItem,
  deleteExpertDiscussionItem,
  submitExpertDiscussion,
  fetchExpertDiscussionAreaTemplates,
  addExpertDiscussionArea,
  deleteExpertDiscussionArea,
  type ExpertDiscussionAreaTemplate,
  type ExpertDiscussionBundleOut,
  type ExamExpertDiscussionAreaOut,
  type ExamExpertDiscussionItemOut,
} from "@/lib/api/exam.api";

type ExpertDiscussionFormProps = {
  examId: number;
  initialOpenAreaIndex?: number; // default 0
};

type LocalItem = ExamExpertDiscussionItemOut & { _dirty?: boolean };
type LocalArea = Omit<ExamExpertDiscussionAreaOut, "items"> & {
  items: LocalItem[];
  _open?: boolean;

  // State flags
  _dirty?: boolean; // irgendwas in der Area geändert (Items / Struktur)
  _scoreDirty?: boolean; // Note/Punkte geändert
  _saved?: boolean; // "gespeichert" im Header bis wieder geändert
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

function formatSchoolGrade(grade: number | null | undefined): string {
  if (grade == null || Number.isNaN(grade)) return "—";

  // auf 2 Nachkommastellen stabil runden
  const g = Math.round(grade * 100) / 100;
  const frac = Math.abs(g % 1);

  // .25 oder .75 → 2 Nachkommastellen
  if (Math.abs(frac - 0.25) < 1e-9 || Math.abs(frac - 0.75) < 1e-9) {
    return g.toFixed(2).replace(".", ",");
  }

  // alles andere → 1 Nachkommastelle
  return g.toFixed(1).replace(".", ",");
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

function mapBundleToLocal(data: ExpertDiscussionBundleOut, initialOpenAreaIndex: number): LocalArea[] {
  return (data.areas ?? []).map((a, idx) => ({
    ...a,
    _open: idx === initialOpenAreaIndex,
    _dirty: false,
    _scoreDirty: false,
    _saved: false,
    items: (a.items ?? []).map((it) => ({ ...it, _dirty: false })),
  }));
}

/**
 * Combobox light – ein Feld (Input) + Vorlagen Dropdown
 */
function TemplateCombobox({
  templates,
  valueText,
  valueTemplateId,
  onPickTemplate,
  onChangeText,
}: {
  templates: Array<{ template_item_id: number; item_text: string | null }>;
  valueText: string;
  valueTemplateId: number | null;
  onPickTemplate: (tplId: number | null) => void;
  onChangeText: (next: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return templates;
    return templates.filter((t) => (t.item_text ?? "").toLowerCase().includes(q));
  }, [templates, query]);

  return (
    <div className="relative">
      <div className="flex gap-2">
        <input
          value={valueText}
          onChange={(e) => onChangeText(e.target.value)}
          placeholder="Frage / Stichwort"
          className="w-full border rounded-md px-2 py-1 text-sm"
          onFocus={() => setOpen(false)}
        />
        <Button type="button" variant="outline" size="sm" onClick={() => setOpen((v) => !v)}>
          Vorlagen
        </Button>
      </div>

      {open && (
        <div className="absolute z-50 mt-2 w-full rounded-md border bg-white shadow-md p-2">
          <div className="flex items-center gap-2 mb-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Vorlage suchen…"
              className="w-full border rounded-md px-2 py-1 text-sm"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                onPickTemplate(null);
                setOpen(false);
              }}
            >
              Keine
            </Button>
          </div>

          <div className="max-h-56 overflow-auto space-y-1">
            {filtered.map((t) => (
              <button
                key={t.template_item_id}
                type="button"
                className={`w-full text-left px-2 py-1 rounded hover:bg-gray-100 ${
                  valueTemplateId === t.template_item_id ? "bg-gray-100" : ""
                }`}
                onClick={() => {
                  onPickTemplate(t.template_item_id);
                  setOpen(false);
                }}
              >
                {t.item_text?.trim() ? t.item_text : `Vorlage #${t.template_item_id}`}
              </button>
            ))}
            {filtered.length === 0 && <div className="text-sm text-gray-500 px-2 py-2">Keine Treffer</div>}
          </div>
        </div>
      )}
    </div>
  );
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

  /* ----------------------------- Load / Reload ----------------------------- */

  const getUiMap = (list: LocalArea[]) =>
    new Map<number, { open: boolean; saved: boolean }>(
      list.map((a) => [a.exam_expert_discussion_area_id, { open: !!a._open, saved: !!a._saved }])
    );

  const reloadAll = async (opts?: {
    openAreaTemplateId?: number; // nach Add: neue Area aufklappen
    preserveOpen?: boolean; // Open-State beibehalten
    preserveSaved?: boolean; // Saved-State beibehalten
    closeAll?: boolean; // nach Reload alles schließen
  }) => {
    const { openAreaTemplateId, preserveOpen = false, preserveSaved = true, closeAll = false } = opts ?? {};

    const prevUi = preserveOpen || preserveSaved ? getUiMap(areas) : null;

    const data = await fetchExpertDiscussionBundle(examId);
    setBundle(data);

    const local = mapBundleToLocal(data, initialOpenAreaIndex);

    // UI-Flags mergen (open + saved)
    if (prevUi) {
      for (const a of local) {
        const prev = prevUi.get(a.exam_expert_discussion_area_id);
        if (!prev) continue;
        if (preserveOpen) a._open = prev.open;
        if (preserveSaved) a._saved = prev.saved;
      }
    }

    if (closeAll) {
      for (const a of local) a._open = false;
    }

    if (openAreaTemplateId != null) {
      for (const a of local) {
        if (a.expert_discussion_area_id === openAreaTemplateId) a._open = true;
      }
    }

    setAreas(local);
  };

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        const data = await fetchExpertDiscussionBundle(examId);
        if (cancelled) return;

        setBundle(data);
        setAreas(mapBundleToLocal(data, initialOpenAreaIndex));
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
    // Fallbacks (falls Backend totals noch nicht liefert)
    const { total, counted } = computeTotalPoints100(areas);

    const fallbackAvgGrade = (() => {
      const graded = areas.filter((a) => typeof a.grade === "number" && !Number.isNaN(a.grade)) as Array<
        LocalArea & { grade: number }
      >;
      return graded.length > 0
        ? Math.round((graded.reduce((acc, a) => acc + Number(a.grade), 0) / graded.length) * 100) / 100
        : null;
    })();

    return {
      totalPoints100: (bundle?.total_points_100 ?? null) ?? total,
      counted,
      avgGrade: (bundle?.total_grade ?? null) ?? fallbackAvgGrade,
    };
  }, [areas, bundle]);


  const hasDirty = useMemo(() => {
  return areas.some((a) => !!a._dirty || !!a._scoreDirty || a.items.some((i) => !!i._dirty));
}, [areas]);


  /* ----------------------------- UI helpers ----------------------------- */

  const toggleOpen = (examAreaId: number) => {
    setAreas((prev) => prev.map((a) => (a.exam_expert_discussion_area_id === examAreaId ? { ...a, _open: !a._open } : a)));
  };

  const openAllAreas = () => setAreas((prev) => prev.map((a) => ({ ...a, _open: true })));
  const closeAllAreas = () => setAreas((prev) => prev.map((a) => ({ ...a, _open: false })));

  const updateAreaLocal = (examAreaId: number, patch: Partial<LocalArea>) => {
    const touchesScore = "grade" in patch || "points_100" in patch;

    setAreas((prev) =>
      prev.map((a) =>
        a.exam_expert_discussion_area_id === examAreaId
          ? {
              ...a,
              ...patch,
              _dirty: true,
              _saved: false, // sobald geändert: "gespeichert" aus (nur für diese Area)
              _scoreDirty: touchesScore ? true : a._scoreDirty,
            }
          : a
      )
    );
  };

  const updateItemLocal = (itemId: number, patch: Partial<LocalItem>) => {
    setAreas((prev) =>
      prev.map((a) => {
        const hit = a.items.some((it) => it.exam_expert_discussion_item_id === itemId);
        if (!hit) return a;

        return {
          ...a,
          _dirty: true,
          _saved: false, // sobald geändert: "gespeichert" aus (nur für diese Area)
          items: a.items.map((it) => (it.exam_expert_discussion_item_id === itemId ? { ...it, ...patch, _dirty: true } : it)),
        };
      })
    );
  };

  const markAreaSavedLocal = (examAreaId: number) => {
    setAreas((prev) =>
      prev.map((a) =>
        a.exam_expert_discussion_area_id === examAreaId
          ? {
              ...a,
              _dirty: false,
              _scoreDirty: false,
              _saved: true,
              items: a.items.map((it) => ({ ...it, _dirty: false })),
            }
          : a
      )
    );
  };

  const markAllSavedLocal = () => {
    setAreas((prev) =>
      prev.map((a) => ({
        ...a,
        _dirty: false,
        _scoreDirty: false,
        _saved: true,
        items: a.items.map((it) => ({ ...it, _dirty: false })),
      }))
    );
  };

  /* ----------------------------- Add Area Dialog ----------------------------- */

  const [addOpen, setAddOpen] = useState(false);
  const [templates, setTemplates] = useState<ExpertDiscussionAreaTemplate[]>([]);
  const [newAreaId, setNewAreaId] = useState<string>("");
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  const existingAreaIds = useMemo(() => {
    const ids = new Set<number>();
    (areas ?? []).forEach((a) => ids.add(a.expert_discussion_area_id));
    return ids;
  }, [areas]);

  const templatesToAdd = useMemo(() => {
    const list = (templates ?? [])
      .map((t) => ({
        expert_discussion_area_id: Number((t as any).expert_discussion_area_id),
        name: String((t as any).name ?? ""),
        sort_order: Number((t as any).sort_order ?? 0),
        code: (t as any).code ?? null,
      }))
      .filter((t) => Number.isFinite(t.expert_discussion_area_id) && t.expert_discussion_area_id > 0);

    return list
      .filter((t) => !existingAreaIds.has(t.expert_discussion_area_id))
      .sort((a, b) => a.sort_order - b.sort_order);
  }, [templates, existingAreaIds]);

  const openAddDialog = async () => {
    setAddOpen(true);
    setNewAreaId("");
    setLoadingTemplates(true);

    try {
      const rows = await fetchExpertDiscussionAreaTemplates(examId);
      setTemplates(rows);
    } catch (err) {
      console.error(err);
      toast.error("Area-Vorlagen konnten nicht geladen werden.");
      setTemplates([]);
    } finally {
      setLoadingTemplates(false);
    }
  };

  /* ----------------------------- CRUD ----------------------------- */

  const handleAddArea = async () => {
    const id = Number(newAreaId);
    if (!Number.isFinite(id) || id <= 0) return;

    if (existingAreaIds.has(id)) {
      toast.info("Diese Area ist bereits vorhanden.");
      return;
    }

    try {
      await addExpertDiscussionArea(examId, id);
      toast.success("Area hinzugefügt.");

      setAddOpen(false);
      setNewAreaId("");

      // open-state beibehalten + neue Area aufklappen
      await reloadAll({ preserveOpen: true, preserveSaved: true, openAreaTemplateId: id });
    } catch (err: any) {
      console.error(err);
      const msg = String(err?.message ?? "");
      if (msg.toLowerCase().includes("already exists") || msg.toLowerCase().includes("schon vorhanden")) {
        toast.info("Diese Area ist bereits vorhanden.");
      } else {
        toast.error("Area konnte nicht hinzugefügt werden.");
      }
    }
  };

  const handleAddQuestion = async (examAreaId: number) => {
    try {
      const created = await createExpertDiscussionItem(examId, examAreaId, {
        template_item_id: null,
        question_text: "",
        answer_text: "",
        examiner_comment: "",
      });

      setAreas((prev) =>
        prev.map((a) =>
          a.exam_expert_discussion_area_id === examAreaId
            ? { ...a, _dirty: true, _saved: false, items: [...a.items, { ...created, _dirty: false }], _open: true }
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
          _dirty: true,
          _saved: false,
          items: a.items.filter((it) => it.exam_expert_discussion_item_id !== itemId),
        }))
      );

      toast.success("Frage gelöscht.");
    } catch (err) {
      console.error(err);
      toast.error("Frage konnte nicht gelöscht werden.");
    }
  };

  const handleSaveArea = async (examAreaId: number) => {
    const area = areas.find((x) => x.exam_expert_discussion_area_id === examAreaId);
    if (!area) return;

    try {
      setSaving(true);

      // 1) Score speichern (Note/Punkte)
      if (area._scoreDirty) {
        await updateExpertDiscussionAreaScore(examId, examAreaId, {
          mode,
          grade: mode === "grades" ? area.grade ?? null : null,
          points_100: mode === "points" ? area.points_100 ?? null : null,
        });
      }

      // 2) Items speichern (nur dirty)
      for (const it of area.items) {
        if (!it._dirty) continue;

        await updateExpertDiscussionItem(examId, it.exam_expert_discussion_item_id, {
          template_item_id: it.template_item_id ?? null,
          question_text: it.question_text ?? "",
          answer_text: it.answer_text ?? null,
          examiner_comment: it.examiner_comment ?? null,
          sort_order: it.sort_order ?? 1,
        });
      }

      // Regel: nach Area-save nichts schließen -> preserveOpen
      // UND: Saved-Status aller anderen Areas beibehalten
      await reloadAll({ preserveOpen: true, preserveSaved: true });

      // Genau diese Area als "gespeichert" markieren (bleibt stehen bis Änderung)
      markAreaSavedLocal(examAreaId);

      toast.success("Area gespeichert");
    } catch (err) {
      console.error(err);
      toast.error("Speichern der Area fehlgeschlagen");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteArea = async (examAreaId: number) => {
    const area = areas.find((x) => x.exam_expert_discussion_area_id === examAreaId);
    if (!area) return;

    const ok = window.confirm(`Area „${area.area_title ?? "Area"}“ wirklich entfernen?`);
    if (!ok) return;

    try {
      setSaving(true);
      await deleteExpertDiscussionArea(examId, examAreaId);

      // nach delete: Open-State beibehalten, Saved-State beibehalten
      await reloadAll({ preserveOpen: true, preserveSaved: true });

      toast.success("Area entfernt");
    } catch (err) {
      console.error(err);
      toast.error("Area konnte nicht entfernt werden");
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    try {
      const dirtyAreas = areas.filter((a) => a._scoreDirty || a._dirty);
      const dirtyItems: LocalItem[] = [];
      for (const a of areas) for (const it of a.items) if (it._dirty) dirtyItems.push(it);

      if (dirtyAreas.length === 0 && dirtyItems.length === 0) {
        toast.info("Keine Änderungen zum Speichern.");
        return;
      }

      setSaving(true);

      // 1) Score Updates
      for (const a of dirtyAreas) {
        if (!a._scoreDirty) continue;

        await updateExpertDiscussionAreaScore(examId, a.exam_expert_discussion_area_id, {
          mode,
          points_100: mode === "points" ? (a.points_100 ?? null) : null,
          grade: mode === "grades" ? (a.grade ?? null) : null,
        });
      }

      // 2) Item Updates
      for (const it of dirtyItems) {
        await updateExpertDiscussionItem(examId, it.exam_expert_discussion_item_id, {
          template_item_id: it.template_item_id ?? null,
          question_text: it.question_text ?? "",
          answer_text: it.answer_text ?? null,
          examiner_comment: it.examiner_comment ?? null,
          sort_order: it.sort_order ?? 1,
        });
      }

      // Regel: nach global save -> alle Areas schließen
      await reloadAll({ closeAll: true, preserveSaved: true });

      // Lokal: alle Areas als "gespeichert" markieren (bleibt bis Änderung)
      markAllSavedLocal();

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
          <p className="text-xs text-gray-500">Teil 2 · Bewertung pro Area · Gesamt: Durchschnitt über bewertete Areas</p>
          {bundle && (
            <p className="text-xs text-gray-400">
              Exam #{bundle.exam_id} · Subject #{bundle.subject_id} · Part #{bundle.exam_part_id}
            </p>
          )}
        </div>

        {/* Add Area Dialog */}
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Neue Area hinzufügen</DialogTitle>
            </DialogHeader>

            <div className="space-y-2">
              <div className="text-sm text-gray-600">Area auswählen</div>

              <Select value={newAreaId || undefined} onValueChange={(v) => setNewAreaId(v)}>
                <SelectTrigger>
                  <SelectValue placeholder={loadingTemplates ? "lädt…" : "Bitte wählen…"} />
                </SelectTrigger>

                <SelectContent>
                  {templatesToAdd.map((t) => (
                    <SelectItem key={t.expert_discussion_area_id} value={String(t.expert_discussion_area_id)}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {!loadingTemplates && templatesToAdd.length === 0 && (
                <div className="text-sm text-gray-500">Es sind keine weiteren Areas verfügbar.</div>
              )}
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={() => setAddOpen(false)}>
                Abbrechen
              </Button>
              <Button onClick={handleAddArea} disabled={!newAreaId || loadingTemplates}>
                Hinzufügen
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <div className="flex items-center gap-2 flex-wrap justify-end">
          <Badge variant="secondary" className="bg-transparent border border-gray-300 text-gray-700">
            Σ {totals.totalPoints100 == null ? "—" : fmtPoints(totals.totalPoints100)} / 100,00 Punkte
            <span className="ml-2 text-gray-500">({totals.counted} Areas)</span>
          </Badge>

          <Badge variant="secondary" className="bg-transparent border border-gray-300 text-gray-700">
            Ø Note: {formatSchoolGrade(totals.avgGrade)}
          </Badge>

          <div className="w-px h-6 bg-gray-200 mx-1" />

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

          <Button size="sm" variant="outline" onClick={openAddDialog} disabled={loading || saving || submitting}>
            Neue Area hinzufügen
          </Button>

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

              const areaDirty = !!a._dirty || !!a._scoreDirty || a.items.some((it) => !!it._dirty);

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

                        {areaDirty ? (
                          <span className="ml-2 text-amber-600 text-xs">geändert</span>
                        ) : a._saved ? (
                          <span className="ml-2 text-emerald-700 text-xs">gespeichert</span>
                        ) : null}

                        {!areaIsRated ? <span className="ml-2 text-gray-400 text-xs">(nicht bewertet)</span> : null}
                      </div>

                      <div className="text-xs text-gray-500">
                        Note: {formatSchoolGrade(a.grade ?? null)} · Punkte: {fmtPoints(a.points_100)} / 100,00
                        <span className="ml-2">· Fragen: {a.items.length}</span>
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={saving || submitting || !areaDirty}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleSaveArea(a.exam_expert_discussion_area_id);
                        }}
                      >
                        Speichern
                      </Button>

                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={saving || submitting}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleDeleteArea(a.exam_expert_discussion_area_id);
                        }}
                      >
                        Area entfernen
                      </Button>

                      <span className="ml-1 text-xs text-gray-600">{isOpen ? "▾" : "▸"}</span>
                    </div>
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
                                onChange={(next) => updateAreaLocal(a.exam_expert_discussion_area_id, { grade: next })}
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
                                onChange={(next) =>
                                  updateAreaLocal(a.exam_expert_discussion_area_id, { points_100: next })
                                }
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

                                    <TemplateCombobox
                                      templates={(a.template_items ?? []).map((x) => ({
                                        template_item_id: x.template_item_id,
                                        item_text: x.item_text,
                                      }))}
                                      valueText={it.question_text ?? ""}
                                      valueTemplateId={it.template_item_id ?? null}
                                      onChangeText={(next) =>
                                        updateItemLocal(it.exam_expert_discussion_item_id, { question_text: next })
                                      }
                                      onPickTemplate={(tplId) => {
                                        const current = (it.question_text ?? "").trim();
                                        let nextText: string | undefined;

                                        if (!current && tplId != null) {
                                          const hit = (a.template_items ?? []).find((x) => x.template_item_id === tplId);
                                          const txt = hit?.item_text?.trim();
                                          if (txt) nextText = txt;
                                        }

                                        updateItemLocal(it.exam_expert_discussion_item_id, {
                                          template_item_id: tplId,
                                          ...(nextText ? { question_text: nextText } : {}),
                                        });
                                      }}
                                    />
                                  </div>

                                  <div>
                                    <label className="block text-xs text-gray-500 mb-1">Antwort / Protokoll (Kandidat)</label>
                                    <textarea
                                      rows={2}
                                      value={it.answer_text ?? ""}
                                      onChange={(e) =>
                                        updateItemLocal(it.exam_expert_discussion_item_id, { answer_text: e.target.value })
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
// End of frontend/src/components/exam/ExpertDiscussionForm.tsx
