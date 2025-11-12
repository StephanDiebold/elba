// src/lib/api/index.ts

// Core-Basis & Utils
export {
  API_BASE,
  getToken,
  setToken,
  ensureFreshToken,
  isTokenExpired,
  reqRaw,
  getJson,
  postJson,
  putJson,
  del,
  ApiError,
} from "./core";

// ---- Auth re-exports (Backwards-Compat) ----
export {
  login,
  logout,
  fetchMe,
  register,
  type LoginResponse,
  type RegisterPayload,
  type RegisterResponse,
} from "./auth.api";

// ---- Common re-exports ----
export {
  getKammern,
  getBezirkskammern,
  type Kammer,
  type Bezirkskammer,
} from "./common.api";

// ---- Exam re-exports (falls benötigt) ----
export * from "./exam.api";

// Optional: gewohnter `api`-Namespace
import * as Auth from "./auth.api";
import * as Common from "./common.api";
import * as Core from "./core";
import * as Exam from "./exam.api";

export const api = {
  // auth
  ...Auth,
  // common
  ...Common,
  // exam
  ...Exam,
  // core helpers
  API_BASE: Core.API_BASE,
  getToken: Core.getToken,
  setToken: Core.setToken,
  ensureFreshToken: Core.ensureFreshToken,
  isTokenExpired: Core.isTokenExpired,
  reqRaw: Core.reqRaw,
  getJson: Core.getJson,
  postJson: Core.postJson,
  putJson: Core.putJson,
  del: Core.del,
};
