// src/components/exam/GradePicker.tsx
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";

export type GradeMode = "grades" | "points";

type Modifier = "plus" | "half" | "minus" | null;

export function GradePicker({
  value,
  onChange,
  disabled,
}: {
  value: number | null;
  onChange: (grade: number | null) => void;
  disabled?: boolean;
}) {
  const parsed = useMemo(() => parseGrade(value), [value]);
  const [base, setBase] = useState<number | null>(parsed.base);
  const [mod, setMod] = useState<Modifier>(parsed.mod);

  // sync wenn parent value geändert wird (Tabwechsel, reload, etc.)
  useEffect(() => {
    setBase(parsed.base);
    setMod(parsed.mod);
  }, [parsed.base, parsed.mod]);

  const effective = useMemo(() => buildGrade(base, mod), [base, mod]);
  const label = useMemo(() => formatGradeLabel(effective), [effective]);

  const setBaseAndEmit = (b: number) => {
    setBase(b);

    // wenn Basis gewechselt wird, Modifier beibehalten, aber nur wenn erlaubt
    const next = buildGrade(b, mod);
    if (next == null) {
      setMod(null);
      onChange(buildGrade(b, null));
      return;
    }
    onChange(next);
  };

  const setModAndEmit = (m: Modifier) => {
    if (base == null) return; // ohne Basis keine Modifier
    const next = buildGrade(base, m);
    if (next == null) return; // z.B. 1+ oder 6-
    setMod(m);
    onChange(next);
  };

  const clear = () => {
    setBase(null);
    setMod(null);
    onChange(null);
  };

  const canPlus = base != null && buildGrade(base, "plus") != null;
  const canHalf = base != null && buildGrade(base, "half") != null;
  const canMinus = base != null && buildGrade(base, "minus") != null;

  return (
    <div className="space-y-2">
      {/* Anzeige – nur EINMAL */}
      <div className="text-sm">
        <span className="text-gray-500 mr-2">Note:</span>
        <span className="font-medium">{label}</span>
      </div>

      {/* Basisnoten */}
      <div className="grid grid-cols-6 gap-2">
        {[1, 2, 3, 4, 5, 6].map((n) => (
          <Button
            key={n}
            type="button"
            size="sm"
            variant={base === n ? "default" : "outline"}
            className="h-9"
            onClick={() => setBaseAndEmit(n)}
            disabled={disabled}
          >
            {n}
          </Button>
        ))}
      </div>

      {/* Modifier: + / 0,5 / - (Plus verbessert!) */}
      <div className="grid grid-cols-4 gap-2">
        <Button
          type="button"
          size="sm"
          variant={mod === "plus" ? "default" : "outline"}
          className="h-9"
          onClick={() => setModAndEmit("plus")}
          disabled={disabled || !canPlus}
          title="verbessert um 0,25"
        >
          +
        </Button>

        <Button
          type="button"
          size="sm"
          variant={mod === "half" ? "default" : "outline"}
          className="h-9"
          onClick={() => setModAndEmit("half")}
          disabled={disabled || !canHalf}
          title="verschlechtert um 0,5"
        >
          0,5
        </Button>

        <Button
          type="button"
          size="sm"
          variant={mod === "minus" ? "default" : "outline"}
          className="h-9"
          onClick={() => setModAndEmit("minus")}
          disabled={disabled || !canMinus}
          title="verschlechtert um 0,25"
        >
          –
        </Button>

        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-9"
          onClick={clear}
          disabled={disabled || (value == null && base == null)}
        >
          Löschen
        </Button>
      </div>
    </div>
  );
}

/** Map: base + modifier -> grade number */
function buildGrade(base: number | null, mod: Modifier): number | null {
  if (base == null) return null;

  if (mod == null) return base;

  if (mod === "half") {
    // 6,5 nicht erlaubt
    if (base === 6) return null;
    return base + 0.5;
  }

  if (mod === "minus") {
    // 6,25 nicht erlaubt
    if (base === 6) return null;
    return base + 0.25;
  }

  // mod === "plus" (verbessert um 0,25): 2 -> 1,75 (2+)
  if (base === 1) return null; // 0,75 nicht erlaubt
  return base - 0.25;
}

/** Parse numeric grade -> base + modifier */
function parseGrade(value: number | null): { base: number | null; mod: Modifier } {
  if (value == null || Number.isNaN(value)) return { base: null, mod: null };

  const frac = round2(value - Math.floor(value)); // 0 / .25 / .5 / .75

  // .75 bedeutet "plus" zur NÄCHSTEN vollen Note (1,75 => 2+)
  if (frac === 0.75) return { base: Math.floor(value) + 1, mod: "plus" };

  if (frac === 0.5) return { base: Math.floor(value), mod: "half" };

  if (frac === 0.25) return { base: Math.floor(value), mod: "minus" };

  return { base: Math.round(value), mod: null };
}

function formatGradeLabel(value: number | null): string {
  if (value == null) return "—";

  const floor = Math.floor(value);
  const frac = round2(value - floor);

  if (frac === 0) return `${floor} (${toComma(value)})`;
  if (frac === 0.5) return `${floor},5 (${toComma(value)})`;
  if (frac === 0.25) return `${floor}- (${toComma(value)})`;
  if (frac === 0.75) return `${floor + 1}+ (${toComma(value)})`;

  return toComma(value);
}

function toComma(n: number): string {
  return n.toFixed(2).replace(".", ",").replace(/,00$/, "").replace(/0$/, "");
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/* ------------------------------------------------------------------
   PointsPicker (touch-optimiert)
   FIX:
   - Prozent liefert 0,25 etc. (2 Dezimalstellen)
   - Delta-Buttons runden NICHT mehr auf 0,5
   - Delta-Skala erweitert: -1, -0,5, -0,25, +0,25, +0,5, +1
------------------------------------------------------------------- */

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function roundToDecimals(n: number, decimals: number) {
  const f = Math.pow(10, decimals);
  return Math.round(n * f) / f;
}

function formatDE2(n: number) {
  // immer 2 Dezimalstellen (Punkte-Anzeige)
  return n.toFixed(2).replace(".", ",");
}

function formatDE1(n: number) {
  // maxPoints optisch ruhiger (1 Dezimalstelle)
  return n.toFixed(1).replace(".", ",").replace(/,0$/, "");
}

function calcPercent(value: number, maxPoints: number) {
  if (!maxPoints || maxPoints <= 0) return 0;
  return clamp((value / maxPoints) * 100, 0, 100);
}

export function PointsPicker({
  value,
  maxPoints,
  onChange,
  disabled,
}: {
  value: number | null;
  maxPoints: number;
  onChange: (points: number | null) => void;
  disabled?: boolean;
}) {
  const current = typeof value === "number" ? value : null;

  // ✅ EINHEITLICH: clamp + 2 Dezimalstellen (auch für Deltas!)
  const setPoints = (next: number | null) => {
    if (disabled) return;
    if (next == null) {
      onChange(null);
      return;
    }
    const clamped = clamp(next, 0, maxPoints);
    const rounded = roundToDecimals(clamped, 2);
    onChange(rounded);
  };

  const applyPercent = (p: number) => {
    const raw = (maxPoints * p) / 100;
    setPoints(raw);
  };

  const addDelta = (delta: number) => {
    const base = current ?? 0;
    setPoints(base + delta);
  };

  const percent = current == null ? null : calcPercent(current, maxPoints);

  return (
    <div className="space-y-2">
      {/* Anzeige */}
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm">
          <span className="font-medium">{current == null ? "—" : formatDE2(current)}</span>
          <span className="text-gray-500"> / {formatDE1(maxPoints)} Punkte</span>
          {percent != null && (
            <span className="ml-2 text-gray-500">({Math.round(percent)}%)</span>
          )}
        </div>

        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled}
          onClick={() => setPoints(null)}
        >
          Löschen
        </Button>
      </div>

      {/* Schnellwahl Prozent */}
      <div className="grid grid-cols-5 gap-2">
        {[
          { label: "0%", p: 0 },
          { label: "25%", p: 25 },
          { label: "50%", p: 50 },
          { label: "75%", p: 75 },
          { label: "100%", p: 100 },
        ].map((x) => (
          <Button
            key={x.p}
            type="button"
            variant="outline"
            className="h-10"
            disabled={disabled}
            onClick={() => applyPercent(x.p)}
          >
            {x.label}
          </Button>
        ))}
      </div>

      {/* Feinjustierung (erweitert) */}
      <div className="grid grid-cols-6 gap-2">
        {[
          { label: "−1", d: -1 },
          { label: "−0,5", d: -0.5 },
          { label: "−0,25", d: -0.25 },
          { label: "+0,25", d: +0.25 },
          { label: "+0,5", d: +0.5 },
          { label: "+1", d: +1 },
        ].map((x) => (
          <Button
            key={x.label}
            type="button"
            variant="outline"
            className="h-10"
            disabled={disabled}
            onClick={() => addDelta(x.d)}
          >
            {x.label}
          </Button>
        ))}
      </div>
    </div>
  );
}

// End of src/components/exam/GradePicker.tsx
