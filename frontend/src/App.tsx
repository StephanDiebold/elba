// src/App.tsx
import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import ProtectedRoute from "@/components/layout/ProtectedRoute";
import DashboardPage from "@/pages/DashboardPage";
import LoginPage from "@/pages/LoginPage";
import RegisterPage from "@/pages/RegisterPage";
import AppShell from "@/components/layout/AppShell";
import Footer from "@/components/layout/Footer";
import { Toaster } from "sonner";

export default function App() {
  useEffect(() => {
    document.title = "ELBA";
  }, []);

  return (
    <AuthProvider>
      <BrowserRouter>
        {/* Globales Layout: Sticky Footer */}
        <div className="min-h-screen flex flex-col">
          <main className="flex-1">
            <Routes>
              {/* Public */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />

              {/* Protected + persistente Top-Bar */}
              <Route element={<ProtectedRoute />}>
                <Route element={<AppShell />}>
                  <Route path="/dashboard" element={<DashboardPage />} />
                </Route>
              </Route>

              {/* Redirects & 404 */}
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route
                path="*"
                element={
                  <div className="p-6 text-sm text-muted-foreground">
                    404 – Seite nicht gefunden.
                  </div>
                }
              />
            </Routes>
          </main>

          {/* Einmaliger globaler Footer (mit Version aus package.json) */}
          <Footer />
        </div>

        {/* Globaler Toaster */}
        <Toaster position="top-right" richColors closeButton expand />
      </BrowserRouter>
    </AuthProvider>
  );
}
