import { Mail } from "lucide-react";
import { ComingSoonPage } from "@/components/admin/layout/ComingSoonPage";

const MailPage = () => (
  <ComingSoonPage
    title="Correio & Recompensas"
    description="Centro unificado para enviar itens, moedas e mensagens em massa para os jogadores."
    icon={Mail}
    bullets={[
      "Envio em massa por classe, level ou lista de roleids",
      "Templates de mensagem com variáveis ({{nick}}, {{cls}})",
      "Anexos com itens, moeda e cartões",
      "Auditoria completa de cada envio",
      "Reenvio para destinatários offline",
      "Agendamento e pré-visualização",
    ]}
  />
);

export default MailPage;
