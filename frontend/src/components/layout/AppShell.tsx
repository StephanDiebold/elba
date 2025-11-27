// AppShell.tsx
import { Outlet } from "react-router-dom";
import AppHeader from "./AppHeader";

export default function AppShell() {
  return (
    <div className="flex flex-col min-h-full">
      <AppHeader />
      {/* Inhalt der jeweiligen Seite */}
      <div className="flex-1">
        <Outlet />
      </div>
    </div>
  );
}

// End of AppShell.tsx