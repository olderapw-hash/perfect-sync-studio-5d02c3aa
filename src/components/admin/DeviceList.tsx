import { Laptop, Loader2, ShieldCheck, Trash2 } from "lucide-react";
import { useAccountDevices, type AccountDevice } from "@/hooks/useAccountDevices";
import { getDeviceId } from "@/hooks/useDeviceId";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { useState } from "react";

interface Props {
  /** "mine" mostra somente os do usuário; "all" mostra todos (superadmin). */
  scope?: "mine" | "all";
  /** Mostra coluna do dono (e-mail) — útil em scope=all. */
  showOwner?: boolean;
}

export const DeviceList = ({ scope = "mine", showOwner }: Props) => {
  const { devices, plan, maxDevices, loading, error, revoke } = useAccountDevices(scope);
  const currentDeviceId = getDeviceId();
  const [revoking, setRevoking] = useState<string | null>(null);

  const handleRevoke = async (d: AccountDevice) => {
    setRevoking(d.id);
    try {
      await revoke(d.id);
      toast.success("Dispositivo revogado.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao revogar.");
    } finally {
      setRevoking(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6 text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando dispositivos…
      </div>
    );
  }
  if (error) {
    return <p className="py-4 text-center text-xs text-destructive">{error}</p>;
  }

  if (devices.length === 0) {
    return (
      <p className="rounded-md border border-border/40 bg-background/40 px-4 py-6 text-center text-xs text-muted-foreground">
        Nenhum dispositivo registrado.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {scope === "mine" && (
        <div className="mb-2 flex items-center justify-between rounded-md border border-border/40 bg-background/40 px-4 py-2 text-xs">
          <span className="text-muted-foreground">Plano atual</span>
          <span className="font-semibold uppercase text-primary">{plan}</span>
          <span className="text-muted-foreground">
            {devices.length}/{maxDevices === 999 ? "∞" : maxDevices} dispositivos
          </span>
        </div>
      )}

      <ul className="space-y-2">
        {devices.map((d) => {
          const isCurrent = d.device_id === currentDeviceId;
          return (
            <li
              key={d.id}
              className="flex items-start justify-between gap-3 rounded-md border border-border/50 bg-background/40 px-4 py-3"
            >
              <div className="flex min-w-0 gap-3">
                <Laptop className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <div className="min-w-0 space-y-0.5">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {d.device_label ?? "Dispositivo"}
                    {isCurrent && (
                      <Badge variant="outline" className="ml-2 border-success/40 text-success text-[9px]">
                        ESTE NAVEGADOR
                      </Badge>
                    )}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Último acesso: {new Date(d.last_seen_at).toLocaleString("pt-BR")}
                  </p>
                  {d.ip_address && (
                    <p className="font-mono text-[10px] text-muted-foreground/70">
                      IP: {d.ip_address}
                    </p>
                  )}
                  {showOwner && d.license?.client_email && (
                    <p className="text-[10px] text-muted-foreground/70">
                      Conta: {d.license.client_name} · {d.license.client_email}
                    </p>
                  )}
                  {d.license_key_masked && (
                    <p className="font-mono text-[10px] text-muted-foreground/70">
                      Token: {d.license_key_masked}
                    </p>
                  )}
                </div>
              </div>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-destructive hover:bg-destructive/10"
                    disabled={revoking === d.id}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Revogar este dispositivo?</AlertDialogTitle>
                    <AlertDialogDescription>
                      {isCurrent ? (
                        <>
                          Este é o navegador que você está usando agora. Ao revogar,
                          você precisará validar a licença novamente no próximo acesso.
                        </>
                      ) : (
                        <>
                          O acesso ao painel pelo dispositivo "{d.device_label}" será bloqueado.
                          A pessoa terá que validar a licença novamente.
                        </>
                      )}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => handleRevoke(d)}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Revogar
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </li>
          );
        })}
      </ul>

      <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <ShieldCheck className="h-3 w-3 text-primary" />
        Cada dispositivo precisa validar o token da licença no primeiro acesso.
      </p>
    </div>
  );
};
