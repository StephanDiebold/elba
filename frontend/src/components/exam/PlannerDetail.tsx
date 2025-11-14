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

function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-xs text-muted-foreground mb-1">{children}</div>;
}

export default function PlannerDetail({
  pruefungstagId,
}: {
  pruefungstagId: number;
}) {
  const [detail, setDetail] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Stammdaten
  const [kammern, setKammern] = useState<Kammer[]>([]);
  const [bk, setBk] = useState<Bezirkskammer[]>([]);

  // edit fields
  const [datum, setDatum] = useState("");
  const [ort, setOrt] = useState("");
  const [kammerId, setKammerId] = useState<number | null>(null);
  const [bkId, setBkId] = useState<number | null>(null);
  const [raum, setRaum] = useState("");
  const [bemerkung, setBemerkung] = useState("");

  // Ausschuss & Slots
  const [ausschuesse, setAusschuesse] = useState<AusschussLink[]>([]);
  const [zeitschemata, setZeitschemata] = useState<Zeitschema[]>([]);
  const [pta, setPta] = useState<number | null>(null);
  const [zs, setZs] = useState<number | null>(null);
  const [anzahl, setAnzahl] = useState(6);
  const [slots, setSlots] = useState<Slot[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      const [d, z, k] = await Promise.all([
        plannerApi.getPruefungstag(pruefungstagId),
        plannerApi.listZeitschemata(),
        plannerApi.listKammern().catch(() => [] as Kammer[]),
      ]);
      setDetail(d);
      setZeitschemata(z);
      setKammern(k);

      // form füllen
      setDatum(d.datum);
      setOrt(d.ort ?? "");
      setKammerId(d.kammer_id ?? null);
      setBkId(d.bezirkskammer_id ?? null);
      setRaum(d.raum_default ?? "");
      setBemerkung(d.bemerkung ?? "");

      // Ausschüsse+Slots
      const aus = await plannerApi.listAusschuesseForTag(pruefungstagId);
      setAusschuesse(aus);
      setSlots(d.slots ?? []);
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

  const save = async () => {
    setSaving(true);
    try {
      await plannerApi.updatePruefungstag(pruefungstagId, {
        datum,
        ort,
        kammer_id: kammerId ?? undefined,
        bezirkskammer_id: bkId ?? undefined,
        raum_default: raum || undefined,
        bemerkung: bemerkung || undefined,
      });
      await load();
    } finally {
      setSaving(false);
    }
  };

  const generateSlots = async () => {
    if (!pta || !zs) return;
    await plannerApi.generateSlots(pta, zs, anzahl);
    await load();
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pruefungstagId]);

  if (loading || !detail) {
    return <Card className="p-6 text-sm text-muted-foreground">Lade…</Card>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {ort || detail.ort} – {dayjs(datum || detail.datum).format("YYYY-MM-DD")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Kopf-Form */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <div>
            <Label>Datum</Label>
            <Input
              type="date"
              value={datum}
              onChange={(e) => setDatum(e.target.value)}
            />
          </div>
          <div>
            <Label>Ort</Label>
            <Input value={ort} onChange={(e) => setOrt(e.target.value)} />
          </div>
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
          <div>
            <Label>Standard-Raum</Label>
            <Input
              value={raum}
              onChange={(e) => setRaum(e.target.value)}
              placeholder="z. B. Raum 101"
            />
          </div>
          <div className="md:col-span-2 lg:col-span-3">
            <Label>Bemerkung</Label>
            <Textarea
              rows={2}
              value={bemerkung}
              onChange={(e) => setBemerkung(e.target.value)}
            />
          </div>
        </div>

        <div className="flex gap-2">
          <Button onClick={save} disabled={saving}>
            {saving ? "Speichern…" : "Speichern"}
          </Button>
        </div>

        {/* Slot-Generator */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
          <div className="md:col-span-2">
            <Select
              value={pta?.toString() ?? ""}
              onValueChange={(v) => setPta(Number(v))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Ausschuss wählen" />
              </SelectTrigger>
              <SelectContent>
                {ausschuesse.map((a) => (
                  <SelectItem key={a.pta_id} value={String(a.pta_id)}>
                    {a.ausschuss_name ?? `PTA ${a.pta_id}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2 flex gap-2">
            <Select
              value={zs?.toString() ?? ""}
              onValueChange={(v) => setZs(Number(v))}
            >
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Zeitschema wählen" />
              </SelectTrigger>
              <SelectContent>
                {zeitschemata.map((z) => (
                  <SelectItem key={z.zeitschema_id} value={String(z.zeitschema_id)}>
                    {z.name} ({z.tag_start})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="number"
              className="w-20"
              value={anzahl}
              onChange={(e) => setAnzahl(Number(e.target.value))}
              min={1}
              max={9}
            />
            <Button onClick={generateSlots} disabled={!pta || !zs}>
              Slots generieren
            </Button>
          </div>
        </div>

        {/* Slots */}
        <div className="mt-4 border rounded-md divide-y">
          {(slots ?? []).length === 0 ? (
            <div className="p-3 text-sm text-muted-foreground">
              Keine Slots vorhanden.
            </div>
          ) : (
            (slots ?? []).map((s) => (
              <div key={s.slot_id} className="p-3 text-sm flex justify-between">
                <div>
                  {dayjs(s.start_at).format("HH:mm")}–{dayjs(s.end_at).format("HH:mm")}
                </div>
                <div className="text-muted-foreground">{s.status}</div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
