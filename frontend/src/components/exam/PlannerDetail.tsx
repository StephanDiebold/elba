// src/components/exam/PlannerDetail.tsx
import { useEffect, useState } from "react";
import dayjs from "dayjs";
import plannerApi from "@/lib/api/planner.api";
import type { AusschussLink, Zeitschema, Slot } from "@/types/planner.types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type Kammer = { kammer_id: number; kammer_name: string };
type Bezirkskammer = { bezirkskammer_id: number; bezirkskammer_name: string };
type Fachbereich = { fachbereich_id: number; fachbereich_name: string };

function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-xs text-muted-foreground mb-1">{children}</div>;
}

export default function PlannerDetail({ pruefungstagId }: { pruefungstagId: number }) {
  const [detail, setDetail] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Stammdaten
  const [kammern, setKammern] = useState<Kammer[]>([]);
  const [bk, setBk] = useState<Bezirkskammer[]>([]);
  const [fachbereiche, setFachbereiche] = useState<Fachbereich[]>([]);

  // Prüfungstag-Felder
  const [fachbereichId, setFachbereichId] = useState<number | null>(null);
  const [datum, setDatum] = useState("");
  const [ort, setOrt] = useState("");
  const [kammerId, setKammerId] = useState<number | null>(null);
  const [bkId, setBkId] = useState<number | null>(null);
  const [bemerkung, setBemerkung] = useState("");

  // Ausschüsse & Slots
  const [ausschuesse, setAusschuesse] = useState<AusschussLink[]>([]);
  const [zeitschemata, setZeitschemata] = useState<Zeitschema[]>([]);
  const [pta, setPta] = useState<number | null>(null);
  const [anzahl, setAnzahl] = useState(6);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [zs, setZs] = useState<number | null>(null);

  // Ort/Raum für aktuell gewählten Ausschuss
  const [ptaOrt, setPtaOrt] = useState("");
  const [ptaRaum, setPtaRaum] = useState("");

  // für "Weiteren Ausschuss hinzufügen"
  const [availableAusschuesse, setAvailableAusschuesse] = useState<
    { ausschuss_id: number; ausschuss_name: string }[]
  >([]);
  const [newAusschussId, setNewAusschussId] = useState<number | null>(null);
  const [newAusschussOrt, setNewAusschussOrt] = useState("");
  const [newAusschussRaum, setNewAusschussRaum] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const [d, z, k, fb, ausTag] = await Promise.all([
        plannerApi.getPruefungstag(pruefungstagId),
        plannerApi.listZeitschemata(),
        plannerApi.listKammern().catch(() => [] as Kammer[]),
        plannerApi.listFachbereiche().catch(() => [] as Fachbereich[]),
        plannerApi.listAusschuesseForTag(pruefungstagId).catch(() => [] as AusschussLink[]),
      ]);

      setDetail(d);
      setZeitschemata(z);
      setKammern(k);
      setFachbereiche(fb);

      // Kopf
      setFachbereichId(d.fachbereich_id ?? null);
      setDatum(d.datum);
      setOrt(d.ort ?? "");
      setKammerId(d.kammer_id ?? null);
      setBkId(d.bezirkskammer_id ?? null);
      setBemerkung(d.bemerkung ?? "");

      setAusschuesse(ausTag);

      // ersten Ausschuss vorauswählen
      if (ausTag.length > 0) {
        setPta(prev => prev ?? ausTag[0].pta_id);
      } else {
        setPta(null);
        setSlots([]);
      }
    } finally {
      setLoading(false);
    }
  };


  // BKs nachladen wenn Kammer geändert
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!kammerId) {
        setBk([]);
        setBkId(null);
        return;
      }
      try {
        const rows = await plannerApi.listBezirkskammern(kammerId);
        if (!cancelled) {
          setBk(rows);
          if (!rows.find((r) => r.bezirkskammer_id === bkId)) {
            setBkId(rows[0]?.bezirkskammer_id ?? null);
          }
        }
      } catch {
        if (!cancelled) {
          setBk([]);
          setBkId(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kammerId]);

  // Ort/Raum des aktuell gewählten Ausschusses nachziehen
  useEffect(() => {
    const cur = (ausschuesse ?? []).find((a) => a.pta_id === pta);
    setPtaOrt(cur?.ort ?? "");
    setPtaRaum(cur?.raum ?? "");
  }, [pta, ausschuesse]);

  // verfügbare Ausschüsse für "Weiteren Ausschuss hinzufügen"
  useEffect(() => {
    if (!detail) return;
    (async () => {
      try {
        const rows = await plannerApi.listAusschuesse({
          fachbereich_id: detail.fachbereich_id ?? undefined,
          kammer_id: detail.kammer_id ?? undefined,
          bezirkskammer_id: detail.bezirkskammer_id ?? undefined,
        });
        const usedIds = new Set((ausschuesse ?? []).map((a) => a.ausschuss_id));
        setAvailableAusschuesse(
          rows.filter((r) => !usedIds.has(r.ausschuss_id)),
        );
      } catch {
        setAvailableAusschuesse([]);
      }
    })();
  }, [
    detail?.pruefungstag_id,
    detail?.fachbereich_id,
    detail?.kammer_id,
    detail?.bezirkskammer_id,
    ausschuesse.length,
  ]);

  // 🔹 NEU: Slots für den aktuell gewählten Ausschuss laden
  useEffect(() => {
    const loadSlots = async () => {
      if (!pta) {
        setSlots([]);
        return;
      }
      const s = await plannerApi.listSlotsByPta(pta);
      setSlots(s);
    };
    loadSlots();
  }, [pta, pruefungstagId]);

  // Prüfungstag laden
  useEffect(() => {
    load();
  }, [pruefungstagId]);


  const handleSaveAll = async () => {
    setSaving(true);
    try {
      // 1) Prüfungstag speichern
      await plannerApi.updatePruefungstag(pruefungstagId, {
        fachbereich_id: fachbereichId ?? undefined,
        datum,
        ort,
        kammer_id: kammerId ?? undefined,
        bezirkskammer_id: bkId ?? undefined,
        bemerkung: bemerkung || undefined,
      });

      // 2) Ort/Raum des aktuell gewählten Ausschusses speichern (falls vorhanden)
      if (pta) {
        const cur = ausschuesse.find((a) => a.pta_id === pta);
        if (cur) {
          await plannerApi.assignAusschussToTag(pruefungstagId, {
            ausschuss_id: cur.ausschuss_id,
            ort: ptaOrt || undefined,
            raum: ptaRaum || undefined,
          });
        }
      }

      await load();
    } finally {
      setSaving(false);
    }
  };

  const generateSlots = async () => {
    if (!pta || !zs || anzahl <= 0) return;
    await plannerApi.generateSlots(pta, zs, anzahl);
    await load();
  };

  const addAusschuss = async () => {
    if (!newAusschussId) return;
    await plannerApi.assignAusschussToTag(pruefungstagId, {
      ausschuss_id: newAusschussId,
      ort: newAusschussOrt || undefined,
      raum: newAusschussRaum || undefined,
    });
    setNewAusschussId(null);
    setNewAusschussOrt("");
    setNewAusschussRaum("");
    await load();
  };

  if (loading || !detail) {
    return <Card className="p-6 text-sm text-muted-foreground">Lade…</Card>;
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle className="text-base md:text-lg">
          {ort || detail.ort} –{" "}
          {dayjs(datum || detail.datum).format("YYYY-MM-DD")}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-5 flex-1 flex flex-col">
        {/* OBERER TEIL: Prüfungstag */}
        <div className="border rounded-md p-3 space-y-3">
          <div className="text-sm font-medium mb-1">Prüfungstag</div>

          {/* Zeile 1: Fachbereich + Datum */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label>Fachbereich</Label>
              <Select
                value={fachbereichId?.toString() ?? ""}
                onValueChange={(v) => setFachbereichId(Number(v))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Fachbereich wählen" />
                </SelectTrigger>
                <SelectContent>
                  {fachbereiche.map((fb) => (
                    <SelectItem
                      key={fb.fachbereich_id}
                      value={String(fb.fachbereich_id)}
                    >
                      {fb.fachbereich_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Datum</Label>
              <Input
                type="date"
                value={datum}
                onChange={(e) => setDatum(e.target.value)}
              />
            </div>
          </div>

          {/* Zeile 2: Kammer + Bezirkskammer */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label>Kammer</Label>
              <Select
                value={kammerId?.toString() ?? ""}
                onValueChange={(v) => setKammerId(Number(v))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Kammer wählen" />
                </SelectTrigger>
                <SelectContent>
                  {kammern.map((k) => (
                    <SelectItem key={k.kammer_id} value={String(k.kammer_id)}>
                      {k.kammer_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Bezirkskammer</Label>
              <Select
                value={bkId?.toString() ?? ""}
                onValueChange={(v) => setBkId(Number(v))}
                disabled={!bk.length}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Bezirkskammer wählen" />
                </SelectTrigger>
                <SelectContent>
                  {bk.map((b) => (
                    <SelectItem
                      key={b.bezirkskammer_id}
                      value={String(b.bezirkskammer_id)}
                    >
                      {b.bezirkskammer_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Bemerkung</Label>
            <Textarea
              rows={2}
              value={bemerkung}
              onChange={(e) => setBemerkung(e.target.value)}
            />
          </div>
        </div>

        {/* MITTLERER TEIL: Ausschüsse & Slots */}
        <div className="border rounded-md p-3 space-y-4">
          <div className="text-sm font-medium">Ausschüsse &amp; Slots</div>

          {/* Ausschuss wählen (bereits zugeordnete) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
            <div>
              <Label>Ausschuss wählen</Label>
              <Select
                value={pta?.toString() ?? ""}
                onValueChange={(v) => setPta(Number(v))}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      (ausschuesse ?? []).length
                        ? "Ausschuss wählen"
                        : "Noch kein Ausschuss zugeordnet"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {(ausschuesse ?? []).map((a) => (
                    <SelectItem key={a.pta_id} value={String(a.pta_id)}>
                      {a.ausschuss_name || `Ausschuss ${a.ausschuss_id}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Ort (für diesen Ausschuss)</Label>
              <Input
                value={ptaOrt}
                onChange={(e) => setPtaOrt(e.target.value)}
                placeholder={ort || "z. B. Softwarezentrum"}
                disabled={!pta}
              />
            </div>

            <div>
              <Label>Raum (für diesen Ausschuss)</Label>
              <Input
                value={ptaRaum}
                onChange={(e) => setPtaRaum(e.target.value)}
                placeholder="z. B. Raum 101"
                disabled={!pta}
              />
            </div>
          </div>

          {/* Zeitschema + Slots */}
          <div className="grid grid-cols-1 md:grid-cols-[2fr,auto,auto] gap-3 items-end">
            <div>
              <Label>Zeitschema wählen</Label>
              <Select
                value={zs?.toString() ?? ""}
                onValueChange={(v) => setZs(Number(v))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Zeitschema wählen" />
                </SelectTrigger>
                <SelectContent>
                  {zeitschemata.map((z) => (
                    <SelectItem
                      key={z.zeitschema_id}
                      value={String(z.zeitschema_id)}
                    >
                      {z.name} ({z.tag_start})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Anzahl Slots</Label>
              <Input
                type="number"
                className="w-24"
                value={anzahl}
                onChange={(e) => setAnzahl(Number(e.target.value))}
                min={1}
                max={9}
              />
            </div>

            <div className="flex gap-2">
              <Button
                onClick={generateSlots}
                disabled={!pta || !zs || anzahl <= 0}
                className="w-full md:w-auto"
              >
                Slots generieren
              </Button>
            </div>
          </div>

          {/* Weiteren Ausschuss hinzufügen */}
          <div className="border-t pt-3 space-y-2">
            <div className="text-xs text-muted-foreground">
              Weiteren Ausschuss hinzufügen
            </div>
            <div className="grid grid-cols-1 md:grid-cols-[2fr,2fr,2fr,auto] gap-3 items-end">
              <div>
                <Label>Ausschuss</Label>
                <Select
                  value={newAusschussId?.toString() ?? ""}
                  onValueChange={(v) => setNewAusschussId(Number(v))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Ausschuss wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableAusschuesse.map((a) => (
                      <SelectItem
                        key={a.ausschuss_id}
                        value={String(a.ausschuss_id)}
                      >
                        {a.ausschuss_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Ort (optional)</Label>
                <Input
                  placeholder={ort || "z. B. Softwarezentrum"}
                  value={newAusschussOrt}
                  onChange={(e) => setNewAusschussOrt(e.target.value)}
                />
              </div>
              <div>
                <Label>Raum (optional)</Label>
                <Input
                  placeholder="z. B. Raum 202"
                  value={newAusschussRaum}
                  onChange={(e) => setNewAusschussRaum(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  onClick={addAusschuss}
                  disabled={!newAusschussId}
                  className="w-full md:w-auto"
                >
                  Ausschuss hinzufügen
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* SLOTS-LISTE */}
        <div className="mt-2 border rounded-md divide-y overflow-auto">
          {(slots ?? []).length === 0 ? (
            <div className="p-3 text-sm text-muted-foreground">
              Keine Slots vorhanden.
            </div>
          ) : (
            (slots ?? []).map((s) => (
              <div
                key={s.slot_id}
                className="p-3 text-sm flex justify-between"
              >
                <div>
                  {dayjs(s.start_at).format("HH:mm")}–
                  {dayjs(s.end_at).format("HH:mm")}
                </div>
                <div className="text-muted-foreground">{s.status}</div>
              </div>
            ))
          )}
        </div>

        {/* EINZIGER SPEICHERN-BUTTON */}
        <div className="pt-3 flex justify-end">
          <Button
            onClick={handleSaveAll}
            disabled={saving}
            className="w-full sm:w-auto"
          >
            {saving ? "Speichere…" : "Speichern"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
