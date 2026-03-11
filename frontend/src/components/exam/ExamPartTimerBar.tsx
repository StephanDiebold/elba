// src/components/exam/ExamPartTimerBar.tsx
//
// Sticky-Statusbar mit zwei unabhängigen Part-Timern (je 15 Min).
// Teil 2 ist gesperrt bis Teil 1 done ist.

import { useEffect, useRef, useState, useCallback } from "react";
import { toast } from "sonner";
import { startExamPart, stopExamPart, resetExamPart } from "@/lib/api/exam.api";
import type { ExamPart } from "@/lib/api/exam.api";

// ─── Konstanten ───────────────────────────────────────────────
const PART_DURATION_SEC = 15 * 60;
const WARN_SEC = 120;

// ─── Helpers ──────────────────────────────────────────────────
function toUtcMs(iso: string): number {
  if (/[Zz]$/.test(iso) || /[+-]\d{2}:\d{2}$/.test(iso)) return new Date(iso).getTime();
  return new Date(iso + "Z").getTime();
}

function fmtTime(sec: number): string {
  if (sec < 0) sec = 0;
  const m = Math.floor(sec / 60).toString().padStart(2, "0");
  const s = (sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function calcRemaining(part: ExamPart): number {
  if (!part.started_at) return PART_DURATION_SEC;
  if (part.status === "done" && part.ended_at) {
    const elapsed = Math.floor(
      (toUtcMs(part.ended_at) - toUtcMs(part.started_at) - (part.total_paused_seconds ?? 0) * 1000) / 1000
    );
    return Math.max(PART_DURATION_SEC - elapsed, 0);
  }
  if (part.status === "in_progress") {
    const elapsed = Math.floor(
      (Date.now() - toUtcMs(part.started_at) - (part.total_paused_seconds ?? 0) * 1000) / 1000
    );
    return Math.max(PART_DURATION_SEC - elapsed, 0);
  }
  return PART_DURATION_SEC;
}

// ─── SinglePartTimer ──────────────────────────────────────────
interface SinglePartTimerProps {
  part: ExamPart;
  locked?: boolean;        // gesperrt (Teil 2 vor Teil 1 done)
  onChanged: () => Promise<void>;
}

function SinglePartTimer({ part, locked, onChanged }: SinglePartTimerProps) {
  const [remaining, setRemaining] = useState(() => calcRemaining(part));
  const [busy, setBusy] = useState(false);
  const [confirmStop, setConfirmStop] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Timer-Tick
  useEffect(() => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }

    if (part.status === "in_progress" && part.started_at) {
      const tick = () => {
        const r = calcRemaining(part);
        setRemaining(r);
        if (r <= 0) {
          clearInterval(intervalRef.current!);
          intervalRef.current = null;
          // Auto-Stop nach 15 Min
          stopExamPart(part.exam_part_id)
            .then(() => onChanged())
            .catch(() => {});
        }
      };
      tick();
      intervalRef.current = setInterval(tick, 500);
      return () => { if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; } };
    } else {
      setRemaining(calcRemaining(part));
    }
  }, [part.status, part.started_at, part.ended_at, part.total_paused_seconds]); // eslint-disable-line

  const handleStart = useCallback(async () => {
    try {
      setBusy(true);
      await startExamPart(part.exam_part_id);
      await onChanged();
    } catch (e: any) {
      toast.error(e?.detail ?? "Start fehlgeschlagen.");
    } finally { setBusy(false); }
  }, [part.exam_part_id, onChanged]);

  const handleStop = useCallback(async () => {
    if (!confirmStop) {
      setConfirmStop(true);
      setTimeout(() => setConfirmStop(false), 3000);
      return;
    }
    setConfirmStop(false);
    try {
      setBusy(true);
      await stopExamPart(part.exam_part_id);
      await onChanged();
      toast.success(`Teil ${part.part_number} beendet.`);
    } catch (e: any) {
      toast.error(e?.detail ?? "Stop fehlgeschlagen.");
    } finally { setBusy(false); }
  }, [confirmStop, part.exam_part_id, part.part_number, onChanged]);

  const handleReset = useCallback(async () => {
    try {
      setBusy(true);
      await resetExamPart(part.exam_part_id);
      await onChanged();
    } catch (e: any) {
      toast.error(e?.detail ?? "Reset fehlgeschlagen.");
    } finally { setBusy(false); }
  }, [part.exam_part_id, onChanged]);

  const isDone = part.status === "done";
  const isRunning = part.status === "in_progress";
  const isPlanned = part.status === "planned";
  const warn = remaining <= WARN_SEC && (isRunning || isDone);

  // Farben Fortschrittsbalken
  const pct = Math.max(0, Math.min(100, (remaining / PART_DURATION_SEC) * 100));
  const barColor = remaining <= 60 ? "bg-red-500"
    : remaining <= WARN_SEC ? "bg-amber-400"
    : "bg-blue-500";

  return (
    <div className={[
      "flex-1 rounded-lg border px-3 py-2 transition-all",
      locked ? "opacity-40 bg-gray-50 border-gray-200"
        : isDone ? "bg-green-50 border-green-200"
        : isRunning ? "bg-blue-50 border-blue-200"
        : "bg-white border-gray-200",
    ].join(" ")}>

      {/* Kopfzeile: Label + Timer */}
      <div className="flex items-center justify-between mb-1.5">
        <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
          Teil {part.part_number}
          {part.part_mode && (
            <span className="ml-1 normal-case font-normal text-gray-400">
              · {part.part_mode === "presentation" ? "Präsentation" : "Durchführung"}
            </span>
          )}
          {part.part_number === 2 && !part.part_mode && (
            <span className="ml-1 normal-case font-normal text-gray-400">· Fachgespräch</span>
          )}
        </div>
        <div className={[
          "text-xl font-mono font-bold tabular-nums",
          isDone ? "text-green-700"
            : warn ? "text-red-600 animate-pulse"
            : isRunning ? "text-blue-700"
            : "text-gray-400",
        ].join(" ")}>
          {fmtTime(remaining)}
        </div>
      </div>

      {/* Fortschrittsbalken */}
      <div className="h-1.5 rounded-full bg-gray-200 mb-2 overflow-hidden">
        <div
          className={["h-full rounded-full transition-all duration-500", barColor].join(" ")}
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Buttons */}
      {!locked && (
        <div className="flex gap-1.5">
          {isPlanned && (
            <button onClick={handleStart} disabled={busy}
              className="flex-1 py-1 px-2 rounded text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors">
              ▶ Start
            </button>
          )}
          {isRunning && (
            <button onClick={handleStop} disabled={busy}
              className={[
                "flex-1 py-1 px-2 rounded text-xs font-semibold transition-colors",
                confirmStop
                  ? "bg-red-600 text-white hover:bg-red-700"
                  : "bg-amber-100 text-amber-800 border border-amber-300 hover:bg-amber-200",
              ].join(" ")}>
              {confirmStop ? "✓ Bestätigen" : "⏹ Stop"}
            </button>
          )}
          {isDone && (
            <>
              <div className="flex-1 py-1 px-2 rounded text-xs font-semibold text-center bg-green-100 text-green-700 border border-green-200">
                ✓ Abgeschlossen
              </div>
              <button onClick={handleReset} disabled={busy}
                className="py-1 px-2 rounded text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
                ↺
              </button>
            </>
          )}
        </div>
      )}
      {locked && (
        <div className="text-xs text-gray-400 text-center py-0.5">Erst nach Abschluss von Teil 1</div>
      )}
    </div>
  );
}

// ─── ExamPartTimerBar (Sticky) ────────────────────────────────
interface ExamPartTimerBarProps {
  parts: ExamPart[];
  onChanged: () => Promise<void>;
}

export default function ExamPartTimerBar({ parts, onChanged }: ExamPartTimerBarProps) {
  const part1 = parts.find((p) => p.part_number === 1) ?? null;
  const part2 = parts.find((p) => p.part_number === 2) ?? null;
  const part2Locked = part1?.status !== "done";

  if (!part1 && !part2) return null;

  return (
    <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-gray-200 shadow-sm px-4 py-2">
      <div className="flex gap-3">
        {part1 && <SinglePartTimer part={part1} onChanged={onChanged} />}
        {part2 && <SinglePartTimer part={part2} locked={part2Locked} onChanged={onChanged} />}
      </div>
    </div>
  );
}
// end of src/components/exam/ExamPartTimerBar.tsx
