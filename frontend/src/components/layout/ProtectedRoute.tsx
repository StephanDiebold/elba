import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

export default function ProtectedRoute() {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-6 text-sm text-muted-foreground">Lade…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
}
