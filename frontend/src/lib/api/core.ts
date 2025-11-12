/* src/lib/api/core.ts */
/* -------------------- API-BASE robust bestimmen -------------------- */
const envBaseRaw =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() ?? "";

export const API_BASE =
  envBaseRaw !== ""
    ? envBaseRaw.replace(/\/+$/, "")
    : import.meta.env.DEV
    ? "/api"
    : "https://elba-api.diebold.gmbh";

// optionales Debug-Log (nur einmal)
if (typeof window !== "undefined") {
  console.info("[API] base:", API_BASE, "| mode:", import.meta.env.MODE);
}

/* ===================================================================
   🔐 JWT: Token-Storage & Utils
   =================================================================== */
const TOKEN_KEY = "token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY) ?? null;
}
export function setToken(token: string | null) {
  if (!token) localStorage.removeItem(TOKEN_KEY);
  else
    localStorage.setItem(
      TOKEN_KEY,
      token.startsWith("Bearer ") ? token.slice(7) : token
    );
}
export function logoutLocal() {
  setToken(null);
}

export function ensureBearer(raw: string) {
  return raw.startsWith("Bearer ") ? raw : `Bearer ${raw}`;
}

function parseJwt(token: string): any | null {
  try {
    const [, payload] = token.split(".");
    return JSON.parse(atob(payload));
  } catch {
    return null;
  }
}
export function isTokenExpired(token: string | null): boolean {
  if (!token) return true;
  const payload = parseJwt(token);
  const exp = payload?.exp;
  if (typeof exp !== "number") return false;
  return exp * 1000 < Date.now();
}
export function ensureFreshToken(): string | null {
  const t = getToken();
  if (!t) return null;
  if (isTokenExpired(t)) {
    setToken(null);
    return null;
  }
  return t;
}

/* -------------------- Header/URL -------------------- */
function buildAuthHeaders(): Record<string, string> {
  const raw = getToken();
  if (!raw) return {};
  return { Authorization: ensureBearer(raw) };
}
function buildHeaders(init: RequestInit = {}): Record<string, string> {
  const headers: Record<string, string> = {
    ...buildAuthHeaders(),
    ...(init.headers ? (init.headers as Record<string, string>) : {}),
  };
  const method = (init.method ?? "GET").toUpperCase();
  const hasBody = !!init.body && method !== "GET" && method !== "HEAD";
  if (hasBody && !("Content-Type" in headers)) {
    headers["Content-Type"] = "application/json";
  }
  return headers;
}
export function join(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE}${p}`.replace(/([^:]\/)\/+/g, "$1");
}

/* -------------------- Fehler/Fetch -------------------- */
export class ApiError extends Error {
  status: number;
  data: any;
  constructor(status: number, data: any) {
    const msg =
      (data && (data.message || data.detail)) ||
      (data?.detail?.code ?? (status === 0 ? "Network error" : `HTTP ${status}`));
    super(msg);
    this.status = status;
    this.data = data;
  }
}
async function parseJsonSafe(res: Response) {
  try {
    const t = await res.text();
    return t ? JSON.parse(t) : {};
  } catch {
    return {};
  }
}

/* -------------------- Core-Requests -------------------- */
export async function req<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = buildHeaders(init);
  let res: Response;
  try {
    res = await fetch(join(path), { ...init, headers, cache: "no-store" });
  } catch {
    throw new ApiError(0, { detail: "Network error" });
  }
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) logoutLocal();
    throw new ApiError(res.status, await parseJsonSafe(res));
  }
  if (res.status === 204) return undefined as unknown as T;
  return (await parseJsonSafe(res)) as T;
}

export async function reqRaw(path: string, init: RequestInit = {}) {
  const headers = buildHeaders(init);
  let res: Response;
  try {
    res = await fetch(join(path), { ...init, headers, cache: "no-store" });
  } catch {
    throw new ApiError(0, { detail: "Network error" });
  }
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) logoutLocal();
    throw new ApiError(res.status, await parseJsonSafe(res));
  }
  return res;
}

/* -------------------- Generische JSON-Helper -------------------- */
export const getJson = <T>(path: string) => req<T>(path, { method: "GET" });
export const postJson = <T, B = unknown>(path: string, body: B) =>
  req<T>(path, { method: "POST", body: JSON.stringify(body) });
export const putJson = <T, B = unknown>(path: string, body: B) =>
  req<T>(path, { method: "PUT", body: JSON.stringify(body) });
export const del = (path: string) => req<void>(path, { method: "DELETE" });
