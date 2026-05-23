import { useState } from "react";
import { Loader2, ShieldCheck, AlertTriangle, Copy, Trash2 } from "lucide-react";
import { useDeviceValidation, registerCurrentDevice } from "@/hooks/useAccountDevices";
import { supabase } from "@/integrations/supabase/client";
import { getDeviceId } from "@/hooks/useDeviceId";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

/**
 * Bloqueia o painel até que o dispositivo atual esteja validado contra a licença
 * do usuário. Renderiza os children quando OK.
 */
export const DeviceValidationGate = ({ children }: { children: React.ReactNode }) => {
  const { result, checking, error, recheck } = useDeviceValidation();
  const [tokenInput, setTokenInput] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (checking) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-xs uppercase tracking-wider">Verificando dispositivo…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="max-w-md rounded-lg border border-destructive/40 bg-destructive/5 p-6 text-center">
          <AlertTriangle className="mx-auto h-10 w-10 text-destructive" />
          <h2 className="mt-3 text-base font-bold">Erro de validação</h2>
          <p className="mt-2 text-sm text-muted-foreground">{error}</p>
          <Button size="sm" className="mt-4" onClick={recheck}>
            Tentar novamente
          </Button>
        </div>
      </div>
    );
  }

  if (!result || result.status === "ok") return <>{children}</>;

  const max = result.max_devices ?? 1;
  const current = result.devices_count ?? 0;
  const limitReached = current >= max;

  const handleSubmit = async () => {
    if (!tokenInput.trim()) {
      toast.error("Cole o token da licença.");
      return;
    }
    setSubmitting(true);
    try {
      await registerCurrentDevice(tokenInput.trim());
      toast.success("Dispositivo autorizado!");
      await recheck();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao validar.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevokeOther = async (id: string) => {
    try {
      await supabase.functions.invoke("device-manager", {
        body: { action: "revoke", id },
      });
      await recheck();
      toast.success("Dispositivo revogado.");
    } catch {
      toast.error("Erro ao revogar dispositivo.");
    }
  };

  return (
    <div className="flex h-full items-center justify-center bg-background/95 p-6 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border border-primary/30 bg-card/90 p-6 shadow-2xl">
        <div className="mb-4 flex items-center gap-3 border-b border-border/60 pb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15">
            <ShieldCheck className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-foreground">
              Validar este dispositivo
            </h2>
            <p className="text-[11px] text-muted-foreground">
              Plano <span className="font-semibold text-primary">{result.plan}</span> · {current}/{max} dispositivos
            </p>
          </div>
        </div>

        <p className="text-xs leading-relaxed text-muted-foreground">
          Para acessar o painel neste navegador, cole o token da sua licença. Você só precisa fazer isso uma vez por dispositivo.
        </p>

        <p className="mt-3 rounded-md border border-border/60 bg-background/60 p-3 text-[11px] text-muted-foreground">
          A chave de ativação foi enviada para o seu e-mail de confirmação de cadastro. Você também pode consultá-la em <span className="font-semibold text-foreground">Minha conta</span> após validar este dispositivo.
        </p>

        <div className="mt-4 space-y-2">
          <Label className="text-xs">Token da licença</Label>
          <Input
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            placeholder="Cole o token aqui…"
            className="font-mono text-xs"
            autoFocus
          />
          <Button
            className="w-full"
            onClick={handleSubmit}
            disabled={submitting || !tokenInput.trim()}
          >
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Validar dispositivo
          </Button>
        </div>

        {limitReached && (result.active_devices?.length ?? 0) > 0 && (
          <div className="mt-5 rounded-md border border-warning/40 bg-warning/5 p-3">
            <p className="mb-2 text-[11px] font-semibold text-warning">
              Limite atingido. Revogue um dispositivo abaixo para liberar espaço:
            </p>
            <ul className="space-y-1.5">
              {result.active_devices!.map((d) => {
                const isCurrent = d.device_id === getDeviceId();
                return (
                  <li
                    key={d.id}
                    className="flex items-center justify-between rounded border border-border/60 bg-background/60 px-2.5 py-1.5 text-[11px]"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-foreground">
                        {d.device_label ?? "Dispositivo"}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {isCurrent ? "Este navegador" : `Último uso: ${new Date(d.last_seen_at).toLocaleString("pt-BR")}`}
                      </p>
                    </div>
                    {!isCurrent && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-2 text-destructive hover:bg-destructive/10"
                        onClick={() => handleRevokeOther(d.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};
