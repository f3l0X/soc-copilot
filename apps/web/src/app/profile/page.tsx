"use client";

import { useEffect, useState } from "react";

import { ApiError, updateProfile } from "@/lib/api";
import { useAuth, useRequireAuth } from "@/lib/auth";

export default function ProfilePage() {
  const auth = useRequireAuth();
  const { refresh } = useAuth();

  const [name, setName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (auth.user) {
      setName(auth.user.name);
      setLastName(auth.user.last_name ?? "");
      setEmail(auth.user.email);
    }
  }, [auth.user]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!auth.user) return;
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const emailChanging = email !== auth.user.email;
      await updateProfile({
        name: name !== auth.user.name ? name : undefined,
        last_name: lastName !== (auth.user.last_name ?? "") ? lastName : undefined,
        email: emailChanging ? email : undefined,
        current_password: emailChanging ? currentPassword : undefined,
      });
      await refresh();
      setCurrentPassword("");
      setSuccess(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "No se pudo guardar el perfil");
    } finally {
      setSaving(false);
    }
  }

  if (!auth.ready) {
    return <div className="p-8 text-slate-500 text-sm">Verificando sesión…</div>;
  }

  const u = auth.user!;
  const dirty =
    name !== u.name || lastName !== (u.last_name ?? "") || email !== u.email;

  return (
    <div className="p-6 max-w-xl mx-auto space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Mi Perfil</h1>
        <p className="text-slate-400 mt-2">
          Edita tu información personal. La contraseña y el rol se gestionan desde
          el panel de administración.
        </p>
      </header>

      <section className="bg-ink-900/60 border border-ink-700 rounded-lg p-6 space-y-4">
        {error && (
          <div className="text-sm bg-rose-950/40 border border-rose-800 text-rose-300 p-3 rounded">
            {error}
          </div>
        )}

        {success && !dirty && (
          <div className="text-sm bg-emerald-950/40 border border-emerald-800 text-emerald-300 p-3 rounded">
            Perfil actualizado correctamente.
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-4">
          <label className="block text-sm">
            <span className="text-slate-400">Nombre</span>
            <input
              type="text"
              required
              minLength={2}
              maxLength={100}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded bg-slate-950 border border-slate-700 px-3 py-2 text-white"
            />
          </label>

          <label className="block text-sm">
            <span className="text-slate-400">Apellidos</span>
            <input
              type="text"
              maxLength={100}
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="mt-1 w-full rounded bg-slate-950 border border-slate-700 px-3 py-2 text-white"
              placeholder="Opcional"
            />
          </label>

          <label className="block text-sm">
            <span className="text-slate-400">Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded bg-slate-950 border border-slate-700 px-3 py-2 text-white"
            />
            <span className="text-xs text-slate-500 mt-1 block">
              Para cambiar el email tendrás que confirmar tu contraseña actual.
            </span>
          </label>

          {email !== u.email && (
            <label className="block text-sm">
              <span className="text-slate-400">Contraseña actual</span>
              <input
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="mt-1 w-full rounded bg-slate-950 border border-slate-700 px-3 py-2 text-white"
                placeholder="Necesaria para confirmar el cambio de email"
              />
            </label>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              disabled={!dirty || saving}
              onClick={() => {
                setName(u.name);
                setLastName(u.last_name ?? "");
                setEmail(u.email);
                setSuccess(false);
                setError(null);
              }}
              className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 disabled:opacity-40"
            >
              Descartar
            </button>
            <button
              type="submit"
              disabled={!dirty || saving}
              className="px-4 py-2 text-sm bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-700 rounded font-medium"
            >
              {saving ? "Guardando..." : "Guardar cambios"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
