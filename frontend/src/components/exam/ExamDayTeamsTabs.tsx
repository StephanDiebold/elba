// src/components/exam/ExamDayTeamsTabs.tsx
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { ExamDayTeam, ExamSlot } from "@/lib/api/planner.api";
import { TeamPanel } from "@/components/exam/TeamPanel";

type Props = {
  examDayId: number;
  teams: ExamDayTeam[];
  slots: ExamSlot[];

  onAddTeam: () => void;
  onGenerateSlots: (team: ExamDayTeam) => Promise<void>;
  onDeleteSlots: (team: ExamDayTeam) => Promise<void>;
  onDeleteTeam: (team: ExamDayTeam) => Promise<void>;
  onOpenAssign: (slot: ExamSlot) => void;

  // ✅ NEU
  onNavigateToExam: (examId: number) => void;

  slotsBusyTeamId: number | null;
};

export function ExamDayTeamsTabs({
  teams,
  slots,
  onAddTeam,
  onGenerateSlots,
  onDeleteSlots,
  onDeleteTeam,
  onOpenAssign,
  onNavigateToExam,
  slotsBusyTeamId,
}: Props) {
  const [activeTeamId, setActiveTeamId] = useState<number | null>(
    teams[0]?.exam_day_team_id ?? null
  );

  // wenn Teams wechseln (neu geladen) und active nicht mehr existiert
  useMemo(() => {
    if (!teams.length) {
      setActiveTeamId(null);
      return;
    }
    if (activeTeamId == null || !teams.some(t => t.exam_day_team_id === activeTeamId)) {
      setActiveTeamId(teams[0].exam_day_team_id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teams]);

  const activeTeam = teams.find((t) => t.exam_day_team_id === activeTeamId) ?? null;

  const slotsByTeam = useMemo(() => {
    const map = new Map<number, ExamSlot[]>();
    for (const s of slots) {
      map.set(s.exam_day_team_id, [...(map.get(s.exam_day_team_id) ?? []), s]);
    }
    return map;
  }, [slots]);

  return (
    <div className="space-y-4">
      {/* Header + Tabs */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Ausschüsse</h2>
          <p className="text-sm text-muted-foreground">
            Wähle einen Ausschuss – darunter findest du direkt die Slots.
          </p>
        </div>

        <Button size="sm" onClick={onAddTeam}>
          + Ausschuss hinzufügen
        </Button>
      </div>

      {teams.length === 0 ? (
        <Card className="p-4 text-sm text-muted-foreground">
          Es sind noch keine Ausschüsse für diesen Prüfungstag angelegt.
        </Card>
      ) : (
        <>
          {/* Reiter */}
          <div className="flex flex-wrap gap-2">
            {teams.map((t) => (
              <Button
                key={t.exam_day_team_id}
                size="sm"
                variant={activeTeamId === t.exam_day_team_id ? "default" : "outline"}
                onClick={() => setActiveTeamId(t.exam_day_team_id)}
              >
                {t.name || `Ausschuss ${t.exam_day_team_id}`}
              </Button>
            ))}
          </div>

          {/* Content */}
          {activeTeam && (
            <TeamPanel
              examDayId={activeTeam.exam_day_id}
              team={activeTeam}
              slots={slotsByTeam.get(activeTeam.exam_day_team_id) ?? []}
              onGenerateSlots={onGenerateSlots}
              onDeleteSlots={onDeleteSlots}
              onDeleteTeam={onDeleteTeam}
              onOpenAssign={onOpenAssign}
              onNavigateToExam={onNavigateToExam}
              busy={slotsBusyTeamId === activeTeam.exam_day_team_id}
            />
          )}
        </>
      )}
    </div>
  );
}
