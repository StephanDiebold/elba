// frontend/src/components/admin/time-schemes/TimeSchemesDefaultsTab.tsx
import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
  TimeSchemeDefaultCreate,
  TimeSchemeDefaultOut,
} from "@/types/admin.types";

import {
  listTimeSchemeDefaults,
  createTimeSchemeDefault,
  updateTimeSchemeDefault,
  deleteTimeSchemeDefault,
  listTimeSchemes,
} from "@/lib/api/adminTimeSchemes.api";

function fmtTimeScheme(ts: TimeSchemeOut) {
  const start = ts.default_first_slot_start?.slice(0, 5) ?? "??:??";
  const lunch =
    ts.lunch_break_duration_minutes != null
      ? `${ts.lunch_break_duration_minutes}m`
      : "—";
  return `${start} • Dauer ${ts.exam_duration_minutes}m • Puffer ${ts.discussion_buffer_minutes}m • Slots ${ts.max_slots} • Lunch ${lunch}`;
}

export default function TimeSchemesDefaultsTab() {
  const [onlyActive, setOnlyActive] = useState(true);
  const [open, setOpen] = useState(false);

  const [defaults, setDefaults] = useState<TimeSchemeDefaultOut[]>([]);
  const [orgUnits, setOrgUnits] = useState<OrgUnitOut[]>([]);
  const [subjects, setSubjects] = useState<SubjectOut[]>([]);
  const [timeSchemes, setTimeSchemes] = useState<TimeSchemeOut[]>([]);

  const [form, setForm] = useState<TimeSchemeDefaultCreate>({
    org_unit_id: 1,
    subject_id: 1,
    time_scheme_id: 1,
    is_active: true,
  });

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

  const timeSchemeById = useMemo(() => {
    const m = new Map<number, TimeSchemeOut>();
    timeSchemes.forEach((t) => m.set(t.time_scheme_id, t));
    return m;
  }, [timeSchemes]);

  async function loadLookups() {
    const [ouRes, subRes, tsRes] = await Promise.all([
      httpClient.get<OrgUnitOut[]>("/admin/org-units?is_active=true&size=200"),
      httpClient.get<SubjectOut[]>("/admin/subjects"),
      listTimeSchemes({ is_active: true }),
    ]);

    const ous = ouRes.data ?? [];
    const subs = subRes.data ?? [];
    const tss = tsRes.data ?? [];

    setOrgUnits(ous);
    setSubjects(subs);
    setTimeSchemes(tss);

    // Dialog Defaults sinnvoll vorbelegen
    const firstOu = ous[0]?.org_unit_id ?? 1;
    const firstSub = subs[0]?.subject_id ?? 1;
    const firstTs = tss[0]?.time_scheme_id ?? 1;

    setForm((prev) => ({
      ...prev,
      org_unit_id: prev.org_unit_id ?? firstOu,
      subject_id: prev.subject_id ?? firstSub,
      time_scheme_id: prev.time_scheme_id ?? firstTs,
      is_active: prev.is_active ?? true,
    }));
  }

  async function loadDefaults() {
    // absichtlich ALLE laden (auch inaktive), damit wir bei gleicher Kombi PATCHen können statt 409 zu bekommen
    const res = await listTimeSchemeDefaults({});
    setDefaults(res.data ?? []);
  }

  useEffect(() => {
    loadLookups();
    loadDefaults();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visibleDefaults = useMemo(() => {
    return defaults.filter((d) => (onlyActive ? d.is_active : true));
  }, [defaults, onlyActive]);

  async function onSave() {
    const existing = defaults.find(
      (d) => d.org_unit_id === form.org_unit_id && d.subject_id === form.subject_id
    );

    if (existing) {
      await updateTimeSchemeDefault(existing.time_scheme_default_id, {
        time_scheme_id: form.time_scheme_id,
        is_active: form.is_active ?? true,
      });
    } else {
      await createTimeSchemeDefault({
        org_unit_id: form.org_unit_id,
        subject_id: form.subject_id,
        time_scheme_id: form.time_scheme_id,
        is_active: form.is_active ?? true,
      });
    }

    setOpen(false);
    await loadDefaults();
  }

  async function onDeactivate(id: number) {
    await deleteTimeSchemeDefault(id); // soft delete => is_active=false
    await loadDefaults();
  }

  async function onActivate(row: TimeSchemeDefaultOut) {
    await updateTimeSchemeDefault(row.time_scheme_default_id, { is_active: true });
    await loadDefaults();
  }

  return (
    <div className="space-y-4">
      {/* Actions */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2">
          <Switch checked={onlyActive} onCheckedChange={setOnlyActive} />
          <span className="text-sm text-muted-foreground">nur aktiv</span>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" onClick={loadDefaults}>Refresh</Button>
          <Button onClick={() => setOpen(true)}>Neu / Setzen</Button>
        </div>
      </div>

      {/* List */}
      <Card className="p-4">
        {visibleDefaults.length === 0 ? (
          <div className="text-sm text-muted-foreground">Keine Defaults gefunden.</div>
        ) : (
          <div className="divide-y">
            {visibleDefaults.map((row) => {
              const ouName = orgUnitNameById.get(row.org_unit_id) ?? `OrgUnit ${row.org_unit_id}`;
              const subCode = subjectCodeById.get(row.subject_id) ?? `Subject ${row.subject_id}`;
              const ts = timeSchemeById.get(row.time_scheme_id);
              const tsLabel = ts ? `${ts.name} (${fmtTimeScheme(ts)})` : `#${row.time_scheme_id}`;

              return (
                <div key={row.time_scheme_default_id} className="py-3 flex items-center gap-3">
                  <div className="flex-1">
                    <div className="font-medium">{subCode} • {ouName}</div>
                    <div className="text-xs text-muted-foreground">Default: {tsLabel}</div>
                  </div>

                  {row.is_active ? (
                    <Button variant="destructive" onClick={() => onDeactivate(row.time_scheme_default_id)}>
                      Deaktivieren
                    </Button>
                  ) : (
                    <Button onClick={() => onActivate(row)}>Aktivieren</Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Default-Zeitschema setzen</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Fach</Label>
              <Select
                value={String(form.subject_id)}
                onValueChange={(v) => setForm((s) => ({ ...s, subject_id: Number(v) }))}
              >
                <SelectTrigger><SelectValue placeholder="Bitte wählen…" /></SelectTrigger>
                <SelectContent>
                  {subjects.map((s) => (
                    <SelectItem key={s.subject_id} value={String(s.subject_id)}>
                      {s.code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Organisationseinheit</Label>
              <Select
                value={String(form.org_unit_id)}
                onValueChange={(v) => setForm((s) => ({ ...s, org_unit_id: Number(v) }))}
              >
                <SelectTrigger><SelectValue placeholder="Bitte wählen…" /></SelectTrigger>
                <SelectContent>
                  {orgUnits.map((o) => (
                    <SelectItem key={o.org_unit_id} value={String(o.org_unit_id)}>
                      {o.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Zeitschema</Label>
              <Select
                value={String(form.time_scheme_id)}
                onValueChange={(v) => setForm((s) => ({ ...s, time_scheme_id: Number(v) }))}
              >
                <SelectTrigger><SelectValue placeholder="Bitte wählen…" /></SelectTrigger>
                <SelectContent>
                  {timeSchemes.map((t) => (
                    <SelectItem key={t.time_scheme_id} value={String(t.time_scheme_id)}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {(() => {
                const ts = timeSchemeById.get(form.time_scheme_id);
                if (!ts) return null;
                return <div className="text-xs text-muted-foreground mt-2">{fmtTimeScheme(ts)}</div>;
              })()}
            </div>

            <div className="flex items-center gap-2 sm:col-span-3">
              <Switch
                checked={!!form.is_active}
                onCheckedChange={(v) => setForm((s) => ({ ...s, is_active: v }))}
              />
              <span className="text-sm text-muted-foreground">aktiv</span>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Abbrechen</Button>
            <Button onClick={onSave}>Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
// End of frontend/src/components/admin/time-schemes/TimeSchemesDefaultsTab.tsx