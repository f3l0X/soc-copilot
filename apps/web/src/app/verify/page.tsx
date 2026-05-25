"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { ApiError, verifyEmail } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

function VerifyInner() {
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const { t } = useI18n();
  const [state, setState] = useState<"pending" | "ok" | "error">("pending");
  const [message, setMessage] = useState<string>(t("verify_pending"));

  useEffect(() => {
    if (!token) {
      setState("error");
      setMessage(t("verify_missing_token"));
      return;
    }
    verifyEmail(token)
      .then(() => {
        setState("ok");
        setMessage(t("verify_success"));
      })
      .catch((err) => {
        setState("error");
        if (err instanceof ApiError) setMessage(err.detail.slice(0, 200));
        else setMessage(err instanceof Error ? err.message : String(err));
      });
  }, [token, t]);

  const tone =
    state === "ok"
      ? "border-emerald-700 bg-emerald-950/40 text-emerald-200"
      : state === "error"
        ? "border-rose-700 bg-rose-950/40 text-rose-200"
        : "border-slate-700 bg-slate-900/40 text-slate-200";

  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <div
        className={`w-full max-w-md space-y-4 rounded-lg border p-6 ${tone}`}
      >
        <h1 className="text-2xl font-bold tracking-tight">{t("verify_title")}</h1>
        <p className="text-sm">{message}</p>
        <Link
          href="/login"
          className="inline-block rounded bg-sky-600 hover:bg-sky-500 px-4 py-2 text-sm font-medium text-white"
        >
          {t("verify_go_login")}
        </Link>
      </div>
    </main>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={<main className="min-h-screen p-8" />}>
      <VerifyInner />
    </Suspense>
  );
}
