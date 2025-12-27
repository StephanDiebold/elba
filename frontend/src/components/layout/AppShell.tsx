// src/components/layout/AppShell.tsx
import { Outlet } from "react-router-dom";
import AppHeader from "./AppHeader";

export default function AppShell() {
  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader />

      {/* Seiteninhalt im gleichen Container wie Header */}
      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-4 py-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
// End of file
