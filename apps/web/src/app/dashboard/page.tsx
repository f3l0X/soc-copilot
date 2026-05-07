"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { getStats, type StatsResponse } from "@/lib/api";
import { useRequireAuth } from "@/lib/auth";

const RISK_COLORS: Record<string, string> = {
  low: "#22c55e",
  medium: "#eab308",
  high: "#f97316",
  critical: "#ef4444",
  unknown: "#64748b",
};

function KpiCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: number | string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-3xl font-semibold text-slate-100">{value}</div>
      {hint && <div className="mt-1 text-xs text-slate-500">{hint}</div>}
    </div>
  );
}

function exportMitreCsv(rows: { technique: string; count: number }[]) {
  const lines = ["technique,count", ...rows.map((r) => `${r.technique},${r.count}`)];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "top-mitre.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export default function DashboardPage() {
  const auth = useRequireAuth();
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!auth.user) return;
    getStats()
      .then(setStats)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [auth.user]);

  // Pad daily series with zeros so a sparse dataset still renders a 30-day axis.
  const dailySeries = useMemo(() => {
    if (!stats) return [];
    const map = new Map(stats.daily_last_30d.map((p) => [p.day, p.count]));
    const out: { day: string; count: number }[] = [];
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setUTCDate(today.getUTCDate() - i);
      const key = d.toISOString().slice(0, 10);
      out.push({ day: key.slice(5), count: map.get(key) ?? 0 });
    }
    return out;
  }, [stats]);

  if (!auth.ready) {
    return <main className="min-h-screen p-8 text-slate-500">Verificando sesión…</main>;
  }

  return (
    <main className="min-h-screen max-w-7xl mx-auto p-8 space-y-6">
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-slate-400">
            Comportamiento de los análisis realizados
            {stats && (
              <span className="ml-1 text-slate-500">
                ({stats.scope === "all" ? "vista global" : "tus alertas"})
              </span>
            )}
          </p>
        </div>
        <Link href="/alerts" className="text-sm text-sky-400 hover:underline">
          + nueva alerta
        </Link>
      </div>

      {error && (
        <div className="rounded border border-rose-700 bg-rose-950/40 p-4 text-sm text-rose-300">
          <strong>Error:</strong> {error}
        </div>
      )}

      {!stats && !error && <p className="text-slate-400">Cargando…</p>}

      {stats && stats.totals.alerts === 0 && (
        <div className="rounded border border-slate-800 bg-slate-900/40 p-6 text-sm text-slate-400">
          Aún no hay datos. Crea tu primera alerta en{" "}
          <Link href="/alerts" className="text-sky-400 hover:underline">
            /alerts
          </Link>{" "}
          y vuelve aquí para ver las gráficas.
        </div>
      )}

      {stats && stats.totals.alerts > 0 && (
        <>
          {/* KPIs */}
          <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard label="Alertas" value={stats.totals.alerts} />
            <KpiCard label="Recomendaciones" value={stats.totals.recommendations} />
            <KpiCard
              label="Riesgo alto/crítico"
              value={
                stats.by_risk
                  .filter((b) => b.risk_level === "high" || b.risk_level === "critical")
                  .reduce((acc, b) => acc + b.count, 0)
              }
            />
            <KpiCard
              label={stats.scope === "all" ? "Usuarios" : "Técnicas MITRE"}
              value={
                stats.scope === "all"
                  ? stats.totals.users ?? 0
                  : stats.top_mitre.length
              }
              hint={stats.scope === "all" ? undefined : "distintas detectadas"}
            />
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Risk distribution */}
            <section className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
              <h2 className="text-sm font-semibold text-slate-200 mb-3">
                Distribución por riesgo
              </h2>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={stats.by_risk}
                      dataKey="count"
                      nameKey="risk_level"
                      innerRadius={50}
                      outerRadius={90}
                      paddingAngle={2}
                    >
                      {stats.by_risk.map((b) => (
                        <Cell
                          key={b.risk_level}
                          fill={RISK_COLORS[b.risk_level] ?? "#64748b"}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: "#0f172a",
                        border: "1px solid #334155",
                        fontSize: "12px",
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: "12px" }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </section>

            {/* Daily 30d */}
            <section className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
              <h2 className="text-sm font-semibold text-slate-200 mb-3">
                Alertas / día (últimos 30)
              </h2>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dailySeries}>
                    <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                    <XAxis
                      dataKey="day"
                      stroke="#64748b"
                      fontSize={11}
                      interval="preserveStartEnd"
                    />
                    <YAxis stroke="#64748b" fontSize={11} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{
                        background: "#0f172a",
                        border: "1px solid #334155",
                        fontSize: "12px",
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="count"
                      stroke="#38bdf8"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </section>
          </div>

          {/* Top MITRE */}
          <section className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-slate-200">
                Top técnicas MITRE
              </h2>
              {stats.top_mitre.length > 0 && (
                <button
                  type="button"
                  onClick={() => exportMitreCsv(stats.top_mitre)}
                  className="text-xs text-sky-400 hover:underline"
                >
                  exportar CSV
                </button>
              )}
            </div>
            {stats.top_mitre.length === 0 ? (
              <p className="text-sm text-slate-500">
                Sin técnicas MITRE detectadas todavía.
              </p>
            ) : (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={stats.top_mitre}
                    layout="vertical"
                    margin={{ left: 20 }}
                  >
                    <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                    <XAxis
                      type="number"
                      stroke="#64748b"
                      fontSize={11}
                      allowDecimals={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="technique"
                      stroke="#94a3b8"
                      fontSize={11}
                      width={80}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "#0f172a",
                        border: "1px solid #334155",
                        fontSize: "12px",
                      }}
                      cursor={{ fill: "rgba(56,189,248,0.08)" }}
                    />
                    <Bar dataKey="count" fill="#38bdf8" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>

          {/* Per-user (admin) */}
          {stats.scope === "all" && stats.by_user && stats.by_user.length > 0 && (
            <section className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
              <h2 className="text-sm font-semibold text-slate-200 mb-3">
                Alertas por usuario
              </h2>
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Email</th>
                    <th className="px-3 py-2 text-right">Alertas</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.by_user.map((u) => (
                    <tr key={u.user_id} className="border-t border-slate-800">
                      <td className="px-3 py-2 text-slate-300">{u.email}</td>
                      <td className="px-3 py-2 text-right text-slate-200">
                        {u.alerts}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}
        </>
      )}
    </main>
  );
}
