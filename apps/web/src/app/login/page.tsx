"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { ApiError, register } from "@/lib/api";
import { useAuth } from "@/lib/auth";

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/";
  const auth = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "register">("login");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!auth.loading && auth.user) router.replace(next);
  }, [auth.loading, auth.user, next, router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (mode === "register") {
        await register(email, password, name);
      }
      await auth.signIn(email, password);
      router.replace(next);
    } catch (err) {
      if (err instanceof ApiError) {
        // 401 invalid credentials, 409 already registered, 422 validation.
        if (err.status === 401) setError("Credenciales inválidas.");
        else if (err.status === 409) setError("Ese email ya está registrado.");
        else setError(err.detail.slice(0, 200));
      } else {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm space-y-4 rounded-lg border border-slate-800 bg-slate-900/40 p-6"
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight">SOC Copilot</h1>
          <p className="text-sm text-slate-400 mt-1">
            {mode === "login"
              ? "Inicia sesión para continuar."
              : "Crea una cuenta. El primer usuario es admin."}
          </p>
        </div>

        {mode === "register" && (
          <label className="block text-sm">
            <span className="text-slate-400">Nombre</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoComplete="name"
              className="mt-1 w-full rounded bg-slate-900 border border-slate-700 px-3 py-2"
            />
          </label>
        )}

        <label className="block text-sm">
          <span className="text-slate-400">Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            className="mt-1 w-full rounded bg-slate-900 border border-slate-700 px-3 py-2"
          />
        </label>

        <label className="block text-sm">
          <span className="text-slate-400">Contraseña</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={mode === "register" ? 8 : 1}
            autoComplete={
              mode === "register" ? "new-password" : "current-password"
            }
            className="mt-1 w-full rounded bg-slate-900 border border-slate-700 px-3 py-2"
          />
        </label>

        {error && (
          <div className="rounded border border-rose-700 bg-rose-950/40 p-3 text-xs text-rose-300">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded bg-sky-600 hover:bg-sky-500 disabled:bg-slate-700 px-4 py-2 text-sm font-medium"
        >
          {loading
            ? "…"
            : mode === "login"
              ? "Iniciar sesión"
              : "Crear cuenta"}
        </button>

        <button
          type="button"
          onClick={() => setMode(mode === "login" ? "register" : "login")}
          className="block w-full text-center text-xs text-slate-400 hover:text-slate-200"
        >
          {mode === "login"
            ? "¿No tienes cuenta? Regístrate"
            : "Ya tengo cuenta"}
        </button>
      </form>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="min-h-screen p-8" />}>
      <LoginInner />
    </Suspense>
  );
}
