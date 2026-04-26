export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

const DEFAULT_TIMEOUT_MS = 60_000;

// ─── Types ────────────────────────────────────────────────────────────────

export type RiskLevel = "low" | "medium" | "high" | "critical";

export interface ExplainRequest {
  log: string;
  source?: string;
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
      headers: { "Content-Type": "application/json", ...(rest.headers ?? {}) },
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const detail = await res.text();
      throw new Error(`API ${res.status}: ${detail}`);
    }
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
