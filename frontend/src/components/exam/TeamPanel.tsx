// src/components/exam/TeamPanel.tsx
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { ExamDayTeam, ExamSlot } from "@/lib/api/planner.api";

type Props = {
  examDayId: number;
  team: ExamDayTeam;
  slots: ExamSlot[];
  onGenerateSlots: (team: ExamDayTeam) => Promise<void>;
  onDeleteSlots: (team: ExamDayTeam) => Promise<void>;
  onDeleteTeam: (team: ExamDayTeam) => Promise<void>;
  onOpenAssign: (slot: ExamSlot) => void;
  onNavigateToExam: (examId: number) => void;

  busy: boolean;
};

const formatTime = (t: string) => t?.slice(0, 5) || t;

export function TeamPanel({
  team,
  slots,
  onGenerateSlots,
  onDeleteSlots,
  onDeleteTeam,
  onOpenAssign,
  onNavigateToExam,
  busy,
}: Props) {
  const slotCount = slots.length;
  const canDeleteSlots = (team.exam_count ?? 0) === 0;

  return (
    <div className="space-y-4">
      {/* Team header */}
      <Card className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="text-base font-semibold">
              {team.name || `Ausschuss ${team.exam_day_team_id}`}
            </div>

            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span>Zeitschema:</span>
              <span className="text-foreground">
                {team.time_scheme_name
                  ? team.time_scheme_name
                  : team.time_scheme_id ?? "–"}
              </span>
              {team.time_scheme_id != null && (
                <Badge variant="secondary">{team.time_scheme_id}</Badge>
              )}

              <span className="mx-2">•</span>
              <span>Slots:</span>
              <span className="text-foreground">{slotCount}</span>

              <span className="mx-2">•</span>
              <span>Prüfungen:</span>
              <span className="text-foreground">{team.exam_count ?? 0}</span>
            </div>

            <div className="text-sm">
              <div className="text-muted-foreground mb-1">Prüfer</div>
              {team.members?.length ? (
                <ul className="list-disc pl-5 space-y-0.5">
                  {team.members.map((m) => (
                    <li key={m.user_id}>
                      {(m.last_name || "").trim()} {(m.first_name || "").trim()}
                      <span className="text-muted-foreground"> (#{m.user_id})</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-muted-foreground">–</div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2 min-w-[220px]">
            <Button
              onClick={() => onGenerateSlots(team)}
              disabled={busy || slotCount > 0}
              title={slotCount > 0 ? "Slots existieren bereits – bitte zuerst löschen" : "Slots generieren"}
            >
              {busy ? "…" : "Slots generieren"}
            </Button>

            <Button
              variant="outline"
              onClick={() => onDeleteSlots(team)}
              disabled={busy || slotCount === 0 || !canDeleteSlots}
              title={
                !canDeleteSlots
                  ? "Nicht möglich: es existieren Prüfungen"
                  : slotCount === 0
                  ? "Keine Slots vorhanden"
                  : "Slots löschen"
              }
            >
              {busy ? "…" : "Slots löschen"}
            </Button>

            <Button
              variant="destructive"
              onClick={() => onDeleteTeam(team)}
              disabled={busy || !team.can_delete}
              title={
                team.can_delete
                  ? "Ausschuss entfernen"
                  : "Nicht möglich: bereits Prüfungen vorhanden"
              }
            >
              {busy ? "…" : "Entfernen"}
            </Button>
          </div>
        </div>
      </Card>

      {/* Slot table */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="font-semibold">Slots</div>
          {slotCount === 0 && (
            <div className="text-sm text-muted-foreground">
              Noch keine Slots vorhanden. Bitte „Slots generieren“.
            </div>
          )}
        </div>

        {slotCount > 0 && (
          <div className="w-full overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr className="border-b">
                  <th className="py-2 pr-2">Slot</th>
                  <th className="py-2 pr-2">Zeit</th>
                  <th className="py-2 pr-2">Prüfkandidat</th>
                  <th className="py-2 pr-2">Status</th>
                  <th className="py-2 text-right">Aktion</th>
                </tr>
              </thead>
              <tbody>
                {slots.map((s) => {
                  const name = `${s.candidate_last_name ?? ""}, ${s.candidate_first_name ?? ""}`
                    .replace(/^,|\s,$/, "")
                    .trim();

                  return (
                    <tr key={s.exam_slot_id} className="border-b last:border-b-0">
                      <td className="py-2 pr-2">{s.slot_index}</td>
                      <td className="py-2 pr-2">
                        {formatTime(s.start_time)} – {formatTime(s.end_time)}
                      </td>
                      <td className="py-2 pr-2">
                        {s.candidate_id ? (
                          <span>{name || `Prüfkandidat ${s.candidate_id}`}</span>
                        ) : (
                          <span className="text-muted-foreground">–</span>
                        )}
                      </td>
                     <td className="py-2 text-right">
                        {s.exam_id ? (
                          <Button size="sm" onClick={() => onNavigateToExam(s.exam_id!)}>
                            Bewerten
                          </Button>
                        ) : (
                          <Button size="sm" variant="outline" onClick={() => onOpenAssign(s)}>
                            Kandidat zuweisen
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
// Ende src/components/exam/TeamPanel.tsx