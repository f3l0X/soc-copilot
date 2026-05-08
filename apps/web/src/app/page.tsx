"use client";

import Link from "next/link";

import { useRequireAuth } from "@/lib/auth";

type Tile = {
  href: string;
  title: string;
  desc: string;
  icon: string;
  hint: string;
};

const TILES: Tile[] = [
  {
    href: "/alerts",
    title: "Alert Explainer",
    desc: "Pega una alerta y obtén triage estructurado",
    icon: "▲",
    hint: "/alerts",
  },
  {
    href: "/logs",
    title: "Logs",
    desc: "Analiza y filtra eventos por host, IP, técnica MITRE",
    icon: "≡",
    hint: "/logs",
  },
  {
    href: "/respond",
    title: "Next Step Recommender",
    desc: "Sugerencias de respuesta y playbooks contextuales",
    icon: "◈",
    hint: "/respond",
  },
  {
    href: "/chat",
    title: "Chat IA",
    desc: "Conversa con el copiloto + RAG sobre tus alertas",
    icon: "◐",
    hint: "/chat",
  },
  {
    href: "/history",
    title: "Histórico",
    desc: "Alertas previas y trazabilidad de decisiones",
    icon: "◷",
    hint: "/history",
  },
  {
    href: "/dashboard",
    title: "Dashboard",
    desc: "Métricas en vivo y cobertura MITRE",
    icon: "▦",
    hint: "/dashboard",
  },
];

export default function Home() {
  const auth = useRequireAuth();

  if (auth.loading || !auth.user) {
    return <div className="p-8" />;
  }

  const fullName =
    [auth.user.name, auth.user.last_name].filter(Boolean).join(" ") ||
    auth.user.email;

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-8">
      <section className="rounded-xl border border-ink-700 bg-gradient-to-br from-cyan-500/10 via-ink-900/60 to-violet-500/10 p-8 relative overflow-hidden">
        <div className="absolute -right-10 -top-10 w-48 h-48 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none" />
        <div className="absolute -left-10 -bottom-10 w-48 h-48 rounded-full bg-violet-500/10 blur-3xl pointer-events-none" />
        <div className="relative">
          <div className="text-[11px] uppercase tracking-widest text-cyan-300/80 mb-2">
            Bienvenido
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-100">
            Hola, {fullName.split(" ")[0]} <span className="text-cyan-300">.</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1 max-w-xl">
            SOC Copilot está listo. Arranca por el módulo que necesites o salta
            al dashboard para ver el estado en vivo.
          </p>
          <div className="mt-4 flex gap-2">
            <Link
              href="/dashboard"
              className="px-3 py-2 rounded-md text-xs bg-cyan-500 text-ink-950 font-medium hover:bg-cyan-400"
            >
              Ir al Dashboard
            </Link>
            <Link
              href="/alerts"
              className="px-3 py-2 rounded-md text-xs border border-ink-700 bg-ink-850 hover:bg-ink-800 text-slate-300"
            >
              Analizar una alerta
            </Link>
          </div>
        </div>
      </section>

      <section>
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-200">Módulos</h2>
          <span className="text-[11px] text-slate-500 font-mono">
            {TILES.length + (auth.user.role === "admin" ? 1 : 0)} disponibles
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {TILES.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className="group rounded-xl border border-ink-700 bg-ink-900/60 p-5 hover:border-cyan-500/40 hover:shadow-glow transition"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-ink-850 border border-ink-700 grid place-items-center text-cyan-300 group-hover:border-cyan-500/40">
                  {t.icon}
                </div>
                <div className="flex-1">
                  <div className="font-medium text-slate-100 group-hover:text-cyan-300">
                    {t.title}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                    {t.desc}
                  </p>
                </div>
              </div>
              <div className="mt-3 text-[10px] font-mono text-slate-600 group-hover:text-cyan-400/70">
                {t.hint} →
              </div>
            </Link>
          ))}
          {auth.user.role === "admin" && (
            <Link
              href="/admin"
              className="group rounded-xl border border-rose-500/30 bg-rose-500/5 p-5 hover:border-rose-500/60 transition"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-ink-850 border border-rose-500/30 grid place-items-center text-rose-300">
                  ◇
                </div>
                <div className="flex-1">
                  <div className="font-medium text-slate-100 group-hover:text-rose-300">
                    Administración
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                    Gestión de usuarios, roles y configuración global
                  </p>
                </div>
              </div>
              <div className="mt-3 text-[10px] font-mono text-rose-400/70">
                /admin · admin only →
              </div>
            </Link>
          )}
        </div>
      </section>
    </div>
  );
}
