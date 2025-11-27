// src/pages/ExamDayDetailPage.tsx

import { useParams } from "react-router-dom";
import PlannerDetail from "@/components/exam/PlannerDetail";

export default function ExamDayDetailPage() {
  const { examDayId } = useParams<{ examDayId: string }>();

  if (!examDayId) {
    return (
      <div className="p-6 text-sm text-red-600">
        Keine Prüfungs-ID in der URL gefunden.
      </div>
    );
  }

  const idNumber = Number(examDayId);
  if (Number.isNaN(idNumber)) {
    return (
      <div className="p-6 text-sm text-red-600">
        Ungültige Prüfungs-ID in der URL.
      </div>
    );
  }

  return <PlannerDetail examDayId={idNumber} />;
}
// End of src/pages/ExamDayDetailPage.tsx
