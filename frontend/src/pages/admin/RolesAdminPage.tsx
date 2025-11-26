import { useAuth } from "@/context/AuthContext";

export default function RolesAdminPage() {
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
      <h1 className="text-xl font-bold">Rollenverwaltung</h1>
      <p className="text-sm text-muted-foreground">
        Die API-Endpunkte für die Rollenverwaltung sind noch nicht implementiert.
        Hier wird später das Mapping von Benutzern zu Rollen sowie die Pflege der Rollen erfolgen.
      </p>
    </div>
  );
}
// End of src/pages/admin/RolesAdminPage.tsx