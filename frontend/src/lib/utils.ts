//src/lib/utils.ts
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// === Prüfungstag: lokale Slot-Vorschau ===
export type DayCfg = {
  date: string;        // YYYY-MM-DD
  startTime: string;   // "08:10"
  examMinutes: number; // 30
  debriefMinutes: number; // 25
  breakStart: string;  // "12:40"
  breakEnd: string;    // "13:30"
  maxExams: number;    // 9
};

const _toDate = (date: string, hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date(`${date}T00:00:00`);
  d.setHours(h, m, 0, 0);
  return d;
};
const _addMinutes = (d: Date, mins: number) => new Date(d.getTime() + mins * 60000);
const _fmtLocal = (d: Date) => d.toISOString().slice(0, 16);

/** Erzeugt eine reine Vorschau (Client-seitig) der Slot-Zeiten für einen Tag. */
export function generateExamSlotsPreview(cfg: DayCfg) {
  const out: { beginn: string; ende: string }[] = [];
  const step = cfg.examMinutes + cfg.debriefMinutes;
  let cur = _toDate(cfg.date, cfg.startTime);
  const bStart = _toDate(cfg.date, cfg.breakStart);
  const bEnd = _toDate(cfg.date, cfg.breakEnd);

  for (let i = 0; i < cfg.maxExams; i++) {
    if (cur >= bStart && cur < bEnd) cur = bEnd;
    const end = _addMinutes(cur, cfg.examMinutes);
    out.push({ beginn: _fmtLocal(cur), ende: _fmtLocal(end) });
    cur = _addMinutes(cur, step);
  }
  return out;
}
