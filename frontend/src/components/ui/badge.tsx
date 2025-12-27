// frontend/src/components/ui/badge.tsx
import * as React from "react";

function cn(...classes: Array<string | undefined | false | null>) {
  return classes.filter(Boolean).join(" ");
}

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary";
}

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  const base =
    "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium";
  const styles =
    variant === "secondary"
      ? "bg-muted text-muted-foreground border-transparent"
      : "bg-foreground text-background border-transparent";

  return <div className={cn(base, styles, className)} {...props} />;
}
