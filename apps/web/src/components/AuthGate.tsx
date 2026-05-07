"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useAuth } from "@/lib/auth";

export function UserBadge() {
  const { user, signOut } = useAuth();
  if (!user) return null;
  const fullName = [user.name, user.last_name].filter(Boolean).join(" ");
  return (
    <div className="flex items-center gap-3 text-xs text-slate-300">
      <Link
        href="/profile"
        className="flex flex-col items-end leading-tight group"
        title="Editar perfil"
      >
        <span className="font-medium text-slate-100 group-hover:text-sky-300">
          {fullName}
        </span>
        <span className="text-[10px] text-slate-500 group-hover:text-slate-400">
          {user.email}
        </span>
      </Link>
      <span
        className={`px-1.5 py-0.5 rounded text-[10px] font-medium uppercase border ${
          user.role === "admin"
            ? "bg-rose-500/10 text-rose-300 border-rose-500/30"
            : "bg-sky-500/10 text-sky-300 border-sky-500/30"
        }`}
      >
        {user.role}
      </span>
      <Link
        href="/settings/llm"
        className="rounded border border-slate-700 px-2 py-1 hover:border-sky-500/50 text-slate-300 hover:text-sky-300"
        title="Configuración de IA (clave + modelo)"
      >
        IA
      </Link>
      <button
        type="button"
        onClick={() => void signOut()}
        className="rounded border border-slate-700 px-2 py-1 hover:border-slate-500 text-slate-300"
      >
        Salir
      </button>
    </div>
  );
}

/**
 * Sticky top bar shown on every authenticated page. Hidden on /login so the
 * sign-in screen stays clean.
 */
export function GlobalHeader() {
  const { user } = useAuth();
  const pathname = usePathname();

  if (pathname === "/login") return null;
  if (!user) return null;

  const isHome = pathname === "/";

  return (
    <header className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-6 py-2 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="text-sm font-semibold text-slate-200 hover:text-white"
          >
            SOC Copilot
          </Link>
          {!isHome && (
            <Link
              href="/"
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-sky-300 rounded border border-slate-700 hover:border-sky-500/50 px-2 py-1"
              title="Volver al inicio"
            >
              <span aria-hidden>←</span>
              <span>Inicio</span>
            </Link>
          )}
          <Link
            href="/dashboard"
            className="text-xs text-slate-400 hover:text-sky-300 rounded border border-slate-700 hover:border-sky-500/50 px-2 py-1"
            title="Métricas de los análisis"
          >
            Dashboard
          </Link>
        </div>
        <UserBadge />
      </div>
    </header>
  );
}
