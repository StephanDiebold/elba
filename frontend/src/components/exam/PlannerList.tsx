// src/components/exam/PlannerList.tsx
import { useEffect, useState } from "react";
import dayjs from "dayjs";
import plannerApi from "@/lib/api/planner.api";
import type { PruefungstagLite } from "@/types/planner.types";
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
import { Plus, RefreshCcw } from "lucide-react";

type Kammer = { kammer_id: number; kammer_name: string };
type Bezirkskammer = { bezirkskammer_id: number; bezirkskammer_name: string };
type Fachbereich = { fachbereich_id: number; fachbereich_name: string };

export default function PlannerList({
  onSelect,
  selectedId,
}: {
  onSelect: (id: number) => void;
  selectedId: number | null;
}) {
  const [list, setList] = useState<PruefungstagLite[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  // Felder für Neuanlage
  const [datum, setDatum] = useState(dayjs().format("YYYY-MM-DD"));
  const [ort, setOrt] = useState("IHK Stuttgart");

  const [kammern, setKammern] = useState<Kammer[]>([]);
  const [bk, setBk] = useState<Bezirkskammer[]>([]);
  const [kammerId, setKammerId] = useState<number | null>(null);
  const [bezirkskammerId, setBezirkskammerId] = useState<number | null>(null);

  const [fachbereiche, setFachbereiche] = useState<Fachbereich[]>([]);
  const [fachbereichId, setFachbereichId] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [resp, k, fb] = await Promise.all([
        plannerApi.listPruefungstage(),
        plannerApi.listKammern().catch(() => [] as Kammer[]),
        plannerApi.listFachbereiche().catch(() => [] as Fachbereich[]),
      ]);

      setList(resp.items);
      setKammern(k);
      setFachbereiche(fb);

      if (k?.length && kammerId == null) {
        setKammerId(k[0].kammer_id);
      }

      // AEVO als Default, wenn vorhanden – sonst erster Fachbereich
      if (fb?.length && fachbereichId == null) {
        const aevo = fb.find((f) =>
          f.fachbereich_name.toLowerCase().includes("aevo"),
        );
        setFachbereichId(aevo?.fachbereich_id ?? fb[0].fachbereich_id);
      }
    } finally {
      setLoading(false);
    }
  };

  // BKs nachladen sobald Kammer gewählt
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!kammerId) {
        setBk([]);
        setBezirkskammerId(null);
        return;
      }
      try {
        const rows = await plannerApi.listBezirkskammern(kammerId);
        if (!cancelled) {
          setBk(rows);
          setBezirkskammerId(rows[0]?.bezirkskammer_id ?? null);
        }
      } catch {
        if (!cancelled) {
          setBk([]);
          setBezirkskammerId(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [kammerId]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const create = async () => {
    setCreating(true);
    try {
      const r = await plannerApi.createPruefungstag({
        datum,
        ort,
        kammer_id: kammerId ?? undefined,
        bezirkskammer_id: bezirkskammerId ?? undefined,
        fachbereich_id: fachbereichId ?? undefined,
        status: "geplant",
      });

      const ptId = r.pruefungstag_id;
      await load();
      onSelect(ptId);
    } finally {
      setCreating(false);
    }
  };

  const btnDisabled = creating || !datum || !ort;

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base md:text-lg">
            Prüfungstage
          </CardTitle>
          <Button
            size="icon"
            variant="ghost"
            onClick={load}
            disabled={loading || creating}
            title="Neu laden"
            className="shrink-0"
          >
            <RefreshCcw className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="pt-0 flex-1 flex flex-col gap-3 min-h-0">
        {/* Neuanlage */}
        <div className="space-y-2 border rounded-md p-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Input
              type="date"
              value={datum}
              onChange={(e) => setDatum(e.target.value)}
            />
            <Input
              value={ort}
              onChange={(e) => setOrt(e.target.value)}
              placeholder="Ort"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Select
              value={fachbereichId?.toString() ?? ""}
              onValueChange={(v) => setFachbereichId(Number(v))}
            >
              <SelectTrigger className="w-full">
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

            <Select
              value={kammerId?.toString() ?? ""}
              onValueChange={(v) => setKammerId(Number(v))}
            >
              <SelectTrigger className="w-full">
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

          <div className="flex flex-wrap gap-2">
            <div className="flex-1 min-w-[180px]">
              <Select
                value={bezirkskammerId?.toString() ?? ""}
                onValueChange={(v) => setBezirkskammerId(Number(v))}
                disabled={!bk.length}
              >
                <SelectTrigger className="w-full">
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

            <Button
              onClick={create}
              disabled={btnDisabled}
              className="w-full sm:w-auto sm:flex-none"
            >
              <Plus className="mr-2 w-4 h-4" />
              Neu
            </Button>
          </div>
        </div>

        {/* Liste der Prüfungstage */}
        <div className="border rounded-lg divide-y flex-1 overflow-y-auto">
          {list.map((x) => (
            <button
              key={x.pruefungstag_id}
              className={[
                "w-full text-left px-3 py-2 hover:bg-muted text-sm",
                selectedId === x.pruefungstag_id ? "bg-muted" : "",
              ].join(" ")}
              onClick={() => onSelect(x.pruefungstag_id)}
            >
              <div className="font-medium">
                {dayjs(x.datum).format("DD.MM.YYYY")}
              </div>
              <div className="text-xs text-muted-foreground">{x.ort}</div>
            </button>
          ))}
          {!list.length && !loading && (
            <div className="p-3 text-sm text-muted-foreground">
              Keine Prüfungstage vorhanden.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
