import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { History, Trash2 } from "lucide-react";
import { saveHistory, useSaveHistory } from "@/lib/saveHistory";
import { cn } from "@/lib/utils";

export const HistoryDrawer = () => {
  const entries = useSaveHistory();
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          className="relative inline-flex items-center gap-2 rounded-md border border-border bg-card/60 px-3 py-2 text-xs transition-smooth hover:border-primary/50"
          title="Histórico de alterações desta sessão"
        >
          <History className="h-3.5 w-3.5" />
          Histórico
          {entries.length > 0 && (
            <span className="rounded-full bg-primary/20 px-1.5 py-0.5 font-mono text-[10px] text-primary">
              {entries.length}
            </span>
          )}
        </button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full max-w-md overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <div className="flex items-center justify-between gap-2">
            <SheetTitle>Histórico desta sessão</SheetTitle>
            {entries.length > 0 && (
              <button
                type="button"
                onClick={() => saveHistory.clear()}
                className="inline-flex items-center gap-1 rounded-md border border-border bg-card/60 px-2 py-1 text-[11px] text-destructive transition-smooth hover:border-destructive/50"
              >
                <Trash2 className="h-3 w-3" />
                Limpar
              </button>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Apenas local — zera ao fechar a aba do navegador.
          </p>
        </SheetHeader>

        {entries.length === 0 ? (
          <div className="mt-6 rounded-lg border border-dashed border-border/60 bg-background/30 p-6 text-center text-xs text-muted-foreground">
            Nenhuma alteração registrada ainda.
          </div>
        ) : (
          <ol className="mt-4 space-y-2">
            {entries.map((e) => (
              <li
                key={e.id}
                className={cn(
                  "rounded-md border p-2 text-xs",
                  e.status === "ok"
                    ? "border-success/30 bg-success/5"
                    : "border-destructive/30 bg-destructive/5",
                )}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-mono text-[11px] text-muted-foreground">
                    roleid {e.roleid} · {e.className}
                  </span>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {new Date(e.ts).toLocaleTimeString("pt-BR")}
                  </span>
                </div>
                <div className="mt-1">
                  <span className="font-semibold text-foreground">{e.field}</span>{" "}
                  <span className="font-mono text-muted-foreground">
                    {e.oldValue || "—"} → {e.newValue || "—"}
                  </span>
                </div>
                <div className="mt-1 text-[11px]">
                  <span
                    className={cn(
                      "rounded px-1.5 py-0.5 font-semibold uppercase tracking-wide",
                      e.status === "ok"
                        ? "bg-success/15 text-success"
                        : "bg-destructive/15 text-destructive",
                    )}
                  >
                    {e.status === "ok" ? "salvo" : "falhou"}
                  </span>
                  {e.error && <span className="ml-2 text-destructive">{e.error}</span>}
                </div>
              </li>
            ))}
          </ol>
        )}
      </SheetContent>
    </Sheet>
  );
};
