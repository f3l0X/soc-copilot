"use client";

import { useAuth } from "@/lib/auth";

export function UserBadge() {
  const { user, signOut } = useAuth();
  if (!user) return null;
  return (
    <div className="flex items-center gap-2 text-xs text-slate-400">
      <span>
        {user.email}{" "}
        <span className="rounded border border-slate-700 px-1 py-0.5 text-[10px] uppercase">
          {user.role}
        </span>
      </span>
      <button
        type="button"
        onClick={() => void signOut()}
        className="rounded border border-slate-700 px-2 py-0.5 hover:border-slate-500"
      >
        salir
      </button>
    </div>
  );
}
