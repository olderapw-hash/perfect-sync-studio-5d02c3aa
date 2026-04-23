import { Mail } from "lucide-react";
import { ComingSoonPage } from "@/components/admin/layout/ComingSoonPage";

const MailTemplatesPage = () => (
  <ComingSoonPage
    title="Templates de correio"
    description="Modelos reutilizáveis de mensagens com anexos pré-configurados."
    icon={Mail}
    bullets={[
      "Biblioteca compartilhada entre membros do servidor",
      "Variáveis dinâmicas no assunto e corpo",
      "Anexos pré-selecionados do catálogo",
      "Preview antes de enviar",
    ]}
  />
);

export default MailTemplatesPage;
