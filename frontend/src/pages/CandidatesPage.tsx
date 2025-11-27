// src/pages/CandidatesPage.tsx

import { useEffect, useState } from "react";
import {
  listCandidates,
  createCandidate,
  updateCandidate,
  deleteCandidate,
  type Candidate,
  type CandidateCreate,
} from "@/lib/api/candidate.api";


import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogContent,
  DialogFooter,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";

// Lokaler Formular-Typ, entkoppelt vom API-Typ
type CandidateForm = {
  candidate_number: string;
  first_name: string;
  last_name: string;
  email: string;
  mobile_number: string;
  is_active: boolean; // aktuell nur UI, wird nicht ans Backend geschickt
};

const emptyForm: CandidateForm = {
  candidate_number: "",
  first_name: "",
  last_name: "",
  email: "",
  mobile_number: "",
  is_active: true,
};

export default function CandidatesPage() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Candidate | null>(null);
  const [form, setForm] = useState<CandidateForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await listCandidates({
        q: search || undefined,
        only_active: false,
      });
      setCandidates(data);
    } catch (e) {
      console.error(e);
      setError("Kandidaten konnten nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openNew = () => {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (c: Candidate) => {
    setEditing(c);
    setForm({
      candidate_number: c.candidate_number ?? "",
      first_name: c.first_name,
      last_name: c.last_name,
      email: c.email ?? "",
      mobile_number: c.mobile_number ?? "",
      // wenn dein Backend später ein Feld is_active bekommt, hier entsprechend befüllen
      is_active: true,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.first_name.trim() || !form.last_name.trim()) return;

    // Nur Felder mitschicken, die das Backend kennt
    const payload: CandidateCreate = {
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      candidate_number: form.candidate_number.trim() || undefined,
      email: form.email.trim() || undefined,
      mobile_number: form.mobile_number.trim() || undefined,
    };

    try {
      setSaving(true);
      if (editing) {
        const updated = await updateCandidate(editing.candidate_id, payload);
        setCandidates((prev) =>
          prev.map((c) =>
            c.candidate_id === updated.candidate_id ? updated : c
          )
        );
      } else {
        const created = await createCandidate(payload);
        setCandidates((prev) => [...prev, created]);
      }
      setDialogOpen(false);
    } catch (e) {
      console.error(e);
      setError("Speichern des Kandidaten fehlgeschlagen.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (c: Candidate) => {
    if (!confirm(`Kandidat ${c.first_name} ${c.last_name} wirklich löschen?`))
      return;
    await deleteCandidate(c.candidate_id);
    setCandidates((prev) =>
      prev.filter((x) => x.candidate_id !== c.candidate_id)
    );
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Prüfkandidaten</h1>
          <p className="text-sm text-muted-foreground">
            Anlage und Pflege der Kandidatenstammdaten.
          </p>
        </div>
        <Button size="sm" onClick={openNew}>
          + Kandidat anlegen
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <Input
          className="max-w-xs"
          placeholder="Suche nach Name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load()}
        />
        <Button size="sm" variant="outline" onClick={load}>
          Suchen
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Lade Kandidaten …</p>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : candidates.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Noch keine Kandidaten erfasst.
        </p>
      ) : (
        <div className="border rounded-md bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/60">
              <tr className="text-left">
                <th className="px-3 py-2 border-b">ID</th>
                <th className="px-3 py-2 border-b">Kandidaten-Nr.</th>
                <th className="px-3 py-2 border-b">Name</th>
                <th className="px-3 py-2 border-b">E-Mail</th>
                <th className="px-3 py-2 border-b">Telefon</th>
                <th className="px-3 py-2 border-b text-right">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {candidates.map((c) => (
                <tr key={c.candidate_id} className="hover:bg-muted/40">
                  <td className="px-3 py-2 border-b">{c.candidate_id}</td>
                  <td className="px-3 py-2 border-b">
                    {c.candidate_number ?? "–"}
                  </td>
                  <td className="px-3 py-2 border-b">
                    {c.last_name}, {c.first_name}
                  </td>
                  <td className="px-3 py-2 border-b">{c.email ?? "–"}</td>
                  <td className="px-3 py-2 border-b">
                    {c.mobile_number ?? "–"}
                  </td>
                  <td className="px-3 py-2 border-b text-right space-x-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openEdit(c)}
                    >
                      Bearbeiten
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDelete(c)}
                    >
                      Löschen
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? "Kandidat bearbeiten" : "Kandidat anlegen"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="candidate_number">
                  Kandidaten-Nr. (optional)
                </Label>
                <Input
                  id="candidate_number"
                  value={form.candidate_number}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, candidate_number: e.target.value }))
                  }
                  placeholder="z. B. 2025-001"
                />
              </div>

              <div className="space-y-1">
                <Label>Vorname</Label>
                <Input
                  value={form.first_name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, first_name: e.target.value }))
                  }
                />
              </div>

              <div className="space-y-1">
                <Label>Nachname</Label>
                <Input
                  value={form.last_name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, last_name: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label>E-Mail</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) =>
                  setForm((f) => ({ ...f, email: e.target.value }))
                }
              />
            </div>

            <div className="space-y-1">
              <Label>Telefon / Mobil</Label>
              <Input
                value={form.mobile_number}
                onChange={(e) =>
                  setForm((f) => ({ ...f, mobile_number: e.target.value }))
                }
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <Switch
                checked={form.is_active}
                onCheckedChange={(checked: boolean) =>
                  setForm((f) => ({ ...f, is_active: checked }))
                }
              />
              <span className="text-sm">Kandidat aktiv (nur Anzeige)</span>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDialogOpen(false)}
              disabled={saving}
            >
              Abbrechen
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? "Speichern …" : "Speichern"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
// End of src/pages/CandidatesPage.tsx
