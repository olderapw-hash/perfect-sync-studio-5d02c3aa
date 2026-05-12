// Contexto de permissões do operador, resolvido pela VPS.
// A VPS é a autoridade final — a UI nunca assume permissões localmente.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  EndpointMissingError,
  pwApi,
  type OperatorPermissions,
  type OperatorRole,
} from "@/lib/pwApiActions";

/* ─── Mapeamento: action GM → chave de permissão ─── */

const ACTION_PERMISSION_MAP: Record<string, keyof OperatorPermissions> = {
  // Leitura (viewer+)
  getGmCommandCatalog: "read",
  getGmActionHistory: "read",
  getGmPermissionCatalog: "read",
  getGmPermissionState: "read",
  getMallCashBalance: "read",
  // Compensação: sendMailItem, sendMailGold (gm_operator+)
  sendMailItem: "bulk_rewards",
  sendMailGold: "bulk_rewards",
  // Comunicação (gm_supervisor+)
  sendSystemMessage: "broadcast",
  // Cash & GM Permissions (gm_admin+)
  grantMallCash: "cash_and_gm_permissions",
  grantGmPermission: "cash_and_gm_permissions",
  revokeGmPermission: "cash_and_gm_permissions",
  // Moderação básica (gm_operator+)
  kickRole: "bulk_rewards",
  banAccount: "bulk_rewards",
  unbanAccount: "bulk_rewards",
  muteAccount: "bulk_rewards",
  muteRole: "bulk_rewards",
  clearRolePk: "bulk_rewards",
  // Bulk operations (gm_operator+)
  searchPlayerDirectory: "bulk_rewards",
  resolveBulkTargets: "bulk_rewards",
  previewBulkTargets: "bulk_rewards",
  queueBulkCommand: "bulk_rewards",
  getBulkCommandJob: "bulk_rewards",
  getBulkCommandJobs: "bulk_rewards",
  saveBulkTemplate: "bulk_rewards",
  getBulkTemplate: "bulk_rewards",
  getBulkTemplates: "bulk_rewards",
  updateBulkTemplate: "bulk_rewards",
  deleteBulkTemplate: "bulk_rewards",
  previewBulkTemplate: "bulk_rewards",
  executeBulkTemplate: "bulk_rewards",
  // Restore & role edit (super_admin only)
  restoreNow: "restore_and_role_edit",
  restoreBackup: "restore_and_role_edit",
  saveRoleEditable: "restore_and_role_edit",
  saveClsconfigTemplate: "restore_and_role_edit",
  // Server Ops / Instances / Control Center — leitura viewer+, controle gm_admin+.
  getServiceStatus: "read",
  getServerLogs: "read",
  getMaintenanceMode: "read",
  getManageableServices: "read",
  getServerOperationStatus: "read",
  getServerOperationsHistory: "read",
  startService: "cash_and_gm_permissions",
  stopService: "cash_and_gm_permissions",
  restartService: "cash_and_gm_permissions",
  startServer: "cash_and_gm_permissions",
  stopServer: "cash_and_gm_permissions",
  restartServer: "cash_and_gm_permissions",
  setMaintenanceMode: "cash_and_gm_permissions",
  exportClsconfig: "cash_and_gm_permissions",
  // Control Center / Instances — leitura viewer+, controle gm_admin+.
  getControlCenterSnapshot: "read",
  getManageableInstances: "read",
  startInstance: "cash_and_gm_permissions",
  startInstances: "cash_and_gm_permissions",
  stopInstance: "cash_and_gm_permissions",
  stopInstances: "cash_and_gm_permissions",
  restartInstance: "cash_and_gm_permissions",
  restartInstances: "cash_and_gm_permissions",
  setInstanceAutoStart: "cash_and_gm_permissions",
  // Watchdog — leitura viewer+, controle gm_admin+.
  getWatchdogStatus: "read",
  getWatchdogHistory: "read",
  saveWatchdogConfig: "cash_and_gm_permissions",
  enableWatchdog: "cash_and_gm_permissions",
  disableWatchdog: "cash_and_gm_permissions",
  runWatchdogCheckNow: "cash_and_gm_permissions",
  // Backups & Restore — leitura viewer+, escrita gm_admin+, restore super_admin.
  backupNow: "cash_and_gm_permissions",
  backupGamedbd: "cash_and_gm_permissions",
  listPanelBackups: "read",
  listBackups: "read",
  getRestorePlan: "read",
  getRestoreHistory: "read",
  // restoreNow / restoreBackup já mapeados acima como restore_and_role_edit.
  // Operator Registry (super_admin only)
  getOperatorRegistry: "restore_and_role_edit",
  saveOperatorRegistryEntry: "restore_and_role_edit",
  deleteOperatorRegistryEntry: "restore_and_role_edit",
  // Rank PvP — leitura para todos, execução/agendamento gm_admin+.
  getPvpRankingLeaderboard: "read",
  getPvpRankingRewardHistory: "read",
  getPvpRankingRewardSchedules: "read",
  previewPvpRankingRewards: "read",
  executePvpRankingRewards: "cash_and_gm_permissions",
  savePvpRankingRewardSchedule: "cash_and_gm_permissions",
  deletePvpRankingRewardSchedule: "cash_and_gm_permissions",
  // GM Commander v3 — Punições rápidas / Broadcast / Meridiano-Títulos.
  // Meridiano/Títulos: leitura é viewer+, preview/apply é gm_operator+
  // (alinhado ao backend; required_role do preset faz o gating fino).
  getQuickPunishmentCatalog: "read",
  previewQuickPunishment: "bulk_rewards",
  executeQuickPunishment: "bulk_rewards",
  queueBroadcastMessage: "broadcast",
  getMeridianTitlePresetCatalog: "read",
  previewMeridianTitlePreset: "bulk_rewards",
  applyMeridianTitlePreset: "bulk_rewards",
};

interface OperatorState {
  /** Permissões resolvidas pela VPS. null = ainda carregando ou endpoint ausente. */
  permissions: OperatorPermissions | null;
  /** Role do operador conforme registry da VPS. */
  role: OperatorRole | null;
  /** Operador identificado (id / email). */
  operator: { id: string; email: string; name?: string } | null;
  /** Modo atual do backend: audit (permite tudo) ou enforce (bloqueia). */
  mode: "audit" | "enforce" | null;
  /** true enquanto carregando o estado inicial. */
  loading: boolean;
  /** Se o endpoint não existe na VPS (versão antiga). */
  endpointMissing: boolean;
  /** Erro ao carregar. */
  error: string | null;
  /** Recarrega o estado da VPS. */
  refresh: () => Promise<void>;
  /** Verifica se uma action GM é permitida para este operador. */
  canAction: (action: string) => boolean;
}

const DEFAULT_STATE: OperatorState = {
  permissions: null,
  role: null,
  operator: null,
  mode: null,
  loading: true,
  endpointMissing: false,
  error: null,
  refresh: async () => {},
  canAction: () => true,
};

const Ctx = createContext<OperatorState>(DEFAULT_STATE);

export function OperatorPermissionsProvider({ children }: { children: ReactNode }) {
  const [permissions, setPermissions] = useState<OperatorPermissions | null>(null);
  const [role, setRole] = useState<OperatorRole | null>(null);
  const [operator, setOperator] = useState<{ id: string; email: string; name?: string } | null>(null);
  const [mode, setMode] = useState<"audit" | "enforce" | null>(null);
  const [loading, setLoading] = useState(true);
  const [endpointMissing, setEndpointMissing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await pwApi.getOperatorPermissionState();
      setPermissions(res.permissions);
      setRole(res.operator.role);
      setOperator(res.operator);
      setMode(res.mode);
      setEndpointMissing(false);
    } catch (e) {
      if (e instanceof EndpointMissingError) {
        // VPS antiga sem suporte — libera tudo (fallback).
        setEndpointMissing(true);
        setPermissions({
          read: true,
          bulk_rewards: true,
          broadcast: true,
          cash_and_gm_permissions: true,
          restore_and_role_edit: true,
        });
        setRole(null);
        setMode(null);
      } else {
        setError(e instanceof Error ? e.message : String(e));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const canAction = useCallback(
    (action: string): boolean => {
      // Enquanto carregando, bloqueia.
      if (loading) return false;
      // Se endpoint não existe, libera tudo (VPS antiga).
      if (endpointMissing) return true;
      // Se não conseguimos carregar, bloqueia.
      if (!permissions) return false;
      // Mapeia action → chave de permissão.
      const permKey = ACTION_PERMISSION_MAP[action];
      if (!permKey) {
        // Action não mapeada → bloqueia por segurança (em vez de cair
        // silenciosamente em `read`). Adicione a action ao
        // ACTION_PERMISSION_MAP antes de chamá-la via canAction.
        if (typeof console !== "undefined") {
          console.warn(`[useOperatorPermissions] action sem mapping: ${action}`);
        }
        return false;
      }
      return permissions[permKey];
    },
    [loading, endpointMissing, permissions],
  );

  const value = useMemo<OperatorState>(
    () => ({
      permissions,
      role,
      operator,
      mode,
      loading,
      endpointMissing,
      error,
      refresh,
      canAction,
    }),
    [permissions, role, operator, mode, loading, endpointMissing, error, refresh, canAction],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useOperatorPermissions() {
  return useContext(Ctx);
}
