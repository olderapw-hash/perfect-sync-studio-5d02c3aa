// Tutorial inline que aparece dentro do /admin quando o usuário ainda não
// configurou um servidor PW (tenant.onboarding_completed = false). Ele orienta
// passo a passo a configuração do api_cls.php e leva pro wizard completo em
// /onboarding. Pode ser dispensado e fica registrado em localStorage por usuário.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  CheckCircle2,
  ExternalLink,
  Rocket,
  Server,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";

const DISMISS_KEY = (uid: string) => `server-setup-tutorial:dismissed:${uid}`;

export const ServerSetupTutorial = () => {
  const { user } = useAuth();
  const { tenant, loading } = useTenant();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    if (!user) return;
    setDismissed(localStorage.getItem(DISMISS_KEY(user.id)) === "1");
  }, [user]);

  if (loading || !user) return null;
  // Tutorial só aparece para usuários cujo servidor ainda não foi configurado.
  if (tenant?.onboarding_completed) return null;
  if (dismissed) return null;

  const close = () => {
    if (user) localStorage.setItem(DISMISS_KEY(user.id), "1");
    setDismissed(true);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-primary/40 bg-card shadow-2xl">
        <button
          onClick={close}
          className="absolute right-3 top-3 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Fechar tutorial"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="border-b border-border/60 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold uppercase tracking-wider text-foreground">
                Bem-vindo ao Orphea Core!
              </h2>
              <p className="text-xs text-muted-foreground">
                Vamos configurar seu primeiro servidor em poucos passos
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4 p-6">
          <p className="text-sm text-muted-foreground">
            Seu painel está pronto. Falta apenas conectar ele ao seu servidor Perfect
            World instalando o <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">api_cls.php</code> na sua VPS.
          </p>

          <ol className="space-y-3">
            <Step
              icon={ShieldCheck}
              title="Licença ativada"
              desc="Pronto — seu dispositivo já foi autorizado."
              done
            />
            <Step
              icon={Server}
              title="Cadastrar dados do servidor"
              desc="Nome do servidor, URL da API (com IP e porta) e secret de autenticação."
            />
            <Step
              icon={ExternalLink}
              title="Instalar o api_cls.php na VPS"
              desc="Baixe o arquivo, suba pra /var/www/html/apicls/ e cole o secret gerado."
            />
            <Step
              icon={Rocket}
              title="Testar conexão e abrir painel"
              desc="Clicamos em 'Testar conexão' e seu painel já fica operacional."
            />
          </ol>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border/60 bg-muted/20 px-6 py-4">
          <Button variant="ghost" size="sm" onClick={close}>
            Configurar depois
          </Button>
          <Button asChild>
            <Link to="/onboarding">
              <Rocket className="mr-2 h-4 w-4" />
              Configurar servidor agora
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
};

const Step = ({
  icon: Icon,
  title,
  desc,
  done,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc: string;
  done?: boolean;
}) => (
  <li className="flex gap-3 rounded-lg border border-border/60 bg-background/40 p-3">
    <div
      className={
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-md " +
        (done ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground")
      }
    >
      {done ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
    </div>
    <div className="min-w-0">
      <p className="text-sm font-bold text-foreground">{title}</p>
      <p className="text-xs text-muted-foreground">{desc}</p>
    </div>
  </li>
);
