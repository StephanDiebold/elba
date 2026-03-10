// src/pages/ExamDayGradingPage.tsx
//
// Master-Detail Bewertungsshell für einen Prüfungstag.
//
// Phase 3 Änderungen:
//   - Kandidaten-Header zeigt Part1Mode-Badge (Präsentation / Durchführung)
//   - examMetaByExamId trackt part1_mode + status pro geladener Prüfung
//   - Sidebar-Item zeigt ebenfalls Modus-Dot
//
// Route: /pruefungstage/:examDayId/bewertung
// Diese Seite liegt AUSSERHALB von AppShell (volle Bildschirmhöhe).
//

import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { ChevronLeft, ChevronRight, Users, ClipboardList } from "lucide-react";

import { getExamDay, listExamDayTeams, listExamSlots } from "@/lib/api/planner.api";
import type { ExamDay, ExamDayTeam, ExamSlot } from "@/lib/api/planner.api";

import ExamGradingView from "@/components/exam/ExamGradingView";
import type { ExamWithParts, Part1Mode } from "@/lib/api/exam.api";

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("de-DE", {
      weekday: "short",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function formatTime(t: string): string {
  return t?.slice(0, 5) ?? t;
}

function candidateName(slot: ExamSlot): string {
  const first = slot.candidate_first_name ?? "";
  const last = slot.candidate_last_name ?? "";
  if (!first && !last) return `Prüfling #${slot.candidate_id ?? "?"}`;
  return `${last}, ${first}`.replace(/^,\s*/, "");
}

function part1ModeLabel(mode: Part1Mode | string | null | undefined): string {
  if (mode === "presentation") return "Präsentation";
  if (mode === "demonstration") return "Durchführung";
  return "";
}

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

type GradingStatus = "open" | "active" | "done";

interface ExamMeta {
  part1_mode: Part1Mode | null;
  allSubmitted: boolean;
}

// ─────────────────────────────────────────────────────────────
// Part1Mode Inline Badge (inline – kein Import nötig)
// ─────────────────────────────────────────────────────────────

function ModeBadge({ mode }: { mode: Part1Mode | string | null | undefined }) {
  if (!mode) return null;
  const label = part1ModeLabel(mode);
  const cls =
    mode === "presentation"
      ? "bg-blue-50 text-blue-600 border-blue-200"
      : "bg-orange-50 text-orange-600 border-orange-200";
  return (
    <span className={`inline-flex items-center text-xs px-1.5 py-0.5 rounded border font-medium ${cls}`}>
      {label}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────
// Candidate Sidebar Item
// ─────────────────────────────────────────────────────────────

interface CandidateItemProps {
  slot: ExamSlot;
  isSelected: boolean;
  status: GradingStatus;
  meta: ExamMeta | null;
  onClick: () => void;
}

function CandidateItem({ slot, isSelected, status, meta, onClick }: CandidateItemProps) {
  const dotClass: Record<GradingStatus, string> = {
    open: "bg-gray-300",
    active: "bg-blue-500 animate-pulse",
    done: "bg-green-500",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "w-full text-left px-3 py-2 rounded-lg transition-all",
        isSelected
          ? "bg-blue-50 border border-blue-200 shadow-sm"
          : "hover:bg-gray-50 border border-transparent",
      ].join(" ")}
    >
      <div className="flex items-start gap-2.5">
        <span className={["w-2.5 h-2.5 rounded-full shrink-0 mt-1", dotClass[status]].join(" ")} />
        <div className="min-w-0 flex-1">
          <div className={["text-sm font-medium truncate", isSelected ? "text-blue-700" : "text-gray-800"].join(" ")}>
            {candidateName(slot)}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            <span className="text-xs text-gray-400">
              {formatTime(slot.start_time)}
            </span>
            {meta?.part1_mode && <ModeBadge mode={meta.part1_mode} />}
          </div>
        </div>
      </div>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────

export default function ExamDayGradingPage() {
  const { examDayId: examDayIdStr } = useParams<{ examDayId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const examDayId = Number(examDayIdStr);

  const [examDay, setExamDay] = useState<ExamDay | null>(null);
  const [teams, setTeams] = useState<ExamDayTeam[]>([]);
  const [slots, setSlots] = useState<ExamSlot[]>([]);
  const [loading, setLoading] = useState(true);

  const selectedExamId = searchParams.get("exam") ? Number(searchParams.get("exam")) : null;
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Tracking: part1_mode + allSubmitted pro Exam
  const [examMetaById, setExamMetaById] = useState<Record<number, ExamMeta>>({});

  /* ─── Data Loading ─── */
  useEffect(() => {
    if (!examDayId || Number.isNaN(examDayId)) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const [day, teamsData, slotsData] = await Promise.all([
          getExamDay(examDayId),
          listExamDayTeams(examDayId),
          listExamSlots(examDayId),
        ]);
        if (cancelled) return;
        setExamDay(day);
        setTeams(teamsData);
        setSlots(slotsData);

        // Auto-select ersten belegten Slot
        if (!searchParams.get("exam")) {
          const first = slotsData.find((s) => s.exam_id != null);
          if (first?.exam_id) {
            setSearchParams({ exam: String(first.exam_id) }, { replace: true });
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [examDayId]); // eslint-disable-line react-hooks/exhaustive-deps

  const bookedSlots = slots.filter((s) => s.exam_id != null && s.candidate_id != null);

  const slotsByTeam: Record<number, ExamSlot[]> = {};
  for (const s of bookedSlots) {
    if (!slotsByTeam[s.exam_day_team_id]) slotsByTeam[s.exam_day_team_id] = [];
    slotsByTeam[s.exam_day_team_id].push(s);
  }

  const getStatus = useCallback((slot: ExamSlot): GradingStatus => {
    if (!slot.exam_id) return "open";
    const meta = examMetaById[slot.exam_id];
    if (meta?.allSubmitted) return "done";
    if (slot.exam_id === selectedExamId) return "active";
    return "open";
  }, [examMetaById, selectedExamId]);

  const handleSelectExam = useCallback((examId: number) => {
    setSearchParams({ exam: String(examId) });
  }, [setSearchParams]);

  /* ─── Callback von ExamGradingView wenn Exam sich ändert ─── */
  const handleExamChanged = useCallback((exam: ExamWithParts) => {
    const allSubmitted =
      exam.parts?.length > 0 &&
      exam.parts.every((p: any) => p.my_status === "submitted");

    setExamMetaById((prev) => ({
      ...prev,
      [exam.exam_id]: {
        part1_mode: exam.part1_mode ?? null,
        allSubmitted,
      },
    }));
  }, []);

  /* ─── Keyboard Navigation ─── */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!["ArrowUp", "ArrowDown"].includes(e.key)) return;
      if (!selectedExamId) return;
      const idx = bookedSlots.findIndex((s) => s.exam_id === selectedExamId);
      if (idx === -1) return;
      e.preventDefault();
      const next = e.key === "ArrowDown" ? bookedSlots[idx + 1] : bookedSlots[idx - 1];
      if (next?.exam_id) handleSelectExam(next.exam_id);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [bookedSlots, selectedExamId, handleSelectExam]);

  /* ─── Summaries ─── */
  const doneCount = bookedSlots.filter(
    (s) => s.exam_id != null && examMetaById[s.exam_id!]?.allSubmitted
  ).length;

  /* ─── Render: Loading ─── */
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen text-sm text-muted-foreground">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <div>Prüfungstag wird geladen …</div>
        </div>
      </div>
    );
  }

  /* ─── Render: Main ─── */
  const activeSlot = bookedSlots.find((s) => s.exam_id === selectedExamId) ?? null;
  const activeMeta = selectedExamId ? (examMetaById[selectedExamId] ?? null) : null;
  const activeTeamName = activeSlot
    ? (teams.find((t) => t.exam_day_team_id === activeSlot.exam_day_team_id)?.name ?? null)
    : null;

  const idx = selectedExamId ? bookedSlots.findIndex((s) => s.exam_id === selectedExamId) : -1;
  const prevSlot = idx > 0 ? bookedSlots[idx - 1] : null;
  const nextSlot = idx >= 0 && idx < bookedSlots.length - 1 ? bookedSlots[idx + 1] : null;

  return (
    <div className="flex flex-col h-screen bg-gray-50 overflow-hidden">

      {/* ── Header ── */}
      <header className="shrink-0 bg-white border-b border-gray-200 px-4 h-14 flex items-center gap-3 shadow-sm">
        <button
          type="button"
          onClick={() => navigate(`/pruefungstage/${examDayId}`)}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors group"
        >
          <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          <span className="hidden sm:inline">Planung</span>
        </button>

        <div className="w-px h-5 bg-gray-200" />

        <div className="flex items-center gap-2 min-w-0">
          <ClipboardList className="w-4 h-4 text-blue-500 shrink-0" />
          <span className="font-semibold text-sm text-gray-800">Bewertung</span>
          {examDay && (
            <span className="text-sm text-gray-500 hidden sm:inline">
              · {formatDate(examDay.date)}
              {examDay.location && <span className="hidden md:inline"> · {examDay.location}</span>}
            </span>
          )}
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-3 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <Users className="w-3.5 h-3.5" />
            {bookedSlots.length} Prüflinge
          </span>
          <span className={doneCount === bookedSlots.length && bookedSlots.length > 0 ? "text-green-600 font-semibold" : "text-gray-500"}>
            {doneCount} / {bookedSlots.length} eingereicht
          </span>
        </div>
      </header>

      {/* ── Body ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Sidebar ── */}
        <aside className={[
          "shrink-0 bg-white border-r border-gray-200 flex flex-col transition-all duration-200 overflow-hidden",
          sidebarOpen ? "w-56" : "w-10",
        ].join(" ")}>

          {/* Sidebar Header */}
          <div className="h-10 flex items-center justify-between px-2 border-b border-gray-100 shrink-0">
            {sidebarOpen && (
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-1">
                Kandidaten
              </span>
            )}
            <button
              type="button"
              onClick={() => setSidebarOpen((v) => !v)}
              className="ml-auto p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
              title={sidebarOpen ? "Einklappen" : "Ausklappen"}
            >
              {sidebarOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
          </div>

          {/* Kandidaten List */}
          {sidebarOpen && (
            <div className="flex-1 overflow-y-auto py-2 px-2 space-y-3">
              {bookedSlots.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-4">Keine Prüflinge zugewiesen.</p>
              )}

              {teams.map((team) => {
                const teamSlots = slotsByTeam[team.exam_day_team_id] ?? [];
                if (teamSlots.length === 0) return null;

                return (
                  <div key={team.exam_day_team_id}>
                    <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-2 pb-1">
                      {team.name || `Ausschuss ${team.exam_day_team_id}`}
                    </div>
                    <div className="space-y-0.5">
                      {teamSlots.map((slot) => (
                        <CandidateItem
                          key={slot.exam_slot_id}
                          slot={slot}
                          isSelected={slot.exam_id === selectedExamId}
                          status={getStatus(slot)}
                          meta={slot.exam_id ? (examMetaById[slot.exam_id] ?? null) : null}
                          onClick={() => slot.exam_id && handleSelectExam(slot.exam_id)}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}

              {bookedSlots.length > 1 && (
                <p className="text-[10px] text-gray-300 text-center pt-2">↑ ↓ zum Navigieren</p>
              )}
            </div>
          )}

          {/* Collapsed: dots only */}
          {!sidebarOpen && (
            <div className="flex-1 overflow-y-auto py-3 flex flex-col items-center gap-2">
              {bookedSlots.map((slot) => {
                const status = getStatus(slot);
                const dot: Record<GradingStatus, string> = {
                  open: "bg-gray-300",
                  active: "bg-blue-500",
                  done: "bg-green-500",
                };
                return (
                  <button
                    key={slot.exam_slot_id}
                    type="button"
                    onClick={() => slot.exam_id && handleSelectExam(slot.exam_id)}
                    title={candidateName(slot)}
                    className={[
                      "w-7 h-7 rounded-full flex items-center justify-center transition-all",
                      slot.exam_id === selectedExamId ? "ring-2 ring-blue-400 ring-offset-1" : "hover:scale-110",
                    ].join(" ")}
                  >
                    <span className={["w-3 h-3 rounded-full", dot[status]].join(" ")} />
                  </button>
                );
              })}
            </div>
          )}
        </aside>

        {/* ── Main Content ── */}
        <main className="flex-1 overflow-y-auto">
          {!selectedExamId ? (
            <div className="flex items-center justify-center h-full text-center">
              <div className="space-y-3 text-gray-400">
                <ClipboardList className="w-10 h-10 mx-auto opacity-30" />
                <div className="text-sm font-medium">Kandidat auswählen</div>
                <div className="text-xs max-w-[200px]">
                  Links einen Prüfling auswählen, um die Bewertung zu starten.
                </div>
              </div>
            </div>
          ) : (
            <div className="px-6 py-5 max-w-5xl">
              {/* ── Kandidaten-Header ── */}
              {activeSlot && (
                <div className="mb-5 flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2 text-xs text-gray-400 uppercase tracking-wide mb-1">
                      <span>{activeTeamName ?? "Ausschuss"}</span>
                      <span>·</span>
                      <span>Slot {activeSlot.slot_index}</span>
                      {/* ✅ Mode-Badge im Kandidaten-Header */}
                      {activeMeta?.part1_mode && (
                        <>
                          <span>·</span>
                          <ModeBadge mode={activeMeta.part1_mode} />
                        </>
                      )}
                    </div>
                    <h2 className="text-xl font-semibold text-gray-900">
                      {candidateName(activeSlot)}
                    </h2>
                    <div className="text-sm text-gray-500 mt-0.5">
                      {formatTime(activeSlot.start_time)} – {formatTime(activeSlot.end_time)} Uhr
                      <span className="text-gray-300 mx-1.5">·</span>
                      Prüfung #{selectedExamId}
                    </div>
                  </div>

                  {/* Prev / Next */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      disabled={!prevSlot?.exam_id}
                      onClick={() => prevSlot?.exam_id && handleSelectExam(prevSlot.exam_id)}
                      className="px-2 py-1.5 text-xs rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
                    >
                      <ChevronLeft className="w-3 h-3" /> Zurück
                    </button>
                    <button
                      type="button"
                      disabled={!nextSlot?.exam_id}
                      onClick={() => nextSlot?.exam_id && handleSelectExam(nextSlot.exam_id)}
                      className="px-2 py-1.5 text-xs rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
                    >
                      Weiter <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              )}

              {/* ── Bewertungsformular ── */}
              <ExamGradingView
                key={selectedExamId}
                examId={selectedExamId}
                onExamChanged={handleExamChanged}
              />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
// End of src/pages/ExamDayGradingPage.tsx
