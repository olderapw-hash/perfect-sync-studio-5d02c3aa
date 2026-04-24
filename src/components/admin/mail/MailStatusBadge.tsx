// Badge de status de envio de correio. Usa tokens semânticos do design.
import { CheckCircle2, Clock, Wifi, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MailSendStatus } from "@/lib/mailTemplates";

const MAP: Record<
  MailSendStatus,
  { label: string; cls: string; Icon: typeof CheckCircle2 }
> = {
  success: {
    label: "Entregue",
    cls: "border-success/40 bg-success/15 text-success",
    Icon: CheckCircle2,
  },
  pending: {
    label: "Pendente",
    cls: "border-amber-500/40 bg-amber-500/15 text-amber-500",
    Icon: Clock,
  },
  endpoint_missing: {
    label: "Endpoint ausente",
    cls: "border-muted-foreground/30 bg-muted/40 text-muted-foreground",
    Icon: Wifi,
  },
  error: {
    label: "Erro",
    cls: "border-destructive/40 bg-destructive/15 text-destructive",
    Icon: XCircle,
  },
};

export const MailStatusBadge = ({ status }: { status: MailSendStatus }) => {
  const { label, cls, Icon } = MAP[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
        cls,
      )}
    >
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
};
