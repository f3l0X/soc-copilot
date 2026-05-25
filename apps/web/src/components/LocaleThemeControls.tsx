"use client";

import { LOCALE_LABELS, useI18n, type Locale } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";

/**
 * Reusable language selector + theme toggle. Used inside AppShell's topbar
 * for authenticated pages and stand-alone in /login (which renders outside
 * AppShell).
 */
export function LocaleThemeControls() {
  const { theme, toggleTheme } = useTheme();
  const { locale, setLocale, t } = useI18n();
  const locales: Locale[] = ["es", "en", "fr"];

  return (
    <div className="flex items-center gap-3">
      {/* Language selector */}
      <div className="flex items-center rounded-md border overflow-hidden text-xs lang-selector">
        {locales.map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => setLocale(l)}
            className={
              "px-2 py-1.5 font-medium transition " +
              (locale === l
                ? "bg-cyan-500 text-ink-950"
                : "opacity-50 hover:opacity-80")
            }
            title={LOCALE_LABELS[l]}
          >
            {l.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Theme toggle */}
      <button
        type="button"
        onClick={toggleTheme}
        className="rounded-md border px-2.5 py-1.5 text-xs font-medium transition hover:border-cyan-500/40 theme-toggle"
        title={theme === "dark" ? t("theme_light") : t("theme_dark")}
      >
        {theme === "dark" ? t("theme_light") : t("theme_dark")}
      </button>
    </div>
  );
}
