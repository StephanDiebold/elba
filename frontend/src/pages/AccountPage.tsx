// src/pages/AccountPage.tsx
import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { updateProfile } from "@/lib/api/auth.api";

export default function AccountPage() {
  const { user, refresh } = useAuth();

  const [displayName, setDisplayName] = useState(
    (user as any)?.display_name ?? ""
  );
  const [mobilnummer, setMobilnummer] = useState(
    (user as any)?.mobilnummer ?? ""
  );
  const [geburtstag, setGeburtstag] = useState(
    (user as any)?.geburtstag ?? "" // ISO (YYYY-MM-DD) – kannst du später schön formatieren
  );

  const roles = (user as any)?.roles as string[] | undefined;
  const primaryRole = (user as any)?.role as string | undefined;

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setSaving(true);
    try {
      await updateProfile({
        display_name: displayName || null,
        mobilnummer: mobilnummer || null,
        geburtstag: geburtstag || null,
      });
      await refresh(); // User im Context neu laden
      setSuccessMsg("Profil wurde gespeichert.");
    } catch (err: any) {
      setErrorMsg(
        err?.message ?? "Profil konnte nicht gespeichert werden."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="space-y-1">
        <div className="text-xs text-muted-foreground">Konto</div>
        <h1 className="text-xl font-bold">Mein Profil</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Persönliche Daten</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4 text-sm" onSubmit={handleSubmit}>
            <div>
              <span className="font-medium">E-Mail: </span>
              <span>{user?.email ?? "–"}</span>
            </div>

            <div className="grid gap-2 max-w-md">
              <label className="space-y-1">
                <span className="font-medium">Anzeigename</span>
                <input
                  type="text"
                  className="border rounded px-3 py-2 w-full"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
              </label>

              <label className="space-y-1">
                <span className="font-medium">Mobilnummer (optional)</span>
                <input
                  type="tel"
                  className="border rounded px-3 py-2 w-full"
                  placeholder="+49 ..."
                  value={mobilnummer}
                  onChange={(e) => setMobilnummer(e.target.value)}
                />
              </label>

              <label className="space-y-1">
                <span className="font-medium">Geburtstag (optional)</span>
                <input
                  type="date"
                  className="border rounded px-3 py-2 w-full"
                  value={geburtstag ?? ""}
                  onChange={(e) => setGeburtstag(e.target.value)}
                />
                <span className="text-xs text-muted-foreground">
                  Format: YYYY-MM-DD.
                </span>
              </label>
            </div>

            <div>
              <span className="font-medium">Rollen: </span>
              {Array.isArray(roles) && roles.length > 0
                ? roles.join(", ")
                : primaryRole ?? "–"}
            </div>

            {errorMsg && (
              <div className="text-xs text-red-600">{errorMsg}</div>
            )}
            {successMsg && (
              <div className="text-xs text-green-600">{successMsg}</div>
            )}

            <Button type="submit" disabled={saving}>
              {saving ? "Speichere ..." : "Änderungen speichern"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Platzhalter für Ausschüsse des Users – später ausbauen */}
      <Card>
        <CardHeader>
          <CardTitle>Meine Ausschüsse</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Hier werden später deine Prüfungsausschüsse mit Funktion &amp; Position
          angezeigt.
        </CardContent>
      </Card>
    </div>
  );
}
// Ende der Datei src/pages/AccountPage.tsx
