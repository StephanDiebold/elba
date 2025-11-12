// src/auth/AuthContext.tsx
import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  login as apiLogin,
  fetchMe,
  logout as apiLogout,
  setToken as apiSetToken,
  ensureFreshToken,
} from "@/lib/api";

type User =
  | { id?: number; user_id?: number; email?: string; [k: string]: any }
  | null;

function normalizeUser(meResp: any): User {
  // erlaube mehrere Formen (direkt, {user}, {data:{user}}, {account} ...)
  const c =
    meResp?.user ??
    meResp?.data?.user ??
    meResp?.account ??
    meResp?.data?.account ??
    meResp;
  return c && (c.email || c.id || c.user_id) ? (c as User) : null;
}

type Ctx = {
  user: User;
  loading: boolean;
  refresh: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthCtx = createContext<Ctx>({
  user: null,
  loading: true,
  refresh: async () => {},
  login: async () => {},
  logout: () => {},
});

export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    try {
      // Token prüfen (löscht sich selbst, wenn abgelaufen)
      const t = ensureFreshToken();
      if (!t) {
        // kein gültiges Token -> sauberer Logout-Zustand
        apiSetToken(null);
        setUser(null);
        return;
      }
      const me = await fetchMe(t); // fetchMe() wirft nicht, gibt null bei 401/403
      if (!me) {
        apiSetToken(null);
        setUser(null);
        return;
      }
      setUser(normalizeUser(me));
    } finally {
      setLoading(false);
    }
  }

  async function login(email: string, password: string) {
    // Login liefert { access_token, token_type }
    const { access_token } = await apiLogin(email, password);
    // Direkt mit frischem Token /auth/me aufrufen (kein Race mit Storage)
    const me = await fetchMe(access_token);
    if (!me) {
      // sehr selten (z. B. CORS/Proxy-Fehler) – Token wieder entfernen
      apiSetToken(null);
      setUser(null);
      throw new Error("Login erfolgreich, aber /auth/me fehlgeschlagen.");
    }
    setUser(normalizeUser(me));
  }

  function logout() {
    apiLogout(); // löscht lokal das Token
    setUser(null);
  }

  useEffect(() => {
    // Beim Mount versuchen, bestehende Session wiederherzustellen
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AuthCtx.Provider value={{ user, loading, refresh, login, logout }}>
      {children}
    </AuthCtx.Provider>
  );
}
