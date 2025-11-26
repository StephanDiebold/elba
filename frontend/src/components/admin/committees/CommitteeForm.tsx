// src/components/admin/committees/CommitteeForm.tsx
import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { OrgUnitOut } from "@/types/admin.types";

export type CommitteeFormValues = {
  org_unit_id: number | null;
  name: string;
  description?: string | null;
  is_active: boolean;
};

type Props = {
  open: boolean;
  mode: "create" | "edit";
  initialValues?: CommitteeFormValues;
  orgUnitOptions: OrgUnitOut[];
  isSubmitting?: boolean;
  onSubmit: (values: CommitteeFormValues) => Promise<void> | void;
  onCancel: () => void;
};

export function CommitteeFormModal({
  open,
  mode,
  initialValues,
  orgUnitOptions,
  isSubmitting = false,
  onSubmit,
  onCancel,
}: Props) {
  const [values, setValues] = useState<CommitteeFormValues>(
    initialValues ?? {
      org_unit_id: null,
      name: "",
      description: "",
      is_active: true,
    }
  );

  useEffect(() => {
    if (initialValues) {
      setValues(initialValues);
    }
  }, [initialValues]);

  const handleChange = (field: keyof CommitteeFormValues, v: any) => {
    setValues((prev: CommitteeFormValues) => ({ ...prev, [field]: v }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(values);
  };

  return (
    <Dialog open={open} onOpenChange={(openVal) => !openVal && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === "create"
              ? "Ausschuss anlegen"
              : "Ausschuss bearbeiten"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* OrgUnit */}
          <div className="space-y-1">
            <Label>Organisationseinheit</Label>
            <select
              className="border rounded px-3 py-2 w-full"
              value={values.org_unit_id ?? ""}
              onChange={(e) =>
                handleChange(
                  "org_unit_id",
                  e.target.value ? Number(e.target.value) : null
                )
              }
              required
            >
              <option value="">– bitte wählen –</option>
              {orgUnitOptions.map((ou) => (
                <option key={ou.org_unit_id} value={ou.org_unit_id}>
                  {ou.name} {ou.code ? `(${ou.code})` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Name */}
          <div className="space-y-1">
            <Label>Name</Label>
            <Input
              value={values.name}
              onChange={(e) => handleChange("name", e.target.value)}
              required
            />
          </div>

          {/* Beschreibung */}
          <div className="space-y-1">
            <Label>Beschreibung (optional)</Label>
            <textarea
              className="border rounded px-3 py-2 w-full min-h-[80px]"
              value={values.description ?? ""}
              onChange={(e) =>
                handleChange("description", e.target.value || null)
              }
            />
          </div>

          {/* Aktiv */}
          <div className="flex items-center gap-2">
            <input
              id="committee_is_active"
              type="checkbox"
              checked={values.is_active}
              onChange={(e) => handleChange("is_active", e.target.checked)}
            />
            <Label htmlFor="committee_is_active">Aktiv</Label>
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

// End of src/components/admin/committees/CommitteeForm.tsx