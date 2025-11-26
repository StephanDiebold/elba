// src/lib/httpClient.ts
import axios from "axios";
import type { AxiosInstance } from "axios";
import { api as legacyApi } from "@/lib/api";

const API_BASE =
  (legacyApi as any)?.API_BASE ?? import.meta.env.VITE_API_BASE_URL ?? "";

export const http: AxiosInstance = axios.create({
  baseURL: API_BASE,
});

// 👇 Alias, damit alle neuen Module `httpClient` verwenden können
export const httpClient: AxiosInstance = http;

// Optional: Default-Export, falls du irgendwo `import http from` benutzt
export default http;

http.interceptors.request.use(
  (config: any) => {
    try {
      const ensureFreshToken = (legacyApi as any).ensureFreshToken as
        | (() => string | null)
        | undefined;
      const getToken = (legacyApi as any).getToken as
        | (() => string | null)
        | undefined;

      const token = ensureFreshToken
        ? ensureFreshToken()
        : getToken
        ? getToken()
        : null;

      if (token) {
        config.headers = config.headers ?? {};
        (config.headers as any).Authorization = `Bearer ${token}`;
      }
    } catch {
      // ignorieren, Anfrage trotzdem senden
    }

    return config;
  },
  (error: any) => {
    return Promise.reject(error);
  }
);

http.interceptors.response.use(
  (response: any) => response,
  (error: any) => {
    // TODO: globales Error-Handling (Toasts etc.)
    return Promise.reject(error);
  }
);

// Ende von src/lib/httpClient.ts
