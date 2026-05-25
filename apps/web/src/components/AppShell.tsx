"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { FloatingActions } from "@/components/FloatingActions";
import { LocaleThemeControls } from "@/components/LocaleThemeControls";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";

type NavItem = {
  href: string;
  labelKey: string;
  icon: string;
  badge?: string;
  shortcut?: string;
};

const OPS_NAV: NavItem[] = [
  { href: "/dashboard", labelKey: "nav_dashboard", icon: "▦", shortcut: "⌘1" },
  { href: "/alerts",    labelKey: "nav_alerts",    icon: "▲" },
  { href: "/logs",      labelKey: "nav_logs",      icon: "≡" },
  // /chat moved to the floating-action button bottom-right of the AppShell
  // (see <FloatingActions />). Keep the nav focused on triage-first paths.
  { href: "/history",   labelKey: "nav_history",   icon: "◷" },
  { href: "/groupchat", labelKey: "nav_groupchat", icon: "◈" },
];

const SYS_NAV: NavItem[] = [
  { href: "/settings/llm", labelKey: "nav_settings", icon: "⚙" },
  { href: "/admin",        labelKey: "nav_admin",     icon: "◇" },
];

const SIDEBAR_COLLAPSED_KEY = "soc:sidebar_collapsed";

function Sidebar({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  const pathname = usePathname();
  const { user } = useAuth();
  const { t } = useI18n();

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  const sysNav = SYS_NAV.filter(
    (it) => it.href !== "/admin" || user?.role === "admin",
  );

  const renderItem = (it: NavItem) => {
    const active = isActive(it.href);
    const label = t(it.labelKey as Parameters<typeof t>[0]);
    return (
      <Link
        key={it.href}
        href={it.href}
        className={
          "flex items-center gap-3 rounded-md text-sm transition " +
          (collapsed ? "px-2 py-2 justify-center " : "px-3 py-2 ") +
          (active
            ? "bg-cyan-500/10 text-cyan-300 border border-cyan-500/20"
            : "text-slate-300 hover:bg-ink-800 border border-transparent")
        }
        title={collapsed ? label : undefined}
        aria-label={collapsed ? label : undefined}
      >
        <span className="w-4 text-center">{it.icon}</span>
        {!collapsed && <span>{label}</span>}
        {!collapsed && it.badge && (
          <span className="ml-auto text-[10px] font-mono px-1.5 rounded bg-rose-500/20 text-rose-300">
            {it.badge}
          </span>
        )}
        {!collapsed && it.shortcut && !it.badge && active && (
          <span className="ml-auto text-[10px] font-mono text-cyan-300/70">
            {it.shortcut}
          </span>
        )}
      </Link>
    );
  };

  return (
    <aside
      className={
        "sidebar shrink-0 border-r flex flex-col transition-[width] duration-200 " +
        (collapsed ? "w-14" : "w-64")
      }
    >
      <div
        className={
          "border-b flex items-center gap-3 " +
          (collapsed ? "px-2 py-3 justify-center" : "px-5 py-5")
        }
      >
        <Link
          href="/"
          className="flex items-center gap-3 min-w-0"
          title={collapsed ? "SOC Copilot" : undefined}
        >
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-cyan-400 to-cyan-700 flex items-center justify-center text-ink-950 font-bold shrink-0">
            S
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="font-semibold tracking-tight">SOC Copilot</div>
              <div className="text-[11px] font-mono opacity-50">v0.4.2 · prod</div>
            </div>
          )}
        </Link>
        {!collapsed && (
          <button
            type="button"
            onClick={onToggle}
            className="ml-auto w-8 h-8 rounded-md bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/20 hover:border-cyan-500/60 hover:text-cyan-200 transition flex items-center justify-center text-base font-bold leading-none"
            title={t("sidebar_collapse")}
            aria-label={t("sidebar_collapse")}
          >
            ‹‹
          </button>
        )}
      </div>

      {collapsed && (
        <button
          type="button"
          onClick={onToggle}
          className="mx-2 mt-3 h-8 rounded-md bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/20 hover:border-cyan-500/60 hover:text-cyan-200 transition flex items-center justify-center text-base font-bold leading-none"
          title={t("sidebar_expand")}
          aria-label={t("sidebar_expand")}
        >
          ››
        </button>
      )}

      <nav className={"py-4 space-y-1 " + (collapsed ? "px-2" : "px-3")}>
        {!collapsed && (
          <div className="px-3 pb-2 text-[10px] uppercase tracking-widest opacity-50">
            {t("nav_ops")}
          </div>
        )}
        {OPS_NAV.map(renderItem)}

        {!collapsed && (
          <div className="px-3 pt-5 pb-2 text-[10px] uppercase tracking-widest opacity-50">
            {t("nav_system")}
          </div>
        )}
        {collapsed && <div className="my-3 border-t opacity-20" />}
        {sysNav.map(renderItem)}
      </nav>

      {!collapsed && (
        <div className="mt-auto m-3 rounded-lg border p-3 text-xs status-widget">
          <div className="flex items-center gap-2 mb-2">
            <span className="relative inline-block w-2 h-2 rounded-full bg-emerald-400 pulse-dot" />
            <span>{t("status_backend")}</span>
          </div>
          <div className="font-mono opacity-50 leading-5">
            api &nbsp; · 142 ms
            <br />
            chroma · 38 ms
            <br />
            gemini · ok
          </div>
        </div>
      )}
    </aside>
  );
}

function Topbar() {
  const { user, signOut } = useAuth();
  const { t } = useI18n();

  const initials = user
    ? `${(user.name?.[0] ?? user.email[0]).toUpperCase()}${
        user.last_name?.[0]?.toUpperCase() ?? ""
      }`
    : "?";
  const fullName = user
    ? [user.name, user.last_name].filter(Boolean).join(" ") || user.email
    : "";

  return (
    <header className="topbar h-14 border-b backdrop-blur flex items-center px-6 gap-4 sticky top-0 z-40">
      <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-md border text-xs w-96 search-box">
        <span>⌕</span>
        <input
          className="bg-transparent outline-none flex-1 placeholder:opacity-40"
          placeholder={t("topbar_search_placeholder")}
        />
        <span className="font-mono text-[10px] opacity-40">⌘K</span>
      </div>

      <div className="ml-auto flex items-center gap-3">
        <LocaleThemeControls />

        <Link
          href="/settings/llm"
          className="text-xs flex items-center gap-2 px-3 py-1.5 rounded-md border hover:border-cyan-500/30 model-btn"
          title={t("tip_model_config")}
        >
          <span className="opacity-50">{t("topbar_model")}</span>
          <span className="text-cyan-300 font-medium">gemini-2.5-pro</span>
          <span className="opacity-40">▾</span>
        </Link>

        {user && (
          <>
            <span
              className={
                "px-1.5 py-0.5 rounded text-[10px] font-medium uppercase border " +
                (user.role === "admin"
                  ? "bg-rose-500/10 text-rose-300 border-rose-500/30"
                  : "bg-cyan-500/10 text-cyan-300 border-cyan-500/30")
              }
            >
              {user.role}
            </span>
            <span
              className={
                "px-1.5 py-0.5 rounded text-[10px] font-medium uppercase border " +
                (user.level === "INSTRUCTOR"
                  ? "bg-violet-500/10 text-violet-300 border-violet-500/30"
                  : user.level === "L2"
                    ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
                    : "bg-amber-500/10 text-amber-300 border-amber-500/30")
              }
              title={t("tip_soc_level")}
            >
              {user.level}
            </span>
            <Link
              href="/profile"
              className="flex items-center gap-2 pl-3 border-l group"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-violet-500 grid place-items-center text-xs font-bold text-ink-950">
                {initials}
              </div>
              <div className="text-xs leading-tight">
                <div className="group-hover:text-cyan-300">{fullName}</div>
                <div className="opacity-40">
                  {user.role} · {user.email}
                </div>
              </div>
            </Link>
            <button
              type="button"
              onClick={() => void signOut()}
              className="rounded-md border px-2.5 py-1.5 text-xs transition hover:border-slate-500"
              title={t("tip_signout")}
            >
              {t("topbar_signout")}
            </button>
          </>
        )}
      </div>
    </header>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  // Hydrate the persisted preference once on mount. Stays false on first
  // render to keep server/client markup matching and avoid hydration
  // warnings; the flip happens after mount.
  useEffect(() => {
    const saved = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
    if (saved === "1") setCollapsed(true);
  }, []);

  function toggle() {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? "1" : "0");
      return next;
    });
  }

  if (pathname === "/login" || !user) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen grid-bg">
      <Sidebar collapsed={collapsed} onToggle={toggle} />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar />
        <main className="flex-1 overflow-auto">{children}</main>
        <FloatingActions />
      </div>
    </div>
  );
}
