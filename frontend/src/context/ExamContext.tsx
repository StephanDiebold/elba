import { createContext, useContext, useState, useMemo } from "react";

type ExamCtxType = {
  selectedDayId: number | null;
  setSelectedDayId: (id: number | null) => void;
  selectedCommitteeId: number | null;
  setSelectedCommitteeId: (id: number | null) => void;
};

const ExamCtx = createContext<ExamCtxType | null>(null);
export const useExam = () => {
  const ctx = useContext(ExamCtx);
  if (!ctx) throw new Error("useExam must be used within <ExamProvider>");
  return ctx;
};

export function ExamProvider({ children }: { children: React.ReactNode }) {
  const [selectedDayId, setSelectedDayId] = useState<number | null>(null);
  const [selectedCommitteeId, setSelectedCommitteeId] = useState<number | null>(null);

  const value = useMemo(() => ({
    selectedDayId, setSelectedDayId,
    selectedCommitteeId, setSelectedCommitteeId,
  }), [selectedDayId, selectedCommitteeId]);

  return <ExamCtx.Provider value={value}>{children}</ExamCtx.Provider>;
}
