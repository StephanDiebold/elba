// src/components/exam/ExamPart1Form.tsx
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GradePicker, PointsPicker, type GradeMode } from "@/components/exam/GradePicker";

import type {
  MemberArea,
  MemberCriterionItem,
  MemberGradingSheetView,
} from "@/lib/api/exam.api";

export type LocalCriterion = MemberCriterionItem & { _dirty?: boolean };
export type LocalArea = Omit<MemberArea, "criteria"> & { criteria: LocalCriterion[] };
export type LocalView = Omit<MemberGradingSheetView, "areas"> & { areas: LocalArea[] };

function estimatePointsFromGrade(grade: number, maxPoints: number): number {
  // linear: 1 => 100%, 6 => 0%
  const factor = (6 - grade) / 5; // 1->1.0, 6->0.0
  const raw = maxPoints * factor;
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

export default function ExamPart1Form(props: {
  partId: number;
  view: LocalView | null;
  isLoading: boolean;

  mode: GradeMode;
  onModeChange: (next: GradeMode) => void;

  openAreas: Set<number>;
  onToggleArea: (areaId: number) => void;
  onOpenAll: () => void;
  onCloseAll: () => void;

  openHintsByItemId: Record<number, boolean>;
  onToggleHint: (itemId: number) => void;

  onUpdateCriterion: (
    areaId: number,
    itemId: number,
    patch: Partial<Pick<LocalCriterion, "grade" | "points" | "comment">>
  ) => void;

  onSave: () => void;
  onSubmit: () => void;

  saving: boolean;
  submitting: boolean;
  partHasDirty: boolean;
}) {
  const {
    view: v,
    isLoading,
    mode,
    onModeChange,
    openAreas,
    onToggleArea,
    onOpenAll,
    onCloseAll,
    openHintsByItemId,
    onToggleHint,
    onUpdateCriterion,
    onSave,
    onSubmit,
    saving,
    submitting,
    partHasDirty,
  } = props;

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
      area.criteria?.reduce((acc, c) => acc + (typeof c.max_points === "number" ? c.max_points : 0), 0) ??
      0;
    return { sumPoints, maxPoints };
  };

  const handleGradeChanged = (areaId: number, c: LocalCriterion, next: number | null) => {
    if (mode !== "grades") return;
    const nextPoints = next == null ? null : estimatePointsFromGrade(next, c.max_points);

    onUpdateCriterion(areaId, c.exam_grading_item_id, {
      grade: next,
      points: nextPoints,
    });
  };

  const handlePointsChanged = (areaId: number, c: LocalCriterion, next: number | null) => {
    if (mode !== "points") return;

    onUpdateCriterion(areaId, c.exam_grading_item_id, {
      points: next,
      grade: null,
    });
  };

  return (
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
              onClick={() => onModeChange("grades")}
              disabled={isLoading}
            >
              Noten
            </Button>
            <Button
              type="button"
              size="sm"
              variant={mode === "points" ? "default" : "outline"}
              onClick={() => onModeChange("points")}
              disabled={isLoading}
            >
              Punkte
            </Button>
          </div>

          {/* Alle öffnen/schließen */}
          <Button size="sm" variant="outline" onClick={onOpenAll} disabled={!v || isLoading}>
            Alle öffnen
          </Button>
          <Button size="sm" variant="outline" onClick={onCloseAll} disabled={!v || isLoading}>
            Alle schließen
          </Button>

          <div className="w-px h-6 bg-gray-200 mx-1" />

          <Button size="sm" variant="outline" onClick={onSave} disabled={!v || saving || !partHasDirty}>
            {saving ? "Speichern …" : "Speichern"}
          </Button>

          <Button
            size="sm"
            variant="default"
            className="bg-green-600 hover:bg-green-700"
            onClick={onSubmit}
            disabled={!v || submitting}
          >
            {submitting ? "Einreichen …" : "Einreichen"}
          </Button>
        </div>
      </div>

      <div className="p-4">
        {isLoading && <div>Bewertungsbogen wird geladen …</div>}

        {!isLoading && !v && <div className="text-sm text-gray-500">Kein Bewertungsbogen verfügbar.</div>}

        {!isLoading && v && (
          <div className="space-y-4">
            {v.areas.map((area) => {
              const isOpen = openAreas.has(area.grading_area_id);
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
                    onClick={() => onToggleArea(area.grading_area_id)}
                    className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 flex items-center justify-between"
                  >
                    <div className="text-left">
                      <div className="font-semibold">
                        {area.area_number}. {area.title}
                      </div>
                      {area.description && (
                        <div className="text-xs text-gray-500">{area.description}</div>
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
                          c.max_points > 0 ? Math.round((achieved / c.max_points) * 100) : 0;

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
                                  Punkte: {fmtPoints(achieved)} / {fmtMaxPoints(c.max_points)}
                                  {mode === "points" && <span className="ml-2">({pct}%)</span>}
                                  {c._dirty ? <span className="ml-2 text-amber-600">geändert</span> : null}
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
                                  onClick={() => onToggleHint(c.exam_grading_item_id)}
                                >
                                  Hinweise {hintOpen ? "ausblenden" : "anzeigen"}
                                </Button>
                              </div>
                            </div>

                            <div
                              className={[
                                "mt-3 grid grid-cols-1 gap-4",
                                hintOpen ? "md:grid-cols-[1fr_320px]" : "md:grid-cols-1",
                              ].join(" ")}
                            >
                              {/* LEFT */}
                              <div className="space-y-3">
                                {mode === "grades" ? (
                                  <GradePicker
                                    value={c.grade ?? null}
                                    onChange={(next) =>
                                      handleGradeChanged(area.grading_area_id, c, next)
                                    }
                                  />
                                ) : (
                                  <div>
                                    <div className="text-xs text-gray-500 mb-1">Punkte</div>
                                    <PointsPicker
                                      value={c.points ?? null}
                                      maxPoints={c.max_points}
                                      onChange={(next) =>
                                        handlePointsChanged(area.grading_area_id, c, next)
                                      }
                                    />
                                  </div>
                                )}

                                <div>
                                  <label className="block text-xs text-gray-500 mb-1">Kommentar</label>
                                  <textarea
                                    rows={2}
                                    value={c.comment ?? ""}
                                    onChange={(e) =>
                                      onUpdateCriterion(area.grading_area_id, c.exam_grading_item_id, {
                                        comment: e.target.value,
                                      })
                                    }
                                    className="w-full border rounded-md px-2 py-1 text-sm"
                                  />
                                </div>
                              </div>

                              {/* RIGHT */}
                              {hintOpen && (
                                <div className="border rounded-lg bg-gray-50 p-3">
                                  <div className="text-sm font-medium mb-2">Hinweise</div>
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
                        <div className="text-sm text-gray-500">Keine Kriterien in diesem Bereich.</div>
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
  );
}
// End of src/components/exam/ExamPart1Form.tsx