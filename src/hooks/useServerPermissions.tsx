// Hook que expõe as permissões efetivas do usuário no servidor ATIVO.
//
// Lê via RPC `get_my_server_permissions(tenant_id)` que já respeita
// owner implícito + jsonb override. Retorna defaults conservadores
// (tudo false) enquanto carrega ou se não houver servidor ativo —
// assim a UI nunca "vaza" um botão antes da checagem.
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useServers } from "@/hooks/useServers";
import { useSubscription } from "@/hooks/useSubscription";

export type ServerPermissionKey =
  | "view"
  | "save_templates"
  | "save_real_roles"
  | "restore_backup"
  | "compare_backup"
  | "clear_sections"
  | "bulk_apply"
  | "manage_servers"
  | "view_audit"
  | "manage_members"
  | "manage_kits"
  | "manage_security";

export type ServerRole = "owner" | "admin" | "editor" | "readonly";

export type PermissionMap = Record<ServerPermissionKey, boolean>;

const ALL_PERMISSION_KEYS: ServerPermissionKey[] = [
  "view",
  "save_templates",
  "save_real_roles",
  "restore_backup",
  "compare_backup",
  "clear_sections",
  "bulk_apply",
  "manage_servers",
  "view_audit",
  "manage_members",
  "manage_kits",
  "manage_security",
];

const FALSE_MAP: PermissionMap = ALL_PERMISSION_KEYS.reduce((acc, k) => {
  acc[k] = false;
  return acc;
}, {} as PermissionMap);

const TRUE_MAP: PermissionMap = ALL_PERMISSION_KEYS.reduce((acc, k) => {
  acc[k] = true;
  return acc;
}, {} as PermissionMap);

/**
 * Mapa efetivo no modo TRIAL: apenas leitura ampla + edição manual de
 * templates iniciais. Tudo que automatiza ou afeta personagens reais
 * fica bloqueado, mesmo que o role no servidor (ou owner) liberasse.
 *
 * Permitido: view, save_templates (clsconfig manual).
 * Bloqueado: bulk_apply, clear_sections, restore_backup, save_real_roles,
 *            manage_security, manage_kits, manage_members, manage_servers, etc.
 */
const TRIAL_MAP: PermissionMap = {
  ...FALSE_MAP,
  view: true,
  save_templates: true,
  // compare_backup é só leitura → seguro liberar.
  compare_backup: true,
};

function normalize(input: unknown): PermissionMap {
  if (!input || typeof input !== "object") return { ...FALSE_MAP };
  const src = input as Record<string, unknown>;
  const out: PermissionMap = { ...FALSE_MAP };
  for (const k of ALL_PERMISSION_KEYS) {
    out[k] = src[k] === true;
  }
  return out;
}

interface CtxValue {
  loading: boolean;
  tenantId: string | null;
  role: ServerRole | null;
  permissions: PermissionMap;
  /** Atalho prático: `can("save_templates")`. */
  can: (perm: ServerPermissionKey) => boolean;
  /** True quando o usuário está no modo Free Trial. */
  isTrial: boolean;
  refetch: () => Promise<void>;
}

const Ctx = createContext<CtxValue>({
  loading: true,
  tenantId: null,
  role: null,
  permissions: { ...FALSE_MAP },
  can: () => false,
  isTrial: false,
  refetch: async () => {},
});

export const ServerPermissionsProvider = ({ children }: { children: ReactNode }) => {
  const { session, isSuperadmin } = useAuth();
  const { active, loading: serversLoading } = useServers();
  const { isTrial, plan, loading: subLoading } = useSubscription();
  const [permissions, setPermissions] = useState<PermissionMap>({ ...FALSE_MAP });
  const [role, setRole] = useState<ServerRole | null>(null);
  const [loading, setLoading] = useState(true);

  const tenantId = active?.id ?? null;

  const fetchPermissions = async () => {
    if (!session?.user) {
      setRole(null);
      setPermissions({ ...FALSE_MAP });
      setLoading(false);
      return;
    }

    // Superadmin global do app → tudo true (mesmo sem tenant ativo).
    if (isSuperadmin && !tenantId) {
      setRole("owner");
      setPermissions({ ...TRUE_MAP });
      setLoading(false);
      return;
    }

    if (!tenantId) {
      setRole(null);
      setPermissions({ ...FALSE_MAP });
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data, error } = await supabase.rpc("get_my_server_permissions", {
      _tenant_id: tenantId,
    });
    if (error || !data) {
      setRole(null);
      setPermissions({ ...FALSE_MAP });
    } else {
      const obj = data as { role?: ServerRole; permissions?: unknown };
      setRole(obj.role ?? null);
      setPermissions(normalize(obj.permissions));
    }
    setLoading(false);
  };

  useEffect(() => {
    if (serversLoading) return;
    void fetchPermissions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id, tenantId, isSuperadmin, serversLoading]);

  // Clamp por plano (aplicado APÓS o role do servidor):
  // - trial / free / iniciante → mapa enxuto.
  // - pro                      → bloqueia Server Ops/Instances (manage_servers).
  // - ultimate                 → libera tudo permitido pelo role.
  // Superadmin escapa do clamp pra continuar testando o painel completo.
  const effectivePermissions = useMemo<PermissionMap>(() => {
    if (isSuperadmin) return permissions;
    if (isTrial) return { ...TRIAL_MAP };
    if (plan === "free") return { ...TRIAL_MAP };
    if (plan === "iniciante") {
      // Iniciante: pode cadastrar/operar a própria VPS, mas sem automações
      // avançadas (bulk_apply, clear_sections, restore_backup, save_real_roles,
      // manage_kits, manage_security, manage_members, view_audit).
      return {
        ...TRIAL_MAP,
        manage_servers: true,
      };
    }
    if (plan === "pro") {
      return { ...permissions, manage_servers: false };
    }
    return permissions; // ultimate
  }, [isTrial, plan, isSuperadmin, permissions]);

  const value = useMemo<CtxValue>(
    () => ({
      loading: loading || subLoading,
      tenantId,
      role,
      permissions: effectivePermissions,
      can: (perm) => effectivePermissions[perm] === true,
      isTrial: isTrial && !isSuperadmin,
      refetch: fetchPermissions,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [loading, subLoading, tenantId, role, effectivePermissions, isTrial, isSuperadmin],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

export const useServerPermissions = () => useContext(Ctx);

/** Componente helper: renderiza children só se a permissão for true. */
export const Can = ({
  perm,
  children,
  fallback = null,
}: {
  perm: ServerPermissionKey;
  children: ReactNode;
  fallback?: ReactNode;
}) => {
  const { can, loading } = useServerPermissions();
  if (loading) return null;
  return can(perm) ? <>{children}</> : <>{fallback}</>;
};
