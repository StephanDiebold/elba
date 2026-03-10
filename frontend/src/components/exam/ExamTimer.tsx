// src/components/exam/ExamTimer.tsx
// Reines Display-Component – kein eigenes Interval, kein State-Management.
// Die verbleibenden Sekunden werden vom Parent berechnet und übergeben.

import { Timer, AlertTriangle, CheckCircle, PauseCircle } from "lucide-react";

interface ExamTimerProps {
  remaining: number;   // verbleibende Sekunden (vom Parent berechnet)
  totalSeconds: number;
  paused?: boolean;
  warnSeconds?: number;
  className?: string;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export default function ExamTimer({
  remaining,
  totalSeconds,
  paused = false,
  warnSeconds = 120,
  className = "",
}: ExamTimerProps) {
  const isOver = remaining <= 0;
  const isWarning = !isOver && remaining <= warnSeconds;
  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const display = `${pad(minutes)}:${pad(seconds)}`;
  const progressPct = Math.round((Math.max(remaining, 0) / totalSeconds) * 100);

  const styles = paused
    ? { wrapper: "bg-amber-50 border-amber-300 text-amber-700", bar: "bg-amber-400", barBg: "bg-amber-100",
        icon: <PauseCircle className="w-4 h-4 shrink-0" />, pulse: "", label: display, hint: "Pausiert" }
    : isOver
    ? { wrapper: "bg-red-50 border-red-300 text-red-700", bar: "bg-red-500", barBg: "bg-red-100",
        icon: <AlertTriangle className="w-4 h-4 shrink-0" />, pulse: "animate-pulse", label: "Zeit abgelaufen", hint: null }
    : isWarning
    ? { wrapper: "bg-orange-50 border-orange-300 text-orange-700", bar: "bg-orange-400", barBg: "bg-orange-100",
        icon: <AlertTriangle className="w-4 h-4 shrink-0" />, pulse: "", label: display, hint: "→ Hinweis an Prüfling geben" }
    : { wrapper: "bg-green-50 border-green-200 text-green-800", bar: "bg-green-500", barBg: "bg-green-100",
        icon: <Timer className="w-4 h-4 shrink-0" />, pulse: "", label: display, hint: null };

  return (
    <div className={["rounded-xl border px-4 py-3 flex items-center gap-3 transition-colors duration-500",
        styles.wrapper, styles.pulse, className].join(" ")}>
      <span className="shrink-0">{styles.icon}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="font-mono text-2xl font-bold tracking-tight leading-none">{styles.label}</span>
          {styles.hint && (
            <span className="text-xs font-semibold uppercase tracking-wide opacity-80">{styles.hint}</span>
          )}
        </div>
        <div className={["mt-2 h-1.5 rounded-full overflow-hidden", styles.barBg].join(" ")}>
          <div className={["h-full rounded-full transition-all duration-1000", styles.bar].join(" ")}
            style={{ width: `${progressPct}%` }} />
        </div>
      </div>
      <div className="shrink-0 text-right">
        <div className="text-xs opacity-60 leading-none">{Math.round(totalSeconds / 60)} min</div>
        {!isOver && <div className="text-xs opacity-60 mt-0.5 leading-none">Prüfungszeit</div>}
        {isOver && <CheckCircle className="w-4 h-4 opacity-60 ml-auto mt-1" />}
      </div>
    </div>
  );
}
