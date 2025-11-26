// src/pages/OrgUnitsPage.tsx

import { useState } from "react";
import { useOrgUnitList, useDeleteOrgUnit, useCreateOrgUnit, useUpdateOrgUnit } from "@/hooks/useOrgUnits";
import type { OrgUnitOut } from "@/types/admin.types";
import { Button } from "@/components/ui/button";
import { OrgUnitFormModal, type OrgUnitFormValues } from "@/components/admin/org-units/OrgUnitForm";
import { useAuth } from "@/context/AuthContext";

export default function OrgUnitsPage() {
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

  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOrgUnit, setEditingOrgUnit] = useState<OrgUnitOut | null>(null);

  // Gesamtliste (mit Suche)
  const { orgUnits, loading, error } = useOrgUnitList({
    search: search.trim() !== "" ? search : undefined,
  });

  // Nur Kammern als mögliche Parents
  const { orgUnits: chamberParents } = useOrgUnitList({
    type: "chamber",
  } as any); // falls OrgUnitListQuery type: "chamber" | "district_chamber" enthält

  const {
    remove: deleteOrgUnit,
    loading: deleting,
    error: deleteError,
  } = useDeleteOrgUnit();

  const {
    create,
    loading: creating,
    error: createError,
  } = useCreateOrgUnit();

  const {
    update,
    loading: updating,
    error: updateError,
  } = useUpdateOrgUnit();

  const mode: "create" | "edit" = editingOrgUnit ? "edit" : "create";
  const isSubmitting = creating || updating;

  const openCreateModal = () => {
    setEditingOrgUnit(null);
    setIsModalOpen(true);
  };

  const openEditModal = (ou: OrgUnitOut) => {
    setEditingOrgUnit(ou);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
  };

  const handleDelete = async (id: number) => {
    const confirmed = window.confirm("Diese Organisationseinheit wirklich löschen?");
    if (!confirmed) return;

    try {
      await deleteOrgUnit(id);
    } catch {
      alert("Fehler beim Löschen.");
    }
  };

  const handleFormSubmit = async (values: OrgUnitFormValues) => {
    if (editingOrgUnit) {
      await update({
        orgUnitId: editingOrgUnit.org_unit_id,
        payload: {
          type: values.type,
          name: values.name,
          code: values.code ?? null,
          is_active: values.is_active,
          parent_org_unit_id: values.parent_org_unit_id ?? null,
        },
      });
    } else {
      await create({
        type: values.type,
        name: values.name,
        code: values.code ?? null,
        is_active: values.is_active,
        parent_org_unit_id: values.parent_org_unit_id ?? null,
      });
    }

    setIsModalOpen(false);
  };

  return (
    <div className="p-6 space-y-6">
      {/* kleiner Admin-Header */}
      <div className="flex flex-col space-y-1">
        <div className="text-xs text-muted-foreground">Administration</div>
        <h1 className="text-xl font-bold">Organisationseinheiten</h1>
      </div>

      <div className="flex items-center justify-between">
        <div />
        <Button onClick={openCreateModal}>+ Neu</Button>
      </div>

      {/* 🔍 Suchfeld */}
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Suche nach Name oder Code..."
          className="border px-3 py-2 rounded w-full"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading && <div>Lade Organisationseinheiten...</div>}

      {error && <div className="text-red-600">Fehler beim Laden: {error.message}</div>}
      {deleteError && <div className="text-red-600">Fehler beim Löschen: {deleteError.message}</div>}
      {createError && <div className="text-red-600">Fehler beim Anlegen: {createError.message}</div>}
      {updateError && <div className="text-red-600">Fehler beim Speichern: {updateError.message}</div>}

      {!loading && !error && (
        <div className="border rounded overflow-hidden">
          <table className="w-full border-collapse">
            <thead className="bg-gray-100">
              <tr>
                <th className="border px-3 py-2 text-left">ID</th>
                <th className="border px-3 py-2 text-left">Name</th>
                <th className="border px-3 py-2 text-left">Typ</th>
                <th className="border px-3 py-2 text-left">Code</th>
                <th className="border px-3 py-2 text-left">Aktiv</th>
                <th className="border px-3 py-2 text-right">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {orgUnits.map((ou: OrgUnitOut) => (
                <tr key={ou.org_unit_id}>
                  <td className="border px-3 py-2">{ou.org_unit_id}</td>
                  <td className="border px-3 py-2">{ou.name}</td>
                  <td className="border px-3 py-2">{ou.type}</td>
                  <td className="border px-3 py-2">{ou.code ?? "-"}</td>
                  <td className="border px-3 py-2">{ou.is_active ? "Ja" : "Nein"}</td>
                  <td className="border px-3 py-2 text-right space-x-2">
                    <Button variant="secondary" onClick={() => openEditModal(ou)}>
                      Bearbeiten
                    </Button>
                    <Button
                      variant="destructive"
                      disabled={deleting}
                      onClick={() => handleDelete(ou.org_unit_id)}
                    >
                      Löschen
                    </Button>
                  </td>
                </tr>
              ))}

              {orgUnits.length === 0 && (
                <tr>
                  <td className="border px-3 py-4 text-center text-gray-500" colSpan={6}>
                    Keine Organisationseinheiten gefunden.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      <OrgUnitFormModal
        open={isModalOpen}
        mode={mode}
        parentOptions={chamberParents} 
        initialValues={
          editingOrgUnit
            ? {
                type: editingOrgUnit.type,
                name: editingOrgUnit.name,
                code: editingOrgUnit.code,
                is_active: editingOrgUnit.is_active,
                parent_org_unit_id: (editingOrgUnit as any).parent_org_unit_id ?? null,
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
// Ende der Datei src/pages/OrgUnitsPage.tsx