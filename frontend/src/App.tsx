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

import CandidatesPage from "@/pages/CandidatesPage";

export default function App() {
  useEffect(() => {
    document.title = "ELBA";
  }, []);

  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="min-h-screen flex flex-col">
          {/* Hauptinhalt */}
          <main className="flex-1">
            <Routes>
              {/* Public */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />

              {/* Protected */}
              <Route element={<ProtectedRoute />}>
                <Route element={<AppShell />}>
                  {/* Dashboard */}
                  <Route path="/dashboard" element={<DashboardPage />} />

                  {/* Prüfungstage */}
                  <Route path="/pruefungstage" element={<PlannerPage />} />

                  {/* Kandidaten-Seite */}
                  <Route path="candidates" element={<CandidatesPage />} />

                  {/* Admin */}
                  <Route path="/admin/org-units" element={<OrgUnitsPage />} />
                  <Route
                    path="/admin/committees"
                    element={<CommitteesAdminPage />}
                  />
                  <Route
                    path="/admin/committees/:committeeId/members"
                    element={<CommitteeMembersPage />}
                  />
                  <Route path="/admin/users" element={<UsersAdminPage />} />
                  <Route path="/admin/roles" element={<RolesAdminPage />} />

                  {/* Account */}
                  <Route path="/account" element={<AccountPage />} />

                  {/* Root → Dashboard */}
                  <Route
                    path="/"
                    element={<Navigate to="/dashboard" replace />}
                  />

                  {/* Prüfungstage */}
                  <Route path="/pruefungstage" element={<PlannerPage />} />
                  <Route path="/pruefungstage/:examDayId" element={<ExamDayDetailPage />} />

                  {/* Alias für Legacy-Route, falls noch gebraucht */}
                  <Route path="/planner" element={<PlannerPage />} />

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

          {/* 👇 Globaler Footer, immer einmal unten */}
          <Footer />
        </div>

        <Toaster position="top-right" richColors closeButton expand />
      </BrowserRouter>
    </AuthProvider>
  );
}
/* Ende App.tsx */