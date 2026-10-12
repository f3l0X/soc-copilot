"use client";

import { useState } from "react";

import { AlertStatusBadge } from "@/components/AlertStatusBadge";
import {
  type AlertDetail,
  type AlertVerdict,
  ApiError,
  assignAlert,
  escalateAlert,
  reopenAlert,
  resolveAlert,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";

// Mismas reglas que la API (services/alert_workflow.py). Aquí solo sirven para
// mostrar los botones adecuados; quien decide de verdad es la API.
const OPEN_STATUSES = ["new", "in_progress", "escalated"];
const L1_CLOSABLE_RISKS = ["low", "medium"];
const MIN_NOTE = { escalate: 10, resolved: 5, false_positive: 5 } as const;

type Mode = null | "escalate" | AlertVerdict;

function errMsg(e: unknown): string {
  if (e instanceof ApiError) {
    try {
      const parsed = JSON.parse(e.detail) as { detail?: unknown };
      if (typeof parsed.detail === "string") return parsed.detail;
    } catch {
      /* texto plano */
    }
    return e.detail;
  }
  return e instanceof Error ? e.message : String(e);
}

export function AlertWorkflowPanel({
  alert,
  onChange,
}: {
  alert: AlertDetail;
  onChange: (detail: AlertDetail) => void;
}) {
  const { user } = useAuth();
  const { t } = useI18n();
  const [mode, setMode] = useState<Mode>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user) return null;

  const admin = user.role === "admin";
  const senior = admin || user.level === "L2" || user.level === "INSTRUCTOR";
  const isOpen = OPEN_STATUSES.includes(alert.status);
  const mine = alert.assigned_to_id === user.id;
  const canWork = isOpen && (mine || admin);
  // Un L1 solo coge alertas nuevas; L2/Instructor/admin también escaladas y ajenas.
  const canAssign =
    isOpen && !mine && (alert.status === "new" || senior);
  const canEscalate = canWork && alert.status !== "escalated";
  const riskOk = L1_CLOSABLE_RISKS.includes((alert.risk_level ?? "").toLowerCase());
  const canClose = canWork && (senior || riskOk);
  const canReopen = senior && !isOpen;
  const minLen = mode ? MIN_NOTE[mode] : 0;
  const textOk = text.trim().length >= minLen;

  async function run(action: () => Promise<AlertDetail>) {
    setBusy(true);
    setError(null);
    try {
      onChange(await action());
      setMode(null);
      setText("");
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  function confirm() {
    if (!mode || !textOk) return;
    const note = text.trim();
    if (mode === "escalate") void run(() => escalateAlert(alert.id, note));
    else void run(() => resolveAlert(alert.id, mode, note));
  }

  function open(next: Mode) {
    setMode(next);
    setText("");
    setError(null);
  }

  const assigned =
    alert.assigned_to_id == null
      ? t("wf_unassigned")
      : mine
        ? t("wf_assigned_you")
        : (alert.assigned_to_name ?? `${t("wf_analyst")} #${alert.assigned_to_id}`);

  const btn =
    "rounded px-3 py-1.5 text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed";

  return (
    <section className="space-y-4 rounded-lg border border-ink-700 bg-ink-900/60 p-6">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <h2 className="text-lg font-semibold">{t("wf_title")}</h2>
        <span className="text-sm text-slate-400">
          {t("wf_status")}: <AlertStatusBadge status={alert.status} />
        </span>
        <span className="text-sm text-slate-400">
          {t("wf_assigned_to")}: <span className="text-slate-200">{assigned}</span>
        </span>
      </div>

      {alert.escalation_note && (
        <div className="text-sm">
          <div className="text-xs uppercase text-slate-500">{t("wf_escalation_note")}</div>
          <p className="text-slate-200 whitespace-pre-line">{alert.escalation_note}</p>
        </div>
      )}
      {alert.resolution && (
        <div className="text-sm">
          <div className="text-xs uppercase text-slate-500">{t("wf_resolution")}</div>
          <p className="text-slate-200 whitespace-pre-line">{alert.resolution}</p>
        </div>
      )}

      {/* Acciones disponibles para este nivel */}
      <div className="flex flex-wrap gap-2">
        {canAssign && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void run(() => assignAlert(alert.id))}
            className={`${btn} bg-violet-600 text-white hover:brightness-110`}
          >
            {t("wf_assign")}
          </button>
        )}
        {canEscalate && (
          <button
            type="button"
            disabled={busy}
            onClick={() => open("escalate")}
            className={`${btn} bg-rose-600 text-white hover:brightness-110`}
          >
            {t("wf_escalate")}
          </button>
        )}
        {canClose && (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() => open("resolved")}
              className={`${btn} bg-emerald-600 text-white hover:brightness-110`}
            >
              {t("wf_resolve")}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => open("false_positive")}
              className={`${btn} border border-ink-700 text-slate-200 hover:bg-ink-800`}
            >
              {t("wf_mark_fp")}
            </button>
          </>
        )}
        {canReopen && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void run(() => reopenAlert(alert.id))}
            className={`${btn} border border-ink-700 text-slate-200 hover:bg-ink-800`}
          >
            {t("wf_reopen")}
          </button>
        )}
      </div>

      {isOpen && !canWork && (
        <p className="text-xs text-amber-300">{t("wf_assign_to_analyze")}</p>
      )}
      {canWork && !canClose && (
        <p className="text-xs text-amber-300">{t("wf_l1_must_escalate")}</p>
      )}

      {/* Nota de escalado o resolución */}
      {mode && (
        <div className="space-y-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            placeholder={mode === "escalate" ? t("wf_note_escalate") : t("wf_note_resolution")}
            className="w-full rounded bg-slate-900 border border-slate-700 px-3 py-2 text-sm"
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy || !textOk}
              onClick={confirm}
              className={`${btn} bg-cyan-600 text-white hover:brightness-110`}
            >
              {t("wf_confirm")}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => open(null)}
              className={`${btn} border border-ink-700 text-slate-300 hover:bg-ink-800`}
            >
              {t("wf_cancel")}
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded border border-rose-700 bg-rose-950/40 p-3 text-sm text-rose-300">
          {error}
        </div>
      )}

      {/* Historial */}
      <div>
        <h3 className="text-sm font-semibold text-slate-400 mb-2">{t("wf_history")}</h3>
        {alert.events.length === 0 ? (
          <p className="text-xs text-slate-500">{t("wf_empty_history")}</p>
        ) : (
          <ol className="space-y-2 text-xs">
            {alert.events.map((ev) => (
              <li key={ev.id} className="border-l-2 border-ink-700 pl-3">
                <div className="text-slate-300">
                  <span className="text-slate-500">
                    {new Date(ev.created_at).toLocaleString()}
                  </span>{" "}
                  · {ev.actor_email}{" "}
                  {t(`wf_action_${ev.action}` as Parameters<typeof t>[0])}
                  {ev.to_status && (
                    <>
                      {" "}
                      → <AlertStatusBadge status={ev.to_status} />
                    </>
                  )}
                </div>
                {ev.note && (
                  <p className="mt-1 text-slate-400 whitespace-pre-line">{ev.note}</p>
                )}
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}
