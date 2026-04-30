// /admin/server/messages — Sub-seção dedicada a comunicação operacional:
// • Envio de mensagem global do sistema (sysmsg)
// • Modo de manutenção (entrada/saída)
//
// Separada de Export & Reload pra deixar o fluxo de comunicação isolado
// das operações destrutivas/idempotentes que regravam o clsconfig.
import { Megaphone } from "lucide-react";
import { SystemMessageCard } from "@/components/admin/SystemMessageCard";
import { MaintenanceModeCard } from "@/components/admin/MaintenanceModeCard";

export default function ServerMessagesPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 text-primary">
          <Megaphone className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-sm font-extrabold uppercase tracking-wider text-foreground">
            Mensagens & Manutenção
          </h2>
          <p className="text-xs text-muted-foreground">
            Comunicação global com os jogadores e controle do modo de manutenção.
            Toda ação aqui é auditada.
          </p>
        </div>
      </div>

      <SystemMessageCard />

      <MaintenanceModeCard />
    </div>
  );
}
