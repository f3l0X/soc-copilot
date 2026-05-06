"use client";

import Link from "next/link";

import { useRequireAuth } from "@/lib/auth";

export default function Home() {
  const auth = useRequireAuth();

  if (auth.loading || !auth.user) {
    return <main className="min-h-screen p-8" />;
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8 gap-6">
      <h1 className="text-4xl font-bold tracking-tight">SOC Copilot</h1>
      <p className="text-slate-400">AI Copilot para Analistas SOC Junior</p>
      <ul className="text-sm text-slate-400 list-disc pl-5 space-y-1">
        <li>
          <Link className="text-sky-400 hover:underline" href="/alerts">
            /alerts
          </Link>{" "}
          — Alert Explainer
        </li>
        <li>
          <Link className="text-sky-400 hover:underline" href="/logs">
            /logs
          </Link>{" "}
          — Analizador y Filtrado de Logs
        </li>
        <li>
          <Link className="text-sky-400 hover:underline" href="/respond">
            /respond
          </Link>{" "}
          — Next Step Recommender
        </li>
        <li>
          <Link className="text-sky-400 hover:underline" href="/history">
            /history
          </Link>{" "}
          — Histórico de alertas
        </li>
        <li>
          <Link className="text-sky-400 hover:underline" href="/chat">
            /chat
          </Link>{" "}
          — Chat IA + RAG
        </li>
        {auth.user.role === "admin" && (
          <li>
            <Link className="text-sky-400 hover:underline" href="/admin">
              /admin
            </Link>{" "}
            — Panel de Administración
          </li>
        )}
      </ul>
    </main>
  );
}
