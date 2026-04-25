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

export async function explainAlert(
  payload: ExplainRequest,
): Promise<ExplainResponse> {
  const res = await fetch(`${API_BASE}/api/explain`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`API ${res.status}: ${detail}`);
  }
  return res.json();
}
