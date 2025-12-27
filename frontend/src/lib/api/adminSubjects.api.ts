// frontend/src/lib/api/adminSubjects.api.ts
import { httpClient } from "@/lib/httpClient";

export type SubjectOut = {
  subject_id: number;
  code: string;
};

export const listSubjects = () => httpClient.get<SubjectOut[]>("/admin/subjects");
// End of file