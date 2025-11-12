import { createContext, useContext, useEffect, useState } from "react";
import { getKammern, getBezirkskammern } from "@/lib/api/common.api";

type CommonCtxType = {
  kammern: Array<{ kammer_id: number; kammer_name: string }>;
  bezirkskammernByKammer: Record<number, Array<{ bezirkskammer_id: number; bezirkskammer_name: string }>>;
  refresh: () => Promise<void>;
};

const CommonCtx = createContext<CommonCtxType | null>(null);
export const useCommon = () => {
  const ctx = useContext(CommonCtx);
  if (!ctx) throw new Error("useCommon must be used within <CommonProvider>");
  return ctx;
};

export function CommonProvider({ children }: { children: React.ReactNode }) {
  const [kammern, setKammern] = useState<CommonCtxType["kammern"]>([]);
  const [bezirkskammernByKammer, setBzk] = useState<CommonCtxType["bezirkskammernByKammer"]>({});

  async function refresh() {
    const k = await getKammern();
    setKammern(k);
    const map: CommonCtxType["bezirkskammernByKammer"] = {};
    await Promise.all(k.map(async (row) => {
      const b = await getBezirkskammern(row.kammer_id);
      map[row.kammer_id] = b;
    }));
    setBzk(map);
  }

  useEffect(() => { refresh(); }, []);
  return <CommonCtx.Provider value={{ kammern, bezirkskammernByKammer, refresh }}>{children}</CommonCtx.Provider>;
}
