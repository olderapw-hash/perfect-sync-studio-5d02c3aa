// /admin/security — Hub de segurança: links para membros, auditoria e
// configurações do servidor. Usado como landing do grupo Segurança.
import { Link } from "react-router-dom";
import {
  ChevronRight,
  Settings as SettingsIcon,
  ShieldCheck,
  Users as UsersIcon,
} from "lucide-react";
import { useServerPermissions } from "@/hooks/useServerPermissions";
import { useAuth } from "@/hooks/useAuth";

const SecurityOverviewPage = () => {
  const { can } = useServerPermissions();
  const { isSuperadmin } = useAuth();

  const cards = [
    {
      to: "/admin/members",
      icon: UsersIcon,
      title: "Membros & permissões",
      desc: "Convide novos editores, defina papéis e ajuste permissões finas.",
      enabled: isSuperadmin || can("manage_members"),
    },
    {
      to: "/admin/audit",
      icon: ShieldCheck,
      title: "Auditoria",
      desc: "Histórico de cada save, restore, clear e bulk apply.",
      enabled: isSuperadmin || can("view_audit"),
    },
    {
      to: "/admin/security/settings",
      icon: SettingsIcon,
      title: "Configurações",
      desc: "Branding, conexão com a VPS e identidade visual do servidor.",
      enabled: true,
    },
  ];

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mx-auto max-w-3xl">
        <header className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-primary">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-extrabold tracking-tight text-foreground">
              Segurança
            </h1>
            <p className="text-xs text-muted-foreground">
              Quem tem acesso, o que cada um pode fazer e o que foi feito.
            </p>
          </div>
        </header>

        <div className="grid gap-3">
          {cards.map((c) => {
            const Icon = c.icon;
            const Card = (
              <div
                className={
                  "group flex items-center gap-4 rounded-xl border border-border bg-card/60 p-4 transition-smooth " +
                  (c.enabled
                    ? "hover:border-primary/40 hover:bg-card/80"
                    : "cursor-not-allowed opacity-50")
                }
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-background/40 text-primary">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-bold text-foreground">
                    {c.title}
                  </h3>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {c.desc}
                  </p>
                </div>
                {c.enabled && (
                  <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
                )}
              </div>
            );
            return c.enabled ? (
              <Link key={c.to} to={c.to}>
                {Card}
              </Link>
            ) : (
              <div key={c.to}>{Card}</div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default SecurityOverviewPage;
