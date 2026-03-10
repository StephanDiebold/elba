// src/pages/ExamGradingPage.tsx
//
// Dünner Wrapper um ExamGradingView.
// Hält die Route /exams/:examId am Leben für direkte Navigation.
//
import { useParams } from "react-router-dom";
import ExamGradingView from "@/components/exam/ExamGradingView";

type RouteParams = { examId?: string };

export default function ExamGradingPage() {
  const { examId } = useParams<RouteParams>();
  const examIdNum = examId ? Number(examId) : NaN;

  if (!examId || Number.isNaN(examIdNum)) {
    return (
      <div className="p-6 text-sm text-red-600">
        Ungültige oder fehlende Prüfungs-ID.
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Prüfungsbewertung</h1>
        <p className="text-sm text-muted-foreground">Prüfung #{examIdNum}</p>
      </div>
      <ExamGradingView examId={examIdNum} />
    </div>
  );
}
// End of src/pages/ExamGradingPage.tsx
