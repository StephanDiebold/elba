// src/pages/admin/CommitteesAdminPage.tsx

import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import {
  useCommitteeList,
  useCreateCommittee,
  useUpdateCommittee,
  useDeleteCommittee,
} from "@/hooks/useCommittees";
import { useOrgUnitList } from "@/hooks/useOrgUnits";
import type { CommitteeOut } from "@/types/admin.types";
import { Button } from "@/components/ui/button";
import {
  CommitteeFormModal,
  type CommitteeFormValues,
} from "@/components/admin/committees/CommitteeForm";

export default function CommitteesAdminPage() {
  const { user } = useAuth();

  const roles = (user as any)?.roles as string[] | undefined;
  const primaryRole = (user as any)?.role as string | undefined;

  // Admin-Logik: Admin ODER Koordinator
  const isAdmin =
    (Array.isArray(roles) &&
      (roles.includes("admin") || roles.includes("koordinator"))) ||
    primaryRole === "admin" ||
    primaryRole === "koordinator";

  if (!isAdmin) {
    return (
      <div className="p-6 text-sm text-red-600">
        403 – Kein Zugriff (Administration nur für Benutzer mit Rolle
        „admin“ oder „koordinator“).
      </div>
    );
  }

  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<CommitteeOut | null>(null);

  const { committees, loading, error } = useCommitteeList();
  const { orgUnits } = useOrgUnitList(); // alle OrgUnits für Dropdown

  const {
    create,
    loading: creating,
    error: createError,
  } = useCreateCommittee();
  const {
    update,
    loading: updating,
    error: updateError,
  } = useUpdateCommittee();
  const {
    remove: deleteCommittee,
    loading: deleting,
    error: deleteError,
  } = useDeleteCommittee();

  const filtered = committees.filter((c) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      c.name.toLowerCase().includes(q) ||
      (c.description ?? "").toLowerCase().includes(q)
    );
  });

  const mode: "create" | "edit" = editing ? "edit" : "create";
  const isSubmitting = creating || updating;

  const openCreateModal = () => {
    setEditing(null);
    setIsModalOpen(true);
  };

  const openEditModal = (c: CommitteeOut) => {
    setEditing(c);
    setIsModalOpen(true);
  };

  const closeModal = () => setIsModalOpen(false);

  const handleDelete = async (id: number) => {
    const confirmed = window.confirm("Diesen Ausschuss wirklich löschen?");
    if (!confirmed) return;
    try {
      await deleteCommittee(id);
    } catch {
      alert("Fehler beim Löschen.");
    }
  };

  const handleFormSubmit = async (values: CommitteeFormValues) => {
    if (!values.org_unit_id) {
      alert("Bitte eine Organisationseinheit wählen.");
      return;
    }

    if (editing) {
      await update({
        committeeId: editing.committee_id,
        payload: {
          org_unit_id: values.org_unit_id,
          name: values.name,
          description: values.description ?? null,
          is_active: values.is_active,
        },
      });
    } else {
      await create({
        org_unit_id: values.org_unit_id,
        name: values.name,
        description: values.description ?? null,
        is_active: values.is_active,
      });
    }

    setIsModalOpen(false);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Kopf */}
      <div className="flex flex-col space-y-1">
        <div className="text-xs text-muted-foreground">Administration</div>
        <h1 className="text-xl font-bold">Ausschüsse</h1>
      </div>

      {/* Suche + Neu-Button */}
      <div className="flex items-center justify-between">
        <input
          type="text"
          placeholder="Suche nach Name oder Beschreibung..."
          className="border px-3 py-2 rounded w-full max-w-sm"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Button className="ml-4" onClick={openCreateModal}>
          + Neuer Ausschuss
        </Button>
      </div>

      {/* Fehler / Status */}
      {loading && <div>Lade Ausschüsse...</div>}
      {error && (
        <div className="text-red-600">
          Fehler beim Laden: {error.message}
        </div>
      )}
      {createError && (
        <div className="text-red-600">
          Fehler beim Anlegen: {createError.message}
        </div>
      )}
      {updateError && (
        <div className="text-red-600">
          Fehler beim Speichern: {updateError.message}
        </div>
      )}
      {deleteError && (
        <div className="text-red-600">
          Fehler beim Löschen: {deleteError.message}
        </div>
      )}

      {/* Liste */}
      {!loading && !error && (
        <div className="border rounded overflow-hidden">
          <table className="w-full border-collapse">
            <thead className="bg-gray-100">
              <tr>
                <th className="border px-3 py-2 text-left">ID</th>
                <th className="border px-3 py-2 text-left">Org.Unit</th>
                <th className="border px-3 py-2 text-left">Name</th>
                <th className="border px-3 py-2 text-left">Beschreibung</th>
                <th className="border px-3 py-2 text-left">Aktiv</th>
                <th className="border px-3 py-2 text-right">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => {
                const ou = orgUnits.find(
                  (o) => o.org_unit_id === c.org_unit_id
                );
                return (
                  <tr key={c.committee_id}>
                    <td className="border px-3 py-2">{c.committee_id}</td>
                    <td className="border px-3 py-2">
                      {ou
                        ? `${ou.name}${ou.code ? ` (${ou.code})` : ""}`
                        : c.org_unit_id}
                    </td>
                    <td className="border px-3 py-2">{c.name}</td>
                    <td className="border px-3 py-2">
                      {c.description ?? "-"}
                    </td>
                    <td className="border px-3 py-2">
                      {c.is_active ? "Ja" : "Nein"}
                    </td>
                    <td className="border px-3 py-2 text-right space-x-2">
                      <Button
                        variant="secondary"
                        onClick={() => openEditModal(c)}
                      >
                        Bearbeiten
                      </Button>

                      <Button asChild variant="outline">
                        <Link to={`/admin/committees/${c.committee_id}/members`}>
                          Mitglieder
                        </Link>
                      </Button>

                      <Button
                        variant="destructive"
                        disabled={deleting}
                        onClick={() => handleDelete(c.committee_id)}
                      >
                        Löschen
                      </Button>
                    </td>
                  </tr>
                );
              })}

              {filtered.length === 0 && (
                <tr>
                  <td
                    className="border px-3 py-4 text-center text-gray-500"
                    colSpan={6}
                  >
                    Keine Ausschüsse gefunden.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Dialog */}
      <CommitteeFormModal
        open={isModalOpen}
        mode={mode}
        orgUnitOptions={orgUnits}
        initialValues={
          editing
            ? {
                org_unit_id: editing.org_unit_id,
                name: editing.name,
                description: editing.description ?? "",
                is_active: editing.is_active ?? true,
              }
            : undefined
        }
        isSubmitting={isSubmitting}
        onSubmit={handleFormSubmit}
        onCancel={closeModal}
      />
    </div>
  );
}

// End of file: frontend/src/pages/admin/CommitteesAdminPage.tsx