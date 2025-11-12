// src/pages/DashboardPage.tsx
import { useAuth } from "@/context/AuthContext";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const who = user?.display_name ?? user?.email ?? "";

  return (
    <div className="p-4 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">
          Willkommen{who ? `, ${who}` : ""}
        </h1>
        <p className="text-sm text-muted-foreground">
          Wähle einen Bereich aus, um loszulegen.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Konto</CardTitle></CardHeader>
          <CardContent className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Abmelden oder Daten prüfen</p>
            <Button variant="outline" onClick={logout}>Logout</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
