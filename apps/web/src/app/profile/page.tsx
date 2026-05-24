"use client";

import { useEffect, useState } from "react";

import { ApiError, updateProfile, UserLevel } from "@/lib/api";
import { useAuth, useRequireAuth } from "@/lib/auth";
import { useI18n, type TranslationKey } from "@/lib/i18n";

const LEVEL_OPTIONS: { value: UserLevel; labelKey: TranslationKey; hintKey: TranslationKey }[] = [
  { value: "L1", labelKey: "level_l1_label", hintKey: "level_l1_hint" },
  { value: "L2", labelKey: "level_l2_label", hintKey: "level_l2_hint" },
  { value: "INSTRUCTOR", labelKey: "level_instructor_label", hintKey: "level_instructor_hint" },
];

export default function ProfilePage() {
  const auth = useRequireAuth();
  const { refresh } = useAuth();
  const { t } = useI18n();

  const [name, setName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [level, setLevel] = useState<UserLevel>("L1");
  const [currentPassword, setCurrentPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (auth.user) {
      setName(auth.user.name);
      setLastName(auth.user.last_name ?? "");
      setEmail(auth.user.email);
      setLevel(auth.user.level);
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
        level: level !== auth.user.level ? level : undefined,
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
    return <div className="p-8 text-slate-500 text-sm">{t("alerts_loading")}</div>;
  }

  const u = auth.user!;
  const canEditLevel = u.role === "admin";
  const dirty =
    name !== u.name ||
    lastName !== (u.last_name ?? "") ||
    email !== u.email ||
    (canEditLevel && level !== u.level);
  const levelHintOpt = LEVEL_OPTIONS.find((o) => o.value === level);
  const levelHint = levelHintOpt ? t(levelHintOpt.hintKey) : undefined;
  const requestedHint =
    !canEditLevel && !u.level_approved && u.requested_level !== u.level
      ? `Solicitaste ${u.requested_level}; un administrador revisará y asignará tu nivel definitivo.`
      : null;

  return (
    <div className="p-6 max-w-xl mx-auto space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">{t("profile_title")}</h1>
        <p className="text-slate-400 mt-2">{t("profile_subtitle")}</p>
      </header>

      <section className="bg-ink-900/60 border border-ink-700 rounded-lg p-6 space-y-4">
        {error && (
          <div className="text-sm bg-rose-950/40 border border-rose-800 text-rose-300 p-3 rounded">
            {error}
          </div>
        )}

        {success && !dirty && (
          <div className="text-sm bg-emerald-950/40 border border-emerald-800 text-emerald-300 p-3 rounded">
            {t("profile_updated")}
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-4">
          <label className="block text-sm">
            <span className="text-slate-400">{t("profile_name")}</span>
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
            <span className="text-slate-400">{t("profile_lastname")}</span>
            <input
              type="text"
              maxLength={100}
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="mt-1 w-full rounded bg-slate-950 border border-slate-700 px-3 py-2 text-white"
              placeholder={t("profile_optional")}
            />
          </label>

          <label className="block text-sm">
            <span className="text-slate-400">{t("profile_email")}</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded bg-slate-950 border border-slate-700 px-3 py-2 text-white"
            />
            <span className="text-xs text-slate-500 mt-1 block">
              {t("profile_email_hint")}
            </span>
          </label>

          {email !== u.email && (
            <label className="block text-sm">
              <span className="text-slate-400">{t("profile_current_password")}</span>
              <input
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="mt-1 w-full rounded bg-slate-950 border border-slate-700 px-3 py-2 text-white"
                placeholder={t("profile_current_password_placeholder")}
              />
            </label>
          )}

          <fieldset className="border border-ink-700 rounded-lg p-4 space-y-2">
            <legend className="px-2 text-sm text-slate-300">
              {t("login_level")}
              {!canEditLevel && !u.level_approved && (
                <span
                  className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-medium uppercase border bg-amber-500/10 text-amber-300 border-amber-500/30"
                >
                  {t("profile_level_pending")}
                </span>
              )}
            </legend>
            <p className="text-xs text-slate-500">
              {canEditLevel ? t("profile_level_admin_note") : t("profile_level_user_note")}
            </p>
            <div className="grid gap-2 sm:grid-cols-3">
              {LEVEL_OPTIONS.map((opt) => {
                const selected = level === opt.value;
                return (
                  <label
                    key={opt.value}
                    className={`rounded border px-3 py-2 text-sm transition-colors ${
                      selected
                        ? "border-cyan-500 bg-cyan-500/10 text-cyan-200"
                        : "border-ink-700 bg-ink-950 text-slate-300"
                    } ${
                      canEditLevel
                        ? "cursor-pointer hover:border-ink-600"
                        : "cursor-not-allowed opacity-70"
                    }`}
                  >
                    <input
                      type="radio"
                      name="level"
                      value={opt.value}
                      checked={selected}
                      disabled={!canEditLevel}
                      onChange={() => setLevel(opt.value)}
                      className="sr-only"
                    />
                    {t(opt.labelKey)}
                  </label>
                );
              })}
            </div>
            {levelHint && (
              <p className="text-[11px] text-slate-400">{levelHint}</p>
            )}
            {requestedHint && (
              <p className="text-[11px] text-amber-300">{requestedHint}</p>
            )}
          </fieldset>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              disabled={!dirty || saving}
              onClick={() => {
                setName(u.name);
                setLastName(u.last_name ?? "");
                setEmail(u.email);
                setLevel(u.level);
                setSuccess(false);
                setError(null);
              }}
              className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 disabled:opacity-40"
            >
              {t("profile_discard")}
            </button>
            <button
              type="submit"
              disabled={!dirty || saving}
              className="px-4 py-2 text-sm bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-700 rounded font-medium"
            >
              {saving ? t("profile_saving") : t("profile_save")}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
