// App.tsx
import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import ProtectedRoute from "@/components/layout/ProtectedRoute";
import AppShell from "@/components/layout/AppShell";
import { Toaster } from "sonner";
import Footer from "@/components/layout/Footer";

// Pages
import DashboardPage from "@/pages/DashboardPage";
import LoginPage from "@/pages/LoginPage";
import RegisterPage from "@/pages/RegisterPage";

import OrgUnitsPage from "@/pages/admin/OrgUnitsPage";
import AccountPage from "@/pages/AccountPage";
import CommitteeMembersPage from "@/pages/admin/CommitteeMembersPage";
import CommitteesAdminPage from "@/pages/admin/CommitteesAdminPage";
import UsersAdminPage from "@/pages/admin/UsersAdminPage";
import RolesAdminPage from "@/pages/admin/RolesAdminPage";

import PlannerPage from "@/pages/PlannerPage";
import ExamDayDetailPage from "@/pages/ExamDayDetailPage";
import ExamDayGradingPage from "@/pages/ExamDayGradingPage";

import CandidatesPage from "@/pages/CandidatesPage";
import ExamGradingPage from "@/pages/ExamGradingPage";

import TimeSchemesPage from "@/pages/admin/TimeSchemesPage";

export default function App() {
  useEffect(() => {
    document.title = "ELBA";
  }, []);

  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="min-h-screen flex flex-col">
          <main className="flex-1">
            <Routes>
              {/* Public */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />

              {/* Protected Bereich */}
              <Route element={<ProtectedRoute />}>

                {/* ─────────────────────────────────────────────────
                    Vollbild-Routen – KEIN AppShell (eigenes Layout)
                    ───────────────────────────────────────────────── */}
                <Route
                  path="/pruefungstage/:examDayId/bewertung"
                  element={<ExamDayGradingPage />}
                />

                {/* ─────────────────────────────────────────────────
                    Standard-Routen – mit AppShell (Header + Padding)
                    ───────────────────────────────────────────────── */}
                <Route element={<AppShell />}>
                  {/* Dashboard */}
                  <Route path="/dashboard" element={<DashboardPage />} />

                  {/* Root → Dashboard */}
                  <Route path="/" element={<Navigate to="/dashboard" replace />} />

                  {/* Prüfungstage / Planer */}
                  <Route path="/pruefungstage" element={<PlannerPage />} />
                  <Route path="/pruefungstage/:examDayId" element={<ExamDayDetailPage />} />

                  {/* Legacy-Alias */}
                  <Route path="/planner" element={<PlannerPage />} />

                  {/* Kandidaten */}
                  <Route path="/candidates" element={<CandidatesPage />} />

                  {/* Admin */}
                  <Route path="/admin/org-units" element={<OrgUnitsPage />} />
                  <Route path="/admin/committees" element={<CommitteesAdminPage />} />
                  <Route path="/admin/committees/:committeeId/members" element={<CommitteeMembersPage />} />
                  <Route path="/admin/users" element={<UsersAdminPage />} />
                  <Route path="/admin/roles" element={<RolesAdminPage />} />
                  <Route path="/admin/time-schemes" element={<TimeSchemesPage />} />

                  {/* Account */}
                  <Route path="/account" element={<AccountPage />} />

                  {/* Einzelne Prüfungsbewertung (Legacy / Direktlink) */}
                  <Route path="/exams/:examId" element={<ExamGradingPage />} />

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
// End of App.tsx
