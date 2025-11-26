import { useAuth } from "@/context/AuthContext";

export default function UsersAdminPage() {
  const { user } = useAuth();
  const roles = (user as any)?.roles as string[] | undefined;
  const primaryRole = (user as any)?.role as string | undefined;
  const isAdmin =
    (Array.isArray(roles) && roles.includes("admin")) || primaryRole === "admin";

  if (!isAdmin) {
    return (
      <div className="p-6 text-sm text-red-600">
        403 – Kein Zugriff (Administration nur für Benutzer mit Rolle „admin“).
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <div className="text-xs text-muted-foreground">Administration</div>
      <h1 className="text-xl font-bold">Benutzerverwaltung</h1>
      <p className="text-sm text-muted-foreground">
        Die API-Endpunkte für eine vollständige Benutzerverwaltung sind noch nicht umgesetzt.
        Diese Seite dient als Platzhalter für das spätere User-Management (Anlegen, Rollen,
        Sperren/Aktivieren usw.).
      </p>
    </div>
  );
}

// End of src/pages/admin/UsersAdminPage.tsx