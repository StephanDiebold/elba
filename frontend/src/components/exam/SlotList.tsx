// src/components/exam/SlotList.tsx
import type { Slot } from "@/types/planner.types";
import dayjs from "dayjs";

export default function SlotList({ slots }: { slots: Slot[] }) {
  if (!slots || slots.length === 0) {
    return <div className="p-4 text-sm text-muted-foreground">Keine Slots vorhanden.</div>;
  }
  return (
    <div className="rounded-lg border overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            <th className="text-left p-2">Start</th>
            <th className="text-left p-2">Ende</th>
            <th className="text-left p-2">Status</th>
            <th className="text-left p-2">Kapazität</th>
          </tr>
        </thead>
        <tbody>
          {slots.map((s) => (
            <tr key={s.slot_id} className="border-t">
              <td className="p-2">{dayjs(s.start_at).format("HH:mm")}</td>
              <td className="p-2">{dayjs(s.end_at).format("HH:mm")}</td>
              <td className="p-2">{s.status}</td>
              <td className="p-2">{s.capacity}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
