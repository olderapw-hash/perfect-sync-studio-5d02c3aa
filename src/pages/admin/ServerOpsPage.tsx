import { Server } from "lucide-react";
import { ComingSoonPage } from "@/components/admin/layout/ComingSoonPage";

const ServerOpsPage = () => (
  <ComingSoonPage
    title="Operação do Servidor"
    description="Monitoramento, anúncios globais e ferramentas de operação em tempo real."
    icon={Server}
    bullets={[
      "Status dos daemons (gamedbd, gacd, gdeliveryd, gs)",
      "Anúncios globais (system message)",
      "Kick / ban / mute em tempo real",
      "Reinício programado de mapas",
      "Métricas de performance (CPU, RAM, players online)",
      "Alertas via Discord/Telegram",
    ]}
  />
);

export default ServerOpsPage;
