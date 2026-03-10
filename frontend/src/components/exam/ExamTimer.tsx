// src/components/exam/ExamTimer.tsx
//
// Countdown-Timer für eine laufende Prüfung.
//
// Verhalten:
//   > 2:00 min  → grün/neutral, normale Anzeige
//   ≤ 2:00 min  → orange, Hinweistext "Hinweis an Prüfling"
//   ≤ 0:00      → rot, pulsierend, "Zeit abgelaufen"
//
// Grundlage: started_at aus dem Backend (ISO-String).
// Dadurch läuft der Timer auch nach Reload korrekt weiter.
//
// Props:
//   startedAt   – ISO-String, wann die Prüfung gestartet wurde
//   durationMin – Gesamtdauer in Minuten (Default 15)
//   warnMin     – Ab wie vielen verbleibenden Minuten Warnung (Default 2)
//

import { useEffect, useRef, useState } from "react";
import { Timer, AlertTriangle, CheckCircle } from "lucide-react";

interface ExamTimerProps {
  startedAt: string;            // ISO-String vom Backend
  durationMin?: number;         // Default 15
  warnMin?: number;             // Default 2
  className?: string;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export default function ExamTimer({
  startedAt,
  durationMin = 15,
  warnMin = 2,
  className = "",
}: ExamTimerProps) {
  const totalSeconds = durationMin * 60;
  const warnSeconds = warnMin * 60;

  // ── Timezone-Fix ──────────────────────────────────────────────────────────
  // Python datetime.utcnow() liefert "2026-03-10T14:00:00" OHNE "Z".
  // JS interpretiert das als Lokalzeit → bei UTC+1 sofort -3600s → "abgelaufen".
  // Lösung: Z anhängen wenn kein Offset/Z vorhanden.
  const toUtcMs = (iso: string): number => {
    if (/[Zz]$/.test(iso) || /[+-]\d{2}:\d{2}$/.test(iso)) {
      return new Date(iso).getTime();
    }
    return new Date(iso + "Z").getTime();
  };

  const calcRemaining = (): number => {
    const elapsed = Math.floor((Date.now() - toUtcMs(startedAt)) / 1000);
    return Math.max(totalSeconds - elapsed, 0);
  };

  const [remaining, setRemaining] = useState<number>(calcRemaining);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Sofort einmal setzen (kann sich durch Hydration leicht unterscheiden)
    setRemaining(calcRemaining());

    intervalRef.current = setInterval(() => {
      const r = calcRemaining();
      setRemaining(r);
      if (r <= 0 && intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }, 500);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [startedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  const isOver = remaining <= 0;
  const isWarning = !isOver && remaining <= warnSeconds;

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const display = `${pad(minutes)}:${pad(seconds)}`;

  // Fortschrittsbalken: 0% = fertig, 100% = voll
  const progressPct = Math.round((remaining / totalSeconds) * 100);

  // ── Farb-Varianten ──
  const styles = isOver
    ? {
        wrapper: "bg-red-50 border-red-300 text-red-700",
        bar: "bg-red-500",
        barBg: "bg-red-100",
        icon: <AlertTriangle className="w-4 h-4 shrink-0" />,
        pulse: "animate-pulse",
        label: "Zeit abgelaufen",
        hint: null,
      }
    : isWarning
    ? {
        wrapper: "bg-orange-50 border-orange-300 text-orange-700",
        bar: "bg-orange-400",
        barBg: "bg-orange-100",
        icon: <AlertTriangle className="w-4 h-4 shrink-0" />,
        pulse: "",
        label: display,
        hint: "→ Hinweis an Prüfling geben",
      }
    : {
        wrapper: "bg-green-50 border-green-200 text-green-800",
        bar: "bg-green-500",
        barBg: "bg-green-100",
        icon: <Timer className="w-4 h-4 shrink-0" />,
        pulse: "",
        label: display,
        hint: null,
      };

  return (
    <div
      className={[
        "rounded-xl border px-4 py-3 flex items-center gap-3 transition-colors duration-500",
        styles.wrapper,
        styles.pulse,
        className,
      ].join(" ")}
    >
      {/* Icon */}
      <span className="shrink-0">{styles.icon}</span>

      {/* Linke Seite: Label + Hint */}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="font-mono text-2xl font-bold tracking-tight leading-none">
            {styles.label}
          </span>
          {styles.hint && (
            <span className="text-xs font-semibold uppercase tracking-wide opacity-80">
              {styles.hint}
            </span>
          )}
        </div>

        {/* Fortschrittsbalken */}
        <div className={["mt-2 h-1.5 rounded-full overflow-hidden", styles.barBg].join(" ")}>
          <div
            className={["h-full rounded-full transition-all duration-1000", styles.bar].join(" ")}
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Rechte Seite: Dauer-Info */}
      <div className="shrink-0 text-right">
        <div className="text-xs opacity-60 leading-none">
          {durationMin} min
        </div>
        {!isOver && (
          <div className="text-xs opacity-60 mt-0.5 leading-none">
            Prüfungszeit
          </div>
        )}
        {isOver && (
          <CheckCircle className="w-4 h-4 opacity-60 ml-auto mt-1" />
        )}
      </div>
    </div>
  );
}
// End of src/components/exam/ExamTimer.tsx
