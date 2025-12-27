// frontend/src/components/admin/time-schemes/TimeSchemesTab.tsx
import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { httpClient } from "@/lib/httpClient";
import type {
  OrgUnitOut,
  SubjectOut,
  TimeSchemeOut,
  TimeSchemeDefaultOut,
  TimeSchemeCreate,
  TimeSchemeUpdate,
} from "@/types/admin.types";

import {
  listTimeSchemes,
  createTimeScheme,
  updateTimeScheme,
  deleteTimeScheme,
  listTimeSchemeDefaults,
  createTimeSchemeDefault,
  updateTimeSchemeDefault,
} from "@/lib/api/adminTimeSchemes.api";

function fmtTimeScheme(ts: TimeSchemeOut) {
  const start = ts.default_first_slot_start?.slice(0, 5) ?? "??:??";
  const lunch =
    ts.lunch_break_duration_minutes != null
      ? `${ts.lunch_break_duration_minutes}m`
      : "—";
  const lunchAfter =
    ts.lunch_after_slots != null ? `nach ${ts.lunch_after_slots}` : "—";

  return `${start} • Dauer ${ts.exam_duration_minutes}m • Puffer ${ts.discussion_buffer_minutes}m • Slots ${ts.max_slots} • Lunch ${lunch} (${lunchAfter})`;
}

function toTimeInput(value: string | null | undefined) {
  if (!value) return "";
  // API liefert meistens "HH:MM:SS"
  return value.slice(0, 5);
}

function normalizeTimeToApi(value: string) {
  // Input type=time liefert "HH:MM"
  return value?.length === 5 ? `${value}:00` : value;
}

function emptyCreate(): TimeSchemeCreate {
  return {
    name: "",
    default_first_slot_start: "08:00",
    exam_duration_minutes: 30,
    discussion_buffer_minutes: 20,
    max_slots: 9,
    lunch_after_slots: null,
    lunch_break_duration_minutes: null,
    is_active: true,
  };
}

export default function TimeSchemesTab() {
  const [loading, setLoading] = useState(false);

  // Lookups
  const [orgUnits, setOrgUnits] = useState<OrgUnitOut[]>([]);
  const [subjects, setSubjects] = useState<SubjectOut[]>([]);

  // Data
  const [timeSchemes, setTimeSchemes] = useState<TimeSchemeOut[]>([]);
  const [defaults, setDefaults] = useState<TimeSchemeDefaultOut[]>([]);

  // Selection (Subject + OrgUnit) – null = Alle
  const [selectedOrgUnitId, setSelectedOrgUnitId] = useState<number | null>(null);
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(null);

  // Dialog (Create/Edit)
  const [editOpen, setEditOpen] = useState(false);
  const [editMode, setEditMode] = useState<"create" | "edit">("create");
  const [editId, setEditId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<TimeSchemeCreate>(emptyCreate());

  const orgUnitNameById = useMemo(() => {
    const m = new Map<number, string>();
    orgUnits.forEach((o) => m.set(o.org_unit_id, o.name));
    return m;
  }, [orgUnits]);

  const subjectCodeById = useMemo(() => {
    const m = new Map<number, string>();
    subjects.forEach((s) => m.set(s.subject_id, s.code));
    return m;
  }, [subjects]);

  const selectionIsSpecific = selectedOrgUnitId != null && selectedSubjectId != null;

  const currentDefault = useMemo(() => {
    if (!selectionIsSpecific) return null;
    return (
      defaults.find(
        (d) => d.org_unit_id === selectedOrgUnitId && d.subject_id === selectedSubjectId
      ) ?? null
    );
  }, [defaults, selectionIsSpecific, selectedOrgUnitId, selectedSubjectId]);

  const currentDefaultTimeSchemeId = currentDefault?.time_scheme_id ?? null;

  // Defaults pro TimeScheme (für Badge-Anzeige, wenn Filter = Alle)
  const defaultsByTimeSchemeId = useMemo(() => {
    const map = new Map<number, TimeSchemeDefaultOut[]>();
    defaults.forEach((d) => {
      if (!d.is_active) return;
      const arr = map.get(d.time_scheme_id) ?? [];
      arr.push(d);
      map.set(d.time_scheme_id, arr);
    });
    return map;
  }, [defaults]);

  async function loadLookups() {
    const [ouRes, subRes] = await Promise.all([
      httpClient.get<OrgUnitOut[]>("/admin/org-units?is_active=true&size=200"),
      httpClient.get<SubjectOut[]>("/admin/subjects"),
    ]);

    setOrgUnits(ouRes.data ?? []);
    setSubjects(subRes.data ?? []);
  }

  async function loadTimeSchemes() {
    const res = await listTimeSchemes({});
    setTimeSchemes(res.data ?? []);
  }

  async function loadAllDefaults() {
    // wichtig: alle Defaults laden, damit wir bei 409 sauber patchen können + Badge-View
    const res = await listTimeSchemeDefaults({});
    setDefaults(res.data ?? []);
  }

  async function reloadAll() {
    setLoading(true);
    try {
      await Promise.all([loadLookups(), loadTimeSchemes(), loadAllDefaults()]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // Default: Alle/Alle
    setSelectedOrgUnitId(null);
    setSelectedSubjectId(null);
    reloadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function toggleTimeSchemeActive(ts: TimeSchemeOut, next: boolean) {
    await updateTimeScheme(ts.time_scheme_id, { is_active: next });
    await loadTimeSchemes();
  }

  async function setDefaultForSelection(time_scheme_id: number) {
    if (!selectionIsSpecific) return;

    const existing = defaults.find(
      (d) => d.org_unit_id === selectedOrgUnitId && d.subject_id === selectedSubjectId
    );

    if (existing) {
      await updateTimeSchemeDefault(existing.time_scheme_default_id, {
        time_scheme_id,
        is_active: true,
      });
    } else {
      await createTimeSchemeDefault({
        org_unit_id: selectedOrgUnitId!,
        subject_id: selectedSubjectId!,
        time_scheme_id,
        is_active: true,
      });
    }

    await loadAllDefaults();
  }

  async function softDeleteTimeScheme(time_scheme_id: number) {
    await deleteTimeScheme(time_scheme_id);
    await Promise.all([loadTimeSchemes(), loadAllDefaults()]);
  }

  function openCreate() {
    setEditMode("create");
    setEditId(null);
    setEditForm(emptyCreate());
    setEditOpen(true);
  }

  function openEdit(ts: TimeSchemeOut) {
    setEditMode("edit");
    setEditId(ts.time_scheme_id);
    setEditForm({
      name: ts.name,
      default_first_slot_start: toTimeInput(ts.default_first_slot_start),
      exam_duration_minutes: ts.exam_duration_minutes,
      discussion_buffer_minutes: ts.discussion_buffer_minutes,
      max_slots: ts.max_slots,
      lunch_after_slots: ts.lunch_after_slots,
      lunch_break_duration_minutes: ts.lunch_break_duration_minutes,
      is_active: ts.is_active,
    });
    setEditOpen(true);
  }

  async function saveEdit() {
    const payload: TimeSchemeCreate = {
      ...editForm,
      default_first_slot_start: normalizeTimeToApi(editForm.default_first_slot_start),
      // falls Input "" liefert:
      lunch_after_slots: editForm.lunch_after_slots ?? null,
      lunch_break_duration_minutes: editForm.lunch_break_duration_minutes ?? null,
      is_active: editForm.is_active ?? true,
    };

    if (editMode === "create") {
      await createTimeScheme(payload);
    } else if (editId != null) {
      const patch: TimeSchemeUpdate = payload as unknown as TimeSchemeUpdate;
      await updateTimeScheme(editId, patch);
    }

    setEditOpen(false);
    await loadTimeSchemes();
  }

  const selectedOrgUnitLabel =
    selectedOrgUnitId != null
      ? orgUnitNameById.get(selectedOrgUnitId) ?? `OrgUnit ${selectedOrgUnitId}`
      : "Alle Organisationseinheiten";

  const selectedSubjectLabel =
    selectedSubjectId != null
      ? subjectCodeById.get(selectedSubjectId) ?? `Subject ${selectedSubjectId}`
      : "Alle Fächer";

  // optional: wenn ein Filter gesetzt ist, filtern wir die Zeitschemata NICHT – wir filtern nur Default-Logik.
  // (Wenn du später auch Zeitschemata nach Subject/OrgUnit klassifizieren willst, bräuchte es eine Beziehung.)

  return (
    <div className="space-y-4">
      {/* Title */}
      <div>
        <div className="text-3xl font-semibold">Zeitschema</div>
        <div className="text-sm text-muted-foreground">
          Definition der Zeitschemata und Default-Zuordnung pro Organisationseinheit &amp; Fach.
        </div>
      </div>

      {/* Filter row */}
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div className="space-y-2">
            <Label>Organisationseinheit</Label>
            <Select
              value={selectedOrgUnitId == null ? "__all__" : String(selectedOrgUnitId)}
              onValueChange={(v) => setSelectedOrgUnitId(v === "__all__" ? null : Number(v))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Bitte wählen…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Alle Organisationseinheiten</SelectItem>
                {orgUnits.map((o) => (
                  <SelectItem key={o.org_unit_id} value={String(o.org_unit_id)}>
                    {o.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Fach</Label>
            <Select
              value={selectedSubjectId == null ? "__all__" : String(selectedSubjectId)}
              onValueChange={(v) => setSelectedSubjectId(v === "__all__" ? null : Number(v))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Bitte wählen…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Alle Fächer</SelectItem>
                {subjects.map((s) => (
                  <SelectItem key={s.subject_id} value={String(s.subject_id)}>
                    {s.code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2 md:justify-end md:col-span-2">
            <Button variant="outline" onClick={reloadAll} disabled={loading}>
              Refresh
            </Button>
            <Button onClick={openCreate}>Neu</Button>
          </div>
        </div>

        <div className="mt-3 text-xs text-muted-foreground">
          Default wird gesetzt für:{" "}
          <span className="font-medium">{selectedSubjectLabel}</span> +{" "}
          <span className="font-medium">{selectedOrgUnitLabel}</span>
          {!selectionIsSpecific && (
            <span className="ml-2">
              (Default-Schalter ist deaktiviert – Badges zeigen vorhandene Defaults.)
            </span>
          )}
        </div>
      </Card>

      {/* List */}
      <Card className="p-4">
        {timeSchemes.length === 0 ? (
          <div className="text-sm text-muted-foreground">Keine Zeitschemata gefunden.</div>
        ) : (
          <div className="divide-y">
            {timeSchemes.map((ts) => {
              const isDefaultForSelection =
                selectionIsSpecific && currentDefaultTimeSchemeId === ts.time_scheme_id;

              const defaultBadges = defaultsByTimeSchemeId.get(ts.time_scheme_id) ?? [];

              return (
                <div
                  key={ts.time_scheme_id}
                  className="py-3 flex flex-col md:flex-row md:items-center gap-3"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="font-medium">{ts.name}</div>

                      {/* Badge: Default (für konkrete Auswahl) */}
                      {isDefaultForSelection && (
                        <Badge className="ml-1" variant="default">
                          Default
                        </Badge>
                      )}

                      {/* Badge(s): Default-Info wenn Filter = Alle */}
                      {!selectionIsSpecific && defaultBadges.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {defaultBadges.slice(0, 6).map((d) => {
                            const sub = subjectCodeById.get(d.subject_id) ?? `Subject ${d.subject_id}`;
                            const ou = orgUnitNameById.get(d.org_unit_id) ?? `OrgUnit ${d.org_unit_id}`;
                            return (
                              <Badge key={d.time_scheme_default_id} variant="secondary">
                                Default: {sub} • {ou}
                              </Badge>
                            );
                          })}
                          {defaultBadges.length > 6 && (
                            <Badge variant="secondary">+{defaultBadges.length - 6} weitere</Badge>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="text-xs text-muted-foreground">{fmtTimeScheme(ts)}</div>
                  </div>

                  <div className="flex items-center gap-3 md:justify-end">
                    {/* Active toggle */}
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={ts.is_active}
                        onCheckedChange={(v) => toggleTimeSchemeActive(ts, v)}
                      />
                      <span className="text-sm text-muted-foreground">aktiv</span>
                    </div>

                    {/* Default toggle (nur wenn konkrete Auswahl) */}
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={!!isDefaultForSelection}
                        onCheckedChange={(v) => {
                          if (v) setDefaultForSelection(ts.time_scheme_id);
                        }}
                        disabled={!selectionIsSpecific}
                      />
                      <span className="text-sm text-muted-foreground">Default</span>
                    </div>

                    <Button variant="outline" onClick={() => openEdit(ts)}>
                      Bearbeiten
                    </Button>

                    <Button
                      variant="destructive"
                      onClick={() => softDeleteTimeScheme(ts.time_scheme_id)}
                      disabled={!ts.is_active}
                      title="Soft-Delete: setzt is_active=false"
                    >
                      Deaktivieren
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editMode === "create" ? "Zeitschema anlegen" : "Zeitschema bearbeiten"}
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2 sm:col-span-2">
              <Label>Name</Label>
              <Input
                value={editForm.name}
                onChange={(e) => setEditForm((s) => ({ ...s, name: e.target.value }))}
                placeholder="z.B. Standard"
              />
            </div>

            <div className="space-y-2">
              <Label>Start (erster Slot)</Label>
              <Input
                type="time"
                value={editForm.default_first_slot_start}
                onChange={(e) =>
                  setEditForm((s) => ({ ...s, default_first_slot_start: e.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Dauer (Min.)</Label>
              <Input
                type="number"
                value={editForm.exam_duration_minutes}
                onChange={(e) =>
                  setEditForm((s) => ({ ...s, exam_duration_minutes: Number(e.target.value) }))
                }
                min={1}
              />
            </div>

            <div className="space-y-2">
              <Label>Puffer (Min.)</Label>
              <Input
                type="number"
                value={editForm.discussion_buffer_minutes}
                onChange={(e) =>
                  setEditForm((s) => ({ ...s, discussion_buffer_minutes: Number(e.target.value) }))
                }
                min={0}
              />
            </div>

            <div className="space-y-2">
              <Label>Max. Slots</Label>
              <Input
                type="number"
                value={editForm.max_slots}
                onChange={(e) => setEditForm((s) => ({ ...s, max_slots: Number(e.target.value) }))}
                min={1}
              />
            </div>

            <div className="space-y-2">
              <Label>Lunch nach Slots (optional)</Label>
              <Input
                type="number"
                value={editForm.lunch_after_slots ?? ""}
                onChange={(e) =>
                  setEditForm((s) => ({
                    ...s,
                    lunch_after_slots: e.target.value === "" ? null : Number(e.target.value),
                  }))
                }
                min={1}
              />
            </div>

            <div className="space-y-2">
              <Label>Lunch Dauer (Min., optional)</Label>
              <Input
                type="number"
                value={editForm.lunch_break_duration_minutes ?? ""}
                onChange={(e) =>
                  setEditForm((s) => ({
                    ...s,
                    lunch_break_duration_minutes: e.target.value === "" ? null : Number(e.target.value),
                  }))
                }
                min={1}
              />
            </div>

            <div className="flex items-center gap-2 sm:col-span-2">
              <Switch
                checked={!!editForm.is_active}
                onCheckedChange={(v) => setEditForm((s) => ({ ...s, is_active: v }))}
              />
              <span className="text-sm text-muted-foreground">aktiv</span>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={saveEdit} disabled={!editForm.name.trim()}>
              Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
