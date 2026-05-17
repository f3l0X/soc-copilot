"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
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

const RISK_LABEL: Record<string, string> = {
  low: "Bajo",
  medium: "Medio",
  high: "Alto",
  critical: "Crítico",
  unknown: "Desconocido",
};

function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={
        "rounded-xl border border-ink-700 bg-ink-900/60 p-5 " + className
      }
    >
      {children}
    </div>
  );
}

function KpiCard({
  label,
  value,
  hint,
  accent,
  children,
}: {
  label: string;
  value: number | string;
  hint?: React.ReactNode;
  accent?: "danger" | "warn" | "ok";
  children?: React.ReactNode;
}) {
  const valueClass =
    accent === "danger"
      ? "text-rose-400"
      : accent === "warn"
        ? "text-orange-400"
        : "text-slate-100";
  return (
    <Card className="hover:shadow-glow transition">
      <div className="text-[11px] uppercase tracking-widest text-slate-500">
        {label}
      </div>
      <div className="mt-1 flex items-baseline gap-2">
        <div className={`text-3xl font-semibold font-mono ${valueClass}`}>
          {value}
        </div>
        {hint && <div className="text-xs text-slate-400">{hint}</div>}
      </div>
      {children && <div className="mt-3">{children}</div>}
    </Card>
  );
}

function Sparkline({ data }: { data: { day: string; count: number }[] }) {
  if (!data.length) return <div className="h-8" />;
  const max = Math.max(1, ...data.map((d) => d.count));
  const points = data
    .map((d, i) => {
      const x = (i / (data.length - 1)) * 100;
      const y = 30 - (d.count / max) * 26;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
  return (
    <svg viewBox="0 0 100 30" className="w-full h-8" preserveAspectRatio="none">
      <polyline fill="none" stroke="#22d3ee" strokeWidth="1.5" points={points} />
    </svg>
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

  const last24h = useMemo(
    () => dailySeries.slice(-1)[0]?.count ?? 0,
    [dailySeries],
  );
  const last7Total = useMemo(
    () => dailySeries.slice(-7).reduce((a, b) => a + b.count, 0),
    [dailySeries],
  );
  const prev7Total = useMemo(
    () => dailySeries.slice(-14, -7).reduce((a, b) => a + b.count, 0),
    [dailySeries],
  );
  const trend7 = prev7Total
    ? Math.round(((last7Total - prev7Total) / prev7Total) * 100)
    : null;

  const criticalCount = useMemo(
    () =>
      stats?.by_risk
        .filter((b) => b.risk_level === "critical")
        .reduce((a, b) => a + b.count, 0) ?? 0,
    [stats],
  );
  const highCount = useMemo(
    () =>
      stats?.by_risk
        .filter((b) => b.risk_level === "high")
        .reduce((a, b) => a + b.count, 0) ?? 0,
    [stats],
  );

  if (!auth.ready) {
    return (
      <div className="p-8 text-slate-500 text-sm">Verificando sesión…</div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-100">
            Centro de operaciones
          </h1>
          <p className="text-sm text-slate-400">
            Resumen en vivo · últimos 30 días
            {stats && (
              <span className="ml-1 text-slate-500">
                · {stats.scope === "all" ? "vista global" : "tus alertas"}
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          {stats && stats.top_mitre.length > 0 && (
            <button
              type="button"
              onClick={() => exportMitreCsv(stats.top_mitre)}
              className="px-3 py-2 rounded-md text-xs border border-ink-700 bg-ink-850 hover:bg-ink-800 text-slate-300"
            >
              Exportar MITRE
            </button>
          )}
          <Link
            href="/alerts"
            className="px-3 py-2 rounded-md text-xs bg-cyan-500 text-ink-950 font-medium hover:bg-cyan-400"
          >
            + Nueva alerta
          </Link>
        </div>
      </div>

      {error && (
        <Card className="border-rose-700 bg-rose-950/40">
          <div className="text-sm text-rose-300">
            <strong>Error:</strong> {error}
          </div>
        </Card>
      )}

      {!stats && !error && (
        <p className="text-slate-400 text-sm">Cargando…</p>
      )}

      {stats && stats.totals.alerts === 0 && (
        <Card>
          <p className="text-sm text-slate-400">
            Aún no hay datos. Crea tu primera alerta y vuelve aquí para ver las gráficas.
          </p>
        </Card>
      )}

      {stats && stats.totals.alerts > 0 && (
        <>
          <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard
              label="Alertas 24h"
              value={last24h}
              hint={
                trend7 !== null && (
                  <span
                    className={
                      trend7 >= 0 ? "text-emerald-400" : "text-rose-400"
                    }
                  >
                    {trend7 >= 0 ? "▲" : "▼"} {Math.abs(trend7)}% 7d
                  </span>
                )
              }
            >
              <Sparkline data={dailySeries.slice(-14)} />
            </KpiCard>

            <KpiCard
              label="Riesgo crítico"
              value={criticalCount}
              accent="danger"
              hint={`${highCount} altos`}
            >
              <div className="flex gap-1 h-2">
                {Array.from({ length: 8 }).map((_, i) => {
                  const filled = i < Math.min(8, criticalCount);
                  return (
                    <div
                      key={i}
                      className={
                        "flex-1 rounded " +
                        (filled ? "bg-risk-critical" : "bg-ink-700")
                      }
                    />
                  );
                })}
              </div>
            </KpiCard>

            <KpiCard
              label="Recomendaciones"
              value={stats.totals.recommendations}
              hint="generadas por IA"
            >
              <div className="text-xs text-slate-500">
                ratio{" "}
                <span className="font-mono text-slate-300">
                  {(
                    stats.totals.recommendations /
                    Math.max(1, stats.totals.alerts)
                  ).toFixed(2)}
                </span>{" "}
                / alerta
              </div>
            </KpiCard>

            <KpiCard
              label={
                stats.scope === "all" ? "Usuarios activos" : "Técnicas MITRE"
              }
              value={
                stats.scope === "all"
                  ? (stats.totals.users ?? 0)
                  : stats.top_mitre.length
              }
              hint={
                stats.scope === "all" ? "registrados" : "distintas detectadas"
              }
            >
              <div className="h-1.5 rounded-full bg-ink-700 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-cyan-400 to-violet-500"
                  style={{
                    width: `${Math.min(
                      100,
                      stats.scope === "all"
                        ? (stats.totals.users ?? 0) * 10
                        : (stats.top_mitre.length / 138) * 100,
                    )}%`,
                  }}
                />
              </div>
            </KpiCard>
          </section>

          <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-sm font-semibold text-slate-200">
                    Volumen de alertas
                  </h2>
                  <p className="text-xs text-slate-500">
                    últimos 30 días · serie diaria
                  </p>
                </div>
                <div className="flex gap-1 text-[11px]">
                  <span className="px-2 py-1 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
                    30d
                  </span>
                </div>
              </div>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={dailySeries}>
                    <defs>
                      <linearGradient id="grad" x1="0" x2="0" y1="0" y2="1">
                        <stop
                          offset="0%"
                          stopColor="#22d3ee"
                          stopOpacity={0.4}
                        />
                        <stop
                          offset="100%"
                          stopColor="#22d3ee"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                    <XAxis
                      dataKey="day"
                      stroke="#64748b"
                      fontSize={11}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      stroke="#64748b"
                      fontSize={11}
                      allowDecimals={false}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "#0f172a",
                        border: "1px solid #334155",
                        fontSize: "12px",
                        borderRadius: "6px",
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="count"
                      stroke="#22d3ee"
                      strokeWidth={2}
                      fill="url(#grad)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card className="border-violet-500/30 bg-gradient-to-br from-violet-500/10 to-cyan-500/5 relative overflow-hidden">
              <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-violet-500/20 blur-2xl pointer-events-none" />
              <div className="flex items-center gap-2 mb-3">
                <span className="w-6 h-6 rounded-md bg-violet-500/30 grid place-items-center text-violet-300">
                  ✦
                </span>
                <h2 className="text-sm font-semibold text-slate-100">
                  Resumen del Copilot
                </h2>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Detectadas{" "}
                <span className="text-rose-300 font-medium">
                  {criticalCount} alertas críticas
                </span>{" "}
                y {highCount} de severidad alta en la ventana actual.
                {stats.top_mitre[0] && (
                  <>
                    {" "}
                    Técnica predominante{" "}
                    <span className="font-mono text-slate-200">
                      {stats.top_mitre[0].technique}
                    </span>{" "}
                    ({stats.top_mitre[0].count} eventos).
                  </>
                )}
              </p>
              <div className="mt-3 flex gap-2">
                <Link
                  href="/respond"
                  className="text-[11px] px-2.5 py-1.5 rounded-md bg-cyan-500 text-ink-950 font-medium hover:bg-cyan-400"
                >
                  Ir a Respond
                </Link>
                <Link
                  href="/chat"
                  className="text-[11px] px-2.5 py-1.5 rounded-md border border-ink-700 text-slate-300 hover:bg-ink-800"
                >
                  Consultar al IA
                </Link>
              </div>
              <div className="mt-3 text-[10px] text-slate-500 font-mono">
                scope: {stats.scope} · base: {stats.totals.alerts} alertas
              </div>
            </Card>
          </section>

          <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <h2 className="text-sm font-semibold text-slate-200 mb-3">
                Distribución por riesgo
              </h2>
              <div className="grid grid-cols-2 gap-4 items-center">
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={stats.by_risk}
                        dataKey="count"
                        nameKey="risk_level"
                        innerRadius={45}
                        outerRadius={75}
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
                          borderRadius: "6px",
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: "11px" }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <ul className="text-xs space-y-1.5">
                  {stats.by_risk.map((b) => (
                    <li
                      key={b.risk_level}
                      className="flex justify-between items-center"
                    >
                      <span className="flex items-center gap-2">
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{
                            background:
                              RISK_COLORS[b.risk_level] ?? "#64748b",
                          }}
                        />
                        {RISK_LABEL[b.risk_level] ?? b.risk_level}
                      </span>
                      <span className="font-mono text-slate-300">
                        {b.count}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </Card>

            <Card>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-slate-200">
                  Top técnicas MITRE
                </h2>
                <span className="text-[11px] text-slate-500 font-mono">
                  {stats.top_mitre.length} detectadas
                </span>
              </div>
              {stats.top_mitre.length === 0 ? (
                <p className="text-sm text-slate-500">
                  Sin técnicas MITRE detectadas todavía.
                </p>
              ) : (
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={stats.top_mitre}
                      layout="vertical"
                      margin={{ left: 10 }}
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
                          borderRadius: "6px",
                        }}
                        cursor={{ fill: "rgba(34,211,238,0.08)" }}
                      />
                      <Bar
                        dataKey="count"
                        fill="#22d3ee"
                        radius={[0, 4, 4, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>
          </section>

          {stats.scope === "all" && stats.by_user && stats.by_user.length > 0 && (
            <Card>
              <h2 className="text-sm font-semibold text-slate-200 mb-3">
                Alertas por usuario
              </h2>
              <table className="w-full text-sm">
                <thead className="text-left text-[10px] uppercase tracking-widest text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Email</th>
                    <th className="px-3 py-2 text-right">Alertas</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.by_user.map((u) => (
                    <tr key={u.user_id} className="border-t border-ink-700">
                      <td className="px-3 py-2 text-slate-300 font-mono text-xs">
                        {u.email}
                      </td>
                      <td className="px-3 py-2 text-right text-slate-200 font-mono">
                        {u.alerts}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}

          <div className="text-[11px] text-slate-600 font-mono pt-4 border-t border-ink-800 flex justify-between">
            <span>SOC Copilot · Blue Team practice · 2026</span>
            <span>scope: {stats.scope}</span>
          </div>
        </>
      )}
    </div>
  );
}
