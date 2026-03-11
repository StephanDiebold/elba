// src/components/exam/ExamPartTimerBar.tsx
// Kompakter Timer-Streifen oben im Tab

import { useEffect, useRef, useState, useCallback } from "react";
import { toast } from "sonner";
import { startExamPart, pauseExamPart, stopExamPart, resetExamPart } from "@/lib/api/exam.api";
import type { ExamPart } from "@/lib/api/exam.api";

const PART_DURATION_SEC = 15 * 60;

function toUtcMs(iso: string): number {
  if (/[Zz]$/.test(iso) || /[+-]\d{2}:\d{2}$/.test(iso)) return new Date(iso).getTime();
  return new Date(iso + "Z").getTime();
}

function fmtTime(sec: number): string {
  if (sec < 0) sec = 0;
  return `${Math.floor(sec / 60).toString().padStart(2, "0")}:${(sec % 60).toString().padStart(2, "0")}`;
}

function calcRemaining(part: ExamPart): number {
  if (!part.started_at) return PART_DURATION_SEC;
  const pausedMs = (part.total_paused_seconds ?? 0) * 1000;
  if (part.status === "done" && part.ended_at)
    return Math.max(PART_DURATION_SEC - Math.floor((toUtcMs(part.ended_at) - toUtcMs(part.started_at) - pausedMs) / 1000), 0);
  if (part.status === "paused" && part.paused_at)
    return Math.max(PART_DURATION_SEC - Math.floor((toUtcMs(part.paused_at) - toUtcMs(part.started_at) - pausedMs) / 1000), 0);
  if (part.status === "in_progress")
    return Math.max(PART_DURATION_SEC - Math.floor((Date.now() - toUtcMs(part.started_at) - pausedMs) / 1000), 0);
  return PART_DURATION_SEC;
}

interface Props { part: ExamPart; locked?: boolean; onChanged: () => Promise<void>; }

export default function ExamPartTimerBar({ part, locked, onChanged }: Props) {
  const [remaining, setRemaining] = useState(() => calcRemaining(part));
  const [busy, setBusy] = useState(false);
  const [confirmStop, setConfirmStop] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    if (part.status === "in_progress" && part.started_at) {
      const tick = () => {
        const r = calcRemaining(part);
        setRemaining(r);
        if (r <= 0) {
          clearInterval(intervalRef.current!); intervalRef.current = null;
          stopExamPart(part.exam_part_id).then(() => onChanged()).catch(() => {});
        }
      };
      tick();
      intervalRef.current = setInterval(tick, 500);
      return () => { if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; } };
    } else {
      setRemaining(calcRemaining(part));
    }
  }, [part.status, part.started_at, part.paused_at, part.ended_at, part.total_paused_seconds]); // eslint-disable-line

  const act = useCallback(async (fn: () => Promise<unknown>, successMsg?: string) => {
    try { setBusy(true); await fn(); await onChanged(); if (successMsg) toast.success(successMsg); }
    catch (e: any) { toast.error(e?.detail ?? "Fehler."); }
    finally { setBusy(false); }
  }, [onChanged]);

  const handleStart  = () => act(() => startExamPart(part.exam_part_id));
  const handlePause  = () => act(() => pauseExamPart(part.exam_part_id));
  const handleStop   = () => {
    if (!confirmStop) { setConfirmStop(true); setTimeout(() => setConfirmStop(false), 3000); return; }
    setConfirmStop(false);
    act(() => stopExamPart(part.exam_part_id), "Abgeschlossen.");
  };
  const handleReset  = () => {
    if (!confirmReset) { setConfirmReset(true); setTimeout(() => setConfirmReset(false), 3000); return; }
    setConfirmReset(false);
    act(() => resetExamPart(part.exam_part_id));
  };

  const isPlanned = part.status === "planned";
  const isRunning = part.status === "in_progress";
  const isPaused  = part.status === "paused";
  const isDone    = part.status === "done";
  const warn      = remaining <= 120 && (isRunning || isPaused);
  const pct       = Math.max(0, Math.min(100, (remaining / PART_DURATION_SEC) * 100));
  const barColor  = remaining <= 60 ? "bg-red-400" : remaining <= 120 ? "bg-amber-400" : "bg-blue-400";

  // Status-Farben für den Timer-Wert
  const timeColor = isDone ? "text-green-600" : warn ? "text-red-500" : isRunning ? "text-blue-600" : isPaused ? "text-amber-600" : "text-gray-400";

  return (
    <div className={`flex items-center gap-3 px-3 py-2 rounded-lg border mb-4 text-sm transition-colors ${
      locked ? "opacity-40 pointer-events-none bg-gray-50 border-gray-200" :
      isDone  ? "bg-green-50 border-green-200" :
      isPaused? "bg-amber-50 border-amber-200" :
      isRunning?"bg-blue-50 border-blue-200" :
                "bg-gray-50 border-gray-200"
    }`}>

      {/* Fortschrittsbalken links */}
      <div className="w-24 h-1.5 rounded-full bg-gray-200 shrink-0 overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${pct}%` }} />
      </div>

      {/* Timer-Wert */}
      <span className={`font-mono font-semibold tabular-nums text-sm w-12 shrink-0 ${timeColor} ${warn && isRunning ? "animate-pulse" : ""}`}>
        {fmtTime(remaining)}
      </span>

      {/* Status-Text */}
      <span className="text-xs text-gray-400 shrink-0">
        {isDone ? "Abgeschlossen" : isPaused ? "Pausiert" : isRunning ? "Läuft" : "Bereit"}
      </span>

      {/* Buttons rechts */}
      {!locked && (
        <div className="flex gap-1.5 ml-auto shrink-0">
          {(isPlanned || isPaused) && (
            <button onClick={handleStart} disabled={busy}
              className="px-2.5 py-1 rounded-md bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {isPaused ? "▶ Fortsetzen" : "▶ Starten"}
            </button>
          )}
          {isRunning && (
            <button onClick={handlePause} disabled={busy}
              className="px-2.5 py-1 rounded-md bg-white border border-amber-300 text-amber-700 text-xs font-medium hover:bg-amber-50 disabled:opacity-50 transition-colors">
              ⏸ Pause
            </button>
          )}
          {(isRunning || isPaused) && (
            <button onClick={handleStop} disabled={busy}
              className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors disabled:opacity-50 ${
                confirmStop ? "bg-red-500 text-white border-red-500" : "bg-white text-red-500 border-red-200 hover:bg-red-50"
              }`}>
              {confirmStop ? "Bestätigen" : "⏹ Stop"}
            </button>
          )}
          {(isRunning || isPaused || isDone) && (
            <button onClick={handleReset} disabled={busy}
              className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors disabled:opacity-50 ${
                confirmReset ? "bg-gray-600 text-white border-gray-600" : "bg-white text-gray-400 border-gray-200 hover:bg-gray-50"
              }`}>
              {confirmReset ? "Sicher?" : "↺"}
            </button>
          )}
        </div>
      )}

      {locked && <span className="ml-auto text-xs text-gray-400">Verfügbar nach Teil 1</span>}
    </div>
  );
}
// end of src/components/exam/ExamPartTimerBar.tsx
