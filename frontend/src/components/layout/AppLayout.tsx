// src/components/layout/AppLayout.tsx
import { Outlet } from "react-router-dom";
import Footer from "@/components/layout/Footer";

export default function AppLayout() {
  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1">
        {/* hier rendert dein Seiteninhalt */}
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
