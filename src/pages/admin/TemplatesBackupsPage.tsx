// /admin/templates/backups — Página dedicada que abre o BackupsDialog.
// Mantém o dialog aberto enquanto a rota estiver ativa; ao fechar, volta
// para /admin/templates.
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Archive } from "lucide-react";
import { BackupsDialog } from "@/components/admin/BackupsDialog";
import { useClsconfig } from "@/hooks/useClsconfig";

const TemplatesBackupsPage = () => {
  const navigate = useNavigate();
  const { reload } = useClsconfig();
  const [open, setOpen] = useState(true);

  // Quando o usuário fecha o dialog, devolve para a rota base de templates.
  useEffect(() => {
    if (!open) {
      const t = setTimeout(() => navigate("/admin/templates"), 150);
      return () => clearTimeout(t);
    }
  }, [open, navigate]);

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mx-auto max-w-3xl">
        <header className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-primary">
            <Archive className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-extrabold tracking-tight text-foreground">
              Backups de templates
            </h1>
            <p className="text-xs text-muted-foreground">
              Snapshots gerados automaticamente antes de cada save.
            </p>
          </div>
        </header>

        <div className="rounded-xl border border-border bg-card/60 p-6 text-center text-sm text-muted-foreground">
          O navegador de backups está aberto. Feche-o para voltar ao editor.
        </div>
      </div>

      <BackupsDialog open={open} onOpenChange={setOpen} onRestored={reload} />
    </div>
  );
};

export default TemplatesBackupsPage;
