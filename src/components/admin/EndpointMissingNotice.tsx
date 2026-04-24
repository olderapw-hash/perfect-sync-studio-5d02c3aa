// Notice padronizada para quando uma action ainda não foi implementada
// no api_cls.php da VPS. Reutilizada por Server Ops, Mail e Segurança.
import { AlertTriangle } from "lucide-react";

export const EndpointMissingNotice = ({ action }: { action: string }) => (
  <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-amber-500">
    <div className="flex items-start gap-2">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <div>
        <p className="text-xs font-bold uppercase tracking-wider">
          Não implementado nesta VPS
        </p>
        <p className="mt-1 text-xs text-amber-500/90">
          O endpoint <code className="font-mono">?action={action}</code> ainda
          não foi instalado neste servidor. Atualize o{" "}
          <code className="font-mono">api_cls.php</code> via{" "}
          <a href="/install" className="underline">
            /install
          </a>{" "}
          para habilitar este recurso.
        </p>
      </div>
    </div>
  </div>
);
