// src/components/layout/ProtectedRoute.tsx
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";

export default function ProtectedRoute() {
  const { user, loading, refresh } = useAuth();
  const loc = useLocation();
  const hasToken = !!localStorage.getItem("token");
  const tried = useRef(false);

  // genau EIN Versuch, den User per Token zu laden
  useEffect(() => {
    if (hasToken && !user && !tried.current) {
      tried.current = true;
      refresh().catch(() => {});
    }
  }, [hasToken, user, refresh]);

  // 1) solange initial geladen wird → Loader
  if (loading) return <div className="p-6 text-sm text-muted-foreground">Lade…</div>;

  // 2) ohne User → Login
  if (!user) return <Navigate to="/login" replace state={{ from: loc }} />;

  // 3) alles gut → geschützte Inhalte
  return <Outlet />;
}
