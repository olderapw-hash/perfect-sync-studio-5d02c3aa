import { useMemo, useState } from "react";
import { Search, Users, ShieldAlert, Loader2 } from "lucide-react";
import type { ClsEntry } from "@/types/clsconfig";
import { cn } from "@/lib/utils";

interface Props {
  entries: ClsEntry[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
  loading?: boolean;
}

export const ClsconfigList = ({ entries, selectedKey, onSelect, loading }: Props) => {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return entries;
    return entries.filter((e) => e.template.summary.name.toLowerCase().includes(term));
  }, [entries, q]);

  return (
    <aside className="flex h-full w-full flex-col border-r border-border bg-card/40 backdrop-blur-md">
      <div className="border-b border-border p-4">
        <div className="mb-3 flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-extrabold uppercase tracking-wider text-foreground">
            Templates
          </h2>
          <span className="ml-auto rounded-md border border-border bg-muted/40 px-2 py-0.5 text-[10px] font-mono text-muted-foreground">
            {entries.length}
          </span>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nome…"
            className="w-full rounded-lg border border-border bg-background/60 py-2 pl-8 pr-3 text-sm outline-none transition-smooth focus:border-primary"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {loading ? (
          <div className="flex items-center justify-center p-6 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 p-6 text-center text-xs text-muted-foreground">
            <ShieldAlert className="h-5 w-5 opacity-60" />
            Nenhum template encontrado.
          </div>
        ) : (
          <ul className="space-y-1">
            {filtered.map((e) => {
              const t = e.template;
              const active = e.key_hex === selectedKey;
              return (
                <li key={e.key_hex}>
                  <button
                    onClick={() => onSelect(e.key_hex)}
                    className={cn(
                      "w-full rounded-lg border px-3 py-2.5 text-left transition-smooth",
                      active
                        ? "border-primary/60 bg-primary/10 shadow-glow"
                        : "border-border bg-background/40 hover:border-primary/40 hover:bg-background/60"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-bold text-foreground">
                        {t.summary.name || "(sem nome)"}
                      </span>
                      <span className="rounded bg-muted/50 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
                        v{e.version}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                      <span>cls {t.summary.cls}</span>
                      <span>·</span>
                      <span>raça {t.summary.race}</span>
                      <span>·</span>
                      <span>lvl {t.summary.level}</span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
};
