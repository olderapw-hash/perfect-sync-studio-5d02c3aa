// /admin/roles/backups — Mesmo BackupsDialog, contexto "personagens reais".
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Archive } from "lucide-react";
import { BackupsDialog } from "@/components/admin/BackupsDialog";

const RolesBackupsPage = () => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (!open) {
      const t = setTimeout(() => navigate("/admin/roles"), 150);
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
              Backups de personagens reais
            </h1>
            <p className="text-xs text-muted-foreground">
              Snapshots gerados antes de cada edição em personagem online.
            </p>
          </div>
        </header>
        <div className="rounded-xl border border-border bg-card/60 p-6 text-center text-sm text-muted-foreground">
          O navegador de backups está aberto. Feche-o para voltar.
        </div>
      </div>
      <BackupsDialog open={open} onOpenChange={setOpen} />
    </div>
  );
};

export default RolesBackupsPage;
