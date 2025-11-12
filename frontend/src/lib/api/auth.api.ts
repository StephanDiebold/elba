/* src/lib/api/auth.api.ts */
import {
  req,
  join,
  ensureFreshToken,
  ensureBearer,
  setToken,
  logoutLocal,
} from "./core";

/* ========== Types ========== */
export type RegisterResponse = {
  user_id: number;
  email: string;
  is_active: boolean;
};

export type RegisterPayload = {
  email: string;
  password: string;
  vorname: string;
  nachname: string;
  mobilnummer?: string | null;
  geburtstag?: string | null; // yyyy-mm-dd
  kammer_id: number;
  bezirkskammer_id?: number | null;
};

export type LoginResponse = {
  access_token: string;
  token_type: "bearer" | string;
};

/* ========== Calls ========== */
export const register = (payload: RegisterPayload) =>
  req<RegisterResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const login = async (
  email: string,
  password: string,
  store = true
): Promise<LoginResponse> => {
  const data = await req<LoginResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  if (store && data?.access_token) setToken(data.access_token);
  return data;
};

export const logout = () => logoutLocal();

export async function fetchMe(token?: string): Promise<any | null> {
  const raw = token ?? ensureFreshToken();
  if (!raw) return null;
  try {
    const r = await fetch(join("/auth/me"), {
      headers: { Authorization: ensureBearer(raw) },
      cache: "no-store",
    });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}
