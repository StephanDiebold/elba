import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import ProtectedRoute from "@/components/layout/ProtectedRoute";
import AppShell from "@/components/layout/AppShell";
import Footer from "@/components/layout/Footer";
import { Toaster } from "sonner";

// Pages
import DashboardPage from "@/pages/DashboardPage";
import LoginPage from "@/pages/LoginPage";
import RegisterPage from "@/pages/RegisterPage";
import PlannerPage from "@/pages/PlannerPage";

export default function App() {
  useEffect(() => {
    document.title = "ELBA";
  }, []);

  return (
    <AuthProvider>
      {/* 👇 Basispfad für alle Routen */}
      <BrowserRouter>
        <div className="min-h-screen flex flex-col">
          <main className="flex-1">
            <Routes>
              {/* Public */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />

              {/* Protected */}
              <Route element={<ProtectedRoute />}>
                <Route element={<AppShell />}>
                  <Route path="/dashboard" element={<DashboardPage />} />
                  <Route path="/planner" element={<PlannerPage />} />
                  {/* Alias für alte Links/Navi */}
                  <Route path="/schedule" element={<PlannerPage />} />

                  {/* Root → Dashboard */}
                  <Route path="/" element={<Navigate to="/dashboard" replace />} />
                  {/* 404 */}
                  <Route
                    path="*"
                    element={
                      <div className="p-6 text-sm text-muted-foreground">
                        404 – Seite nicht gefunden.
                      </div>
                    }
                  />
                </Route>
              </Route>
            </Routes>
          </main>

          <Footer />
        </div>

        <Toaster position="top-right" richColors closeButton expand />
      </BrowserRouter>
    </AuthProvider>
  );
}
