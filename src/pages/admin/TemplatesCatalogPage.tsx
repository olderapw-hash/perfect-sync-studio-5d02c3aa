// /admin/templates/catalogo — Aba dedicada para o catálogo de itens.
// O ItemCatalogManager já é um Dialog completo; aqui montamos uma página
// que mostra as estatísticas atuais e abre o Dialog para gestão.
import { Boxes, Database, Package, Search } from "lucide-react";
import { useState } from "react";
import { useItemCatalog } from "@/context/ItemCatalogContext";
import { ItemCatalogManager } from "@/components/admin/ItemCatalogManager";
import { ItemCatalogAdvancedDialog } from "@/components/admin/ItemCatalogAdvancedDialog";

const TemplatesCatalogPage = () => {
  const { catalog, items } = useItemCatalog();
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mx-auto max-w-4xl">
        <header className="mb-6 flex flex-wrap items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-primary">
            <Boxes className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h1 className="text-lg font-extrabold tracking-tight text-foreground">
              Catálogo de itens
            </h1>
            <p className="text-xs text-muted-foreground">
              Arquivos <code className="font-mono">.tab</code> e ícones
              utilizados em todo o painel.
            </p>
          </div>
          <button
            onClick={() => setSearchOpen(true)}
            className="inline-flex items-center gap-2 rounded-md border border-border bg-card/60 px-3 py-2 text-xs transition-smooth hover:border-primary/50"
          >
            <Search className="h-3.5 w-3.5" />
            Buscar item
          </button>
          <ItemCatalogManager />
        </header>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-border bg-card/60 p-4">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
              <Database className="h-3.5 w-3.5 text-primary" />
              Catálogo ativo
            </div>
            <div className="mt-2">
              {catalog ? (
                <>
                  <p className="text-base font-bold text-foreground">
                    {catalog.name}
                  </p>
                  <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
                    {catalog.tab_path}
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Nenhum catálogo ativo
                </p>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card/60 p-4">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
              <Package className="h-3.5 w-3.5 text-primary" />
              Itens carregados
            </div>
            <p className="mt-2 text-2xl font-extrabold text-foreground">
              {items.size.toLocaleString("pt-BR")}
            </p>
          </div>
        </div>

        <p className="mt-4 text-[11px] text-muted-foreground">
          Use <strong>Importar / atualizar catálogo</strong> para subir um novo{" "}
          <code className="font-mono">.tab</code> ou ZIP de ícones. As mudanças
          ficam disponíveis em todo o painel imediatamente.
        </p>
      </div>

      <ItemCatalogAdvancedDialog
        open={searchOpen}
        onOpenChange={setSearchOpen}
      />
    </div>
  );
};

export default TemplatesCatalogPage;
