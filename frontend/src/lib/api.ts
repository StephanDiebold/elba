// src/lib/api.ts

/* -------------------- API-BASE robust bestimmen -------------------- */
const envBaseRaw =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() ?? "";

/**
 * PROD: fällt hart auf PROD-API zurück, wenn Env fehlt.
 * DEV: fällt auf /api (Proxy) zurück.
 */
export const API_BASE =
  envBaseRaw !== ""
    ? envBaseRaw.replace(/\/+$/, "")
    : import.meta.env.DEV
    ? "/api"
    : "https://elba-api.diebold.gmbh";

// optionales Debug-Log (nur einmal beim Laden)
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
function asBearer(raw: string): string {
  return raw.startsWith("Bearer ") ? raw : `Bearer ${raw}`;
}
function getRawToken(): string | null {
  return getToken();
}

/** Kleiner Helfer zum Dekodieren des JWT-Payloads (ohne Validation) */
function parseJwt(token: string): any | null {
  try {
    const [, payload] = token.split(".");
    return JSON.parse(atob(payload));
  } catch {
    return null;
  }
}

/** Abgelaufen? (exp in Sekunden) */
export function isTokenExpired(token: string | null): boolean {
  if (!token) return true;
  const payload = parseJwt(token);
  const exp = payload?.exp;
  if (typeof exp !== "number") return false; // kein exp -> als nicht abgelaufen behandeln
  return exp * 1000 < Date.now();
}

/** Ensure-Helper: ist ein gültiges Token da? */
export function ensureFreshToken(): string | null {
  const t = getToken();
  if (!t) return null;
  if (isTokenExpired(t)) {
    setToken(null);
    return null;
  }
  return t;
}

/* -------------------- Header-Builder -------------------- */
function buildAuthHeaders(): Record<string, string> {
  const raw = getRawToken();
  if (!raw) return {};
  return { Authorization: asBearer(raw) };
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

/* -------------------- Pfad-Join -------------------- */
function join(path: string): string {
  // immer mit führendem Slash
  return path.startsWith("/") ? `${API_BASE}${path}` : `${API_BASE}/${path}`;
}

/* -------------------- Fehlerklasse -------------------- */
export class ApiError extends Error {
  status: number;
  data: any;
  constructor(status: number, data: any) {
    super(
      (data && (data.message || data.detail)) ||
        (data?.detail?.code ?? `HTTP ${status}`)
    );
    this.status = status;
    this.data = data;
  }
}

/* -------------------- Fetch-Helfer (JWT: kein credentials/include) -------------------- */
async function req<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = buildHeaders(init);
  const res = await fetch(join(path), { ...init, headers, cache: "no-store" });
  if (!res.ok) {
    let data: any = {};
    try {
      const text = await res.text();
      data = text ? JSON.parse(text) : {};
    } catch {
      data = {};
    }
    throw new ApiError(res.status, data);
  }
  if (res.status === 204) return undefined as unknown as T;
  try {
    const text = await res.text();
    if (!text) return undefined as unknown as T;
    return JSON.parse(text) as T;
  } catch {
    return undefined as unknown as T;
  }
}

export async function reqRaw(path: string, init: RequestInit = {}) {
  const headers = buildHeaders(init);
  const res = await fetch(join(path), { ...init, headers, cache: "no-store" });
  if (!res.ok) {
    let data: any = {};
    try {
      const text = await res.text();
      data = text ? JSON.parse(text) : {};
    } catch {
      data = {};
    }
    throw new ApiError(res.status, data);
  }
  return res;
}

/* -------------------- /auth/me (JWT: nur Bearer) -------------------- */
export async function fetchMe(token?: string): Promise<any | null> {
  const raw = token ?? ensureFreshToken();
  if (!raw) return null;
  try {
    const r = await fetch(join("/auth/me"), {
      headers: { Authorization: asBearer(raw) },
      cache: "no-store",
    });
    if (!r.ok) return null; // 401/403 -> nicht eingeloggt
    return await r.json();
  } catch {
    return null;
  }
}

/* ===================================================================
   STAMMDATEN
   =================================================================== */

export type Kammer = { kammer_id: number; kammer_name: string };
export type Bezirkskammer = { bezirkskammer_id: number; bezirkskammer_name: string; kammer_id: number };

export async function getKammern(): Promise<Kammer[]> {
  return req<Kammer[]>("/stammdaten/kammer", { method: "GET" });
}

export async function getBezirkskammern(kammer_id: number): Promise<Bezirkskammer[]> {
  return req<Bezirkskammer[]>(`/stammdaten/bezirkskammer?kammer_id=${kammer_id}`, { method: "GET" });
}

/* ===================================================================
   AUTH: Register / Login / Logout
   =================================================================== */

/** Antwort vom Backend bei erfolgreicher Registrierung */
export type RegisterResponse = {
  user_id: number;
  email: string;
  is_active: boolean;
};

/** Neues Register-Payload (Backend: /auth/register) */
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

/** Registrierung mit erweiterten Feldern */
export async function register(payload: RegisterPayload): Promise<RegisterResponse> {
  return req<RegisterResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/** Login → speichert access_token (JWT) */
export type LoginResponse = {
  access_token: string;
  token_type: "bearer" | string;
};

export async function login(
  email: string,
  password: string,
  store = true
): Promise<LoginResponse> {
  const data = await req<LoginResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  if (store && data?.access_token) setToken(data.access_token);
  return data;
}

/** Logout (Client-seitig): Token löschen */
export function logout() {
  setToken(null);
}

/* ===================================================================
   GENERISCHE GET/POST-Helper (praktisch für CRUD)
   =================================================================== */

export async function getJson<T>(path: string): Promise<T> {
  return req<T>(path, { method: "GET" });
}

export async function postJson<T, B = unknown>(
  path: string,
  body: B
): Promise<T> {
  return req<T>(path, { method: "POST", body: JSON.stringify(body) });
}

export async function putJson<T, B = unknown>(
  path: string,
  body: B
): Promise<T> {
  return req<T>(path, { method: "PUT", body: JSON.stringify(body) });
}

export async function del(path: string): Promise<void> {
  await req<void>(path, { method: "DELETE" });
}

/* ===================================================================
   Backwards-Compat Namespace (für Imports: { api })
   =================================================================== */
export const api = {
  // auth
  register,
  login,
  logout,
  fetchMe,

  // stammdaten
  getKammern,
  getBezirkskammern,

  // helpers
  getJson,
  postJson,
  putJson,
  del,
  reqRaw,

  // utils
  getToken,
  setToken,
  isTokenExpired,
  ensureFreshToken,
  API_BASE,
};
