// Mapa central de actions da API → permissão exigida.
// Usado tanto no front (esconder/disable) quanto na edge function
// (clsconfig-proxy) para enforcement.
//
// Mantém alinhado com server_members.permissions:
//   view, save_templates, save_real_roles, restore_backup,
//   compare_backup, clear_sections, bulk_apply, manage_servers,
//   view_audit, manage_members.

import type { ServerPermissionKey } from "@/hooks/useServerPermissions";

/** Action HTTP do api_cls.php → permissão exigida no painel. */
export const ACTION_PERMISSION: Record<string, ServerPermissionKey> = {
  // leitura
  getClsconfig: "view",
  getClsconfigDebug: "view",
  getItemCatalog: "view",
  getSkillCatalog: "view",
  getAccountCharacters: "view",
  listBackups: "view",
  getRoleEditable: "view",

  // escrita "template"
  saveClsconfigTemplate: "save_templates",

  // escrita em personagem real
  saveRoleEditable: "save_real_roles",
  saveStatus: "save_real_roles",
  saveInventory: "save_real_roles",

  // backups
  restoreBackup: "restore_backup",

  // operação do servidor (v1: leitura + export)
  getServiceStatus: "view",
  getServerLogs: "view_audit",
  exportClsconfig: "save_templates",

  // operação do servidor (v2: mensagem global + manutenção)
  sendSystemMessage: "save_templates",
  getMaintenanceMode: "view",
  setMaintenanceMode: "manage_servers",

  // operação do servidor v3 (controle real de instâncias)
  getManageableServices: "view",
  startService: "manage_servers",
  stopService: "manage_servers",
  restartService: "manage_servers",
  // Server Ops v4 — controle do servidor inteiro (autostart-aware).
  startServer: "manage_servers",
  stopServer: "manage_servers",
  restartServer: "manage_servers",
  getServerOperationStatus: "view",
  getServerOperationsHistory: "view_audit",

  // segurança (kick/ban/unban + histórico)
  kickRole: "manage_security",
  banAccount: "manage_security",
  unbanAccount: "manage_security",
  clearRolePk: "manage_security",
  listSecurityHistory: "view_audit",

  // GM Commander v2 — Bulk Operations
  searchPlayerDirectory: "manage_security",
  resolveBulkTargets: "manage_security",
  previewBulkTargets: "manage_security",
  queueBulkCommand: "manage_security",
  getBulkCommandJob: "view_audit",
  getBulkCommandJobs: "view_audit",

  // GM Commander v3 — Punições rápidas / Broadcast / Meridiano-Títulos.
  getQuickPunishmentCatalog: "view",
  previewQuickPunishment: "manage_security",
  executeQuickPunishment: "manage_security",
  queueBroadcastMessage: "save_templates",
  getMeridianTitlePresetCatalog: "view",
  previewMeridianTitlePreset: "view",
  applyMeridianTitlePreset: "manage_servers",
};

/** Operações UI que mapeiam pra mais de uma action. */
export const UI_PERMISSION = {
  bulkApply: "bulk_apply",
  clearSections: "clear_sections",
  compareBackup: "compare_backup",
} as const;
