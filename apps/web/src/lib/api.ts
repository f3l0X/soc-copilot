export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

const DEFAULT_TIMEOUT_MS = 60_000;

// ─── Types ────────────────────────────────────────────────────────────────

export type RiskLevel = "low" | "medium" | "high" | "critical";

export interface ExplainRequest {
  log: string;
  source?: string;
  model?: string;
}

export interface ExplainResponse {
  id: number | null;
  summary: string;
  risk_level: RiskLevel;
  mitre_techniques: string[];
  reasoning: string;
}

export interface RecommendAction {
  title: string;
  detail: string;
  rationale: string;
}

export interface RecommendRequest {
  alert_id?: number;
  log?: string;
  source?: string;
  model?: string;
}

export interface RecommendResponse {
  id: number | null;
  alert_id: number | null;
  actions: RecommendAction[];
  priority: RiskLevel;
  learning_notes: string;
}

export interface AlertSummary {
  id: number;
  source: string | null;
  summary: string | null;
  risk_level: RiskLevel | null;
  mitre_techniques: string[] | null;
  created_at: string;
}

export interface RecommendationDetail {
  id: number;
  actions: RecommendAction[];
  priority: RiskLevel;
  learning_notes: string | null;
  created_at: string;
}

export interface AlertDetail extends AlertSummary {
  log: string;
  reasoning: string | null;
  recommendations: RecommendationDetail[];
}

// ─── Internal fetch helper ────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly detail: string,
  ) {
    super(`API ${status}: ${detail}`);
  }
}

async function request<T>(
  path: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<T> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, ...rest } = init;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...rest,
      credentials: "include",
      headers: { "Content-Type": "application/json", ...(rest.headers ?? {}) },
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const detail = await res.text();
      throw new ApiError(res.status, detail);
    }
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error(`Timeout tras ${timeoutMs / 1000}s — reintenta`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// ─── Public API ───────────────────────────────────────────────────────────

export const explainAlert = (payload: ExplainRequest) =>
  request<ExplainResponse>("/api/explain", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const recommendActions = (payload: RecommendRequest) =>
  request<RecommendResponse>("/api/recommend", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const listAlerts = (limit = 50, offset = 0) =>
  request<AlertSummary[]>(`/api/alerts?limit=${limit}&offset=${offset}`);

export const getAlert = (id: number) =>
  request<AlertDetail>(`/api/alerts/${id}`);

// ─── Chat ─────────────────────────────────────────────────────────────────

export type ChatRole = "user" | "assistant" | "system";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
  log_context?: string;
  model?: string;
}

export interface ChatResponse {
  reply: string;
  sources: string[];
}

export const sendChat = (payload: ChatRequest) =>
  request<ChatResponse>("/api/chat", {
    method: "POST",
    body: JSON.stringify(payload),
  });

// ─── Knowledge Base ───────────────────────────────────────────────────────

export interface KBStatus {
  total: number;
  mitre: number;
  owasp: number;
  unknown: number;
}

export const kbStatus = () => request<KBStatus>("/api/kb/status");

// ─── LLM ──────────────────────────────────────────────────────────────────

export interface ModelsInfo {
  default: string;
  available: string[];
}

export const getModels = () => request<ModelsInfo>("/api/llm/models");

// ─── Auth ─────────────────────────────────────────────────────────────────

export type UserRole = "analyst" | "admin";

export interface UserMe {
  id: number;
  name: string;
  last_name: string;
  email: string;
  role: UserRole;
  created_at: string;
}

export interface UpdateProfilePayload {
  name?: string;
  last_name?: string;
  email?: string;
}

export const updateProfile = (payload: UpdateProfilePayload & { current_password?: string }) =>
  request<UserMe>("/api/auth/me", {
    method: "PUT",
    body: JSON.stringify(payload),
  });

// ─── Per-user LLM settings (BYO Gemini key + preferred model) ─────────────

export interface LLMSettings {
  configured: boolean;
  key_last4: string | null;
  key_validated_at: string | null;
  preferred_chat_model: string | null;
  available_models: string[];
  default_model: string;
  server_quota_used: number;
  server_quota_limit: number;
}

export const getLLMSettings = () =>
  request<LLMSettings>("/api/auth/me/llm");

export const updateLLMSettings = (payload: {
  api_key?: string;
  preferred_chat_model?: string;
}) =>
  request<LLMSettings>("/api/auth/me/llm", {
    method: "PUT",
    body: JSON.stringify(payload),
  });

export const clearLLMKey = () =>
  request<LLMSettings>("/api/auth/me/llm", { method: "DELETE" });

export interface LoginResponse {
  user: UserMe;
  expires_at: string;
}

export const register = (email: string, password: string, name: string) =>
  request<UserMe>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password, name }),
  });

export const getAdminUsers = () => request<UserMe[]>("/api/admin/users");

export const adminCreateUser = (payload: {
  name: string;
  email: string;
  password: string;
  role: UserRole;
}) =>
  request<UserMe>("/api/admin/users", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const adminChangePassword = (userId: number, new_password: string) =>
  request<void>(`/api/admin/users/${userId}/password`, {
    method: "PUT",
    body: JSON.stringify({ new_password }),
  });

export const adminChangeRole = (userId: number, role: UserRole) =>
  request<UserMe>(`/api/admin/users/${userId}/role`, {
    method: "PUT",
    body: JSON.stringify({ role }),
  });

export const adminDeleteUser = (userId: number) =>
  request<void>(`/api/admin/users/${userId}`, { method: "DELETE" });

export interface AuditLogEntry {
  id: number;
  created_at: string;
  actor_id: number | null;
  actor_email: string;
  action: string;
  target_type: string | null;
  target_id: number | null;
  target_label: string | null;
  details: Record<string, unknown> | null;
  ip: string | null;
}

export interface PermissionCell {
  permission_key: string;
  area: string;
  action: string;
  role: UserRole;
  allowed: boolean;
  locked: boolean;
  default: boolean;
}

export interface PermissionChange {
  role: UserRole;
  permission_key: string;
  allowed: boolean;
}

export const getPermissions = () =>
  request<PermissionCell[]>("/api/admin/permissions");

export const updatePermissions = (changes: PermissionChange[]) =>
  request<PermissionCell[]>("/api/admin/permissions", {
    method: "PUT",
    body: JSON.stringify({ changes }),
  });

export const getAuditLog = (params: {
  limit?: number;
  offset?: number;
  action?: string;
  actor_email?: string;
} = {}) => {
  const qs = new URLSearchParams();
  if (params.limit != null) qs.set("limit", String(params.limit));
  if (params.offset != null) qs.set("offset", String(params.offset));
  if (params.action) qs.set("action", params.action);
  if (params.actor_email) qs.set("actor_email", params.actor_email);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return request<AuditLogEntry[]>(`/api/admin/audit${suffix}`);
};

export const login = (email: string, password: string) =>
  request<LoginResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

export const logout = () =>
  request<void>("/api/auth/logout", { method: "POST" });

export const getMe = () => request<UserMe>("/api/auth/me");
