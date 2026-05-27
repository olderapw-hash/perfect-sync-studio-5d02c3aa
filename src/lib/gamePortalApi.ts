const DEFAULT_API = "/apicls/api_cls.php";

function apiBase(): string {
  const fromEnv = import.meta.env.VITE_GAME_PORTAL_API as string | undefined;
  return (fromEnv && fromEnv.trim()) || DEFAULT_API;
}

/** Base da API admin (modo VPS direto). */
export function getVpsApiBase(): string {
  return apiBase();
}

/** Gateway Meridiano/Títulos (modo VPS direto). */
export function getVpsMeridianApiBase(): string {
  return meridianApiBase();
}

export function buildPortalAdminHeaders(opts: {
  secret: string;
  operatorId?: string;
  operatorEmail?: string;
  operatorName?: string;
}): Record<string, string> {
  return portalAdminHeaders(opts);
}

async function portalFetch<T>(
  action: string,
  init?: RequestInit & { query?: Record<string, string | number | undefined> },
): Promise<T> {
  const qs = new URLSearchParams();
  qs.set("action", action);
  if (init?.query) {
    for (const [key, val] of Object.entries(init.query)) {
      if (val !== undefined && val !== "") qs.set(key, String(val));
    }
  }
  const { query: _query, ...fetchInit } = init ?? {};
  const url = `${apiBase()}?${qs.toString()}`;
  const res = await fetch(url, {
    ...fetchInit,
    headers: {
      "Content-Type": "application/json",
      ...(fetchInit.headers ?? {}),
    },
  });
  const data = (await res.json()) as T & { error?: string; success?: boolean };
  if (typeof data.error === "string" && data.error && data.success !== true) {
    throw new Error(data.error);
  }
  if (!res.ok && data.success !== true) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return data;
}

export interface GamePortalConfig {
  success: boolean;
  enabled: boolean;
  site_title: string;
  site_subtitle: string;
  banner_items: string[];
  links: {
    discord: string;
    youtube: string;
    admin_login: string;
  };
  features: {
    change_password: boolean;
    startup_gold: boolean;
    gm_on_register?: boolean;
  };
  rewards?: {
    startup_gold_enabled: boolean;
    startup_gold_amount: string;
    gm_on_register?: boolean;
    gm_zoneid?: number;
  };
  landing?: {
    protected: boolean;
  };
  settings?: {
    landing_password_enabled?: boolean;
    landing_password_configured?: boolean;
  };
}

export interface PortalResult {
  success: boolean;
  errors?: string[];
  messages?: string[];
  account?: { login: string; userid: number };
}

export interface CheckLoginResult {
  success: boolean;
  login: string;
  valid: boolean;
  exists: boolean;
  available: boolean;
  error?: string;
}

export function fetchGamePortalConfig() {
  return portalFetch<GamePortalConfig>("getGamePortalConfig");
}

export interface GamePortalLandingStatus {
  success: boolean;
  protected: boolean;
  unlocked: boolean;
  site_title?: string;
  site_subtitle?: string;
  access_token?: string;
  session?: LandingAccessSession;
  error?: string;
}

export interface LandingAccessSession {
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
  sessions?: LandingAccessSession[];
  total?: number;
  error?: string;
}

export function fetchGamePortalLandingStatus(accessToken?: string) {
  return portalFetch<GamePortalLandingStatus>("getGamePortalLandingStatus", {
    query: accessToken ? { access_token: accessToken } : undefined,
  });
}

export function verifyGamePortalLandingPassword(password: string) {
  return portalFetch<GamePortalLandingStatus>("verifyGamePortalLandingPassword", {
    method: "POST",
    body: JSON.stringify({ password }),
  });
}

export function fetchLandingAccessSessions(opts?: PortalAdminOpts) {
  return portalFetch<LandingAccessSessionsResponse>("listLandingAccessSessions", {
    method: "GET",
    headers: opts ? portalAdminHeaders(opts) : undefined,
  });
}

export function revokeLandingAccessSession(sessionId: string, opts?: PortalAdminOpts) {
  return portalFetch<{ success: boolean; message?: string; error?: string }>(
    "revokeLandingAccessSession",
    {
      method: "POST",
      headers: opts ? portalAdminHeaders(opts) : undefined,
      body: JSON.stringify({ session_id: sessionId }),
    },
  );
}

export function revokeAllLandingAccessSessions(opts?: PortalAdminOpts) {
  return portalFetch<{ success: boolean; message?: string; revoked_count?: number; error?: string }>(
    "revokeAllLandingAccessSessions",
    {
      method: "POST",
      headers: opts ? portalAdminHeaders(opts) : undefined,
      body: JSON.stringify({}),
    },
  );
}

export interface SaveGamePortalSettingsPayload {
  enable_startup_gold?: boolean;
  startup_gold?: string;
  site_title?: string;
  site_subtitle?: string;
  landing_password_enabled?: boolean;
  landing_password?: string;
  clear_landing_password?: boolean;
}

export interface SaveGamePortalSettingsResponse {
  success: boolean;
  message?: string;
  portal?: GamePortalConfig;
  error?: string;
}

/** Salva config do portal direto na VPS (modo self-hosted, sem Supabase proxy). */
export async function saveGamePortalAdminConfigDirect(
  body: SaveGamePortalSettingsPayload,
  opts: { secret: string; operatorId?: string; operatorEmail?: string; operatorName?: string },
) {
  return portalFetch<SaveGamePortalSettingsResponse>("saveGamePortalAdminConfig", {
    method: "POST",
    headers: portalAdminHeaders(opts),
    body: JSON.stringify(body),
  });
}

export function gamePortalAdminSecret(): string {
  const fromEnv =
    (import.meta.env.VITE_GAME_PORTAL_ADMIN_SECRET as string | undefined) ||
    (import.meta.env.VITE_PW_API_SECRET as string | undefined);
  return (fromEnv && fromEnv.trim()) || "";
}

export function canUseDirectGamePortalAdminSave(): boolean {
  return gamePortalAdminSecret().length > 0;
}

/** Alias: modo VPS direto (secret no build) — Meridiano, staff, portal admin. */
export function canUseDirectVpsApi(): boolean {
  return canUseDirectGamePortalAdminSave();
}

export function gamePortalOperatorOpts(user?: {
  id?: string;
  email?: string | null;
  user_metadata?: Record<string, unknown>;
} | null) {
  return {
    secret: gamePortalAdminSecret(),
    operatorId: user?.id,
    operatorEmail: user?.email ?? undefined,
    operatorName:
      (user?.user_metadata?.full_name as string | undefined) ||
      (user?.user_metadata?.name as string | undefined),
  };
}

function meridianApiBase(): string {
  const base = apiBase();
  if (/api_cls(?:_[a-z_]+)?\.php$/i.test(base)) {
    return base.replace(/api_cls(?:_[a-z_]+)?\.php$/i, "api_cls_meridian_titles.php");
  }
  return "/apicls/api_cls_meridian_titles.php";
}

async function meridianFetch<T>(
  action: string,
  init?: RequestInit,
): Promise<T> {
  const url = `${meridianApiBase()}?action=${encodeURIComponent(action)}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok && !("success" in (data as object)) && !("presets" in (data as object))) {
    throw new Error((data as { error?: string }).error || `HTTP ${res.status}`);
  }
  return data;
}

export interface MeridianTitlePresetSummary {
  key: string;
  label: string;
  summary?: string;
  applies?: string[];
}

export interface MeridianTitleCatalogResponse {
  success?: boolean;
  presets?: MeridianTitlePresetSummary[];
  error?: string;
}

export interface MeridianTitlePresetPayload {
  preset_key: string;
  roleid: number;
  kick_online?: boolean;
  dry_run?: boolean;
}

export interface MeridianTitlePreviewResponse {
  success?: boolean;
  would_change?: boolean;
  error?: string;
  [key: string]: unknown;
}

export interface MeridianTitleApplyResponse {
  success?: boolean;
  message?: string;
  error?: string;
  [key: string]: unknown;
}

/** Meridiano/Títulos direto na VPS (gateway api_cls_meridian_titles.php). */
export function getMeridianTitlePresetCatalogDirect(
  opts: { secret: string; operatorId?: string; operatorEmail?: string; operatorName?: string },
) {
  return meridianFetch<MeridianTitleCatalogResponse>("getMeridianTitlePresetCatalog", {
    method: "GET",
    headers: portalAdminHeaders(opts),
  });
}

export function previewMeridianTitlePresetDirect(
  body: MeridianTitlePresetPayload,
  opts: { secret: string; operatorId?: string; operatorEmail?: string; operatorName?: string },
) {
  return meridianFetch<MeridianTitlePreviewResponse>("previewMeridianTitlePreset", {
    method: "POST",
    headers: portalAdminHeaders(opts),
    body: JSON.stringify(body),
  });
}

export function applyMeridianTitlePresetDirect(
  body: MeridianTitlePresetPayload,
  opts: { secret: string; operatorId?: string; operatorEmail?: string; operatorName?: string },
) {
  return meridianFetch<MeridianTitleApplyResponse>("applyMeridianTitlePreset", {
    method: "POST",
    headers: portalAdminHeaders(opts),
    body: JSON.stringify(body),
  });
}

export interface PlayerTargetProfileDirect {
  roleid?: number;
  userid?: number;
  name?: string;
  resolution_note?: string;
  [key: string]: unknown;
}

export interface PlayerTargetProfileDirectResponse {
  success: boolean;
  profile?: PlayerTargetProfileDirect;
  resolved_at?: string;
  error?: string;
}

export interface MallCashWalletSnapshot {
  shop_balance_gold?: number;
  shop_balance_units?: number;
  cash_gold?: number;
  cash_units?: number;
  cash_add_gold?: number;
  cash_add_units?: number;
  cash_used_gold?: number;
  cash_used_units?: number;
  cash_total_gold?: number;
  cash_total_units?: number;
  [key: string]: unknown;
}

export interface MallCashBalanceDirectResponse {
  success: boolean;
  roleid?: number;
  userid?: number | null;
  account?: unknown;
  target?: { roleid?: number; userid?: number; role_name?: string };
  wallet?: MallCashWalletSnapshot;
  collected_at?: string;
  error?: string;
}

export interface NormalizedMallCashBalance {
  success: boolean;
  roleid?: number;
  userid?: number | null;
  account?: string | null;
  wallet: MallCashWalletSnapshot;
  collected_at?: string;
  error?: string;
}

/** API devolve account como objeto; normaliza para UI segura. */
export function normalizeMallCashBalance(raw: MallCashBalanceDirectResponse): NormalizedMallCashBalance {
  const target = raw.target ?? {};
  const wallet = raw.wallet && typeof raw.wallet === "object" ? raw.wallet : {};
  let accountLabel: string | null = null;
  if (typeof raw.account === "string" && raw.account.trim()) {
    accountLabel = raw.account.trim();
  } else if (typeof target.role_name === "string" && target.role_name.trim()) {
    accountLabel = target.role_name.trim();
  } else if (target.userid) {
    accountLabel = `userid ${target.userid}`;
  }
  return {
    success: Boolean(raw.success),
    roleid: raw.roleid ?? target.roleid,
    userid: raw.userid ?? target.userid ?? null,
    account: accountLabel,
    wallet,
    collected_at: raw.collected_at,
    error: raw.error,
  };
}

export interface GrantMallCashDirectPayload {
  roleid?: number;
  userid?: number;
  amount: number;
  reason: string;
  confirm?: "GRANT_MALL_CASH";
  dry_run?: boolean;
}

export interface GrantMallCashDirectResponse {
  success: boolean;
  dry_run?: boolean;
  roleid?: number;
  amount?: number;
  reason?: string;
  grant_result?: { error_code?: number; message?: string; [key: string]: unknown };
  wallet_before?: MallCashWalletSnapshot;
  wallet_after?: MallCashWalletSnapshot;
  balance_change?: { cash_total_gold?: number; [key: string]: unknown };
  warning?: string;
  error?: string;
  [key: string]: unknown;
}

type PortalAdminOpts = {
  secret: string;
  operatorId?: string;
  operatorEmail?: string;
  operatorName?: string;
};

/** Perfil do jogador direto na VPS (GM Commander / Mall cash). */
export function getPlayerTargetProfileDirect(
  target: { roleid?: number; userid?: number; name?: string },
  opts: PortalAdminOpts,
) {
  const query: Record<string, string | number> = {};
  if (target.roleid != null) query.roleid = target.roleid;
  if (target.userid != null) query.userid = target.userid;
  if (target.name?.trim()) query.name = target.name.trim();
  return portalFetch<PlayerTargetProfileDirectResponse>("getPlayerTargetProfile", {
    method: "GET",
    query,
    headers: portalAdminHeaders(opts),
  });
}

/** Saldo mall cash direto na VPS. */
export function getMallCashBalanceDirect(roleid: number, opts: PortalAdminOpts) {
  return portalFetch<MallCashBalanceDirectResponse>("getMallCashBalance", {
    method: "GET",
    query: { roleid },
    headers: portalAdminHeaders(opts),
  });
}

/** Conceder gold da loja direto na VPS. */
export function grantMallCashDirect(body: GrantMallCashDirectPayload, opts: PortalAdminOpts) {
  return portalFetch<GrantMallCashDirectResponse>("grantMallCash", {
    method: "POST",
    headers: portalAdminHeaders(opts),
    body: JSON.stringify(body),
  });
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

function portalAdminHeaders(opts: {
  secret: string;
  operatorId?: string;
  operatorEmail?: string;
  operatorName?: string;
}): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-sync-secret": opts.secret,
  };
  if (opts.operatorId) headers["x-operator-id"] = opts.operatorId;
  if (opts.operatorEmail) headers["x-operator-email"] = opts.operatorEmail;
  if (opts.operatorName) headers["x-operator-name"] = opts.operatorName;
  return headers;
}

/** Cria conta staff direto na VPS (modo self-hosted, sem Supabase proxy). */
export async function createStaffAccountDirect(
  body: CreateStaffAccountPayload,
  opts: { secret: string; operatorId?: string; operatorEmail?: string; operatorName?: string },
) {
  return portalFetch<CreateStaffAccountResponse>("createStaffAccount", {
    method: "POST",
    headers: portalAdminHeaders(opts),
    body: JSON.stringify(body),
  });
}

export function checkGameLogin(login: string) {
  return portalFetch<CheckLoginResult>("checkGameLogin", {
    query: { login },
  });
}

export function registerGameAccount(login: string, password: string) {
  return portalFetch<PortalResult>("registerGameAccount", {
    method: "POST",
    body: JSON.stringify({ login, password }),
  });
}

export function changeGamePassword(
  login: string,
  newPassword: string,
  confirmPassword: string,
) {
  return portalFetch<PortalResult>("changeGamePassword", {
    method: "POST",
    body: JSON.stringify({
      login,
      new_password: newPassword,
      confirm_password: confirmPassword,
    }),
  });
}
