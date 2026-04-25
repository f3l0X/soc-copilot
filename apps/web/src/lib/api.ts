export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

export interface ExplainRequest {
  log: string;
  source?: string;
}

export interface ExplainResponse {
  summary: string;
  risk_level: "low" | "medium" | "high" | "critical";
  mitre_techniques: string[];
  reasoning: string;
}

const DEFAULT_TIMEOUT_MS = 60_000;

export async function explainAlert(
  payload: ExplainRequest,
  { timeoutMs = DEFAULT_TIMEOUT_MS }: { timeoutMs?: number } = {},
): Promise<ExplainResponse> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${API_BASE}/api/explain`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const detail = await res.text();
      throw new Error(`API ${res.status}: ${detail}`);
    }
    return res.json();
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error(`Timeout tras ${timeoutMs / 1000}s — reintenta`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
