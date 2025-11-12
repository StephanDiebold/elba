// src/components/layout/MasterDetailLayout.tsx
import type { ReactNode, CSSProperties } from "react";
import { cn } from "@/lib/utils";

type Props = {
  title: string;
  subtitle?: string;

  /** Ganzer Kopfbereich unter dem Titel (über BEIDEN Spalten) */
  header?: ReactNode;

  /** Linke/rechte Spalten-spezifische Header (über der jeweiligen Spalte) */
  listHeader?: ReactNode;
  detailHeader?: ReactNode;

  /** Spalteninhalte */
  list?: ReactNode;
  detail?: ReactNode;

  /** Optionale Footer-Zonen unten in den Spalten (nicht scrollend) */
  listFooter?: ReactNode;
  detailFooter?: ReactNode;

  /** Alternativ: freier Inhalt, wenn keine 2 Spalten */
  children?: ReactNode;

  className?: string;

  /**
   * Aktiviert ein höhengebundenes 2-Spalten-Layout:
   * - jede Spalte ist flex-col
   * - Inhalt scrollt innerhalb der Spalte
   * - Footer-Zone bleibt sichtbar
   */
  fullHeight?: boolean;

  /**
   * Pixeloffset, der vom Viewport abgezogen wird (z.B. für Title/Spacing).
   * Default 180px. Wird nur genutzt, wenn `fullHeight` = true.
   */
  heightOffsetPx?: number;
  /** Reduziert vertikale Abstände / Titelgröße */
  compact?: boolean;
};

export default function MasterDetailLayout({
  title,
  subtitle,
  header,
  listHeader,
  detailHeader,
  list,
  detail,
  listFooter,
  detailFooter,
  children,
  className,
  fullHeight = false,
  heightOffsetPx = 180,
  compact = false,
}: Props) {
  const hasTwoCols = list != null || detail != null;

  // Inline-Style für exakte Höhe, nur wenn fullHeight aktiv ist
  const gridStyle: CSSProperties | undefined = fullHeight
    ? { height: `calc(100vh - ${heightOffsetPx}px)` }
    : undefined;

  return (
    <div className={cn(compact ? "space-y-2" : "space-y-3", className)}>
      <div>
        <h1 className={cn(compact ? "text-lg font-semibold" : "text-xl font-semibold")}>{title}</h1>
        {subtitle && (
          <p className={cn("text-muted-foreground", compact ? "text-xs" : "text-sm")}>{subtitle}</p>
        )}
      </div>

      {header && <div>{header}</div>}

      {hasTwoCols ? (
        <div
          className={cn(
            "grid grid-cols-1 md:grid-cols-[2fr_1fr] gap-3",
            fullHeight && "overflow-hidden",
            compact && "gap-2"
          )}
          style={gridStyle}
        >
          <div className={cn(fullHeight && "flex flex-col overflow-hidden")}>
            {listHeader ? <div className={cn(compact ? "mb-1" : "mb-2")}>{listHeader}</div> : null}
            <div className={cn(fullHeight && "min-h-0 flex-1 overflow-auto")}>{list}</div>
            {listFooter ? <div className={cn(compact ? "mt-1" : "mt-2")}>{listFooter}</div> : null}
          </div>

          <div className={cn(fullHeight && "flex flex-col overflow-hidden")}>
            {detailHeader ? (
              <div className={cn("flex justify-end", compact ? "mb-1" : "mb-2")}>{detailHeader}</div>
            ) : null}
            <div className={cn(fullHeight && "min-h-0 flex-1 overflow-auto")}>{detail}</div>
            {detailFooter ? <div className={cn(compact ? "mt-1" : "mt-2")}>{detailFooter}</div> : null}
          </div>
        </div>
      ) : (
        <div>{children}</div>
      )}
    </div>
  );
}