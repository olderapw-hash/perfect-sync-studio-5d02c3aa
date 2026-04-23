import { CalendarDays } from "lucide-react";
import { ComingSoonPage } from "@/components/admin/layout/ComingSoonPage";

const EventsPage = () => (
  <ComingSoonPage
    title="Eventos"
    description="Calendário de eventos do servidor com automação de premiações e anúncios."
    icon={CalendarDays}
    bullets={[
      "Cadastro de eventos recorrentes (semanais, mensais)",
      "Premiação automática via correio",
      "Notificações in-game e webhook (Discord)",
      "Relatório de participação",
      "Templates de eventos prontos (PvP, drop x2, GM live)",
    ]}
  />
);

export default EventsPage;
