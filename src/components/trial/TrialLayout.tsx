// Layout dedicado da área Free Trial.
//
// Estrutura intencionalmente mais enxuta que o AdminLayout:
//   - Sem sidebar de áreas Pro (Mail, Segurança, Personagens Reais...).
//   - Header destacando que o usuário está em modo gratuito.
//   - Botão de upgrade sempre visível.
//
// Aqui só liberamos o que o trial pode fazer hoje:
// edição manual de templates iniciais (CLS) + visualização do catálogo.
import { Link, NavLink, Outlet } from "react-router-dom";
import { LogOut, Shield, Sparkles, Boxes } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useAppSettings } from "@/hooks/useAppSettings";
import { useServers } from "@/hooks/useServers";
import { cn } from "@/lib/utils";

const TRIAL_NAV = [
  { to: "/trial/templates", label: "Templates iniciais", icon: Boxes },
];

export const TrialLayout = () => {
  const { user, signOut } = useAuth();
  const { settings } = useAppSettings();
  const { active: activeServer } = useServers();

  return (
    <div className="flex h-screen w-full flex-col bg-hero">
      {/* Faixa de modo trial — visualmente distinta do /admin. */}
      <div className="flex flex-wrap items-center gap-3 border-b border-primary/40 bg-primary/10 px-4 py-2 text-[12px]">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
          <Sparkles className="h-3 w-3" />
          Free Trial
        </span>
        <span className="text-foreground/90">
          Modo <strong>gratuito</strong>: você só pode editar manualmente os{" "}
          <strong>templates iniciais</strong>. Recursos Pro ficam disponíveis após
          o upgrade.
        </span>
        <Link
          to="/pricing"
          className="ml-auto rounded-md bg-primary px-3 py-1 text-[11px] font-bold text-primary-foreground hover:brightness-110"
        >
          Fazer upgrade
        </Link>
      </div>

      {/* Top bar */}
      <header className="flex flex-wrap items-center gap-3 border-b border-border bg-card/60 px-5 py-3 backdrop-blur-md">
        {settings.logo_url ? (
          <img src={settings.logo_url} alt="" className="h-6 w-6 rounded object-cover" />
        ) : (
          <Shield className="h-5 w-5 text-primary" />
        )}
        <div className="min-w-0">
          <h1 className="truncate text-sm font-extrabold uppercase tracking-wider text-foreground">
            {settings.server_name} · trial
          </h1>
          <p className="text-[11px] text-muted-foreground">
            Acesso gratuito · edição manual de templates
          </p>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {activeServer ? (
            <Link
              to="/servers"
              className="inline-flex max-w-[280px] items-center gap-2 rounded-full border border-success/40 bg-success/10 px-3 py-1 text-[11px] font-medium text-success transition-smooth hover:bg-success/20"
              title={`Servidor ativo: ${activeServer.server_name}`}
            >
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-success" />
              <span className="truncate font-semibold">{activeServer.server_name}</span>
            </Link>
          ) : (
            <Link
              to="/servers"
              className="inline-flex items-center gap-2 rounded-full border border-destructive/40 bg-destructive/10 px-3 py-1 text-[11px] font-medium text-destructive transition-smooth hover:bg-destructive/20"
            >
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-destructive" />
              Sem servidor ativo
            </Link>
          )}
          {user && (
            <span
              className="hidden text-[11px] text-muted-foreground sm:inline"
              title={user.email ?? ""}
            >
              {user.email}
            </span>
          )}
          <button
            onClick={signOut}
            className="inline-flex items-center gap-2 rounded-md border border-border bg-card/60 px-3 py-2 text-xs transition-smooth hover:border-destructive/50 hover:text-destructive"
            title="Sair"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sair
          </button>
        </div>
      </header>

      {/* Sub-nav minimalista */}
      <nav className="flex items-center gap-1 border-b border-border bg-card/40 px-3 py-1">
        {TRIAL_NAV.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground",
                  isActive && "bg-primary/10 text-primary",
                )
              }
            >
              <Icon className="h-3.5 w-3.5" />
              {item.label}
            </NavLink>
          );
        })}
      </nav>

      <main className="flex-1 overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
};
