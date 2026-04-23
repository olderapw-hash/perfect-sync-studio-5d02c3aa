import { Mail } from "lucide-react";
import { ComingSoonPage } from "@/components/admin/layout/ComingSoonPage";

const MailHistoryPage = () => (
  <ComingSoonPage
    title="Histórico de envios"
    description="Linha do tempo de cada correio enviado pelo painel."
    icon={Mail}
    bullets={[
      "Filtro por destinatário, template ou data",
      "Status de entrega (pendente, entregue, expirado)",
      "Reenvio rápido com um clique",
      "Exportação em CSV",
    ]}
  />
);

export default MailHistoryPage;
