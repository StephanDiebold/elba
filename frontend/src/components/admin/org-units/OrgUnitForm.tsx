// src/components/admin/org-units/OrgUnitForm.tsx

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { OrgUnitOut } from "@/types/admin.types";

export type OrgUnitFormValues = {
  type: "chamber" | "district_chamber";
  name: string;
  code?: string | null;
  is_active: boolean;
  parent_org_unit_id?: number | null;
};

type Props = {
  open: boolean;
  mode: "create" | "edit";
  initialValues?: OrgUnitFormValues;
  parentOptions: OrgUnitOut[];  // 👈 alle Kammern
  isSubmitting?: boolean;
  onSubmit: (values: OrgUnitFormValues) => Promise<void> | void;
  onCancel: () => void;
};

export function OrgUnitFormModal({
  open,
  mode,
  initialValues,
  parentOptions,
  isSubmitting = false,
  onSubmit,
  onCancel,
}: Props) {
  const [values, setValues] = useState<OrgUnitFormValues>(
    initialValues ?? {
      type: "chamber",
      name: "",
      code: "",
      is_active: true,
      parent_org_unit_id: null,
    }
  );

  useEffect(() => {
    if (initialValues) {
      setValues(initialValues);
    }
  }, [initialValues]);

  const handleChange = (field: keyof OrgUnitFormValues, v: any) => {
    setValues((prev) => ({ ...prev, [field]: v }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(values);
  };

  const isDistrict = values.type === "district_chamber";

  return (
    <Dialog open={open} onOpenChange={(openVal) => !openVal && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Organisationseinheit anlegen" : "Organisationseinheit bearbeiten"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Typ */}
          <div className="space-y-1">
            <Label>Typ</Label>
            <select
              className="border rounded px-3 py-2 w-full"
              value={values.type}
              onChange={(e) => handleChange("type", e.target.value as OrgUnitFormValues["type"])}
            >
              <option value="chamber">Kammer</option>
              <option value="district_chamber">Bezirkskammer</option>
            </select>
          </div>

          {/* Parent nur bei District-Chamber */}
          {isDistrict && (
            <div className="space-y-1">
              <Label>Übergeordnete Kammer</Label>
              <select
                className="border rounded px-3 py-2 w-full"
                value={values.parent_org_unit_id ?? ""}
                onChange={(e) =>
                  handleChange(
                    "parent_org_unit_id",
                    e.target.value ? Number(e.target.value) : null
                  )
                }
              >
                <option value="">– bitte wählen –</option>
                {parentOptions.map((ou) => (
                  <option key={ou.org_unit_id} value={ou.org_unit_id}>
                    {ou.name} {ou.code ? `(${ou.code})` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Name */}
          <div className="space-y-1">
            <Label>Name</Label>
            <Input
              value={values.name}
              onChange={(e) => handleChange("name", e.target.value)}
              required
            />
          </div>

          {/* Code */}
          <div className="space-y-1">
            <Label>Code</Label>
            <Input
              value={values.code ?? ""}
              onChange={(e) => handleChange("code", e.target.value || null)}
            />
          </div>

          {/* Aktiv */}
          <div className="flex items-center gap-2">
            <input
              id="is_active"
              type="checkbox"
              checked={values.is_active}
              onChange={(e) => handleChange("is_active", e.target.checked)}
            />
            <Label htmlFor="is_active">Aktiv</Label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onCancel}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Speichere..." : "Speichern"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
// Ende der Datei src/components/admin/org-units/OrgUnitForm.tsx