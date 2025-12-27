// src/lib/httpClient.ts
import axios from "axios";
import type { AxiosInstance } from "axios";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

export const http: AxiosInstance = axios.create({
  baseURL: API_BASE,
});

// Alias (falls du es im Code so nutzt)
export const httpClient: AxiosInstance = http;

// Optional Default Export
export default http;

/**
 * Token-Handling: komplett ohne Import aus "@/lib/api"
 * -> wir lesen den Token direkt aus localStorage (oder passe den Key an)
 */
http.interceptors.request.use(
  (config) => {
    try {
      // 🔧 ggf. anpassen: "access_token" / "token" / "elba_access_token"
      const token =
        localStorage.getItem("access_token") ??
        localStorage.getItem("token") ??
        null;

      if (token) {
        config.headers = config.headers ?? {};
        (config.headers as any).Authorization = `Bearer ${token}`;
      }
    } catch {
      // ignorieren, Anfrage trotzdem senden
    }
    return config;
  },
  (error) => Promise.reject(error)
);

http.interceptors.response.use(
  (response) => response,
  (error) => {
    // TODO: globales Error-Handling (Toasts etc.)
    return Promise.reject(error);
  }
);
