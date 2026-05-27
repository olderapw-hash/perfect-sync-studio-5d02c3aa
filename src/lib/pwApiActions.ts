// Cliente tipado para as actions extras da VPS (Lote 3).
// Roteia via Edge Function `clsconfig-proxy` que injeta o `x-sync-secret`.
// Modo self-hosted: quando VITE_GAME_PORTAL_ADMIN_SECRET existe, chama api_cls.php direto.
// Cada action tem o contrato documentado em docs/api-contract.md.
import { supabase } from "@/integrations/supabase/client";
import { handleMaybeAuthOrForbidden } from "@/lib/authErrors";

export interface CatalogItemDefaults {
  count?: number;
  max_count?: number;
  proctype?: number;
  expire_date?: number;
  guid1?: number;
  guid2?: number;
  mask?: number;
  data?: string;
  [k: string]: unknown;
}

export interface CatalogItem {
  id: number;
  name: string;
  icon_path?: string;
  tier?: number;
  stack_max?: number;
  max_count?: number;
  type?: string;
  /** Marca quando o PHP devolveu o item via fallback de ID (sem metadados completos). */
  source?: "catalog" | "fallback_id" | string;
  defaults?: CatalogItemDefaults;
}

export interface ItemCatalogResponse {
  success: boolean;
  count: number;
  items: CatalogItem[];
  error?: string;
}

/** Tipo de backup retornado pela VPS. `export_log` é o log do exportClsconfig. */
export type BackupKind = "role_json" | "clsconfig_file" | "export_log";

export interface BackupRecord {
  type: BackupKind;
  file: string;
  /** basename amigável retornado pelo PHP. */
  name?: string;
  /** roleid pode não vir em alguns logs de export — opcional/null. */
  roleid?: number | null;
  /** Tamanho em bytes (PHP retorna `bytes`). */
  bytes?: number;
  /** epoch seconds (PHP retorna `mtime`). */
  mtime?: number;
  /** ISO string (PHP retorna `created_at` como string). */
  created_at?: string;
  sha1?: string;
}

/**
 * Resposta REAL do endpoint na VPS:
 * {
 *   success: true,
 *   backups: {
 *     role_json: BackupRecord[],
 *     clsconfig_files: BackupRecord[],
 *     export_logs: BackupRecord[],
 *     all: BackupRecord[]   // união ordenada por created_at desc
 *   }
 * }
 */
export interface ListBackupsResponse {
  success: boolean;
  backups: {
    role_json?: BackupRecord[];
    clsconfig_files?: BackupRecord[];
    export_logs?: BackupRecord[];
    all?: BackupRecord[];
  };
  error?: string;
}


/**
 * Contrato real do PHP (abr/2026):
 *
 * Request:
 *   { type:"role_json", name:"<basename>", confirm:"RESTORE_ROLE_JSON" }
 *   ou para dry-run:
 *   { type:"role_json", name:"<basename>", dry_run:true }
 *
 * Response (dry_run):
 *   { success:true, dry_run:true, roleid:31, source:{...}, target:{...} }
 *
 * Response (real):
 *   {
 *     success:true,
 *     roleid:31,
 *     restored:{
 *       saved:{
 *         verified:boolean,
 *         backups:{
 *           role_json:{ file:string },
 *           clsconfig_file:{ file:string }
 *         },
 *         export?:{ log_file?:string }
 *       }
 *     }
 *   }
 */
export interface RestoreSavedBlock {
  verified?: boolean;
  backups?: {
    role_json?: { file: string };
    clsconfig_file?: { file: string };
  };
  export?: { log_file?: string };
}

export interface RestoreBackupResponse {
  success: boolean;
  dry_run?: boolean;
  roleid?: number;
  source?: Record<string, unknown>;
  target?: Record<string, unknown>;
  restored?: {
    saved?: RestoreSavedBlock;
    // tolerância pra shapes antigos
    role_json?: boolean;
    clsconfig_file?: boolean;
  };
  verified?: boolean;
  error?: string;
}

export interface RestoreBackupRequest {
  type: "role_json";
  name: string;
  confirm?: "RESTORE_ROLE_JSON";
  dry_run?: boolean;
}

/**
 * Resposta de `getRoleEditable` — espelha o shape de uma entry do
 * getClsconfig, mas vinda do registro REAL do personagem no gamedbd.
 *
 * `template` segue o mesmo schema usado em ClsTemplate (status/inventory/
 * equipment/storehouse/base/summary), permitindo reusar o ClsconfigEditor
 * sem tradução adicional.
 */
export interface GetRoleEditableResponse {
  success: boolean;
  /** True se o personagem está logado (kick antes de editar). */
  online?: boolean;
  /** Snapshot atual do role no gamedbd, no mesmo schema do clsconfig. */
  template?: unknown;
  /** Wrapper opcional usado em algumas versões do PHP. */
  role?: unknown;
  error?: string;
}

/**
 * Payload de `saveRoleEditable`. Aceita tanto o modo "patch parcial"
 * (status/inventory soltos) quanto o modo "template completo" (mesmo
 * shape de saveClsconfigTemplate, porém roteado para o gamedbd real).
 *
 * `export` é opt-in: por padrão NÃO disparamos exportclsconfig em
 * personagens reais (só faz sentido quando o usuário marca a opção
 * avançada na UI).
 */
export interface SaveRoleEditablePayload {
  roleid: number;
  status?: Record<string, number | string>;
  inventory?: unknown;
  equipment?: unknown;
  storehouse?: unknown;
  /** Template completo no shape de ClsTemplate (sem decoded/cultivation/summary/class_info). */
  template?: unknown;
  /** Quando true, pede ao PHP para agendar exportclsconfig após o save. Default: false. */
  export?: boolean;
}

export interface SaveRoleEditableResponse {
  success: boolean;
  roleid?: number;
  online?: boolean;
  applied?: string[];
  verified?: boolean;
  /** Shape antigo / direto. */
  backups?: { role_json?: { file: string } };
  /** Shape "saved.*" usado pela API atualizada. */
  saved?: {
    verified?: boolean;
    backup?: { file?: string };
    backups?: {
      role_json?: { file?: string };
      clsconfig_file?: { file?: string };
    };
    export?: { log_file?: string; scheduled?: boolean };
    role?: unknown;
  };
  error?: string;
}

/**
 * Erro padronizado quando o endpoint da VPS ainda não existe (404).
 */
export class EndpointMissingError extends Error {
  constructor(public action: string) {
    super(`Endpoint ?action=${action} ainda não implementado na VPS`);
    this.name = "EndpointMissingError";
  }
}

/**
 * Erro de ação que falhou na VPS (HTTP 4xx/5xx) MAS o corpo de resposta
 * ainda traz dados estruturados úteis — ex.: Server Ops devolve
 * `operation.id` mesmo quando uma etapa falha (exit != 0). O caller pode
 * inspecionar `payload.operation` pra abrir o drawer de progresso e
 * mostrar o log_file.
 */
export class PwApiActionError<T = unknown> extends Error {
  constructor(
    public action: string,
    message: string,
    public status: number,
    public payload: T,
  ) {
    super(message);
    this.name = "PwApiActionError";
  }
}

const VPS_MERIDIAN_ACTIONS = new Set([
  "getMeridianTitlePresetCatalog",
  "previewMeridianTitlePreset",
  "applyMeridianTitlePreset",
]);

async function buildVpsDirectOperatorHeaders(): Promise<Record<string, string>> {
  const {
    buildPortalAdminHeaders,
    gamePortalAdminSecret,
  } = await import("@/lib/gamePortalApi");
  const secret = gamePortalAdminSecret();
  if (!secret) {
    throw new Error("VITE_GAME_PORTAL_ADMIN_SECRET nao configurado no build");
  }

  const { supabase } = await import("@/integrations/supabase/client");
  const { data: sessionData } = await supabase.auth.getSession();
  const user = sessionData.session?.user;

  return buildPortalAdminHeaders({
    secret,
    operatorId: user?.id,
    operatorEmail: user?.email ?? undefined,
    operatorName:
      (user?.user_metadata?.full_name as string | undefined) ||
      (user?.user_metadata?.name as string | undefined),
  });
}

function parseVpsDirectPayload(rawBody: string, status: number, action: string): unknown {
  if (!rawBody.trim()) {
    if (status === 404) throw new EndpointMissingError(action);
    throw new Error(`Resposta vazia da VPS (HTTP ${status})`);
  }
  try {
    return JSON.parse(rawBody);
  } catch {
    if (status === 404) throw new EndpointMissingError(action);
    throw new Error(`Resposta invalida da VPS (HTTP ${status}): ${rawBody.slice(0, 240)}`);
  }
}

function assertVpsDirectResponse<T>(
  action: string,
  status: number,
  rawBody: string,
  data: unknown,
): T {
  if (status === 401 || status === 403) {
    handleMaybeAuthOrForbidden(new Error(`${status} ${rawBody || "Unauthorized"}`));
  }

  if (status === 404) {
    throw new EndpointMissingError(action);
  }

  if (data && typeof data === "object") {
    const d = data as { success?: boolean; error?: string; endpoint_missing?: boolean };
    if (d.endpoint_missing === true) {
      throw new EndpointMissingError(action);
    }
    const err = d.error ?? "";
    const explicitFail = d.success === false;
    const looksMissing =
      /not\s+found|unknown\s+action|n[ãa]o\s+encontrad|acao\s+invalida|a[cç][aã]o\s+inv[aá]lida/i.test(err);
    if ((explicitFail || err) && looksMissing) {
      throw new EndpointMissingError(action);
    }
    if (explicitFail && err) {
      throw new PwApiActionError(action, err, status, data);
    }
    if (typeof d.error === "string" && d.error && d.success !== true) {
      throw new Error(d.error);
    }
  }

  if (!data || typeof data !== "object") {
    if (status >= 400) {
      throw new Error(rawBody || `HTTP ${status}`);
    }
  }

  if (status >= 400) {
    const err =
      data && typeof data === "object" && "error" in data
        ? String((data as { error?: string }).error ?? "")
        : rawBody;
    if (err && data && typeof data === "object") {
      throw new PwApiActionError(action, err, status, data);
    }
    throw new Error(err || `HTTP ${status}`);
  }

  return data as T;
}

/** Chama api_cls.php (ou gateway Meridiano) direto na VPS — sem Supabase proxy. */
async function callVpsActionDirect<T>(
  action: string,
  opts: { method: "GET" | "POST"; query?: Record<string, string | number>; body?: unknown },
): Promise<T> {
  const { getVpsApiBase, getVpsMeridianApiBase } = await import("@/lib/gamePortalApi");
  const headers = await buildVpsDirectOperatorHeaders();
  const qs = new URLSearchParams();
  qs.set("action", action);
  if (opts.query) {
    for (const [k, v] of Object.entries(opts.query)) qs.set(k, String(v));
  }

  const base = VPS_MERIDIAN_ACTIONS.has(action) ? getVpsMeridianApiBase() : getVpsApiBase();
  const url = `${base}?${qs.toString()}`;

  const isIdempotent = opts.method === "GET" || /^(get|list|export)/i.test(action);
  const maxAttempts = isIdempotent ? 3 : 1;
  let lastStatus = 0;
  let lastBody = "";

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const res = await fetch(url, {
      method: opts.method,
      headers,
      body: opts.method === "POST" ? JSON.stringify(opts.body ?? {}) : undefined,
    });
    lastStatus = res.status;
    lastBody = await res.text();
    const transient = lastStatus >= 502 && lastStatus <= 504;
    if (!transient || attempt >= maxAttempts - 1) {
      const parsed = parseVpsDirectPayload(lastBody, lastStatus, action);
      return assertVpsDirectResponse<T>(action, lastStatus, lastBody, parsed);
    }
    await new Promise((r) => setTimeout(r, attempt === 0 ? 400 : 1200));
  }

  const parsed = parseVpsDirectPayload(lastBody, lastStatus, action);
  return assertVpsDirectResponse<T>(action, lastStatus, lastBody, parsed);
}

async function callAction<T>(
  action: string,
  opts: { method: "GET" | "POST"; query?: Record<string, string | number>; body?: unknown },
): Promise<T> {
  const { canUseDirectVpsApi } = await import("@/lib/gamePortalApi");
  if (canUseDirectVpsApi()) {
    return callVpsActionDirect<T>(action, opts);
  }

  const qs = new URLSearchParams();
  if (opts.query) {
    for (const [k, v] of Object.entries(opts.query)) qs.set(k, String(v));
  }
  const path = `clsconfig-proxy/action/${action}${qs.toString() ? "?" + qs.toString() : ""}`;
  const { invokeClsconfigProxy } = await import("@/lib/clsconfigInvoke");

  // Retry automático em 503 (SUPABASE_EDGE_RUNTIME_ERROR / cold-start / restart).
  // Apenas para métodos idempotentes (GET) ou ações de leitura conhecidas.
  const isIdempotent =
    opts.method === "GET" ||
    /^(get|list|export)/i.test(action);
  const maxAttempts = isIdempotent ? 3 : 1;
  let attempt = 0;
  let lastResult: Awaited<ReturnType<typeof invokeClsconfigProxy<T>>> | null = null;
  while (attempt < maxAttempts) {
    attempt++;
    lastResult = await invokeClsconfigProxy<T>(path, {
      method: opts.method,
      body: opts.method === "POST" ? (opts.body ?? {}) : undefined,
    });
    const transient =
      lastResult.status === 503 ||
      /SUPABASE_EDGE_RUNTIME_ERROR|temporarily unavailable/i.test(lastResult.rawBody ?? "");
    if (!transient || attempt >= maxAttempts) break;
    // Backoff: 400ms, 1200ms
    await new Promise((r) => setTimeout(r, attempt === 1 ? 400 : 1200));
  }
  const { data, error, status, rawBody } = lastResult!;
  if (error) {
    if (status === 404) throw new EndpointMissingError(action);
    if (status === 400 && /acao\s+invalida|a[cç][aã]o\s+inv[aá]lida|unknown\s+action/i.test(rawBody)) {
      throw new EndpointMissingError(action);
    }
    // VPS antiga responde 500 com body vazio para actions novas →
    // proxy converte para 502 "Upstream returned non-JSON". Tratamos
    // como endpoint ausente para a UI mostrar a notice amigável.
    if ((status === 502 || status === 500) && /upstream\s+returned\s+non-json|endpoint\s+not\s+implemented/i.test(rawBody)) {
      throw new EndpointMissingError(action);
    }
    // Tenta extrair payload JSON estruturado do erro pra preservar campos
    // úteis (ex.: operation.id em Server Ops).
    let parsed: unknown = null;
    try {
      parsed = rawBody ? JSON.parse(rawBody) : null;
    } catch {
      parsed = null;
    }
    if (parsed && typeof parsed === "object") {
      const p = parsed as { error?: string };
      throw new PwApiActionError(
        action,
        p.error ?? error.message,
        status ?? 0,
        parsed,
      );
    }
    throw new Error(rawBody ? `${error.message}\n\n${rawBody}` : error.message);
  }
  // Resposta 2xx mas com {error:"..."} no corpo (sem success:false).
  if (data && typeof data === "object") {
    const d = data as { success?: boolean; error?: string; endpoint_missing?: boolean };
    if (d.endpoint_missing === true) {
      throw new EndpointMissingError(action);
    }
    const err = d.error ?? "";
    const explicitFail = d.success === false;
    const looksMissing = /not\s+found|unknown\s+action|n[ãa]o\s+encontrad|acao\s+invalida|a[cç][aã]o\s+inv[aá]lida/i.test(err);
    if ((explicitFail || err) && looksMissing) {
      throw new EndpointMissingError(action);
    }
  }
  return data as T;
}

export const pwApi = {
  getItemCatalog(params: { q?: string; id?: number | string; limit?: number; offset?: number } = {}) {
    const query: Record<string, string | number> = {};
    if (params.id != null && params.id !== "") query.id = params.id;
    if (params.q) query.q = params.q;
    if (params.limit != null) query.limit = params.limit;
    if (params.offset != null) query.offset = params.offset;
    return callAction<ItemCatalogResponse>("getItemCatalog", { method: "GET", query });
  },
  listBackups(params: { roleid?: number; limit?: number } = {}) {
    const query: Record<string, string | number> = {};
    if (params.roleid != null) query.roleid = params.roleid;
    if (params.limit != null) query.limit = params.limit;
    return callAction<ListBackupsResponse>("listBackups", { method: "GET", query });
  },
  restoreBackup(body: RestoreBackupRequest) {
    return callAction<RestoreBackupResponse>("restoreBackup", { method: "POST", body });
  },
  getRoleEditable(roleid: number) {
    return callAction<GetRoleEditableResponse>("getRoleEditable", {
      method: "GET",
      query: { roleid },
    });
  },
  saveRoleEditable(body: SaveRoleEditablePayload) {
    return callAction<SaveRoleEditableResponse>("saveRoleEditable", { method: "POST", body });
  },
  /**
   * Lê o conteúdo bruto de um backup role_json.
   * Endpoint dedicado (preferencial). VPS espera POST JSON:
   *   { type: "role_json", name: "<basename>" }
   * Resposta:
   *   { success: true, backup: { template, requested_payload, ... } }
   * Se a VPS ainda não implementou, lança EndpointMissingError —
   * o caller pode tentar dry_run como fallback.
   */
  getBackupContent(name: string, type: BackupKind = "role_json") {
    return callAction<GetBackupContentResponse>("getBackupContent", {
      method: "POST",
      body: { type, name },
    });
  },
  /**
   * Envia um correio com item anexado para o personagem alvo.
   * Contrato em docs/api-contract.md §4. Se 404 → EndpointMissingError.
   */
  sendMailItem(body: SendMailItemPayload) {
    return callAction<SendMailResponse>("sendMailItem", { method: "POST", body });
  },
  /**
   * Envia um correio com moedas/gold anexadas. Contrato em §5.
   */
  sendMailGold(body: SendMailGoldPayload) {
    return callAction<SendMailResponse>("sendMailGold", { method: "POST", body });
  },
  /* ─────────── Operação do Servidor v1 ─────────── */
  /**
   * Lê o status atual dos daemons do PW (gamedbd, gdeliveryd, etc).
   * Se o endpoint ainda não existe na VPS, lança EndpointMissingError —
   * a UI exibe "não implementado nesta VPS".
   */
  getServiceStatus() {
    return callAction<ServiceStatusResponse>("getServiceStatus", { method: "GET" });
  },
  /**
   * Lê últimas linhas dos logs principais do servidor. `source` filtra
   * por origem; `lines` controla o tail (default 200).
   */
  getServerLogs(params: { source?: ServerLogSource; lines?: number; q?: string } = {}) {
    const query: Record<string, string | number> = {};
    if (params.source) query.source = params.source;
    if (params.lines != null) query.lines = params.lines;
    if (params.q) query.q = params.q;
    return callAction<ServerLogsResponse>("getServerLogs", { method: "GET", query });
  },
  /**
   * Dispara `exportclsconfig` na VPS. Operação NÃO destrutiva (apenas
   * regrava o `clsconfig.data` a partir do gamedbd) — mas exige
   * permissão `save_templates` por escrever em arquivo do servidor.
   */
  exportClsconfig() {
    return callAction<ExportClsconfigResponse>("exportClsconfig", { method: "POST", body: {} });
  },
  /**
   * Envia uma mensagem global/system para todos os jogadores online
   * via wrapper sudo dedicado na VPS. Suporta `dry_run` para validar
   * o payload sem entregar de fato.
   */
  sendSystemMessage(body: SendSystemMessagePayload) {
    return callAction<SendSystemMessageResponse>("sendSystemMessage", {
      method: "POST",
      body,
    });
  },
  /**
   * Lê o estado atual de manutenção persistido na VPS.
   * Operação leve (apenas lê o state.json local). Sempre devolve um
   * estado bem-formado mesmo quando o arquivo ainda não existe.
   */
  getMaintenanceMode() {
    return callAction<GetMaintenanceModeResponse>("getMaintenanceMode", {
      method: "GET",
    });
  },
  /**
   * Liga/desliga o modo manutenção do servidor. Quando `broadcast=true`
   * (default), uma mensagem global de alta prioridade é disparada
   * automaticamente — mas a manutenção persiste mesmo se o broadcast falhar.
   * `dry_run` valida sem persistir/enviar.
   */
  setMaintenanceMode(body: SetMaintenanceModePayload) {
    return callAction<SetMaintenanceModeResponse>("setMaintenanceMode", {
      method: "POST",
      body,
    });
  },
  /** Lê multiplicadores (EXP/SP/drop/money) de gamed/script.lua. */
  getServerRates() {
    return callAction<GetServerRatesResponse>("getServerRates", { method: "GET" });
  },
  /** Grava rates em script.lua (backup automático). Requer restart GS. */
  saveServerRates(body: SaveServerRatesPayload) {
    return callAction<SaveServerRatesResponse>("saveServerRates", {
      method: "POST",
      body,
    });
  },
  /* ─────────── Segurança v1 (kick / ban / unban) ─────────── */
  /**
   * Desconecta um personagem online (kick). Não bane — apenas força a
   * saída. Útil pra liberar slot ou interromper exploit em andamento.
   */
  kickRole(body: KickRolePayload) {
    return callAction<SecurityActionResponse>("kickRole", { method: "POST", body });
  },
  /**
   * Bane uma conta. Quando `duration_seconds` é informado e > 0, é um
   * ban temporário; ausente / 0 = ban permanente. `reason` obrigatório
   * para auditoria.
   */
  banAccount(body: BanAccountPayload) {
    return callAction<SecurityActionResponse>("banAccount", { method: "POST", body });
  },
  /**
   * Remove o ban de uma conta. `reason` recomendado pra trilha.
   */
  unbanAccount(body: UnbanAccountPayload) {
    return callAction<SecurityActionResponse>("unbanAccount", { method: "POST", body });
  },
  /**
   * Lista as últimas N ações de segurança registradas na VPS (kick/ban/
   * unban). O front mantém uma trilha paralela em `audit_logs` — esse
   * endpoint é a "fonte da verdade" do servidor.
   */
  listSecurityHistory(params: { limit?: number; account?: string; roleid?: number } = {}) {
    const query: Record<string, string | number> = {};
    if (params.limit != null) query.limit = params.limit;
    if (params.account) query.account = params.account;
    if (params.roleid != null) query.roleid = params.roleid;
    return callAction<SecurityHistoryResponse>("listSecurityHistory", { method: "GET", query });
  },
  /* ─────────── Server Ops v3 — controle real de servicos ─────────── */
  getManageableServices() {
    return callAction<ManageableServicesResponse>("getManageableServices", { method: "GET" });
  },
  startService(body: ServiceControlPayload) {
    return callAction<ServiceControlResponse>("startService", { method: "POST", body });
  },
  stopService(body: ServiceControlPayload) {
    return callAction<ServiceControlResponse>("stopService", { method: "POST", body });
  },
  restartService(body: ServiceControlPayload) {
    return callAction<ServiceControlResponse>("restartService", { method: "POST", body });
  },
  /* ─────────── Server Ops v4 — controle do servidor inteiro ─────────── */
  /**
   * `startServer` — sobe o core do servidor.
   *
   * Comportamento (ver INSTANCE_CONTROL_V1_FRONTEND_CONTRACT.md):
   *  - Sem `instances`: backend usa o autostart por padrão.
   *  - Com `instances`: sobe a lista explícita.
   *  - `use_auto_start: false`: desabilita o autostart nessa chamada
   *    (sobe só o core, sem instâncias adicionais).
   *  - `use_auto_start: true` + `instances`: soma a lista manual com o autostart.
   *
   * Importante: NÃO enviar `instances: []` como "limpar seleção" — o backend
   * trata como "sem seleção explícita" e cai no autostart. Para desligar de
   * fato, use `use_auto_start: false`.
   */
  startServer(body: ServerControlPayload = {}) {
    return callAction<ServiceControlResponse>("startServer", { method: "POST", body });
  },
  /** `stopServer` — para o servidor inteiro (core + instâncias rodando). */
  stopServer(body: ServerControlPayload = {}) {
    return callAction<ServiceControlResponse>("stopServer", { method: "POST", body });
  },
  /**
   * `restartServer` — reinicia o servidor. Mesmas regras de autostart de
   * `startServer`. Aceita também `reason`, `countdown_seconds`, `broadcast`,
   * `enable_maintenance`, `backup_before_restart`, `verify_after_restart`.
   */
  restartServer(body: ServerControlPayload = {}) {
    return callAction<ServiceControlResponse>("restartServer", { method: "POST", body });
  },
  /**
   * Polling do progresso de operações longas (start/stop/restart server).
   * `operation_id` é o id retornado em ServiceControlResponse.operation.id.
   * Quando omitido, a VPS devolve a operação mais recente do tipo informado.
   */
  getServerOperationStatus(params: { operation_id?: string; type?: string } = {}) {
    const query: Record<string, string> = {};
    if (params.operation_id) query.operation_id = params.operation_id;
    if (params.type) query.type = params.type;
    return callAction<ServerOperationStatusResponse>("getServerOperationStatus", {
      method: "GET",
      query,
    });
  },
  /** Solicita cancelamento cooperativo de operação longa em andamento. */
  cancelServerOperation(body: { operation_id: string; reason?: string }) {
    return callAction<CancelServerOperationResponse>("cancelServerOperation", {
      method: "POST",
      body,
    });
  },
  /**
   * Histórico de operações do servidor (start/stop/restart de server e
   * services). Filtros opcionais por `type` e `success_state`. `limit`
   * default ~50 no PHP.
   */
  getServerOperationsHistory(
    params: {
      type?: string;
      success_state?: string;
      limit?: number;
    } = {},
  ) {
    const query: Record<string, string | number> = {};
    if (params.type) query.type = params.type;
    if (params.success_state) query.success_state = params.success_state;
    if (params.limit != null) query.limit = params.limit;
    return callAction<ServerOperationsHistoryResponse>(
      "getServerOperationsHistory",
      { method: "GET", query },
    );
  },
  /* ─────────── Instance Control v1 ─────────── */
  getManageableInstances() {
    return callAction<ManageableInstancesResponse>("getManageableInstances", {
      method: "GET",
    });
  },
  /**
   * Toggle individual: { code, enabled } OU lista completa: { codes }.
   * O backend sempre devolve a lista resultante (auto_start_codes).
   */
  setInstanceAutoStart(body: SetInstanceAutoStartPayload) {
    return callAction<SetInstanceAutoStartResponse>("setInstanceAutoStart", {
      method: "POST",
      body,
    });
  },
  startInstance(body: InstanceControlSinglePayload) {
    return callAction<InstanceControlResponse>("startInstance", {
      method: "POST",
      body,
    });
  },
  startInstances(body: InstanceControlBatchPayload) {
    return callAction<InstanceControlResponse>("startInstances", {
      method: "POST",
      body,
    });
  },
  stopInstance(body: InstanceControlSinglePayload) {
    return callAction<InstanceControlResponse>("stopInstance", {
      method: "POST",
      body,
    });
  },
  stopInstances(body: InstanceControlBatchPayload) {
    return callAction<InstanceControlResponse>("stopInstances", {
      method: "POST",
      body,
    });
  },
  restartInstance(body: InstanceControlSinglePayload) {
    return callAction<InstanceControlResponse>("restartInstance", {
      method: "POST",
      body,
    });
  },
  restartInstances(body: InstanceControlBatchPayload) {
    return callAction<InstanceControlResponse>("restartInstances", {
      method: "POST",
      body,
    });
  },
  /* ─────────── Control Center v1 ─────────── */
  getControlCenterSnapshot() {
    return callAction<ControlCenterSnapshotResponse>("getControlCenterSnapshot", { method: "GET" });
  },
  /* ─────────── Backups (panel-level) ─────────── */
  listPanelBackups(params: { limit?: number; type?: PanelBackupKind } = {}) {
    const query: Record<string, string | number> = {};
    if (params.limit != null) query.limit = params.limit;
    if (params.type) query.type = params.type;
    return callAction<ListPanelBackupsResponse>("listBackups", { method: "GET", query });
  },
  backupNow(body: BackupNowPayload) {
    return callAction<BackupNowResponse>("backupNow", { method: "POST", body });
  },
  /* ─────────── Watchdog ─────────── */
  getWatchdogStatus() {
    return callAction<WatchdogStatusResponse>("getWatchdogStatus", { method: "GET" });
  },
  getWatchdogHistory(params: { limit?: number } = {}) {
    const query: Record<string, string | number> = {};
    if (params.limit != null) query.limit = params.limit;
    return callAction<WatchdogHistoryResponse>("getWatchdogHistory", { method: "GET", query });
  },
  saveWatchdogConfig(body: WatchdogConfig) {
    return callAction<WatchdogConfigResponse>("saveWatchdogConfig", { method: "POST", body });
  },
  enableWatchdog() {
    return callAction<WatchdogConfigResponse>("enableWatchdog", { method: "POST", body: {} });
  },
  disableWatchdog() {
    return callAction<WatchdogConfigResponse>("disableWatchdog", { method: "POST", body: {} });
  },
  runWatchdogCheckNow(body: { dry_run?: boolean } = {}) {
    return callAction<WatchdogCheckResponse>("runWatchdogCheckNow", { method: "POST", body });
  },
  /* ─────────── Game Portal (cadastro publico) ─────────── */
  getGamePortalAdminConfig() {
    return callAction<GamePortalAdminConfigResponse>("getGamePortalAdminConfig", { method: "GET" });
  },
  saveGamePortalAdminConfig(body: SaveGamePortalAdminConfigPayload) {
    return callAction<SaveGamePortalAdminConfigResponse>("saveGamePortalAdminConfig", {
      method: "POST",
      body,
    });
  },
  createStaffAccount(body: CreateStaffAccountPayload) {
    return callAction<CreateStaffAccountResponse>("createStaffAccount", { method: "POST", body });
  },
  listLandingAccessSessions() {
    return callAction<LandingAccessSessionsResponse>("listLandingAccessSessions", { method: "GET" });
  },
  revokeLandingAccessSession(sessionId: string) {
    return callAction<{ success: boolean; message?: string }>("revokeLandingAccessSession", {
      method: "POST",
      body: { session_id: sessionId },
    });
  },
  revokeAllLandingAccessSessions() {
    return callAction<{ success: boolean; message?: string; revoked_count?: number }>(
      "revokeAllLandingAccessSessions",
      { method: "POST", body: {} },
    );
  },
  /* ─────────── GM Commander v1 ─────────── */
  /** Catálogo de comandos GM disponíveis na VPS (capability flags). */
  getGmCommandCatalog() {
    return callAction<GmCommandCatalogResponse>("getGmCommandCatalog", { method: "GET" });
  },
  /** Histórico unificado de ações GM (mail/grant/mod/sysmsg). */
  getGmActionHistory(params: { limit?: number } = {}) {
    const query: Record<string, string | number> = {};
    if (params.limit != null) query.limit = params.limit;
    return callAction<GmActionHistoryResponse>("getGmActionHistory", { method: "GET", query });
  },
  /** Saldo de cash/gold da Mall (loja) por roleid. */
  getMallCashBalance(roleid: number) {
    return callAction<MallCashBalanceResponse>("getMallCashBalance", {
      method: "GET",
      query: { roleid },
    });
  },
  /** Crédito de gold/cash da loja na conta. NÃO confundir com sendMailGold. */
  grantMallCash(body: GrantMallCashPayload) {
    return callAction<GrantMallCashResponse>("grantMallCash", { method: "POST", body });
  },
  /** Template do correio enviado após grantMallCash. */
  getMallCashNotifyMailConfig() {
    return callAction<MallCashNotifyMailConfigResponse>("getMallCashNotifyMailConfig", { method: "GET" });
  },
  saveMallCashNotifyMailConfig(body: SaveMallCashNotifyMailConfigPayload) {
    return callAction<MallCashNotifyMailConfigResponse>("saveMallCashNotifyMailConfig", { method: "POST", body });
  },
  /** Silencia uma conta (chat global). */
  muteAccount(body: MuteAccountPayload) {
    return callAction<SecurityActionResponse>("muteAccount", { method: "POST", body });
  },
  /** Silencia um personagem específico. */
  muteRole(body: MuteRolePayload) {
    return callAction<SecurityActionResponse>("muteRole", { method: "POST", body });
  },
  /* ─────────── Moderação: Clear PK ─────────── */
  /**
   * Limpa o estado PK (player kill) de um personagem.
   * Suporta dry_run para preview antes da execução real.
   */
  clearRolePk(body: ClearRolePkPayload) {
    return callAction<ClearRolePkResponse>("clearRolePk", { method: "POST", body });
  },
  /** Catálogo de presets de punição rápida (kick, mute, ban). */
  getQuickPunishmentCatalog() {
    return callAction<QuickPunishmentCatalogResponse>("getQuickPunishmentCatalog", {
      method: "GET",
    });
  },
  /** Preview do plano de punição (sem efetivar). */
  previewQuickPunishment(body: QuickPunishmentPayload) {
    return callAction<QuickPunishmentPreviewResponse>("previewQuickPunishment", {
      method: "POST",
      body,
    });
  },
  /** Executa punição rápida conforme preset escolhido. */
  executeQuickPunishment(body: QuickPunishmentPayload) {
    return callAction<QuickPunishmentExecuteResponse>("executeQuickPunishment", {
      method: "POST",
      body,
    });
  },
  /* ─────────── GM Permissions v2 ─────────── */
  /** Catálogo estático das regras GM (id → label). */
  getGmPermissionCatalog() {
    return callAction<GmPermissionCatalogResponse>("getGmPermissionCatalog", { method: "GET" });
  },
  /** Estado atual de permissões GM de uma conta (por userid OU roleid). */
  getGmPermissionState(target: { userid?: number; roleid?: number }) {
    const query: Record<string, string> = {};
    if (target.userid != null) query.userid = String(target.userid);
    if (target.roleid != null) query.roleid = String(target.roleid);
    return callAction<GmPermissionStateResponse>("getGmPermissionState", {
      method: "GET",
      query,
    });
  },
  /** Concede permissões GM (template completo OU subset via rule_ids). */
  grantGmPermission(body: GmPermissionMutationPayload) {
    return callAction<GmPermissionMutationResponse>("grantGmPermission", {
      method: "POST",
      body: { ...body, confirm: "GRANT_GM_PERMISSION" as const },
    });
  },
  /** Revoga permissões GM (template completo OU subset via rule_ids). */
  revokeGmPermission(body: GmPermissionMutationPayload) {
    return callAction<GmPermissionMutationResponse>("revokeGmPermission", {
      method: "POST",
      body: { ...body, confirm: "REVOKE_GM_PERMISSION" as const },
    });
  },
  getMeridianTitlePresetCatalog() {
    return callAction<MeridianTitleCatalogResponse>("getMeridianTitlePresetCatalog", { method: "GET" });
  },
  previewMeridianTitlePreset(body: MeridianTitlePresetPayload) {
    return callAction<MeridianTitlePreviewResponse>("previewMeridianTitlePreset", {
      method: "POST",
      body,
    });
  },
  applyMeridianTitlePreset(body: MeridianTitlePresetPayload) {
    return callAction<MeridianTitleApplyResponse>("applyMeridianTitlePreset", {
      method: "POST",
      body,
    });
  },
  /* ─────────── GM Commander v2 — Bulk Operations ─────────── */
  searchPlayerDirectory(params: BulkSelectionParams & { limit?: number }) {
    return callAction<PlayerDirectoryResponse>("searchPlayerDirectory", {
      method: "POST",
      body: params,
    });
  },
  getPlayerTargetProfile(target: { roleid?: number; userid?: number; name?: string }) {
    const query: Record<string, string> = {};
    if (target.roleid != null) query.roleid = String(target.roleid);
    if (target.userid != null) query.userid = String(target.userid);
    if (target.name != null && target.name.trim()) query.name = target.name.trim();
    return callAction<PlayerTargetProfileResponse>("getPlayerTargetProfile", {
      method: "GET",
      query,
    });
  },
  resolveBulkTargets(body: ResolveBulkTargetsPayload) {
    return callAction<ResolveBulkTargetsResponse>("resolveBulkTargets", {
      method: "POST",
      body,
    });
  },
  previewBulkTargets(body: PreviewBulkTargetsPayload) {
    return callAction<PreviewBulkTargetsResponse>("previewBulkTargets", {
      method: "POST",
      body,
    });
  },
  queueBulkCommand(body: QueueBulkCommandPayload) {
    return callAction<QueueBulkCommandResponse>("queueBulkCommand", {
      method: "POST",
      body,
    });
  },
  getBulkCommandJob(jobId: string) {
    return callAction<GetBulkCommandJobResponse>("getBulkCommandJob", {
      method: "GET",
      query: { job_id: jobId },
    });
  },
  getBulkCommandJobs(params: { limit?: number } = {}) {
    const query: Record<string, string | number> = {};
    if (params.limit != null) query.limit = params.limit;
    return callAction<GetBulkCommandJobsResponse>("getBulkCommandJobs", {
      method: "GET",
      query,
    });
  },
  /* ─────────── GM Commander v2 — Bulk Templates ─────────── */
  saveBulkTemplate(body: SaveBulkTemplatePayload) {
    return callAction<BulkTemplateResponse>("saveBulkTemplate", { method: "POST", body });
  },
  getBulkTemplate(template_key: string) {
    return callAction<BulkTemplateResponse>("getBulkTemplate", { method: "GET", query: { template_key } });
  },
  getBulkTemplates(params: { category?: string } = {}) {
    const query: Record<string, string> = {};
    if (params.category) query.category = params.category;
    return callAction<BulkTemplatesListResponse>("getBulkTemplates", { method: "GET", query });
  },
  updateBulkTemplate(body: UpdateBulkTemplatePayload) {
    return callAction<BulkTemplateResponse>("updateBulkTemplate", { method: "POST", body });
  },
  deleteBulkTemplate(template_key: string) {
    return callAction<{ success: boolean; error?: string }>("deleteBulkTemplate", { method: "POST", body: { template_key } });
  },
  previewBulkTemplate(template_key: string) {
    return callAction<PreviewBulkTargetsResponse>("previewBulkTemplate", { method: "POST", body: { template_key } });
  },
  executeBulkTemplate(body: ExecuteBulkTemplatePayload) {
    return callAction<QueueBulkCommandResponse>("executeBulkTemplate", { method: "POST", body });
  },
  /* ─────────── GM Commander v2 — Bulk Schedules ─────────── */
  scheduleBulkCommand(body: ScheduleBulkCommandPayload) {
    return callAction<ScheduleBulkCommandResponse>("scheduleBulkCommand", { method: "POST", body });
  },
  getBulkSchedules(params: { limit?: number } = {}) {
    const query: Record<string, string | number> = {};
    if (params.limit != null) query.limit = params.limit;
    return callAction<GetBulkSchedulesResponse>("getBulkSchedules", { method: "GET", query });
  },
  getBulkSchedule(scheduleId: string) {
    return callAction<GetBulkScheduleResponse>("getBulkSchedule", { method: "GET", query: { schedule_id: scheduleId } });
  },
  updateBulkSchedule(scheduleId: string, body: Partial<ScheduleBulkCommandPayload>) {
    return callAction<ScheduleBulkCommandResponse>("updateBulkSchedule", { method: "POST", body: { ...body, schedule_id: scheduleId } });
  },
  deleteBulkSchedule(scheduleId: string) {
    return callAction<{ success: boolean; deleted: boolean; schedule_id: string; error?: string }>("deleteBulkSchedule", { method: "POST", body: { schedule_id: scheduleId } });
  },
  /* ─────────── Operator Permissions ─────────── */
  /** Catálogo de permissões disponíveis por role de operador. */
  getOperatorPermissionCatalog() {
    return callAction<OperatorPermissionCatalogResponse>("getOperatorPermissionCatalog", { method: "GET" });
  },
  /** Estado de permissões do operador atual (resolvido via headers x-operator-*). */
  getOperatorPermissionState() {
    return callAction<OperatorPermissionStateResponse>("getOperatorPermissionState", { method: "GET" });
  },

  /* ─────────── Operator Registry (CRUD operators.json) ─────────── */
  /** Lista todos os operadores registrados na VPS. */
  getOperatorRegistry() {
    return callAction<OperatorRegistryResponse>("getOperatorRegistry", { method: "GET" });
  },
  /** Cria ou atualiza um operador no registry. */
  saveOperatorRegistryEntry(entry: OperatorRegistryEntry) {
    return callAction<{ success: boolean; error?: string }>("saveOperatorRegistryEntry", {
      method: "POST",
      body: entry,
    });
  },
  /** Remove um operador do registry por id ou email. */
  deleteOperatorRegistryEntry(identifier: { id?: string; email?: string }) {
    return callAction<{ success: boolean; error?: string }>("deleteOperatorRegistryEntry", {
      method: "POST",
      body: identifier,
    });
  },

  /* ─────────── Rank PvP — eventos > rank pvp ─────────── */
  getPvpRankingLeaderboard(params: { limit?: number } = {}) {
    const query: Record<string, string | number> = {};
    if (params.limit != null) query.limit = params.limit;
    return callAction<PvpRankingLeaderboardResponse>("getPvpRankingLeaderboard", {
      method: "GET",
      query,
    });
  },
  previewPvpRankingRewards(body: PvpRewardExecutionPayload) {
    return callAction<PvpRewardPreviewResponse>("previewPvpRankingRewards", {
      method: "POST",
      body,
    });
  },
  executePvpRankingRewards(body: PvpRewardExecutionPayload) {
    return callAction<PvpRewardExecutionResponse>("executePvpRankingRewards", {
      method: "POST",
      body,
    });
  },
  getPvpRankingRewardHistory(params: { limit?: number } = {}) {
    const query: Record<string, string | number> = {};
    if (params.limit != null) query.limit = params.limit;
    return callAction<PvpRewardHistoryResponse>("getPvpRankingRewardHistory", {
      method: "GET",
      query,
    });
  },
  getPvpRankingRewardSchedules(params: { limit?: number } = {}) {
    const query: Record<string, string | number> = {};
    if (params.limit != null) query.limit = params.limit;
    return callAction<PvpRewardSchedulesResponse>("getPvpRankingRewardSchedules", {
      method: "GET",
      query,
    });
  },
  getPvpRankingRewardSchedule(params: { schedule_id: string }) {
    return callAction<PvpScheduleDetailResponse>("getPvpRankingRewardSchedule", {
      method: "GET",
      query: { schedule_id: params.schedule_id },
    });
  },
  savePvpRankingRewardSchedule(body: PvpScheduleSavePayload) {
    return callAction<PvpScheduleSaveResponse>("savePvpRankingRewardSchedule", {
      method: "POST",
      body,
    });
  },
  deletePvpRankingRewardSchedule(body: { schedule_id: string }) {
    return callAction<{ success: boolean; error?: string }>(
      "deletePvpRankingRewardSchedule",
      { method: "POST", body },
    );
  },
};

/* ─────────── Rank PvP — tipos ─────────── */

export interface PvpRankingEntry {
  position: number;
  roleid: number;
  /** nome do personagem (campo oficial do contrato). */
  name?: string;
  /** id da classe (campo oficial do contrato). */
  cls?: number;
  class_name?: string;
  kills?: number;
  deaths?: number;
  points?: number;
  last_kill_at?: string | number | null;
  [k: string]: unknown;
}

export interface PvpRankingLeaderboardResponse {
  success: boolean;
  entries?: PvpRankingEntry[];
  count?: number;
  error?: string;
}

export interface PvpRewardConfig {
  position: number;
  item_id?: number;
  count?: number;
  money?: number;
  title?: string;
  message?: string;
}

export interface PvpRewardExecutionPayload {
  rewards: PvpRewardConfig[];
  reset_ranking?: boolean;
  reset_only_on_full_success?: boolean;
}

/** Player resumido dentro de uma entry de preview/result. */
export interface PvpRewardPlayer {
  roleid?: number;
  name?: string;
  cls?: number;
  class_name?: string;
  [k: string]: unknown;
}

/** Entry do preview / execução (contrato oficial). */
export interface PvpRewardEntry {
  position: number;
  player?: PvpRewardPlayer | null;
  reward?: PvpRewardConfig;
  delivery_method?: string;
  status?: string;
  error?: string;
  has_target?: boolean;
  [k: string]: unknown;
}

export interface PvpRewardPreviewResponse {
  success: boolean;
  entries?: PvpRewardEntry[];
  missing_positions?: number[];
  error?: string;
}

export interface PvpRewardExecutionSummary {
  completed_count?: number;
  failed_count?: number;
  skipped_count?: number;
  deliverable_count?: number;
  status?: string;
  reset_performed?: boolean;
  [k: string]: unknown;
}

export interface PvpRewardExecutionResponse {
  success: boolean;
  status?: string;
  completed_count?: number;
  failed_count?: number;
  skipped_count?: number;
  reset_performed?: boolean;
  reset_result?: Record<string, unknown> | null;
  results?: PvpRewardEntry[];
  leaderboard?: PvpRankingEntry[];
  error?: string;
}

export interface PvpRewardHistoryEntry {
  id?: string;
  created_at?: string | number;
  source?: "manual" | "schedule" | string;
  status?: string;
  actor?: { id?: string; email?: string; name?: string } | string | null;
  summary?: PvpRewardExecutionSummary;
  reset_performed?: boolean;
  leaderboard?: PvpRankingEntry[];
  results?: PvpRewardEntry[];
  reset_result?: Record<string, unknown> | null;
  [k: string]: unknown;
}

export interface PvpRewardHistoryResponse {
  success: boolean;
  entries?: PvpRewardHistoryEntry[];
  count?: number;
  error?: string;
}

/** Resumo de schedule retornado pela listagem. NÃO contém `rewards`. */
export interface PvpScheduleSummary {
  id?: string;
  name?: string;
  weekdays?: number[];
  time_of_day?: string;
  timezone?: string;
  enabled?: boolean;
  reset_ranking?: boolean;
  reset_only_on_full_success?: boolean;
  reward_positions?: number[];
  preview?: PvpRewardEntry[];
  next_run_at?: string | null;
  last_run_at?: string | null;
  last_result?: string | null;
  last_error?: string | null;
  /** estado computado pela VPS: ok | warning | error | paused | pending */
  derived_state?: string | null;
  /** severidade visual do estado: ok | warning | error | muted */
  status_severity?: "ok" | "warning" | "error" | "muted" | string | null;
  [k: string]: unknown;
}

/** Schedule completo (retornado por getPvpRankingRewardSchedule). */
export interface PvpScheduleDetail extends PvpScheduleSummary {
  rewards?: PvpRewardConfig[];
}

export interface PvpScheduleDetailResponse {
  success: boolean;
  schedule?: PvpScheduleDetail;
  error?: string;
}

export interface PvpScheduleSavePayload {
  id?: string;
  name: string;
  weekdays: number[];
  time_of_day: string;
  timezone?: string;
  enabled?: boolean;
  reset_ranking?: boolean;
  reset_only_on_full_success?: boolean;
  rewards: PvpRewardConfig[];
}

export interface PvpScheduleSaveResponse {
  success: boolean;
  schedule?: PvpScheduleDetail;
  error?: string;
}

export interface PvpRewardSchedulesResponse {
  success: boolean;
  schedules?: PvpScheduleSummary[];
  count?: number;
  error?: string;
}

/* ─────────── GM Commander v1 — tipos ─────────── */

/** Estado de suporte de cada action no catálogo. */
export type GmCapabilityState =
  | "supported"
  | "version_gated"
  | "contract_only"
  | "unsupported"
  | string;

export interface GmCommandCapability {
  /** Nome canônico da action (ex.: "grantMallCash", "teleportRole"). */
  action: string;
  /** Rótulo amigável quando o backend devolver. */
  label?: string;
  /** Categoria sugerida pela VPS (compensation/moderation/communication/...). */
  category?: string;
  state: GmCapabilityState;
  /** Suporta dry_run nativo. */
  supports_dry_run?: boolean;
  /** Mensagem livre (motivo do gate). */
  message?: string;
  [k: string]: unknown;
}

export interface GmCommandCatalogResponse {
  success: boolean;
  count?: number;
  capabilities?: GmCommandCapability[];
  /** Algumas versões devolvem como mapa action→capability. */
  commands?: Record<string, GmCommandCapability>;
  collected_at?: string | number;
  error?: string;
}

export interface GmActionHistoryEntry {
  id?: string;
  ts: number | string;
  action: string;
  /** Categoria operacional (compensation/moderation/communication). */
  category?: string;
  target?: string | number | null;
  roleid?: number | null;
  account?: string | null;
  status: "ok" | "error" | "pending" | string;
  dry_run?: boolean;
  by?: string | null;
  message?: string | null;
  error?: string | null;
  [k: string]: unknown;
}

export interface GmActionHistoryResponse {
  success: boolean;
  count?: number;
  entries: GmActionHistoryEntry[];
  warning?: string;
  error?: string;
}

/**
 * Saldo da carteira da Mall (loja). PW 1.7.8:
 * - `shop_balance` / `cash_total` = saldo spendavel in-game (cash_add - cash_used)
 * - `cash_add` = total recarregado (nao e saldo atual)
 * - `cash_used` = total gasto na loja
 */
export interface MallCashWallet {
  /** Saldo spendavel da loja (igual in-game). */
  shop_balance_gold?: number;
  shop_balance_units?: number;
  cash_gold?: number;
  cash_units?: number;
  cash_add_gold?: number;
  cash_add_units?: number;
  cash_used_gold?: number;
  cash_used_units?: number;
  /** Alias de shop_balance para compatibilidade. */
  cash_total_gold?: number;
  cash_total_units?: number;
  [k: string]: unknown;
}

export interface MallCashBalanceResponse {
  success: boolean;
  roleid?: number;
  userid?: number | null;
  account?: string | null;
  wallet: MallCashWallet;
  /** Saída bruta do gacd quando disponível (debug). */
  raw?: unknown;
  collected_at?: string | number;
  error?: string;
}

export interface GrantMallCashPayload {
  /** Identificadores de alvo (pelo menos um). */
  roleid?: number;
  userid?: number;
  /** Inteiro > 0 em gold (não em units). */
  amount: number;
  reason: string;
  /** Texto fixo "GRANT_MALL_CASH" exigido para execução real. */
  confirm?: "GRANT_MALL_CASH";
  dry_run?: boolean;
}

export interface GrantMallCashResult {
  /** Código retornado pelo gacd. -8 pode indicar warning não-fatal. */
  error_code?: number;
  raw?: unknown;
  message?: string;
  [k: string]: unknown;
}

export interface BalanceChange {
  cash_gold?: number;
  cash_units?: number;
  cash_add_gold?: number;
  cash_add_units?: number;
  cash_total_gold?: number;
  cash_total_units?: number;
}

export interface GrantMallCashResponse {
  success: boolean;
  dry_run?: boolean;
  roleid?: number;
  userid?: number | null;
  target?: { userid?: number; roleid?: number; role_name?: string };
  grant?: { amount?: number; cash_units?: number };
  amount?: number;
  reason?: string;
  grant_result?: GrantMallCashResult;
  wallet_before?: MallCashWallet;
  wallet_after?: MallCashWallet;
  balance_change?: BalanceChange;
  verification_attempts?: number;
  grant_queued?: boolean;
  usecash_queue?: {
    before?: { pending_count?: number; pending_cash_units?: number };
    after?: { pending_count?: number; pending_cash_units?: number };
    observation?: { observed_cash_units?: number; confirmed?: boolean; partial?: boolean };
  };
  warning?: string;
  notification_mail?: {
    attempted?: boolean;
    success?: boolean;
    skipped_reason?: string;
    error?: string;
    mail?: { title?: string; message?: string };
  };
  notification_mail_warning?: string;
  log_file?: string;
  error?: string;
}

export interface MallCashNotifyMailConfig {
  enabled: boolean;
  title: string;
  body_template: string;
  thanks: string;
}

export interface MallCashNotifyMailConfigResponse {
  success: boolean;
  config: MallCashNotifyMailConfig;
  placeholders?: Record<string, string>;
  config_file?: string;
  error?: string;
}

export interface SaveMallCashNotifyMailConfigPayload {
  enabled?: boolean;
  title?: string;
  body_template?: string;
  thanks?: string;
}

/* ─────────── Mute (extensão da Segurança v1) ─────────── */

export interface MuteAccountPayload {
  account?: string;
  userid?: number;
  roleid?: number;
  duration_seconds?: number;
  permanent?: boolean;
  reason: string;
  dry_run?: boolean;
}

export interface MuteRolePayload {
  roleid: number;
  duration_seconds?: number;
  permanent?: boolean;
  reason: string;
  dry_run?: boolean;
}

/* ─────────── GM Permissions v2 — tipos ─────────── */

/** Uma regra GM (id + label legível). */
export interface GmPermissionRule {
  id: number;
  label?: string;
  /** Algumas builds devolvem em pt-br ("nome") ou aliases. */
  name?: string;
  description?: string;
  category?: string;
  [k: string]: unknown;
}

export interface GmPermissionCatalogResponse {
  success: boolean;
  rule_catalog?: GmPermissionRule[];
  /** Algumas versões devolvem como mapa id → rule. */
  rules?: Record<string, GmPermissionRule>;
  template_rule_ids?: number[];
  collected_at?: string | number;
  error?: string;
}

/**
 * Resumo do estado atual da conta perante o template GM.
 * Usado para destacar matches/missing/diffs no UI.
 */
export interface GmPermissionSummary {
  template_available?: boolean;
  current_rule_count?: number;
  template_rule_count?: number;
  fully_matches_template?: boolean;
  partially_matches_template?: boolean;
  missing_rule_count?: number;
  matching_rule_count?: number;
  [k: string]: unknown;
}

export interface GmPermissionStateResponse {
  success: boolean;
  userid?: number | null;
  roleid?: number | null;
  account?: string | null;
  rule_catalog?: GmPermissionRule[];
  permission_state?: {
    current_rule_ids?: number[];
    template_rule_ids?: number[];
    current_rules?: number[] | Array<{ rid?: number; id?: number; label?: string }>;
    template_rules?: number[] | Array<{ rid?: number; id?: number; label?: string }>;
    matching_rules?: number[] | Array<{ rid?: number; id?: number; label?: string }>;
    missing_rules?: number[] | Array<{ rid?: number; id?: number; label?: string }>;
    gm_method?: string;
    [k: string]: unknown;
  };
  permission_summary?: GmPermissionSummary;
  /** Algumas versões devolvem direto na raiz. */
  current_rules?: number[];
  template_rules?: number[];
  matching_rules?: number[];
  missing_rules?: number[];
  collected_at?: string | number;
  error?: string;
}

/**
 * Payload de grant/revoke (compartilhado entre as duas actions).
 *
 *  - omitir `rule_ids` → aplica TEMPLATE COMPLETO
 *  - enviar `rule_ids` → aplica/remove SUBSET granular
 */
export interface GmPermissionMutationPayload {
  userid?: number;
  roleid?: number;
  reason: string;
  rule_ids?: number[];
  permission_level?: number;
  kick_online?: boolean;
  /** Anexado automaticamente pelo wrapper (não setar no UI). */
  confirm?: "GRANT_GM_PERMISSION" | "REVOKE_GM_PERMISSION";
}

export interface GmPermissionMutationResponse {
  success: boolean;
  message?: string;
  userid?: number | null;
  roleid?: number | null;
  account?: string | null;
  session_kick?: unknown;
  permission_summary_before?: GmPermissionSummary;
  permission_summary_after?: GmPermissionSummary;
  permission_change?: {
    inserted?: number[];
    deleted?: number[];
    [k: string]: unknown;
  };
  inserted_rule_count?: number;
  deleted_rule_count?: number;
  after_rules?: number[];
  warning?: string;
  error?: string;
  [k: string]: unknown;
}

/* ─────────── Server Ops — histórico de operações ─────────── */

export interface ServerOperationHistoryEntry {
  id: string;
  type: string;
  stage?: ServerOperationStage | null;
  running?: boolean;
  success?: boolean;
  success_state?: ServerOperationSuccessState;
  services?: string[];
  dry_run?: boolean;
  reason?: string | null;
  created_at?: string | number | null;
  completed_at?: string | number | null;
  log_file?: string | null;
  error?: string | null;
}

export interface ServerOperationsHistoryResponse {
  success: boolean;
  count?: number;
  operations?: ServerOperationHistoryEntry[];
  error?: string;
}

/* ─────────── Server Ops v3 — controle real de servicos ─────────── */

export interface ManageableService {
  key: string;
  label?: string;
  process_name?: string;
  state: ServiceState;
  pid?: number | null;
  process_count?: number;
  pids?: number[];
  port?: number | null;
  systemd_state?: string | null;
  listening?: boolean | null;
  aliases?: string[];
  supported_actions?: Array<"start" | "stop" | "restart">;
  selectable?: boolean;
  message?: string | null;
}

export interface ManageableServicesResponse {
  success: boolean;
  count?: number;
  collected_at?: string | number;
  services: ManageableService[];
  error?: string;
}

export interface ServiceControlPayload {
  /** Lote (preferencial). */
  services?: string[];
  /** Single (alternativa). */
  service?: string;
  verify?: boolean;
  dry_run?: boolean;
}

/**
 * Payload do Server Ops v4 (`startServer`/`stopServer`/`restartServer`).
 *
 * Regras de autostart (start/restart):
 *  - omitir `instances` → backend usa o autostart configurado.
 *  - `instances: ["is24",...]` → sobe a lista explícita.
 *  - `use_auto_start: false` → desliga o autostart nessa chamada.
 *  - `use_auto_start: true` + `instances` → soma manual + autostart.
 *
 * Não enviar `instances: []` (vazio) como "limpar"; o backend trata como
 * "sem seleção" e cai no autostart.
 */
export interface ServerControlPayload {
  verify?: boolean;
  dry_run?: boolean;
  /** Lista explícita de instâncias (omitir → autostart). */
  instances?: string[];
  /** Sobrescreve o uso do autostart. */
  use_auto_start?: boolean;
  /** Restart: contagem regressiva antes do shutdown (segundos). */
  countdown_seconds?: number;
  /** Restart: broadcast de aviso aos players. */
  broadcast?: boolean;
  /** Restart: liga manutenção durante o ciclo. */
  enable_maintenance?: boolean;
  /** Restart: dispara backup antes do restart. */
  backup_before_restart?: boolean;
  /** Restart: verifica services após o restart. */
  verify_after_restart?: boolean;
  /** Texto livre pra trilha de auditoria. */
  reason?: string;
}

export interface ServiceControlResultEntry {
  success: boolean;
  service: string;
  action: "start" | "stop" | "restart";
  method?: string;
  message?: string;
  error?: string;
  exit?: number;
  post_state?: ServiceState;
  post_pid?: number | null;
  post_process_count?: number;
}

export interface ServiceControlResponse {
  success: boolean;
  dry_run?: boolean;
  action?: "start" | "stop" | "restart";
  services?: string[];
  verify?: boolean;
  results?: ServiceControlResultEntry[];
  log_file?: string | null;
  message?: string;
  error?: string;
  /** Quando a VPS dispara operação assíncrona (start/stop/restart server completo). */
  operation?: ServerOperationStatus;
}

/* ─────────── Server Ops — progresso assíncrono ─────────── */

export type ServerOperationStage =
  | "queued"
  | "broadcast"
  | "countdown"
  | "backup"
  | "stop"
  | "start"
  | "restart"
  | "verify"
  | "completed"
  | "failed"
  | "unknown"
  | string;

export type ServerOperationSuccessState = "running" | "success" | "failed" | "error" | "cancelled" | string;

export interface ServerOperationStatus {
  id: string;
  type:
    | "startServer"
    | "stopServer"
    | "restartServer"
    | "startService"
    | "stopService"
    | "restartService"
    | string;
  stage: ServerOperationStage;
  running: boolean;
  success_state: ServerOperationSuccessState;
  success: boolean;
  created_at?: string | number | null;
  completed_at?: string | number | null;
  reason?: string | null;
  dry_run?: boolean;
  log_file?: string | null;
  countdown?: Array<{ seconds_left?: number; message?: string; sent_at?: string | number }> | null;
  backup?: {
    success?: boolean;
    path?: string | null;
    started_at?: string | number;
    completed_at?: string | number;
    error?: string | null;
  } | null;
  restart?: Record<string, unknown> | null;
  verification?: {
    success?: boolean;
    services?: Array<{ key: string; state: ServiceState; ok?: boolean; message?: string }>;
    started_at?: string | number;
    completed_at?: string | number;
  } | null;
  error?: string | null;
  cancel_requested?: boolean;
  cancelled?: boolean;
  cancel_reason?: string | null;
  services?: string[];
  instances?: string[];
  pending_instances?: string[];
  already_running_instances?: string[];
  autostart_sequential_codes?: string[];
  autostart_codes?: string[];
  results?: Array<{
    instances?: string[];
    success?: boolean;
  }>;
  native_autostart_hold?: {
    held_codes?: string[];
    released?: boolean;
    success?: boolean;
  } | null;
  instance_verification?: {
    requested?: boolean;
    success?: boolean;
    instances?: Array<{ code?: string; state?: string; running?: boolean }>;
  } | null;
}

export interface ServerOperationStatusResponse {
  success: boolean;
  operation?: ServerOperationStatus;
  error?: string;
  endpoint_missing?: boolean;
}

export interface CancelServerOperationResponse {
  success: boolean;
  already_requested?: boolean;
  operation?: ServerOperationStatus;
  error?: string;
}

/* ─────────── Operação do Servidor v1 ─────────── */

export type ServiceState = "online" | "offline" | "unknown";

export interface ServiceInfo {
  /** Identificador curto vindo da VPS (gamedbd, gdeliveryd, mysql, httpd...). */
  key: string;
  /** Rótulo amigável para exibir na UI. */
  label?: string;
  /** Nome real do processo no sistema (ex.: "gamedbd", "mysqld"). */
  process_name?: string;
  state: ServiceState;
  /** PID principal quando aplicável. */
  pid?: number | null;
  /** Quantidade total de processos vivos com esse nome. */
  process_count?: number;
  /** Lista completa de PIDs (quando há múltiplos). */
  pids?: number[];
  /** Porta TCP/UDP principal quando faz sentido. */
  port?: number | null;
  /** Estado reportado pelo systemd (active/inactive/unknown). */
  systemd_state?: string;
  /** True quando a porta está em LISTEN. */
  listening?: boolean;
  /** Mensagem livre (ex.: "PID file ausente"). */
  message?: string;
}

export interface ServiceStatusResponse {
  success: boolean;
  /** ISO string OU epoch seconds da coleta no PHP. */
  collected_at?: string | number;
  services: ServiceInfo[];
  error?: string;
}

export type ServerLogSource =
  | "apicls"
  | "authd"
  | "exportclsconfig"
  | "gacd"
  | "gamedbd"
  | "gdeliveryd"
  | "gfactiond"
  | "glinkd"
  | "gs01"
  | "httpd"
  | "logservice"
  | "mail"
  | "mysql"
  | "uniquenamed"
  | "world2"
  | "world2.formatlog";

export interface ServerLogEntry {
  /** ISO 8601 ou epoch — depende da origem. */
  ts?: string;
  /** Linha bruta. */
  line: string;
  /** Severidade adivinhada (best-effort). */
  level?: "info" | "warn" | "error" | "debug";
}

export interface ServerLogsResponse {
  success: boolean;
  source: ServerLogSource;
  /** Caminho do arquivo lido (informativo). */
  file?: string;
  /** Quantas linhas vieram. */
  count?: number;
  entries: ServerLogEntry[];
  /** Mensagem amigável quando o arquivo não existe / sem permissão. */
  warning?: string;
  /** Lista de sources disponíveis no host (best-effort do backend). */
  available_sources?: ServerLogSource[];
  error?: string;
}

export interface ExportClsconfigResponse {
  success: boolean;
  /** Caminho do log gerado pelo exportclsconfig.sh. */
  log_file?: string;
  /** Saída resumida do comando (best-effort). */
  output?: string;
  /** Backup do gamedbd gerado antes do export, quando aplicável. */
  gamedbd_backup?: { file?: string; bytes?: number };
  error?: string;
}

/* ─────────── Mensagem de Sistema (Server Ops v2) ─────────── */

export type SystemMessageKind = "system" | "broadcast" | "tip" | "world";
export type SystemMessagePriority = "low" | "normal" | "high";

export interface SendSystemMessagePayload {
  /** Texto da mensagem (1..200 chars por default). */
  message: string;
  /** Tipo de canal. Default: system. */
  kind?: SystemMessageKind;
  /** Prioridade visual/sonora repassada ao wrapper. Default: normal. */
  priority?: SystemMessagePriority;
  /** Quando true, valida sem entregar. */
  dry_run?: boolean;
}

export interface SendSystemMessageResponse {
  success: boolean;
  /** Eco do dry_run quando aplicável. */
  dry_run?: boolean;
  /** Eco do que foi enviado/validado. */
  message?: string;
  kind?: SystemMessageKind;
  priority?: SystemMessagePriority;
  /** Tamanho em chars (UTF-8) reportado pelo PHP. */
  length?: number;
  /** True quando o gdeliveryd entregou; false = enfileirado/queue. */
  delivered?: boolean;
  /** Mecanismo usado: lua_console, custom, no_native_handler... */
  method?: string;
  /** Caminho do log JSON gerado em backups/sysmsg-logs. */
  log_file?: string;
  /** Saída bruta quando o handler não retorna JSON. */
  raw?: string;
  /** Mensagem amigável quando ficou em queue. */
  note?: string;
  error?: string;
}

/* ─────────── Maintenance Mode (Server Ops v2) ─────────── */

export interface MaintenanceState {
  enabled: boolean;
  reason: string | null;
  eta_minutes: number | null;
  /** ISO 8601 UTC quando entrou em manutenção (mantido em ON consecutivos). */
  started_at: string | null;
  /** ISO 8601 UTC = started_at + eta_minutes (best-effort). */
  ends_at: string | null;
  /** IP/identificador do chamador no PHP (best-effort). */
  updated_by: string | null;
  /** ISO 8601 UTC do último update. */
  updated_at: string | null;
}

export interface SetMaintenanceModePayload {
  enabled: boolean;
  reason?: string;
  /** Tempo previsto em minutos (>=0, teto de 1440). */
  eta_minutes?: number | null;
  /** Quando true, dispara sendSystemMessage automaticamente. Default true. */
  broadcast?: boolean;
  dry_run?: boolean;
}

export interface MaintenanceBroadcastResult {
  attempted: boolean;
  result?: SendSystemMessageResponse;
  error?: string;
  skipped_reason?: string;
  planned?: boolean;
}

export interface SetMaintenanceModeResponse {
  success: boolean;
  dry_run?: boolean;
  /** Estado já persistido após a operação (em dry_run vem em `next`). */
  maintenance?: MaintenanceState;
  next?: MaintenanceState;
  previous?: MaintenanceState;
  broadcast?: MaintenanceBroadcastResult;
  error?: string;
}

export interface GetMaintenanceModeResponse {
  success: boolean;
  maintenance: MaintenanceState;
  error?: string;
}

/* ─────────── Server Rates (script.lua) ─────────── */

export interface ServerRateField {
  key: string;
  lua_constant: string;
  label: string;
  description?: string;
  group?: string;
  value: number;
  value_text?: string;
}

export interface GetServerRatesResponse {
  success: boolean;
  source_file: string;
  source_mtime?: number | null;
  requires_gs_reload?: boolean;
  reload_hint?: string;
  bounds?: { min: number; max: number };
  rates: Record<string, number>;
  fields: ServerRateField[];
  error?: string;
}

export interface SaveServerRatesPayload {
  rates: Record<string, string | number>;
  dry_run?: boolean;
}

export interface SaveServerRatesResponse extends GetServerRatesResponse {
  changed?: boolean;
  message?: string;
  backup_file?: string;
  updated_by?: string;
  updated_at?: string;
  changes?: Record<string, { before: number; after: number }>;
  dry_run?: boolean;
}

export interface MailItemAttachment {
  item_id: number;
  count: number;
  max_count?: number;
  proctype?: number;
  expire_date?: number;
  mask?: number;
  guid1?: number;
  guid2?: number;
  data?: string;
}

export interface SendMailItemPayload {
  roleid: number;
  subject?: string;
  body?: string;
  item: MailItemAttachment;
}

export interface SendMailGoldPayload {
  roleid: number;
  subject?: string;
  body?: string;
  /** Inteiro > 0, no menor denominador (PW armazena em "moedas de cobre"). */
  amount: number;
}

export interface SendMailResponse {
  success: boolean;
  roleid?: number;
  mail_id?: number;
  delivered?: boolean;
  error?: string;
}

/**
 * Resposta de `getBackupContent` — devolve o template completo do role
 * que foi salvo no backup, no mesmo shape de ClsTemplate (porém vinda
 * do snapshot do gamedbd no momento do save, não do clsconfig).
 *
 * Shape REAL retornado pela VPS (abr/2026):
 *   {
 *     success: true,
 *     backup: {
 *       template: {...},            // shape de ClsTemplate
 *       requested_payload: {...},   // payload enviado no saveRoleEditable que originou o backup
 *       roleid?: number,
 *       name?: string,
 *       ...
 *     }
 *   }
 *
 * Campos legados `template`/`role` no nível raiz são mantidos para
 * compatibilidade com versões antigas do PHP.
 */
export interface BackupContent {
  template?: unknown;
  requested_payload?: unknown;
  roleid?: number;
  name?: string;
  [k: string]: unknown;
}

export interface GetBackupContentResponse {
  success: boolean;
  /** Wrapper preferencial (PHP atual). */
  backup?: BackupContent;
  /** Legado: alguns deploys antigos devolviam estes campos no topo. */
  roleid?: number;
  name?: string;
  template?: unknown;
  role?: unknown;
  error?: string;
}

/* ─────────── Segurança v1 (kick / ban / unban) ─────────── */

export interface KickRolePayload {
  /** roleid do personagem alvo (obrigatório). */
  roleid: number;
  /** Motivo curto (auditoria). Obrigatório no front. */
  reason: string;
}

export interface BanAccountPayload {
  /** Identificador da conta. Pode ser nome de login OU userid. */
  account?: string;
  userid?: number;
  /** Roleid do personagem online — usado para kick pós-ban. */
  roleid?: number;
  /** Duração em segundos. Obrigatório para ban temporário. */
  duration_seconds?: number;
  /** true = ban permanente (não envia duration_seconds). */
  permanent?: boolean;
  reason: string;
  /** Quando true, a VPS valida sem aplicar. */
  dry_run?: boolean;
  /** Quando true, a VPS executa kick do roleid após o ban. */
  kick_online?: boolean;
  /** Tempo de aviso antes do kick (segundos). Default 10. */
  kick_seconds?: number;
}

export interface UnbanAccountPayload {
  userid: number;
  account?: string;
  roleid?: number;
  reason?: string;
  refresh_services?: string[];
  dry_run?: boolean;
}

export interface ClearRolePkPayload {
  roleid: number;
  reason?: string;
  kick_online?: boolean;
  kick_seconds?: number;
  dry_run?: boolean;
}

export interface ClearRolePkPkState {
  pk_count?: number;
  invader_state?: number;
  invader_time?: number;
  pariah_time?: number;
}

export interface QuickPunishmentPreset {
  key: string;
  label: string;
  summary: string;
  status: string;
  required_role: string;
  underlying_action: string;
  target_scope: "role" | "account" | string;
  duration_required: boolean;
  default_duration_seconds: number;
  max_duration_seconds?: number;
  supports_kick_online?: boolean;
}

export interface QuickPunishmentCatalogResponse {
  success: boolean;
  presets: QuickPunishmentPreset[];
  unsupported_presets?: QuickPunishmentPreset[];
  collected_at?: string;
  error?: string;
}

export interface QuickPunishmentPlan {
  preset_key?: string;
  label?: string;
  required_role?: string;
  underlying_action?: string;
  target_scope?: string;
  target?: { roleid?: number; userid?: number };
  reason?: string;
  duration_seconds?: number;
  permanent?: boolean;
  kick_online?: boolean;
  kick_seconds?: number;
  warnings?: string[];
}

export interface QuickPunishmentPayload {
  preset_key: string;
  roleid?: number;
  userid?: number;
  reason?: string;
  duration_seconds?: number;
  kick_online?: boolean;
}

export interface QuickPunishmentPreviewResponse {
  success: boolean;
  preset?: { key: string; label: string; summary?: string; required_role?: string };
  plan?: QuickPunishmentPlan;
  previewed_at?: string;
  error?: string;
}

export interface QuickPunishmentExecuteResponse {
  success: boolean;
  preset?: { key: string; label: string; required_role?: string };
  plan?: QuickPunishmentPlan;
  result?: SecurityActionResponse;
  executed_at?: string;
  error?: string;
}

export interface ClearRolePkResponse {
  success: boolean;
  dry_run?: boolean;
  roleid?: number;
  error?: string;
  gm_action?: {
    pk_clear?: {
      before?: ClearRolePkPkState;
      after?: ClearRolePkPkState;
      role_forbid_before?: unknown;
      role_forbid_after?: unknown;
      cleared?: boolean;
      changed?: boolean;
    };
    session_refresh?: {
      success?: boolean;
      role_forbid_cleanup?: { cleared?: boolean };
      post_refresh_role_forbid?: unknown;
    };
    [key: string]: unknown;
  };
}

export interface ForbidDelivery {
  before_type_ids?: number[];
  after_type_ids?: number[];
  applied_type_ids?: number[];
  inserted_type_ids?: number[];
  deleted_type_ids?: number[];
  account?: {
    before_type_ids?: number[];
    after_type_ids?: number[];
    [key: string]: unknown;
  };
  role_clear?: {
    cleared?: boolean;
    roleid?: number;
    message?: string;
  };
  [key: string]: unknown;
}

export interface GmActionBlock {
  action?: string;
  userid?: number;
  account_forbid_backend?: "forbid_table" | "gamedbd" | string;
  message?: string;
  delivery?: ForbidDelivery | { account?: ForbidDelivery };
  /** Ban details from the backend */
  account_ban?: {
    blocks_login?: boolean;
    duration_seconds?: number;
    forbid_until?: string;
    forbid_until_unix?: number;
    permanent?: boolean;
  };
  /** Session kick details (separate from ban) */
  session_kick?: {
    roleid?: number;
    seconds?: number;
    success?: boolean;
    message?: string;
  };
  /** Delivery daemon forbid notification evidence */
  deliveryd_forbid?: {
    success?: boolean;
    message?: string;
    [key: string]: unknown;
  };
  /** Role-level forbid clear (unban with roleid) */
  role_clear?: {
    cleared?: boolean;
    roleid?: number;
    message?: string;
    [key: string]: unknown;
  };
  /** Login cache refresh results (when refresh_services is used) */
  login_cache_refresh?: {
    requested?: string[];
    results?: Record<string, { success?: boolean; message?: string; [key: string]: unknown }>;
    [key: string]: unknown;
  };
}

export interface SecurityActionResponse {
  success: boolean;
  /** Eco da action executada (kick/ban/unban). */
  action?: string;
  /** roleid envolvido (kickRole sempre devolve). */
  roleid?: number;
  /** Conta envolvida quando aplicável. */
  account?: string;
  userid?: number;
  /** Duração efetiva do ban em segundos (ban temporário). */
  seconds?: number;
  /** Eco do motivo enviado. */
  reason?: string;
  /** Caminho do log gerado pelo script da VPS. */
  log_file?: string;
  /** epoch seconds em que o ban expira (ban temporário). */
  ban_until?: number | null;
  /** Estado pós-ação. */
  state?: "online" | "offline" | "banned" | "unbanned";
  /** Echo de dry_run quando aplicável. */
  dry_run?: boolean;
  message?: string;
  error?: string;
  /** Bloco detalhado retornado pelo backend real (ban/unban). */
  gm_action?: GmActionBlock;
}

export type SecurityHistoryAction = "kick" | "ban" | "unban";

export interface SecurityHistoryEntry {
  ts: number;
  action: SecurityHistoryAction;
  roleid?: number | null;
  account?: string | null;
  userid?: number | null;
  reason?: string | null;
  duration_seconds?: number | null;
  by?: string | null;
}

export interface SecurityHistoryResponse {
  success: boolean;
  count?: number;
  entries: SecurityHistoryEntry[];
  warning?: string;
  error?: string;
}


/* ─────────── Instance Control v1 ─────────── */

export type InstanceActionType =
  | "startInstance"
  | "startInstances"
  | "stopInstance"
  | "stopInstances"
  | "restartInstance"
  | "restartInstances";

export interface ManageableInstance {
  code: string;
  key: string;
  name: string;
  category: string;
  scope: string;
  configured: boolean;
  auto_start: boolean;
  auto_start_order: number | null;
  running: boolean;
  state: string; // "running" | "stopped" | ...
  running_source: string; // "process" | "listen_port" | "none" | ...
  pid: number | null;
  process_count: number;
  pids: number[];
  command_excerpt: string;
  batch_size: number;
  section_types: string[];
  section_type: string;
  player_per_instance: number | null;
  effect_player_per_instance: number | null;
  instance_capacity: number | null;
  listen_addr: string;
  listen_port: number;
  listening: boolean;
  supported_actions: string[];
  selectable: boolean;
}

export interface ManageableInstancesResponse {
  success: boolean;
  instances?: ManageableInstance[];
  count?: number;
  running_count?: number;
  auto_start_count?: number;
  collected_at?: string | number;
  source_files?: string[];
  error?: string;
}

/** Toggle individual: { code, enabled } OU lista completa: { codes }. */
export type SetInstanceAutoStartPayload =
  | { code: string; enabled: boolean }
  | { codes: string[] };

export interface SetInstanceAutoStartResponse {
  success: boolean;
  changed?: boolean;
  auto_start_codes?: string[];
  auto_start_count?: number;
  auto_start_instances?: ManageableInstance[];
  added?: string[];
  removed?: string[];
  previous_codes?: string[];
  error?: string;
}

export interface InstanceControlSinglePayload {
  code: string;
  verify?: boolean;
  dry_run?: boolean;
}

export interface InstanceControlBatchPayload {
  codes: string[];
  verify?: boolean;
  dry_run?: boolean;
}

export interface InstanceControlResponse {
  success: boolean;
  dry_run?: boolean;
  /** Operação assíncrona — usar id para abrir drawer de progresso. */
  operation?: ServerOperationStatus;
  error?: string;
}

/* ─────────── Control Center v1 ─────────── */

export interface HostHealthSnapshot {
  hostname?: string;
  ip?: string;
  uptime_seconds?: number;
  uptime_human?: string;
  cpu_percent?: number;
  cpu_cores?: number;
  load_average?: number[]; // [1m, 5m, 15m]
  memory?: {
    total_mb?: number;
    used_mb?: number;
    free_mb?: number;
    percent?: number;
  };
  disk?: {
    total_gb?: number;
    used_gb?: number;
    free_gb?: number;
    percent?: number;
    mountpoint?: string;
  };
  ping_ms?: number | null;
  response_time_ms?: number | null;
  collected_at?: string | number;
  [k: string]: unknown;
}

export interface ServicesSummary {
  total?: number;
  online?: number;
  offline?: number;
  unknown?: number;
  critical_offline?: number;
  [k: string]: unknown;
}

export interface InstancesSummary {
  total?: number;
  running?: number;
  stopped?: number;
  auto_start?: number;
  [k: string]: unknown;
}

export interface ControlCenterAlert {
  id?: string;
  severity?: "info" | "warn" | "warning" | "error" | "critical" | string;
  title?: string;
  message?: string;
  source?: string;
  created_at?: string | number;
  [k: string]: unknown;
}

export interface OperationRecentEntry {
  id?: string;
  type?: string;
  stage?: string;
  success?: boolean;
  success_state?: string;
  created_at?: string | number;
  completed_at?: string | number;
  services?: string[];
  instances?: string[];
  reason?: string | null;
  [k: string]: unknown;
}

export interface WatchdogStatusBlock {
  enabled?: boolean;
  critical_services?: string[];
  last_check_at?: string | number | null;
  last_success_at?: string | number | null;
  last_result?: "ok" | "degraded" | "failed" | string | null;
  cooldown_seconds?: number;
  cooldown_remaining?: number;
  unhealthy_services?: string[];
  healthy_services?: string[];
  trigger_services?: string[];
  critical_failure?: boolean;
  [k: string]: unknown;
}

export interface ControlCenterSnapshot {
  host?: HostHealthSnapshot;
  services?: {
    all?: ManageableService[];
    manageable?: ManageableService[];
    summary?: ServicesSummary;
  };
  instances?: {
    items?: ManageableInstance[];
    summary?: InstancesSummary;
  };
  maintenance?: MaintenanceState;
  watchdog?: WatchdogStatusBlock;
  operations?: {
    recent?: OperationRecentEntry[];
    running?: OperationRecentEntry[];
  };
  alerts?: ControlCenterAlert[];
  collected_at?: string | number;
  [k: string]: unknown;
}

export interface ControlCenterSnapshotResponse {
  success: boolean;
  snapshot: ControlCenterSnapshot;
  error?: string;
}

/* ─────────── Backups (panel-level) ─────────── */

export type PanelBackupKind =
  | "gamedbd"
  | "clsconfig"
  | "mysql"
  | "uniquenamed"
  | "panel"
  | "full";

export interface PanelBackupRecord {
  id?: string;
  type?: PanelBackupKind | string;
  name?: string;
  file?: string;
  bytes?: number;
  size?: number;
  created_at?: string | number;
  mtime?: number;
  sha1?: string;
  status?: "ok" | "running" | "failed" | string;
  source?: string;
  [k: string]: unknown;
}

export interface ListPanelBackupsResponse {
  success: boolean;
  count?: number;
  backups?: PanelBackupRecord[];
  // Tolerância: algumas versões do PHP devolvem agrupado por tipo
  grouped?: Record<string, PanelBackupRecord[]>;
  error?: string;
}

export interface BackupNowPayload {
  type: PanelBackupKind;
  reason?: string;
  dry_run?: boolean;
}

export interface BackupNowResponse {
  success: boolean;
  backup?: PanelBackupRecord;
  operation?: ServerOperationStatus;
  log_file?: string;
  error?: string;
}

/* ─────────── Watchdog ─────────── */

export interface WatchdogConfig {
  enabled?: boolean;
  critical_services?: string[];
  cooldown_seconds?: number;
  failure_threshold?: number;
  max_restart_attempts?: number;
  verify_restart?: boolean;
  pause_during_maintenance?: boolean;
  auto_restart?: boolean;
  notify?: boolean;
  [k: string]: unknown;
}

export interface WatchdogConfigResponse {
  success: boolean;
  config?: WatchdogConfig;
  status?: WatchdogStatusBlock;
  error?: string;
}

export interface WatchdogStatusResponse {
  success: boolean;
  status?: WatchdogStatusBlock;
  config?: WatchdogConfig;
  error?: string;
}

export interface WatchdogHistoryEntry {
  id?: string;
  ts?: string | number;
  result?: "ok" | "degraded" | "failed" | string;
  unhealthy_services?: string[];
  actions?: string[];
  duration_ms?: number;
  [k: string]: unknown;
}

export interface WatchdogHistoryResponse {
  success: boolean;
  count?: number;
  entries?: WatchdogHistoryEntry[];
  error?: string;
}

export interface WatchdogCheckResponse {
  success: boolean;
  result?: "ok" | "degraded" | "failed" | string;
  unhealthy_services?: string[];
  actions?: string[];
  duration_ms?: number;
  status?: WatchdogStatusBlock;
  error?: string;
}

/* ─────────── Game Portal (cadastro publico) ─────────── */

export interface GamePortalAdminSettings {
  enable_startup_gold: boolean;
  startup_gold: string;
  site_title: string;
  site_subtitle: string;
}

export interface GamePortalAdminConfigResponse {
  success: boolean;
  enabled: boolean;
  site_title: string;
  site_subtitle: string;
  banner_items?: string[];
  links?: {
    discord?: string;
    youtube?: string;
    admin_login?: string;
  };
  features?: {
    change_password?: boolean;
    startup_gold?: boolean;
  };
  rewards?: {
    startup_gold_enabled?: boolean;
    startup_gold_amount?: string;
  };
  settings?: GamePortalAdminSettings;
  settings_file?: string;
  has_runtime_overrides?: boolean;
  error?: string;
}

export interface SaveGamePortalAdminConfigPayload {
  enable_startup_gold?: boolean;
  startup_gold?: string;
  site_title?: string;
  site_subtitle?: string;
  landing_password_enabled?: boolean;
  landing_password?: string;
  clear_landing_password?: boolean;
}

export interface LandingAccessSessionEntry {
  id: string;
  ip?: string;
  label?: string;
  user_agent?: string;
  created_at?: string;
  last_seen_at?: string;
  token_suffix?: string;
  online?: boolean;
}

export interface LandingAccessSessionsResponse {
  success: boolean;
  protected?: boolean;
  landing_password_enabled?: boolean;
  landing_password_configured?: boolean;
  sessions?: LandingAccessSessionEntry[];
  total?: number;
  error?: string;
}

export interface SaveGamePortalAdminConfigResponse {
  success: boolean;
  message?: string;
  portal?: GamePortalAdminConfigResponse;
  error?: string;
}

export interface CreateStaffAccountPayload {
  login: string;
  password: string;
  enable_gold?: boolean;
  gold?: string;
  enable_gm?: boolean;
  gm_level?: number;
}

export interface CreateStaffAccountResponse {
  success: boolean;
  errors?: string[];
  messages?: string[];
  account?: {
    login?: string;
    userid?: number;
    email?: string;
    extras?: string[];
    gm_level?: number;
  };
  error?: string;
}

export interface MeridianTitlePreset {
  key: string;
  label: string;
  summary?: string;
  applies?: string[];
}

export interface MeridianTitleCatalogResponse {
  success: boolean;
  presets?: MeridianTitlePreset[];
  error?: string;
}

export interface MeridianTitlePresetPayload {
  preset_key: string;
  roleid?: number;
  userid?: number;
  name?: string;
  kick_online?: boolean;
  dry_run?: boolean;
}

export interface MeridianTitlePreviewResponse {
  success: boolean;
  would_change?: boolean;
  warnings?: string[];
  current?: { has_full_meridian?: boolean; has_full_titles?: boolean };
  after?: { has_full_meridian?: boolean; has_full_titles?: boolean };
  target?: { roleid?: number; name?: string; online?: boolean };
  error?: string;
  [k: string]: unknown;
}

export interface MeridianTitleApplyResponse {
  success: boolean;
  message?: string;
  changed?: boolean;
  error?: string;
  [k: string]: unknown;
}

/* ─────────── GM Commander v2 — Bulk Operations tipos ─────────── */

export interface BulkSelectionParams {
  roleids?: number[];
  userids?: number[];
  names?: string[];
  guild_id?: number;
  guild_ids?: number[];
  class_ids?: number[];
  level_min?: number;
  level_max?: number;
  online_only?: boolean;
  all_online?: boolean;
  ranking_key?: string;
  ranking_limit?: number;
}

export interface PlayerDirectoryEntry {
  roleid: number;
  userid?: number;
  name?: string;
  cls?: number;
  level?: number;
  guild?: string;
  guild_id?: number;
  online?: boolean;
  [k: string]: unknown;
}

export interface PlayerDirectoryResponse {
  success: boolean;
  entries: PlayerDirectoryEntry[];
  count: number;
  selection?: Record<string, unknown>;
  warnings?: string[];
  online_diagnostics?: Record<string, number>;
  capabilities?: Record<string, boolean>;
  error?: string;
}

export interface PlayerTargetProfile {
  roleid: number;
  userid?: number;
  name?: string;
  cls?: number;
  class_name?: string;
  level?: number;
  guild?: string;
  guild_id?: number;
  online?: boolean;
  [k: string]: unknown;
}

export interface PlayerTargetProfileResponse {
  success: boolean;
  profile: PlayerTargetProfile;
  resolved_at?: string;
  error?: string;
}

export type BulkCommandKey = "sendMailItem" | "sendMailGold" | "grantMallCash" | "sendSystemMessage";

export interface BulkTarget {
  roleid: number;
  userid?: number;
  name?: string;
  cls?: number;
  level?: number;
  guild?: string;
  online?: boolean;
  [k: string]: unknown;
}

export interface ResolveBulkTargetsPayload extends BulkSelectionParams {
  command_key: BulkCommandKey;
}

export interface ResolveBulkTargetsResponse {
  success: boolean;
  command_key: string;
  selection: Record<string, unknown>;
  count: number;
  targets: BulkTarget[];
  profiles: PlayerDirectoryEntry[];
  warnings: string[];
  resolved_at: string;
  error?: string;
}

export interface PreviewBulkTargetsPayload extends BulkSelectionParams {
  command_key: BulkCommandKey;
  /** Command-specific fields (item_id, count, amount, message, etc.) */
  [k: string]: unknown;
}

export interface BulkCommandPayloadPreview {
  item_id?: number;
  count?: number;
  money?: number;
  amount?: number | null;
  message?: string;
}

export interface PreviewBulkTargetsResponse {
  success: boolean;
  command_key: string;
  count: number;
  sample_size: number;
  sample_targets: BulkTarget[];
  selection: Record<string, unknown>;
  warnings: string[];
  command_payload_preview: BulkCommandPayloadPreview;
  previewed_at: string;
  error?: string;
}

export interface QueueBulkCommandPayload extends BulkSelectionParams {
  command_key: BulkCommandKey;
  bulk_notify_enabled?: boolean;
  bulk_notify_message?: string;
  bulk_notify_on_queue?: boolean;
  /** Command-specific fields */
  [k: string]: unknown;
}

export interface BulkJobSummary {
  id: string;
  command_key: string;
  status: "queued" | "processing" | "completed" | "failed" | "cancelled" | string;
  created_at: string;
  updated_at: string;
  target_count: number;
  completed_count?: number;
  failed_count?: number;
  actor?: { name?: string; ip?: string };
  selection?: Record<string, unknown>;
  warnings?: string[];
  [k: string]: unknown;
}

export interface QueueBulkCommandResponse {
  success: boolean;
  job: BulkJobSummary;
  job_file?: string;
  audit_file?: string;
  error?: string;
}

export interface GetBulkCommandJobResponse {
  success: boolean;
  job: BulkJobSummary & {
    command_payload?: Record<string, unknown>;
    targets_pending?: BulkTarget[];
    targets_completed?: BulkTarget[];
    targets_failed?: Array<BulkTarget & { error?: string }>;
    preview?: { sample_targets?: BulkTarget[] };
  };
  error?: string;
}

export interface GetBulkCommandJobsResponse {
  success: boolean;
  jobs: BulkJobSummary[];
  limit: number;
  collected_at: string;
  error?: string;
}

/* ─────────── GM Commander v2 — Bulk Templates tipos ─────────── */

export type BulkTemplateCategory = "evento" | "punicao" | "recompensa" | "broadcast";

export interface BulkTemplate {
  template_key: string;
  label: string;
  category: BulkTemplateCategory;
  command_key: BulkCommandKey;
  selection: BulkSelectionParams;
  default_payload: Record<string, unknown>;
  requires_preview: boolean;
  requires_confirmation: boolean;
  created_by?: string;
  updated_by?: string;
  created_at?: string;
  updated_at?: string;
}

export interface SaveBulkTemplatePayload {
  template_key: string;
  label: string;
  category: BulkTemplateCategory;
  command_key: BulkCommandKey;
  selection: BulkSelectionParams;
  default_payload: Record<string, unknown>;
  requires_preview?: boolean;
  requires_confirmation?: boolean;
}

export interface UpdateBulkTemplatePayload extends SaveBulkTemplatePayload {}

export interface ExecuteBulkTemplatePayload {
  template_key: string;
  mode: "queue" | "schedule";
  /** For schedule mode */
  schedule?: {
    day_of_week: number;
    time_utc: string;
    timezone?: string;
    name?: string;
  };
  /** Override default_payload */
  payload_overrides?: Record<string, unknown>;
  confirm?: string;
}

export interface BulkTemplateResponse {
  success: boolean;
  template: BulkTemplate;
  error?: string;
}

export interface BulkTemplatesListResponse {
  success: boolean;
  templates: BulkTemplate[];
  count: number;
  error?: string;
}

/* ─────────── GM Commander v2 — Bulk Schedule types ─────────── */

/** Summary returned by the VPS for each schedule */
export interface VpsBulkScheduleSummary {
  id: string;
  name: string;
  command_key: BulkCommandKey | string;
  enabled: boolean;
  weekdays: number[];
  time_of_day: string;
  timezone: string;
  created_at: string | null;
  updated_at: string | null;
  actor?: { name?: string; ip?: string };
  updated_by?: { name?: string; ip?: string };
  selection: Record<string, unknown>;
  preview_count: number;
  preview_warnings: string[];
  next_run_at: string | null;
  next_retry_at: string | null;
  last_run_at: string | null;
  last_job_id: string | null;
  last_result: string | null;
  last_error: string | null;
  last_error_at: string | null;
}

export interface ScheduleBulkCommandPayload {
  name?: string;
  command_key: BulkCommandKey | string;
  weekdays: number[];
  time_of_day: string;
  timezone?: string;
  enabled?: boolean;
  /** Selection params flattened or nested */
  selection?: BulkSelectionParams;
  /** Command-specific fields (item_id, count, amount, message, confirm, etc.) */
  [k: string]: unknown;
}

export interface ScheduleBulkCommandResponse {
  success: boolean;
  schedule: VpsBulkScheduleSummary;
  schedule_file?: string;
  audit_file?: string;
  error?: string;
}

export interface GetBulkSchedulesResponse {
  success: boolean;
  schedules: VpsBulkScheduleSummary[];
  limit: number;
  collected_at: string;
  error?: string;
}

/* ─────────── Operator Permissions — tipos ─────────── */

export type OperatorRole = "viewer" | "gm_operator" | "gm_supervisor" | "gm_admin" | "super_admin";

export interface OperatorPermissions {
  read: boolean;
  bulk_rewards: boolean;
  broadcast: boolean;
  cash_and_gm_permissions: boolean;
  restore_and_role_edit: boolean;
}

export interface OperatorPermissionStateResponse {
  success: boolean;
  operator: {
    id: string;
    email: string;
    name?: string;
    role: OperatorRole;
  };
  permissions: OperatorPermissions;
  mode: "audit" | "enforce";
  error?: string;
}

export interface OperatorPermissionCatalogResponse {
  success: boolean;
  roles: Record<OperatorRole, { label: string; permissions: OperatorPermissions }>;
  error?: string;
}

/* ─────────── Operator Registry — tipos ─────────── */

export interface OperatorRegistryEntry {
  id: string;
  email: string;
  name?: string;
  role: OperatorRole;
  enabled: boolean;
  allowed_ips?: string[];
}

export interface OperatorRegistryInvalidEntry {
  index?: number;
  reason?: string;
  error?: string;
  raw?: unknown;
  [key: string]: unknown;
}

export interface OperatorRoleMeta {
  label?: string;
  description?: string;
  [key: string]: unknown;
}

export interface OperatorRegistryResponse {
  success: boolean;
  operators: OperatorRegistryEntry[];
  roles?: OperatorRole[] | null;
  role_meta?: Partial<Record<OperatorRole, OperatorRoleMeta>>;
  invalid_entries?: OperatorRegistryInvalidEntry[];
  registry_file?: string | null;
  updated_at?: string | null;
  error?: string;
}

export interface GetBulkScheduleResponse {
  success: boolean;
  schedule: Record<string, unknown>;
  summary: VpsBulkScheduleSummary;
  schedule_file?: string;
  error?: string;
}
