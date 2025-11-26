// src/pages/admin/CommitteeMembersPage.tsx

import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import {
  useCommitteeMembers,
  useAddCommitteeMember,
  useDeleteCommitteeMember,
} from "@/hooks/useCommitteeMembers";
import { useCommitteeList } from "@/hooks/useCommittees";
import { useCommitteeFunctions, useCommitteePositions } from "@/hooks/useCommitteeMeta";
import type { CommitteeMemberOut } from "@/types/admin.types";

export default function CommitteeMembersPage() {
  const { user } = useAuth();
  const roles = (user as any)?.roles as string[] | undefined;
  const primaryRole = (user as any)?.role as string | undefined;

  const isAdminOrKoordinator =
    (Array.isArray(roles) &&
      (roles.includes("admin") || roles.includes("koordinator"))) ||
    primaryRole === "admin" ||
    primaryRole === "koordinator";

  if (!isAdminOrKoordinator) {
    return (
      <div className="p-6 text-sm text-red-600">
        403 – Kein Zugriff (nur Admin / Koordinator).
      </div>
    );
  }

  const params = useParams<{ committeeId: string }>();
  const navigate = useNavigate();

  const committeeId = Number(params.committeeId);
  if (!committeeId || Number.isNaN(committeeId)) {
    return (
      <div className="p-6">
        <div className="mb-4 text-sm text-red-600">
          Ungültige Ausschuss-ID in der URL.
        </div>
        <Button variant="outline" onClick={() => navigate("/admin/committees")}>
          Zurück zur Ausschuss-Übersicht
        </Button>
      </div>
    );
  }

  // Ausschussdaten für Titel
  const { committees } = useCommitteeList();
  const committee = committees.find((c) => c.committee_id === committeeId);

  // Mitglieder-Hooks
  const {
    members,
    loading,
    error,
  } = useCommitteeMembers(committeeId);

  const {
    addMember,
    loading: adding,
    error: addError,
  } = useAddCommitteeMember();

  const {
    deleteMember,
    loading: deleting,
    error: deleteError,
  } = useDeleteCommitteeMember();

  // Meta: Funktionen & Positionen
  const { functions, loading: loadingFunctions, error: functionsError } = useCommitteeFunctions();
  const { positions, loading: loadingPositions, error: positionsError } = useCommitteePositions();

  // Eingaben
  const [userIdInput, setUserIdInput] = useState("");
  const [isActiveInput, setIsActiveInput] = useState(true);
  const [selectedFunctionId, setSelectedFunctionId] = useState<number | null>(null);
  const [selectedPositionId, setSelectedPositionId] = useState<number | null>(null);

  async function handleAddMember(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const userId = Number(userIdInput);
    if (!userId || Number.isNaN(userId)) {
      alert("Bitte eine gültige User-ID eingeben.");
      return;
    }
    try {
      await addMember({
        user_id: userId,
        committee_id: committeeId,
        committee_function_id: selectedFunctionId ?? null,
        committee_position_id: selectedPositionId ?? null,
        is_active: isActiveInput,
      });
      setUserIdInput("");
      setSelectedFunctionId(null);
      setSelectedPositionId(null);
    } catch {
      // Fehler wird unten angezeigt
    }
  }

  async function handleRemoveMember(m: CommitteeMemberOut) {
    const ok = window.confirm(
      `Mitglied "${m.display_name}" aus diesem Ausschuss entfernen?`
    );
    if (!ok) return;
    await deleteMember({
      userCommitteeId: m.user_committee_id,
      committeeId,
    });
  }

  return (
    <div className="p-6 space-y-6">
      {/* Kopf */}
      <div className="space-y-1">
        <div className="text-xs text-muted-foreground">Administration</div>
        <h1 className="text-xl font-bold">
          Mitglieder – Ausschuss{" "}
          {committee
            ? `${committee.name} (ID ${committee.committee_id})`
            : `ID ${committeeId}`}
        </h1>
        <div className="text-xs text-muted-foreground">
          <Link
            to="/admin/committees"
            className="underline underline-offset-2"
          >
            Zurück zur Ausschuss-Übersicht
          </Link>
        </div>
      </div>

      {/* Status / Fehler */}
      {loading && <div>Lade Mitglieder…</div>}
      {error && (
        <div className="text-red-600 text-sm">
          Fehler beim Laden: {error.message}
        </div>
      )}
      {addError && (
        <div className="text-red-600 text-sm">
          Fehler beim Hinzufügen: {addError.message}
        </div>
      )}
      {deleteError && (
        <div className="text-red-600 text-sm">
          Fehler beim Entfernen: {deleteError.message}
        </div>
      )}
      {functionsError && (
        <div className="text-red-600 text-sm">
          Fehler beim Laden der Funktionen: {functionsError.message}
        </div>
      )}
      {positionsError && (
        <div className="text-red-600 text-sm">
          Fehler beim Laden der Positionen: {positionsError.message}
        </div>
      )}

      {/* Tabelle */}
      {!loading && !error && (
        <div className="border rounded overflow-hidden">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="border px-3 py-2 text-left">ID</th>
                <th className="border px-3 py-2 text-left">Name</th>
                <th className="border px-3 py-2 text-left">E-Mail</th>
                <th className="border px-3 py-2 text-left">Funktion</th>
                <th className="border px-3 py-2 text-left">Position</th>
                <th className="border px-3 py-2 text-center">Aktiv</th>
                <th className="border px-3 py-2 text-right">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.user_committee_id}>
                  <td className="border px-3 py-2">{m.user_id}</td>
                  <td className="border px-3 py-2">{m.display_name}</td>
                  <td className="border px-3 py-2">{m.email}</td>
                  <td className="border px-3 py-2">
                    {m.committee_function_name ?? "–"}
                  </td>
                  <td className="border px-3 py-2">
                    {m.committee_position_name ?? "–"}
                  </td>
                  <td className="border px-3 py-2 text-center">
                    {m.is_active ? "Ja" : "Nein"}
                  </td>
                  <td className="border px-3 py-2 text-right">
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={deleting}
                      onClick={() => handleRemoveMember(m)}
                    >
                      Entfernen
                    </Button>
                  </td>
                </tr>
              ))}

              {members.length === 0 && (
                <tr>
                  <td
                    className="border px-3 py-4 text-center text-gray-500"
                    colSpan={7}
                  >
                    Noch keine Mitglieder zugeordnet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Mitglied hinzufügen – User-ID + Funktion + Position */}
      <form
        onSubmit={handleAddMember}
        className="flex flex-wrap items-end gap-4 text-sm"
      >
        <div className="space-y-1">
          <div className="font-medium">User-ID hinzufügen</div>
          <input
            type="number"
            className="border rounded px-3 py-1 w-40"
            placeholder="User-ID"
            value={userIdInput}
            onChange={(e) => setUserIdInput(e.target.value)}
          />
          <div className="text-xs text-muted-foreground">
            (später: Auswahl über Prüfer-Liste)
          </div>
        </div>

        <div className="space-y-1">
          <div className="font-medium">Funktion</div>
          <select
            className="border rounded px-3 py-1 min-w-[220px]"
            value={selectedFunctionId ?? ""}
            onChange={(e) =>
              setSelectedFunctionId(
                e.target.value ? Number(e.target.value) : null
              )
            }
            disabled={loadingFunctions}
          >
            <option value="">– keine Funktion –</option>
            {functions.map((f) => (
              <option
                key={f.committee_function_id}
                value={f.committee_function_id}
              >
                {f.display_name_de} ({f.code})
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <div className="font-medium">Position</div>
          <select
            className="border rounded px-3 py-1 min-w-[220px]"
            value={selectedPositionId ?? ""}
            onChange={(e) =>
              setSelectedPositionId(
                e.target.value ? Number(e.target.value) : null
              )
            }
            disabled={loadingPositions}
          >
            <option value="">– keine Position –</option>
            {positions.map((p) => (
              <option
                key={p.committee_position_id}
                value={p.committee_position_id}
              >
                {p.display_name_de} ({p.code})
              </option>
            ))}
          </select>
        </div>

        <label className="flex items-center gap-2 mb-2">
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={isActiveInput}
            onChange={(e) => setIsActiveInput(e.target.checked)}
          />
          <span>als aktiv markieren</span>
        </label>

        <Button
          type="submit"
          size="sm"
          disabled={adding}
        >
          {adding ? "Füge hinzu…" : "Prüfer hinzufügen"}
        </Button>
      </form>
    </div>
  );
}
// End of file: frontend/src/pages/admin/CommitteeMembersPage.tsx
