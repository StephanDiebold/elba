/* src/lib/api/common.api.ts */
import { req } from "./core";

export type Kammer = { kammer_id: number; kammer_name: string };
export type Bezirkskammer = {
  bezirkskammer_id: number;
  bezirkskammer_name: string;
  kammer_id: number;
};

export const getKammern = () => req<Kammer[]>("/stammdaten/kammer", { method: "GET" });

export const getBezirkskammern = (kammer_id: number) =>
  req<Bezirkskammer[]>(`/stammdaten/bezirkskammer?kammer_id=${kammer_id}`, {
    method: "GET",
  });
