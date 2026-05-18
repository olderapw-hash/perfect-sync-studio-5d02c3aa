// /admin/templates — Editor de templates iniciais (CLS).
// Renderiza a lista de classes como uma COLUNA INTERNA da página
// (não como uma Sidebar shadcn — isso entraria em conflito com a
// AdminSidebar do AdminLayout, que já controla o SidebarProvider).
import { useEffect, useState } from "react";
import {
  AlertCircle,
  Archive,
  Database,
  Info,
  Loader2,
  RefreshCw,
  Search,
} from "lucide-react";
import { useClsconfig } from "@/hooks/useClsconfig";
import { ClsconfigEditor } from "@/components/admin/ClsconfigEditor";
import { ClsconfigList } from "@/components/admin/ClsconfigList";
import { HistoryDrawer } from "@/components/admin/HistoryDrawer";
import { BackupsDialog } from "@/components/admin/BackupsDialog";
import { ItemCatalogAdvancedDialog } from "@/components/admin/ItemCatalogAdvancedDialog";
import { ItemCatalogManager } from "@/components/admin/ItemCatalogManager";
import type { ApiClass } from "@/types/clsconfig";

const TemplatesPage = () => {
  const { data, raw, loading, error, reload } = useClsconfig();
  const [selected, setSelected] = useState<string | null>(null);
  const [backupsOpen, setBackupsOpen] = useState(false);
  const [searchItemOpen, setSearchItemOpen] = useState(false);
  const classesById = new Map((data?.classes ?? []).map((cls) => [cls.id, cls]));
  const missingClasses = (data?.missing_class_ids ?? [])
    .map((id) => classesById.get(id))
    .filter((value): value is ApiClass => Boolean(value));
  const discoveredRoleidLines = Object.entries(data?.roleids_by_cls ?? {})
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([cls, roleids]) => {
      const apiClass = classesById.get(Number(cls));
      const label = apiClass ? `${apiClass.name} (cls ${cls})` : `cls ${cls}`;
      return `${label}: ${roleids.join(", ")}`;
    });

  useEffect(() => {
    if (data?.entries.length && !selected) {
      setSelected(data.entries[0].key_hex);
    }
  }, [data, selected]);

  const entry = data?.entries.find((e) => e.key_hex === selected) ?? null;
  const isEmpty = !loading && !error && data && data.entries.length === 0;

  return (
    <div className="flex h-full w-full">
      {/* Coluna interna: lista de classes/templates */}
      <aside className="flex w-[300px] shrink-0 flex-col border-r border-border bg-card/40 backdrop-blur-md">
        <div className="flex h-10 items-center gap-2 border-b border-border px-3 text-xs font-extrabold uppercase tracking-wider text-foreground">
          <Search className="h-3.5 w-3.5 text-primary" />
          Templates CLS
        </div>
        {data && (
          <div className="border-b border-border bg-background/30 px-3 py-2 text-[11px] text-muted-foreground">
            <div>
              Proxy: <strong>{data.entries.length}</strong> template(s) carregado(s) de{" "}
              <strong>{data.classes.length}</strong> classe(s) no catÃ¡logo.
            </div>
            {data.available_roleids && data.available_roleids.length > 0 && (
              <div className="mt-1 font-mono text-[10px]">
                roleids disponÃ­veis: {data.available_roleids.join(", ")}
              </div>
            )}
          </div>
        )}
        <div className="flex-1 overflow-y-auto">
          <ClsconfigList
            entries={data?.entries ?? []}
            classes={data?.classes ?? []}
            usedClasses={data?.used_classes ?? []}
            selectedKey={selected}
            onSelect={setSelected}
            loading={loading}
          />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Toolbar interna da página */}
        <div className="flex flex-wrap items-center gap-2 border-b border-border bg-card/40 px-4 py-2">
          <h2 className="mr-2 text-xs font-extrabold uppercase tracking-wider text-foreground">
            Editor de Templates
          </h2>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => setSearchItemOpen(true)}
              className="inline-flex items-center gap-2 rounded-md border border-border bg-card/60 px-3 py-1.5 text-xs transition-smooth hover:border-primary/50"
              title="Buscar item no catálogo"
            >
              <Search className="h-3.5 w-3.5" />
              Item
            </button>
            <button
              onClick={() => setBackupsOpen(true)}
              className="inline-flex items-center gap-2 rounded-md border border-border bg-card/60 px-3 py-1.5 text-xs transition-smooth hover:border-primary/50"
              title="Listar backups"
            >
              <Archive className="h-3.5 w-3.5" />
              Backups
            </button>
            <ItemCatalogManager />
            <HistoryDrawer />
            <button
              onClick={reload}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-md border border-border bg-card/60 px-3 py-1.5 text-xs transition-smooth hover:border-primary/50 disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              Recarregar
            </button>
          </div>
        </div>

        <section className="flex-1 overflow-hidden">
          {!loading && !error && data && (
            <div className="border-b border-border bg-amber-500/5 px-4 py-3">
              <div className="flex items-start gap-2 text-sm">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                <div className="min-w-0 space-y-1">
                  <div className="font-semibold text-foreground">
                    DiagnÃ³stico do clsconfig-proxy
                  </div>
                  <div className="text-xs text-muted-foreground">
                    O hook mostra apenas os templates que o VPS devolve agora pelo proxy. Se uma
                    classe nÃ£o aparece aqui, ainda falta template correspondente no servidor ou o
                    <code className="mx-1 font-mono">clsconfig_template_roleids</code>
                    da API nÃ£o inclui o roleid dela.
                  </div>
                  {missingClasses.length > 0 && (
                    <div className="text-xs text-amber-300">
                      Classes sem template retornado agora:{" "}
                      {missingClasses.map((cls) => `${cls.name} (cls ${cls.id})`).join(", ")}
                    </div>
                  )}
                  {discoveredRoleidLines.length > 0 && (
                    <pre className="overflow-x-auto rounded-md bg-background/60 p-2 font-mono text-[10px] text-foreground/80">
                      {discoveredRoleidLines.join("\n")}
                    </pre>
                  )}
                </div>
              </div>
            </div>
          )}
          {error ? (
            <div className="m-6 overflow-auto rounded-xl border border-destructive/40 bg-destructive/10 p-6 text-sm text-destructive">
              <div className="flex items-center gap-2 font-semibold">
                <AlertCircle className="h-4 w-4" />
                Erro ao carregar clsconfig
              </div>
              <pre className="mt-2 whitespace-pre-wrap break-all rounded-md bg-background/40 p-3 text-xs text-destructive/90">
                {error}
              </pre>
            </div>
          ) : loading && !data ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : isEmpty ? (
            <div className="m-6 overflow-auto rounded-xl border border-border bg-card/40 p-6 text-sm">
              <div className="flex items-center gap-2 font-semibold text-foreground">
                <Database className="h-4 w-4 text-primary" />
                Nenhum template retornado (count = 0)
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                O endpoint{" "}
                <code className="font-mono">
                  /apicls/api_cls.php?action=getClsconfig
                </code>{" "}
                respondeu com sucesso, mas{" "}
                <code className="font-mono">entries</code> está vazio.
              </p>
              <pre className="mt-4 max-h-[60vh] overflow-auto rounded-md bg-background/60 p-3 font-mono text-[11px] text-foreground/80">
                {JSON.stringify(raw, null, 2)}
              </pre>
            </div>
          ) : entry ? (
            <ClsconfigEditor
              entry={entry}
              allEntries={data?.entries ?? []}
              onReload={reload}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Selecione um template à esquerda para editar.
            </div>
          )}
        </section>
      </div>

      <BackupsDialog
        open={backupsOpen}
        onOpenChange={setBackupsOpen}
        onRestored={reload}
      />
      <ItemCatalogAdvancedDialog
        open={searchItemOpen}
        onOpenChange={setSearchItemOpen}
      />
    </div>
  );
};

export default TemplatesPage;
