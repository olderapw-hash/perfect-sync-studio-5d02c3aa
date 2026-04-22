// Histórico LOCAL de alterações (apenas durante a sessão do navegador).
// Sem backend. Persiste em sessionStorage para sobreviver a reload, mas zera ao fechar a aba.
import { useSyncExternalStore } from "react";

export interface HistoryEntry {
  id: string;
  ts: number;
  roleid: number;
  className: string;
  field: string;
  /** stringified para evitar referência mutável */
  oldValue: string;
  newValue: string;
  status: "ok" | "error";
  error?: string;
}

const KEY = "clsconfig.saveHistory.v1";
const MAX = 200;

const load = (): HistoryEntry[] => {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

let entries: HistoryEntry[] = load();
const listeners = new Set<() => void>();

const persist = () => {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(entries));
  } catch {
    /* quota — ignora */
  }
  listeners.forEach((l) => l());
};

const fmt = (v: unknown): string => {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  try {
    const s = JSON.stringify(v);
    return s.length > 120 ? s.slice(0, 117) + "…" : s;
  } catch {
    return String(v);
  }
};

export const saveHistory = {
  push(entry: Omit<HistoryEntry, "id" | "ts">) {
    const full: HistoryEntry = {
      ...entry,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      ts: Date.now(),
    };
    entries = [full, ...entries].slice(0, MAX);
    persist();
  },
  pushDiff(opts: {
    roleid: number;
    className: string;
    field: string;
    oldValue: unknown;
    newValue: unknown;
    status: "ok" | "error";
    error?: string;
  }) {
    saveHistory.push({
      roleid: opts.roleid,
      className: opts.className,
      field: opts.field,
      oldValue: fmt(opts.oldValue),
      newValue: fmt(opts.newValue),
      status: opts.status,
      error: opts.error,
    });
  },
  clear() {
    entries = [];
    persist();
  },
  list(): HistoryEntry[] {
    return entries;
  },
};

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};

export function useSaveHistory(): HistoryEntry[] {
  return useSyncExternalStore(subscribe, () => entries, () => entries);
}
