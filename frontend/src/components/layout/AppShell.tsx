import { Outlet } from "react-router-dom";
import AppHeader from "./AppHeader";

export default function AppShell() {
  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader />
      <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-4">
        <Outlet />
      </main>
    </div>
  );
}
