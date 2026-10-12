"use client";

import type { AlertStatus } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

// Colores por estado del ciclo de vida de la alerta (Práctica 3).
const STYLES: Record<AlertStatus, string> = {
  new: "border-amber-700 bg-amber-900/40 text-amber-300",
  escalated: "border-rose-700 bg-rose-900/40 text-rose-300",
  in_progress: "border-violet-700 bg-violet-900/40 text-violet-300",
  resolved: "border-emerald-700 bg-emerald-900/40 text-emerald-300",
  false_positive: "border-slate-600 bg-slate-800 text-slate-300",
};

export function AlertStatusBadge({ status }: { status: AlertStatus | null | undefined }) {
  const { t } = useI18n();
  const s: AlertStatus = status ?? "new";
  return (
    <span
      className={`inline-block whitespace-nowrap rounded border px-2 py-0.5 text-[11px] font-medium ${STYLES[s]}`}
    >
      {t(`status_${s}` as Parameters<typeof t>[0])}
    </span>
  );
}
