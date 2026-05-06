"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import { ModelSelector } from "@/components/ModelSelector";
import { MitreList, RiskBadge } from "@/components/RiskBadge";
import { explainAlert, type ExplainResponse } from "@/lib/api";
import { useRequireAuth } from "@/lib/auth";
import { useModel } from "@/lib/useModel";

export default function AlertsPage() {
  const searchParams = useSearchParams();
  const [log, setLog] = useState("");
  const [source, setSource] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ExplainResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { selected: model } = useModel();
  const auth = useRequireAuth();

  useEffect(() => {
    if (searchParams.get("import") === "true") {
      const importedLog = sessionStorage.getItem("soc_copilot_imported_logs");
      if (importedLog) {
        setLog(importedLog);
        setSource("imported_logs");
      }
    }
  }, [searchParams]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      setResult(
        await explainAlert({
          log,
          source: source || undefined,
          model: model ?? undefined,
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  if (!auth.ready) {
    return <main className="min-h-screen p-8 text-slate-500">Verificando sesión…</main>;
  }

  return (
    <main className="min-h-screen max-w-5xl mx-auto p-8 space-y-6">
      <div className="flex items-baseline justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Alert Explainer</h1>
          <p className="text-slate-400 mt-1">
            Pega un log o alerta. La IA explica qué ocurre, asigna riesgo y
            mapea a MITRE ATT&CK.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <ModelSelector compact />
          <Link href="/history" className="text-sm text-sky-400 hover:underline">
            Histórico →
          </Link>
        </div>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <input
          value={source}
          onChange={(e) => setSource(e.target.value)}
          placeholder="Fuente (auth.log, nginx, syslog…)"
          className="w-full rounded bg-slate-900 border border-slate-700 px-3 py-2 text-sm"
        />
        <textarea
          value={log}
          onChange={(e) => setLog(e.target.value)}
          rows={10}
          required
          className="w-full rounded bg-slate-900 border border-slate-700 px-3 py-2 font-mono text-xs"
        />
        <button
          type="submit"
          disabled={loading || !log.trim()}
          className="rounded bg-sky-600 hover:bg-sky-500 disabled:bg-slate-700 px-4 py-2 text-sm font-medium"
        >
          {loading ? "Analizando…" : "Analizar"}
        </button>
      </form>

      {error && (
        <div className="rounded border border-rose-700 bg-rose-950/40 p-4 text-sm text-rose-300">
          <strong>Error:</strong> {error}
        </div>
      )}

      {result && (
        <div className="space-y-4 rounded-lg border border-slate-800 bg-slate-900/40 p-6">
          <div className="flex items-start justify-between gap-4">
            <h2 className="text-lg font-semibold">
              Resumen{" "}
              {result.id != null && (
                <span className="text-xs text-slate-500">#{result.id}</span>
              )}
            </h2>
            <RiskBadge level={result.risk_level} />
          </div>
          <p className="text-slate-200 leading-relaxed">{result.summary}</p>

          <div>
            <h3 className="text-sm font-semibold text-slate-400 mb-2">
              MITRE ATT&CK
            </h3>
            <MitreList techniques={result.mitre_techniques} />
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-400 mb-2">
              Razonamiento
            </h3>
            <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-line">
              {result.reasoning}
            </p>
          </div>

          {result.id != null && (
            <div className="pt-2">
              <Link
                href={`/respond?alert_id=${result.id}`}
                className="inline-block rounded bg-emerald-700 hover:bg-emerald-600 px-4 py-2 text-sm font-medium"
              >
                Siguiente paso → recomendar acciones
              </Link>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
