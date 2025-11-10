// src/components/layout/Footer.tsx
import { cn } from "@/lib/utils";

declare const __APP_VERSION__: string; // kommt aus vite.define

type FooterProps = {
  className?: string;
};

export default function Footer({ className }: FooterProps) {
  return (
    <footer
      className={cn(
        "border-t text-sm text-muted-foreground",
        "py-2 px-4",
        "bg-background",
        className
      )}
      role="contentinfo"
    >
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between">
        <span>&copy; {new Date().getFullYear()} DIEBOLD Consulting</span>
        <span>Version {__APP_VERSION__}</span>
      </div>
    </footer>
  );
}
