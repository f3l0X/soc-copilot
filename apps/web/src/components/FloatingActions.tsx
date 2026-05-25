"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";

/**
 * Floating action button anchored bottom-right of the AppShell. Currently
 * opens a single quick link to Chat IA. The Chat IA entry was deliberately
 * removed from the side nav (OPS_NAV) when this component was added so
 * the access stays single-sourced.
 *
 * Hides on /login (no shell) and /chat (we're already there).
 */
export function FloatingActions() {
  const { user } = useAuth();
  const pathname = usePathname();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  if (!user || pathname === "/login") return null;
  if (pathname === "/chat") return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">
      {open && (
        <div className="flex flex-col items-end gap-2 mb-1">
          <Link
            href="/chat"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-lg text-sm font-medium text-white transition hover:scale-105"
            style={{ background: "linear-gradient(135deg, #7c3aed, #6d28d9)" }}
          >
            <span>◐</span>
            <span>{t("nav_chat")}</span>
          </Link>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-14 h-14 rounded-full shadow-xl text-white text-2xl flex items-center justify-center transition hover:scale-110 active:scale-95"
        style={{
          background: open
            ? "linear-gradient(135deg, #374151, #1f2937)"
            : "linear-gradient(135deg, #7c3aed, #6d28d9)",
          boxShadow: "0 8px 32px rgba(124, 58, 237, 0.35)",
        }}
        title={open ? t("fab_close") : t("nav_chat")}
        aria-label={open ? t("fab_close") : t("nav_chat")}
        aria-expanded={open}
      >
        {open ? "✕" : "◐"}
      </button>
    </div>
  );
}
