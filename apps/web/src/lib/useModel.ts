"use client";

import { useEffect, useState } from "react";

import { type ModelsInfo, getModels } from "@/lib/api";

const STORAGE_KEY = "soc:llm-model";

/** Shared hook: fetches the allowlist once, exposes the selected model
 *  (persisted in localStorage) and a setter. The selected model is sent
 *  on every /explain, /recommend and /chat call so users can switch when
 *  the default hits a quota wall. */
export function useModel() {
  const [info, setInfo] = useState<ModelsInfo | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getModels()
      .then((m) => {
        setInfo(m);
        const stored =
          typeof window !== "undefined"
            ? window.localStorage.getItem(STORAGE_KEY)
            : null;
        if (stored && m.available.includes(stored)) {
          setSelected(stored);
        } else {
          setSelected(m.default);
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  function choose(model: string) {
    setSelected(model);
    try {
      window.localStorage.setItem(STORAGE_KEY, model);
    } catch {
      /* localStorage may be unavailable in private mode */
    }
  }

  return { info, selected, choose, error };
}
