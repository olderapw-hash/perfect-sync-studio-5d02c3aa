// Página pública de aceite de convites.
// Acessível por qualquer usuário logado (não exige role admin global),
// pra que membros convidados consigam aceitar antes de ter acesso ao /admin.
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CheckCircle2, Loader2, LogOut, Mail, ShieldAlert, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useMyPendingInvites } from "@/hooks/useServerMembers";
import { Button } from "@/components/ui/button";

const Invites = () => {
  const navigate = useNavigate();
  const { session, loading: authLoading, signOut } = useAuth();
  const { invites, loading, refetch } = useMyPendingInvites();
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !session) navigate("/auth", { replace: true });
  }, [authLoading, session, navigate]);

  const accept = async (id: string) => {
    setBusyId(id);
    const { error } = await supabase.rpc("accept_server_invite" as never, {
      _invite_id: id,
    } as never);
    setBusyId(null);
    if (error) {
      toast.error("Erro ao aceitar: " + error.message);
      return;
    }
    toast.success("Convite aceito! Você agora é membro do servidor.");
    await refetch();
  };

  const decline = async (id: string) => {
    setBusyId(id);
    const { error } = await supabase
      .from("server_invites")
      .update({ status: "revoked" })
      .eq("id", id);
    setBusyId(null);
    if (error) {
      toast.error("Erro: " + error.message);
      return;
    }
    toast.success("Convite recusado");
    await refetch();
  };

  if (authLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const userEmail = session?.user.email ?? "";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60 bg-card/30">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/15">
              <Mail className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h1 className="text-sm font-extrabold uppercase tracking-wider">
                Meus Convites
              </h1>
              <p className="text-xs text-muted-foreground">
                Logado como <span className="font-mono">{userEmail}</span>
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={signOut}>
            <LogOut className="mr-2 h-4 w-4" /> Sair
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">
        {invites.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/30 p-12 text-center">
            <Mail className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Nenhum convite pendente para <span className="font-mono">{userEmail}</span>.
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Se você esperava um convite, peça pra quem te convidou conferir se o e-mail
              está exatamente igual ao que você usa pra entrar.
            </p>
            <div className="mt-6 flex justify-center gap-2">
              <Button asChild variant="outline" size="sm">
                <Link to="/admin">Ir para o painel</Link>
              </Button>
              <Button asChild size="sm">
                <Link to="/servers">Meus servidores</Link>
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-md border border-primary/30 bg-primary/10 p-3 text-xs">
              Você foi convidado para participar de{" "}
              <span className="font-bold">
                {invites.length} servidor{invites.length > 1 ? "es" : ""}
              </span>
              . Aceite abaixo pra ganhar acesso.
            </div>

            {invites.map((inv) => (
              <div
                key={inv.id}
                className="rounded-xl border border-border bg-card/40 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                        {inv.role}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        Expira em{" "}
                        {new Date(inv.expires_at).toLocaleDateString("pt-BR")}
                      </span>
                    </div>
                    <p className="mt-2 text-sm">
                      Você foi convidado como{" "}
                      <span className="font-bold">{inv.role}</span>.
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Convite enviado em{" "}
                      {new Date(inv.invited_at).toLocaleString("pt-BR")}.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => accept(inv.id)}
                      disabled={busyId === inv.id}
                    >
                      {busyId === inv.id ? (
                        <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <CheckCircle2 className="mr-2 h-3.5 w-3.5" />
                      )}
                      Aceitar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={() => decline(inv.id)}
                      disabled={busyId === inv.id}
                    >
                      <X className="mr-2 h-3.5 w-3.5" /> Recusar
                    </Button>
                  </div>
                </div>
              </div>
            ))}

            <div className="mt-6 flex justify-end gap-2">
              <Button asChild variant="outline" size="sm">
                <Link to="/servers">Ver meus servidores</Link>
              </Button>
              <Button asChild size="sm">
                <Link to="/admin">Ir para o painel</Link>
              </Button>
            </div>
          </div>
        )}

        <div className="mt-8 rounded-md border border-border bg-card/40 p-3 text-[11px] text-muted-foreground">
          <ShieldAlert className="mr-2 inline h-3 w-3" />
          Convites são casados pelo e-mail. O e-mail mostrado acima precisa ser
          exatamente o que foi usado no convite.
        </div>
      </main>
    </div>
  );
};

export default Invites;
