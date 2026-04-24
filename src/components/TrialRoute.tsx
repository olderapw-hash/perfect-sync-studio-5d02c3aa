// Guard da área /trial.
//
// Regras:
//   - Sem sessão → /auth.
//   - Sem assinatura ativa E sem trial → /pricing.
//   - Já é assinante pago (não-trial) → /admin (não faz sentido ficar no trial).
//   - Superadmin: livre.
import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";

export const TrialRoute = ({ children }: { children: React.ReactNode }) => {
  const { session, isSuperadmin, loading } = useAuth();
  const { isActive, isTrial, loading: subLoading } = useSubscription();

  if (loading || subLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-hero">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!session) return <Navigate to="/auth" replace />;
  if (isSuperadmin) return <>{children}</>;

  // Assinante pago vai pro painel completo.
  if (isActive && !isTrial) return <Navigate to="/admin" replace />;

  // Sem nenhum tipo de acesso — manda escolher um plano.
  if (!isActive && !isTrial) return <Navigate to="/pricing" replace />;

  return <>{children}</>;
};
