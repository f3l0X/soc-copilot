"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { AlertStatusBadge, ReviewBadge } from "@/components/AlertStatusBadge";
import { RiskBadge } from "@/components/RiskBadge";
import {
  type AlertBulkResolveResult,
  type AlertQueue,
  type AlertSummary,
  type AlertVerdict,
  ApiError,
  assignAlert,
  bulkResolveAlerts,
  getWazuhStatus,
  listAlerts,
  type WazuhStatus,
  wazuhPullNow,
} from "@/lib/api";
import { useRequireAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";

// Colas del ciclo de vida (Práctica 3); "all" = sin filtro.
type Filter = AlertQueue | "all";
const REFRESH_MS = 15_000;
const OPEN_STATUSES = ["new", "in_progress", "escalated"];

function levelClass(level: number | null): string {
  if (level == null) return "bg-slate-800 text-slate-300 border-slate-600";
  if (level >= 13) return "bg-rose-900/50 text-rose-300 border-rose-700";
  if (level >= 10) return "bg-orange-900/40 text-orange-300 border-orange-700";
  if (level >= 7) return "bg-amber-900/40 text-amber-300 border-amber-700";
  return "bg-emerald-900/40 text-emerald-300 border-emerald-700";
}

function fmt(ts: string | null, never: string): string {
  return ts ? new Date(ts).toLocaleString() : never;
}

function errMsg(e: unknown): string {
  if (e instanceof ApiError) {
    try {
      const parsed = JSON.parse(e.detail) as { detail?: unknown };
      if (typeof parsed.detail === "string") return parsed.detail;
    } catch {
      /* plain text detail */
    }
    return e.detail;
  }
  return e instanceof Error ? e.message : String(e);
}

function IntegrationPanel() {
  const { t } = useI18n();
  const [status, setStatus] = useState<WazuhStatus | null>(null);
  const [pulling, setPulling] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(() => {
    getWazuhStatus()
      .then(setStatus)
      .catch((e) => setMsg(errMsg(e)));
  }, []);

  useEffect(load, [load]);

  async function pull() {
    setPulling(true);
    setMsg(null);
    try {
      const r = await wazuhPullNow();
      setMsg(`${t("siem_pull_result")}: ${r.created} · dup ${r.duplicates} · fetched ${r.fetched}`);
      load();
    } catch (e) {
      setMsg(errMsg(e));
    } finally {
      setPulling(false);
    }
  }

  const pill = (on: boolean) => (
    <span
      className={
        "ml-2 rounded border px-1.5 py-0.5 text-[10px] uppercase " +
        (on
          ? "border-emerald-700 bg-emerald-900/40 text-emerald-300"
          : "border-slate-600 bg-slate-800 text-slate-400")
      }
    >
      {on ? t("siem_enabled") : t("siem_disabled")}
    </span>
  );

  return (
    <div className="rounded-lg border border-ink-700 bg-ink-900/60 p-4 text-sm space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">{t("siem_integration")}</h2>
        <button
          type="button"
          onClick={pull}
          disabled={pulling || !status?.pull_enabled}
          title={
            status && !status.pull_enabled
              ? "Pull desactivado: configura WAZUH_INDEXER_URL en el .env"
              : undefined
          }
          className="rounded bg-cyan-600 hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed px-3 py-1.5 text-xs font-medium text-white"
        >
          {pulling ? t("siem_pulling") : t("siem_pull_now")}
        </button>
      </div>
      {status && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div>
            <div className="opacity-60">{t("siem_push")}{pill(status.push_enabled)}</div>
            <div className="mt-1">
              {t("siem_last_push")}: {fmt(status.push_last_received, t("siem_never"))}
            </div>
          </div>
          <div>
            <div className="opacity-60">{t("siem_pull")}{pill(status.pull_enabled)}</div>
            <div className="mt-1">
              {t("siem_last_pull")}: {fmt(status.pull_last_run, t("siem_never"))}
            </div>
            {status.pull_last_error && (
              <div className="mt-1 text-rose-300">{status.pull_last_error}</div>
            )}
          </div>
          <div>
            <div className="opacity-60">{t("siem_last24h")}</div>
            <div className="mt-1 text-lg font-semibold">{status.alerts_last_24h}</div>
          </div>
          <div>
            <div className="opacity-60">
              {t("siem_pending_count")} · {t("siem_min_level")} {status.min_rule_level}
            </div>
            <div className="mt-1 text-lg font-semibold">{status.alerts_pending}</div>
          </div>
        </div>
      )}
      {msg && <div className="text-xs text-slate-300">{msg}</div>}
    </div>
  );
}

export default function SiemPage() {
  const auth = useRequireAuth();
  const { t } = useI18n();
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("new");
  const [takingId, setTakingId] = useState<number | null>(null);
  // Cierre masivo (Práctica 3)
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkMode, setBulkMode] = useState<AlertVerdict | null>(null);
  const [bulkText, setBulkText] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkResult, setBulkResult] = useState<AlertBulkResolveResult | null>(null);
  const queueChosen = useRef(false);
  const [alerts, setAlerts] = useState<AlertSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const load = useCallback(() => {
    listAlerts(100, 0, { origin: "wazuh", queue: filter === "all" ? undefined : filter })
      .then((rows) => {
        setAlerts(rows);
        setError(null);
      })
      .catch((e) => setError(errMsg(e)));
  }, [filter]);

  // Cola inicial según el nivel: L1 → nuevas; Instructor → para revisar;
  // L2 y admin → escaladas. Solo la primera vez, luego manda el usuario.
  useEffect(() => {
    if (!auth.user || queueChosen.current) return;
    queueChosen.current = true;
    if (auth.user.level === "INSTRUCTOR") setFilter("review");
    else if (auth.user.role === "admin" || auth.user.level === "L2") setFilter("escalated");
    else setFilter("new");
  }, [auth.user]);

  useEffect(() => {
    if (!auth.user) return;
    load();
    if (!autoRefresh) return;
    const id = setInterval(load, REFRESH_MS);
    return () => clearInterval(id);
  }, [auth.user, load, autoRefresh]);

  // Al cambiar de cola se vacía la selección.
  useEffect(() => {
    setSelected(new Set());
    setBulkMode(null);
  }, [filter]);

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function bulkClose() {
    if (!bulkMode || bulkText.trim().length < 5 || selected.size === 0) return;
    setBulkBusy(true);
    setError(null);
    try {
      const r = await bulkResolveAlerts([...selected], bulkMode, bulkText.trim());
      setBulkResult(r);
      setSelected(new Set(r.failed.map((f) => f.id)));
      setBulkMode(null);
      setBulkText("");
      load();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBulkBusy(false);
    }
  }

  // Asignarse la alerta y abrirla en la página Alertas para analizarla.
  async function take(id: number) {
    setTakingId(id);
    setError(null);
    try {
      await assignAlert(id);
      router.push(`/alerts?wazuh_id=${id}`);
    } catch (e) {
      setError(errMsg(e));
      setTakingId(null);
      load();
    }
  }

  if (!auth.ready) {
    return <div className="p-8 text-slate-500 text-sm">{t("alerts_loading")}</div>;
  }

  const me = auth.user;
  const senior =
    me?.role === "admin" || me?.level === "L2" || me?.level === "INSTRUCTOR";
  const instructor = me?.role === "admin" || me?.level === "INSTRUCTOR";
  const isMine = (a: AlertSummary) => me != null && a.assigned_to_id === me.id;
  // Mismas reglas que la API: un L1 solo coge alertas nuevas; L2/Instructor/admin
  // también las escaladas y las de otros analistas.
  const canTake = (a: AlertSummary) =>
    !isMine(a) &&
    (a.status === "new" || (senior && (a.status === "escalated" || a.status === "in_progress")));

  const openRows = (alerts ?? []).filter((a) => OPEN_STATUSES.includes(a.status));
  const allSelected = openRows.length > 0 && openRows.every((a) => selected.has(a.id));
  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(openRows.map((a) => a.id)));
  }

  const filters: { key: Filter; label: string }[] = [
    { key: "new", label: t("siem_queue_new") },
    { key: "mine", label: t("siem_queue_mine") },
    { key: "in_progress", label: t("siem_queue_in_progress") },
    { key: "escalated", label: t("siem_queue_escalated") },
    { key: "closed", label: t("siem_queue_closed") },
    // La cola de revisión solo tiene sentido para Instructor y admin.
    ...(instructor ? [{ key: "review" as Filter, label: t("siem_queue_review") }] : []),
    { key: "all", label: t("siem_filter_all") },
  ];

  return (
    <div className="p-6 max-w-[1280px] mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("siem_title")}</h1>
        <p className="text-slate-400 mt-1">{t("siem_subtitle")}</p>
      </div>

      {auth.user?.role === "admin" && <IntegrationPanel />}

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-md border border-ink-700 overflow-hidden text-xs">
          {filters.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={
                "px-3 py-1.5 " +
                (filter === f.key ? "bg-cyan-500 text-ink-950" : "opacity-60 hover:opacity-90")
              }
            >
              {f.label}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-xs opacity-80">
          <input
            type="checkbox"
            checked={autoRefresh}
            onChange={(e) => setAutoRefresh(e.target.checked)}
          />
          {t("siem_auto_refresh")}
        </label>
        <button
          type="button"
          onClick={load}
          className="ml-auto rounded border border-ink-700 px-3 py-1.5 text-xs hover:bg-ink-800"
        >
          {t("siem_refresh")}
        </button>
      </div>

      {error && (
        <div className="rounded border border-rose-700 bg-rose-950/40 p-4 text-sm text-rose-300">
          <strong>{t("alerts_error")}</strong> {error}
        </div>
      )}

      {/* Cierre masivo: una única resolución para todas las seleccionadas */}
      {selected.size > 0 && (
        <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/5 p-4 text-sm space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">
              {selected.size} {t("bulk_selected")}
            </span>
            <button
              type="button"
              disabled={bulkBusy}
              onClick={() => setBulkMode("resolved")}
              className="rounded bg-emerald-600 hover:brightness-110 disabled:opacity-50 px-3 py-1.5 text-xs font-medium text-white"
            >
              {t("wf_resolve")}
            </button>
            <button
              type="button"
              disabled={bulkBusy}
              onClick={() => setBulkMode("false_positive")}
              className="rounded border border-ink-700 hover:bg-ink-800 disabled:opacity-50 px-3 py-1.5 text-xs font-medium text-slate-200"
            >
              {t("wf_mark_fp")}
            </button>
            <button
              type="button"
              onClick={() => {
                setSelected(new Set());
                setBulkMode(null);
              }}
              className="ml-auto text-xs text-slate-400 hover:text-slate-200"
            >
              {t("bulk_clear")}
            </button>
          </div>
          {bulkMode && (
            <div className="space-y-2">
              <textarea
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                rows={2}
                placeholder={t("wf_note_resolution")}
                className="w-full rounded bg-slate-900 border border-slate-700 px-3 py-2 text-sm"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={bulkBusy || bulkText.trim().length < 5}
                  onClick={() => void bulkClose()}
                  className="rounded bg-cyan-600 hover:brightness-110 disabled:opacity-50 px-3 py-1.5 text-xs font-medium text-white"
                >
                  {t("wf_confirm")}
                </button>
                <button
                  type="button"
                  disabled={bulkBusy}
                  onClick={() => setBulkMode(null)}
                  className="rounded border border-ink-700 hover:bg-ink-800 px-3 py-1.5 text-xs text-slate-300"
                >
                  {t("wf_cancel")}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Resultado del último cierre masivo */}
      {bulkResult && (
        <div className="rounded-lg border border-ink-700 bg-ink-900/60 p-4 text-sm space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-emerald-300">
              {t("bulk_result_closed")}: {bulkResult.closed.length}
            </span>
            <button
              type="button"
              onClick={() => setBulkResult(null)}
              className="text-xs opacity-60 hover:opacity-100"
              aria-label="close"
            >
              ✕
            </button>
          </div>
          {bulkResult.failed.length > 0 && (
            <div className="text-amber-300">
              {t("bulk_result_failed")}: {bulkResult.failed.length}
              <ul className="mt-1 text-xs text-slate-400 space-y-0.5">
                {bulkResult.failed.map((f) => (
                  <li key={f.id}>
                    #{f.id}: {f.detail}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {!alerts && !error && <p className="text-slate-400">{t("history_loading")}</p>}
      {alerts && alerts.length === 0 && <p className="text-slate-400">{t("siem_empty")}</p>}

      {alerts && alerts.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    disabled={openRows.length === 0}
                    onChange={toggleAll}
                    aria-label={t("bulk_select_all")}
                  />
                </th>
                <th className="px-3 py-2">{t("siem_col_level")}</th>
                <th className="px-3 py-2">{t("siem_col_rule")}</th>
                <th className="px-3 py-2">{t("siem_col_agent")}</th>
                <th className="px-3 py-2">{t("siem_col_event")}</th>
                <th className="px-3 py-2">{t("history_col_risk")}</th>
                <th className="px-3 py-2">{t("history_col_mitre")}</th>
                <th className="px-3 py-2">{t("siem_col_status")}</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {alerts.map((a) => (
                <tr key={a.id} className="border-t border-ink-700 align-top">
                  <td className="px-3 py-2">
                    {OPEN_STATUSES.includes(a.status) && (
                      <input
                        type="checkbox"
                        checked={selected.has(a.id)}
                        onChange={() => toggle(a.id)}
                        aria-label={`#${a.id}`}
                      />
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`rounded border px-2 py-0.5 text-xs font-mono ${levelClass(a.rule_level)}`}>
                      {a.rule_level ?? "—"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-slate-200 max-w-md">{a.summary ?? "—"}</td>
                  <td className="px-3 py-2 text-slate-400">{a.agent_name ?? "—"}</td>
                  <td className="px-3 py-2 text-slate-400 whitespace-nowrap">
                    {new Date(a.event_at ?? a.created_at).toLocaleString()}
                  </td>
                  <td className="px-3 py-2"><RiskBadge level={a.risk_level} /></td>
                  <td className="px-3 py-2 text-xs text-slate-400">
                    {(a.mitre_techniques ?? []).join(", ") || "—"}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    <AlertStatusBadge status={a.status} />
                    {a.assigned_to_name && (
                      <div className="mt-1 text-[11px] text-slate-400 whitespace-nowrap">
                        {t("wf_assigned_to")}: {isMine(a) ? t("wf_assigned_you") : a.assigned_to_name}
                      </div>
                    )}
                    {a.review_rating && (
                      <div className="mt-1">
                        <ReviewBadge rating={a.review_rating} />
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {/* Asignada a mí → Analizar; se puede coger → Asignármela; si no → Ver */}
                    {isMine(a) && !a.analyzed_at ? (
                      <Link
                        href={`/alerts?wazuh_id=${a.id}`}
                        className="inline-block rounded bg-cyan-600 hover:brightness-110 px-3 py-1 text-xs font-medium text-white"
                      >
                        {t("siem_analyze_btn")}
                      </Link>
                    ) : canTake(a) ? (
                      <button
                        type="button"
                        onClick={() => void take(a.id)}
                        disabled={takingId === a.id}
                        className="rounded bg-violet-600 hover:brightness-110 disabled:opacity-50 px-3 py-1 text-xs font-medium text-white"
                      >
                        {t("wf_assign")}
                      </button>
                    ) : (
                      <Link
                        href={`/alerts?wazuh_id=${a.id}`}
                        className="text-xs text-cyan-400 hover:underline"
                      >
                        {t("siem_view")}
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
