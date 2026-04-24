// Estado vazio elegante para quando não há servidor ativo. Reaproveitado
// pelas páginas que dependem do tenant (Mail, Roles, Templates).
import { Link } from "react-router-dom";
import { ServerCrash } from "lucide-react";

interface Props {
  title?: string;
  description?: string;
}

export const NoActiveServerState = ({
  title = "Nenhum servidor ativo",
  description = "Você precisa selecionar um servidor antes de usar este módulo.",
}: Props) => (
  <div className="flex h-full items-center justify-center p-6">
    <div className="max-w-md rounded-2xl border border-destructive/40 bg-destructive/10 p-8 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-destructive/20 text-destructive">
        <ServerCrash className="h-6 w-6" />
      </div>
      <h2 className="text-base font-extrabold uppercase tracking-wider text-foreground">
        {title}
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      <Link
        to="/servers"
        className="mt-5 inline-flex items-center gap-2 rounded-md border border-primary/40 bg-primary/10 px-4 py-2 text-xs font-semibold text-primary transition-smooth hover:bg-primary/20"
      >
        Selecionar servidor
      </Link>
    </div>
  </div>
);
