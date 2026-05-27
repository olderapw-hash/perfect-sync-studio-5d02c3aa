// /admin/gm — GM Commander v1
//
// Painel operacional para Game Masters. Consome os endpoints do api_cls.php
// (via clsconfig-proxy) já validados no backend do PWOLD:
//
//   Compensação:  sendMailItem · sendMailGold · grantMallCash
//   Moderação:    kickRole · banAccount · unbanAccount · muteAccount · muteRole
//   Comunicação:  sendSystemMessage
//   Histórico:    getGmActionHistory
//   Capacidade:   getGmCommandCatalog
//
// Regras importantes:
//   1. Capacidade real = getGmCommandCatalog. Actions com state diferente
//      de "supported" aparecem desabilitadas com badge "em breve".
//   2. Toda ação destrutiva passa por dialog de confirmação que FORÇA
//      um dry_run primeiro (preview) antes de liberar a execução real.
//   3. sendMailGold (moedas normais) ≠ grantMallCash (gold da loja).
//      A UI mantém os dois em cards separados com tooltip explicando.
//   4. grantMallCash valida o sucesso operacional via balance_change e
//      wallet_after.cash_total — NÃO assume cash_gold isolado.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Award,
  Ban,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Clock,
  Eye,
  EyeOff,
  Coins,
  Crown,
  Crosshair,
  Flame,
  Gamepad2,
  Gift,
  Globe,
  Hammer,
  Heart,
  History as HistoryIcon,
  Key,
  Loader2,
  Lock,
  LogOut,
  Mail,
  Megaphone,
  MessageSquare,
  Paintbrush,
  RefreshCw,
  Scroll,
  Settings,
  Shield,
  ShieldAlert,
  ShieldCheck,
  ShieldOff,
  Skull,
  Sparkles,
  Star,
  Sword,
  Swords,
  Target,
  Trophy,
  Users,
  VolumeX,
  Wallet,
  Wand2,
  XCircle,
  Zap,
  type LucideIcon,
} from "lucide-react";
// toast replaced by GmFeedback overlay

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { NoActiveServerState } from "@/components/admin/NoActiveServerState";
import { EndpointMissingNotice } from "@/components/admin/EndpointMissingNotice";
import { BulkCommanderTab } from "@/components/admin/BulkCommanderTab";

import { useAuth } from "@/hooks/useAuth";
import { OperatorPermissionsProvider, useOperatorPermissions } from "@/hooks/useOperatorPermissions";
import { useServers } from "@/hooks/useServers";
import { useServerPermissions } from "@/hooks/useServerPermissions";
import { logAuditEvent } from "@/lib/auditLog";
import { canUseDirectVpsApi, normalizeMallCashBalance, type NormalizedMallCashBalance } from "@/lib/gamePortalApi";
import { cn } from "@/lib/utils";
import {
  EndpointMissingError,
  pwApi,
  type ClearRolePkResponse,
  type ForbidDelivery,
  type GmActionBlock,
  type GmActionHistoryEntry,
  type GmCommandCapability,
  type GmCommandCatalogResponse,
  type GmPermissionMutationResponse,
  type GmPermissionRule,
  type GmPermissionStateResponse,
  type GmPermissionSummary,
  type GrantMallCashResponse,
  type MallCashBalanceResponse,
  type MallCashWallet,
  type MeridianTitlePreset,
  type MeridianTitleApplyResponse,
  type MeridianTitlePreviewResponse,
  type PlayerTargetProfile,
  type QuickPunishmentExecuteResponse,
  type QuickPunishmentPreset,
  type QuickPunishmentPreviewResponse,
  type SecurityActionResponse,
} from "@/lib/pwApiActions";

/* -------------------------------------------------------------------------- */
/* GmFeedback — centered card overlay instead of corner toasts                */
/* -------------------------------------------------------------------------- */

type FeedbackType = "success" | "error" | "info" | "warning";
interface FeedbackItem {
  id: number;
  type: FeedbackType;
  title: string;
  description?: string;
}

interface FeedbackAPI {
  success: (title: string, opts?: { description?: string } | string) => void;
  error: (title: string, opts?: { description?: string } | string) => void;
  info: (title: string, opts?: { description?: string } | string) => void;
  warning: (title: string, opts?: { description?: string } | string) => void;
}

const FeedbackCtx = createContext<FeedbackAPI | null>(null);

function useFeedback(): FeedbackAPI {
  const ctx = useContext(FeedbackCtx);
  if (!ctx) throw new Error("useFeedback must be inside FeedbackProvider");
  return ctx;
}

function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const nextId = useRef(0);

  const push = useCallback((type: FeedbackType, title: string, opts?: { description?: string } | string) => {
    const id = nextId.current++;
    const description = typeof opts === "string" ? opts : opts?.description;
    setItems((prev) => [...prev, { id, type, title, description }]);
    setTimeout(() => setItems((prev) => prev.filter((i) => i.id !== id)), 3500);
  }, []);

  const api = useMemo<FeedbackAPI>(
    () => ({
      success: (t, o?) => push("success", t, o),
      error: (t, o?) => push("error", t, o),
      info: (t, o?) => push("info", t, o),
      warning: (t, o?) => push("warning", t, o),
    }),
    [push],
  );

  const iconMap: Record<FeedbackType, React.ReactNode> = {
    success: <CheckCircle2 className="h-6 w-6 text-emerald-400" />,
    error: <XCircle className="h-6 w-6 text-red-400" />,
    info: <AlertTriangle className="h-6 w-6 text-blue-400" />,
    warning: <AlertTriangle className="h-6 w-6 text-amber-400" />,
  };

  const bgMap: Record<FeedbackType, string> = {
    success: "border-emerald-500/50 bg-emerald-950/90",
    error: "border-red-500/50 bg-red-950/90",
    info: "border-blue-500/50 bg-blue-950/90",
    warning: "border-amber-500/50 bg-amber-950/90",
  };

  return (
    <FeedbackCtx.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-0 z-[200] flex flex-col items-center justify-center gap-3">
        {items.map((item) => (
          <div
            key={item.id}
            className={cn(
              "pointer-events-auto animate-in fade-in zoom-in-95 slide-in-from-bottom-4 duration-300",
              "rounded-xl border px-6 py-4 shadow-2xl backdrop-blur-md",
              "flex items-start gap-3 max-w-md w-full",
              bgMap[item.type],
            )}
          >
            <div className="mt-0.5">{iconMap[item.type]}</div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">{item.title}</p>
              {item.description && (
                <p className="mt-0.5 text-xs text-muted-foreground">{item.description}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </FeedbackCtx.Provider>
  );
}

/* -------------------------------------------------------------------------- */
/* Capabilities — fonte da verdade do que está suportado de fato              */
/* -------------------------------------------------------------------------- */

const FALLBACK_SUPPORTED = new Set([
  "sendMailItem",
  "sendMailGold",
  "grantMallCash",
  "kickRole",
  "banAccount",
  "unbanAccount",
  "muteAccount",
  "muteRole",
  "sendSystemMessage",
  "clearRolePk",
  "getQuickPunishmentCatalog",
  "previewQuickPunishment",
  "executeQuickPunishment",
  "getMeridianTitlePresetCatalog",
  "previewMeridianTitlePreset",
  "applyMeridianTitlePreset",
  // GM Permissions v2 — backend confirmado.
  "getGmPermissionCatalog",
  "getGmPermissionState",
  "grantGmPermission",
  "revokeGmPermission",
  // GM Commander v2 — Bulk Operations (Fase A homologada).
  "searchPlayerDirectory",
  "searchGuildDirectory",
  "resolveBulkTargets",
  "previewBulkTargets",
  "queueBulkCommand",
  "getBulkCommandJob",
  "getBulkCommandJobs",
  // GM Commander v2 — Bulk Templates (Fase B homologada).
  "saveBulkTemplate",
  "getBulkTemplate",
  "getBulkTemplates",
  "updateBulkTemplate",
  "deleteBulkTemplate",
  "previewBulkTemplate",
  "executeBulkTemplate",
]);

const FALLBACK_UNSUPPORTED = new Set<string>([]);

function normalizeCatalog(
  cat: GmCommandCatalogResponse | null,
): Map<string, GmCommandCapability> {
  const map = new Map<string, GmCommandCapability>();
  if (!cat) return map;
  if (Array.isArray(cat.capabilities)) {
    for (const c of cat.capabilities) map.set(c.action, c);
  }
  if (cat.commands && typeof cat.commands === "object") {
    for (const [k, v] of Object.entries(cat.commands)) map.set(k, v);
  }
  return map;
}

function isSupported(
  action: string,
  caps: Map<string, GmCommandCapability>,
): boolean {
  const c = caps.get(action);
  if (c) return c.state === "supported";
  // Fallback: se o catálogo não devolveu nada (versão antiga da VPS),
  // confia na lista canônica de actions validadas.
  if (FALLBACK_SUPPORTED.has(action)) return true;
  if (FALLBACK_UNSUPPORTED.has(action)) return false;
  return false;
}

/* -------------------------------------------------------------------------- */
/* Tab icon customization (superadmin only, localStorage)                      */
/* -------------------------------------------------------------------------- */

const ICON_CATALOG: Record<string, LucideIcon> = {
  Gift, Hammer, MessageSquare, Shield, History: HistoryIcon, Wand2, Zap, Sparkles,
  Mail, Coins, Wallet, Ban, ShieldOff, ShieldCheck, VolumeX, LogOut,
  Sword, Swords, Crown, Star, Trophy, Award, Flame, Skull, Target, Crosshair,
  Heart, Globe, Key, Lock, Megaphone, Scroll, BookOpen, Gamepad2, Users, Paintbrush,
  Settings, Clock, RefreshCw, AlertTriangle,
};

const ICON_NAMES = Object.keys(ICON_CATALOG);

/** Game icons from PW sprite sheet — stored in public/gm-icons/ */
const PW_ICON_NAMES = [
  "crystal", "phoenix", "crown", "shield", "coin", "lotus", "rose", "star",
  "hourglass", "dragon", "dragon2", "chest", "firebird", "sword", "orb",
  "fire", "flower", "gem", "diamond", "scroll", "book", "scroll2", "feather",
  "sparkle", "jade", "coinbronze", "globe", "hammer", "gift", "moon", "pet",
  "bag", "potion", "gold", "sun", "crystal2", "mail", "quill", "heart", "wand",
];

const ROLE_LABELS: Record<string, string> = {
  viewer: "Viewer",
  gm_operator: "GM Operator",
  gm_supervisor: "GM Supervisor",
  gm_admin: "GM Admin",
  super_admin: "Super Admin",
};

type TabKey = "compensation" | "moderation" | "communication" | "permissions" | "meridian" | "bulk" | "history";


const DEFAULT_TAB_ICONS: Record<TabKey, string> = {
  compensation: "Gift",
  moderation: "Hammer",
  communication: "MessageSquare",
  permissions: "Shield",
  meridian: "BookOpen",
  bulk: "Users",
  history: "History",
};

const TAB_ICON_STORAGE_KEY = "gm-tab-icons";

function loadTabIcons(): Record<TabKey, string> {
  try {
    const raw = localStorage.getItem(TAB_ICON_STORAGE_KEY);
    if (raw) return { ...DEFAULT_TAB_ICONS, ...JSON.parse(raw) };
  } catch { /* noop */ }
  return { ...DEFAULT_TAB_ICONS };
}

function saveTabIcons(icons: Record<TabKey, string>) {
  localStorage.setItem(TAB_ICON_STORAGE_KEY, JSON.stringify(icons));
}

/** Returns true if the icon key refers to a PW game icon (prefixed with "pw:") */
function isPwIcon(name: string): boolean {
  return name.startsWith("pw:");
}

/** Render a tab icon — either Lucide component or PW game image */
function TabIconRenderer({ name, className }: { name: string; className?: string }) {
  if (isPwIcon(name)) {
    const pwName = name.slice(3);
    return (
      <img
        src={`/gm-icons/${pwName}.png`}
        alt={pwName}
        className={cn("inline-block rounded-sm object-contain", className)}
        style={{ width: "1em", height: "1em" }}
      />
    );
  }
  const LucideComp = ICON_CATALOG[name] ?? Gift;
  return <LucideComp className={className} />;
}

/* -------------------------------------------------------------------------- */
/* Card visibility (superadmin controls which cards other users see)            */
/* -------------------------------------------------------------------------- */

const CARD_VISIBILITY_KEY = "gm-card-visibility";

function loadCardVisibility(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(CARD_VISIBILITY_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* noop */ }
  return {};
}

function saveCardVisibility(v: Record<string, boolean>) {
  localStorage.setItem(CARD_VISIBILITY_KEY, JSON.stringify(v));
}

function isCardVisible(cardId: string, visibility: Record<string, boolean>): boolean {
  return visibility[cardId] !== false;
}

/* -------------------------------------------------------------------------- */
/* Página principal                                                            */
/* -------------------------------------------------------------------------- */

export default function GmCommanderPage() {
  return (
    <FeedbackProvider>
      <OperatorPermissionsProvider>
        <GmCommanderPageInner />
      </OperatorPermissionsProvider>
    </FeedbackProvider>
  );
}

function GmCommanderPageInner() {
  const toast = useFeedback();
  const { active } = useServers();
  const { isSuperadmin } = useAuth();
  const { can, loading: permLoading } = useServerPermissions();
  const opPerms = useOperatorPermissions();
  const [catalog, setCatalog] = useState<GmCommandCatalogResponse | null>(null);
  const [catalogMissing, setCatalogMissing] = useState(false);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [historyTick, setHistoryTick] = useState(0);
  const [tabIcons, setTabIcons] = useState<Record<TabKey, string>>(loadTabIcons);
  const [cardVisibility, setCardVisibility] = useState<Record<string, boolean>>(loadCardVisibility);

  const toggleCardVisibility = useCallback((cardId: string) => {
    setCardVisibility((prev) => {
      const next = { ...prev, [cardId]: prev[cardId] === false ? true : false };
      saveCardVisibility(next);
      return next;
    });
  }, []);

  const caps = useMemo(() => normalizeCatalog(catalog), [catalog]);

  const loadCatalog = useCallback(async () => {
    setCatalogLoading(true);
    setCatalogMissing(false);
    try {
      const res = await pwApi.getGmCommandCatalog();
      setCatalog(res);
    } catch (e) {
      if (e instanceof EndpointMissingError) {
        // Catálogo ausente não bloqueia a UI: caímos no fallback canônico.
        setCatalog(null);
        setCatalogMissing(true);
      } else {
        toast.error(e instanceof Error ? e.message : String(e));
      }
    } finally {
      setCatalogLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  const refreshHistory = useCallback(() => setHistoryTick((t) => t + 1), []);

  if (!active) return <NoActiveServerState />;
  const allowed = isSuperadmin || can("manage_security");
  if (!permLoading && !allowed) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="max-w-md rounded-2xl border border-destructive/40 bg-destructive/10 p-8 text-center">
          <ShieldAlert className="mx-auto mb-3 h-8 w-8 text-destructive" />
          <h2 className="text-base font-extrabold uppercase tracking-wider text-foreground">
            Sem permissão
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Permissão <strong>manage_security</strong> obrigatória para o GM
            Commander.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      <header className="relative overflow-hidden border-b border-border/50 bg-gradient-to-r from-card/90 via-card/60 to-card/40 px-6 py-5 backdrop-blur-xl">
        {/* Subtle ambient glow */}
        <div className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-purple-500/5 blur-3xl" />
        <div className="pointer-events-none absolute -left-10 bottom-0 h-40 w-40 rounded-full bg-primary/5 blur-3xl" />
        
        <div className="relative flex flex-wrap items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-purple-500/30 bg-purple-500/10 text-purple-400 ring-1 ring-purple-500/10 transition-transform hover:scale-105">
            <Wand2 className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="mb-1.5 inline-flex items-center gap-1.5 rounded-full border border-purple-500/30 bg-purple-500/10 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-purple-400 shadow-[0_0_12px_-3px_hsl(270_60%_55%/0.3)]">
              <Zap className="h-3 w-3" />
              GM · v1
            </div>
            <h1 className="truncate text-xl font-extrabold tracking-tight text-foreground">
              GM Commander
            </h1>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Compensação, moderação e comunicação operacional. Toda ação
              destrutiva passa por preview (dry_run) antes da execução real.
              {canUseDirectVpsApi() ? (
                <span className="ml-1.5 inline-flex items-center rounded border border-emerald-500/40 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-400">
                  VPS direto
                </span>
              ) : null}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Operator role badge */}
            {opPerms.operator && (
              <div className="flex items-center gap-1.5 rounded-full border border-border/40 bg-card/60 px-2.5 py-1 text-[10px] backdrop-blur-sm">
                <ShieldCheck className="h-3 w-3 text-emerald-400" />
                <span className="font-semibold text-foreground">{opPerms.operator.email.split("@")[0]}</span>
                <Badge variant="outline" className="ml-1 border-primary/30 px-1.5 py-0 text-[9px] font-bold uppercase tracking-wider text-primary">
                  {ROLE_LABELS[opPerms.role ?? "viewer"]}
                </Badge>
                {opPerms.mode === "audit" && (
                  <Badge variant="outline" className="border-amber-500/30 px-1.5 py-0 text-[9px] font-bold uppercase tracking-wider text-amber-400">
                    audit
                  </Badge>
                )}
              </div>
            )}
            {opPerms.loading && (
              <div className="flex items-center gap-1.5 rounded-full border border-border/40 bg-card/60 px-2.5 py-1 text-[10px] backdrop-blur-sm">
                <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                <span className="text-muted-foreground">Permissões…</span>
              </div>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => void loadCatalog()}
              disabled={catalogLoading}
              className="border-border/60 bg-card/60 backdrop-blur-sm transition-all hover:border-primary/40 hover:bg-primary/5"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", catalogLoading && "animate-spin")} />
              Capacidades
            </Button>
          </div>
        </div>

        {catalogMissing && (
          <div className="relative mt-4 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-2.5 text-[11px] text-amber-400 backdrop-blur-sm">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              <strong>getGmCommandCatalog</strong> não existe nesta VPS — usando
              capacidades canônicas como fallback. Atualize o api_cls.php para
              detecção dinâmica.
            </span>
          </div>
        )}
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-4">
        <Tabs defaultValue={opPerms.canAction("sendMailItem") ? "compensation" : "history"} className="space-y-5">
          <TabsList className="h-auto flex-wrap gap-1 rounded-xl border border-border/40 bg-card/30 p-1 backdrop-blur-sm">
            {([
              { key: "compensation" as TabKey, label: "Compensação", gateAction: "sendMailItem" },
              { key: "moderation" as TabKey, label: "Moderação", gateAction: "kickRole" },
              { key: "communication" as TabKey, label: "Comunicação", gateAction: "sendSystemMessage" },
              { key: "permissions" as TabKey, label: "Permissões GM", gateAction: "grantGmPermission" },
              { key: "meridian" as TabKey, label: "Meridiano / Títulos", gateAction: "getMeridianTitlePresetCatalog" },
              { key: "bulk" as TabKey, label: "Bulk Commander", gateAction: "queueBulkCommand" },
              { key: "history" as TabKey, label: "Histórico", gateAction: "getGmActionHistory" },
            ] as const)
              .filter(({ gateAction }) => opPerms.loading || opPerms.canAction(gateAction))
              .map(({ key, label }) => {
              return (
                <TabsTrigger key={key} value={key} className="gap-2 rounded-lg px-4 py-2 text-xs data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-[0_0_12px_-3px_hsl(210_85%_60%/0.3)]">
                  <TabIconRenderer name={tabIcons[key]} className="h-3.5 w-3.5" />
                  {label}
                </TabsTrigger>
              );
            })}
            {isSuperadmin && (
              <TabsTrigger value="customize" className="gap-2 rounded-lg px-4 py-2 text-xs data-[state=active]:bg-purple-500/10 data-[state=active]:text-purple-400 data-[state=active]:shadow-[0_0_12px_-3px_hsl(270_60%_55%/0.3)]">
                <Paintbrush className="h-3.5 w-3.5" />
                Personalizar
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="compensation" className="space-y-4">
            <CompensationTab caps={caps} onActed={refreshHistory} isSuperadmin={isSuperadmin} cardVisibility={cardVisibility} onToggleVisibility={toggleCardVisibility} />
          </TabsContent>
          <TabsContent value="moderation" className="space-y-4">
            <ModerationTab caps={caps} onActed={refreshHistory} isSuperadmin={isSuperadmin} cardVisibility={cardVisibility} onToggleVisibility={toggleCardVisibility} />
          </TabsContent>
          <TabsContent value="communication" className="space-y-4">
            <CommunicationTab caps={caps} onActed={refreshHistory} isSuperadmin={isSuperadmin} cardVisibility={cardVisibility} onToggleVisibility={toggleCardVisibility} />
          </TabsContent>
          <TabsContent value="permissions" className="space-y-4">
            <GmPermissionsTab caps={caps} onActed={refreshHistory} isSuperadmin={isSuperadmin} cardVisibility={cardVisibility} onToggleVisibility={toggleCardVisibility} />
          </TabsContent>
          <TabsContent value="meridian" className="space-y-4">
            <MeridianTitlesTab caps={caps} onActed={refreshHistory} />
          </TabsContent>
          <TabsContent value="bulk" className="space-y-4">
            <BulkCommanderTab caps={caps} onActed={refreshHistory} />
          </TabsContent>
          <TabsContent value="history">
            <HistoryTab tick={historyTick} />
          </TabsContent>
          {isSuperadmin && (
            <TabsContent value="customize" className="space-y-4">
              <TabIconCustomizer icons={tabIcons} onChange={(next) => { setTabIcons(next); saveTabIcons(next); }} />
            </TabsContent>
          )}
        </Tabs>
      </main>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Tab Icon Customizer (superadmin only)                                       */
/* -------------------------------------------------------------------------- */

const TAB_LABELS: Record<TabKey, string> = {
  compensation: "Compensação",
  moderation: "Moderação",
  communication: "Comunicação",
  permissions: "Permissões GM",
  meridian: "Meridiano / Títulos",
  bulk: "Bulk Commander",
  history: "Histórico",
};

function TabIconCustomizer({
  icons,
  onChange,
}: {
  icons: Record<TabKey, string>;
  onChange: (next: Record<TabKey, string>) => void;
}) {
  const [editingTab, setEditingTab] = useState<TabKey | null>(null);

  const handleSelect = (tab: TabKey, iconName: string) => {
    onChange({ ...icons, [tab]: iconName });
    setEditingTab(null);
  };

  const handleReset = () => {
    onChange({ ...DEFAULT_TAB_ICONS });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-extrabold uppercase tracking-wider text-foreground">
            Ícones das abas
          </h3>
          <p className="text-[11px] text-muted-foreground">
            Personalize o ícone de cada seção. Visível apenas para superadmin.
          </p>
        </div>
        <Button size="sm" variant="ghost" onClick={handleReset} className="text-xs text-muted-foreground hover:text-foreground">
          <RefreshCw className="mr-1.5 h-3 w-3" />
          Resetar
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {(Object.keys(TAB_LABELS) as TabKey[]).map((tab) => {
          return (
            <button
              key={tab}
              type="button"
              onClick={() => setEditingTab(editingTab === tab ? null : tab)}
              className={cn(
                "group flex items-center gap-3 rounded-xl border bg-card/40 px-4 py-3 text-left backdrop-blur-sm transition-all duration-200 hover:bg-card/70",
                editingTab === tab
                  ? "border-primary/50 shadow-[0_0_20px_-6px_hsl(210_85%_60%/0.2)]"
                  : "border-border/50 hover:border-primary/30",
              )}
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-transform group-hover:scale-110">
                <TabIconRenderer name={icons[tab]} className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-foreground">{TAB_LABELS[tab]}</p>
                <p className="text-[10px] text-muted-foreground">{icons[tab].replace("pw:", "PW: ")}</p>
              </div>
              <Paintbrush className="h-3.5 w-3.5 text-muted-foreground/50 transition-colors group-hover:text-primary" />
            </button>
          );
        })}
      </div>

      {/* Icon picker grid */}
      {editingTab && (
        <div className="space-y-4 rounded-xl border border-primary/30 bg-card/60 p-4 backdrop-blur-sm">
          <p className="text-xs font-semibold text-foreground">
            Selecione o ícone para <span className="text-primary">{TAB_LABELS[editingTab]}</span>
          </p>

          {/* PW Game Icons */}
          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-purple-400">Perfect World</p>
            <div className="grid grid-cols-8 gap-1.5 sm:grid-cols-10 lg:grid-cols-12">
              {PW_ICON_NAMES.map((name) => {
                const key = `pw:${name}`;
                const isActive = icons[editingTab] === key;
                return (
                  <button
                    key={key}
                    type="button"
                    title={name}
                    onClick={() => handleSelect(editingTab, key)}
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-lg border transition-all duration-150 hover:scale-110",
                      isActive
                        ? "border-purple-500 bg-purple-500/20 shadow-[0_0_12px_-3px_hsl(270_60%_55%/0.4)]"
                        : "border-border/40 bg-card/30 hover:border-purple-500/40 hover:bg-purple-500/5",
                    )}
                  >
                    <img src={`/gm-icons/${name}.png`} alt={name} className="h-6 w-6 rounded-sm object-contain" />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Lucide Icons */}
          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Sistema</p>
            <div className="grid grid-cols-8 gap-1.5 sm:grid-cols-10 lg:grid-cols-12">
              {ICON_NAMES.map((name) => {
                const Ic = ICON_CATALOG[name];
                const isActive = icons[editingTab] === name;
                return (
                  <button
                    key={name}
                    type="button"
                    title={name}
                    onClick={() => handleSelect(editingTab, name)}
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-lg border transition-all duration-150 hover:scale-110",
                      isActive
                        ? "border-primary bg-primary/20 text-primary shadow-[0_0_12px_-3px_hsl(210_85%_60%/0.4)]"
                        : "border-border/40 bg-card/30 text-muted-foreground hover:border-primary/40 hover:bg-primary/5 hover:text-foreground",
                    )}
                  >
                    <Ic className="h-4 w-4" />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function CapBadge({
  action,
  caps,
}: {
  action: string;
  caps: Map<string, GmCommandCapability>;
}) {
  const c = caps.get(action);
  const state = c?.state ?? (FALLBACK_SUPPORTED.has(action) ? "supported" : "unsupported");
  if (state === "supported") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-400">
        <CheckCircle2 className="h-3 w-3" />
        suportado
      </span>
    );
  }
  if (state === "version_gated" || state === "contract_only") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-400">
        <Clock className="h-3 w-3" />
        em breve
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-muted-foreground/20 bg-muted/30 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
      <XCircle className="h-3 w-3" />
      indisponível
    </span>
  );
}

function GmCard({
  icon: Icon,
  title,
  subtitle,
  action,
  caps,
  children,
  tone = "default",
}: {
  icon: typeof Gift;
  title: string;
  subtitle: string;
  action: string;
  caps: Map<string, GmCommandCapability>;
  children: React.ReactNode;
  tone?: "default" | "danger" | "warning" | "premium";
}) {
  const supported = isSupported(action, caps);

  /* ── Tone-aware styling ── */
  const toneStyles = {
    default: {
      border: "border-border/60 hover:border-primary/40",
      glow: "hover:shadow-[0_0_30px_-8px_hsl(210_85%_60%/0.25)]",
      iconBg: "bg-primary/10 text-primary ring-1 ring-primary/20",
      accent: "from-primary/5 via-transparent to-transparent",
      line: "from-primary/50 via-primary/15 to-transparent",
    },
    danger: {
      border: "border-destructive/30 hover:border-destructive/50",
      glow: "hover:shadow-[0_0_30px_-8px_hsl(1_71%_64%/0.25)]",
      iconBg: "bg-destructive/10 text-destructive ring-1 ring-destructive/20",
      accent: "from-destructive/5 via-transparent to-transparent",
      line: "from-destructive/50 via-destructive/15 to-transparent",
    },
    warning: {
      border: "border-amber-500/30 hover:border-amber-500/50",
      glow: "hover:shadow-[0_0_30px_-8px_hsl(38_80%_58%/0.25)]",
      iconBg: "bg-amber-500/10 text-amber-500 ring-1 ring-amber-500/20",
      accent: "from-amber-500/5 via-transparent to-transparent",
      line: "from-amber-500/50 via-amber-500/15 to-transparent",
    },
    premium: {
      border: "border-purple-500/30 hover:border-purple-500/50",
      glow: "hover:shadow-[0_0_30px_-8px_hsl(270_60%_55%/0.3)]",
      iconBg: "bg-purple-500/10 text-purple-400 ring-1 ring-purple-500/20",
      accent: "from-purple-500/5 via-transparent to-transparent",
      line: "from-purple-500/50 via-purple-500/15 to-transparent",
    },
  };
  const s = toneStyles[tone];

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-2xl border backdrop-blur-md transition-all duration-300",
        "bg-gradient-to-br from-card/80 via-card/50 to-card/30",
        s.border,
        s.glow,
      )}
    >
      {/* Accent glow — top-left radial */}
      <div
        className={cn(
          "pointer-events-none absolute -left-10 -top-10 h-40 w-40 rounded-full opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100",
          tone === "danger" ? "bg-destructive/20" : tone === "warning" ? "bg-amber-500/20" : tone === "premium" ? "bg-purple-500/20" : "bg-primary/20",
        )}
      />
      {/* Top accent line */}
      <div
        className={cn(
          "pointer-events-none absolute left-6 right-6 top-0 h-px bg-gradient-to-r",
          s.line,
        )}
      />

      <div className="relative px-5 pb-5 pt-5">
        {/* Header */}
        <div className="mb-4 flex items-start gap-3.5">
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-105",
              s.iconBg,
            )}
          >
            <Icon className="h-[18px] w-[18px]" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-[13px] font-extrabold uppercase tracking-wider text-foreground">
                {title}
              </h3>
              <CapBadge action={action} caps={caps} />
            </div>
            <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
              {subtitle}
            </p>
            <code className="mt-1.5 inline-flex items-center rounded-md border border-border/50 bg-muted/40 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground/70">
              ?action={action}
            </code>
          </div>
        </div>

        {/* Divider */}
        <div className="mb-4 h-px bg-gradient-to-r from-border/60 via-border/30 to-transparent" />

        {/* Content */}
        <div
          className={cn(
            "space-y-3",
            !supported && "pointer-events-none opacity-40 grayscale",
          )}
        >
          {children}
          {!supported && (
            <div className="flex items-center gap-2 rounded-lg border border-muted/50 bg-muted/20 px-3 py-2">
              <XCircle className="h-3.5 w-3.5 text-muted-foreground" />
              <p className="text-[11px] italic text-muted-foreground">
                Endpoint não suportado nesta VPS.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Confirm dialog — força dry_run antes do real                                */
/* -------------------------------------------------------------------------- */

interface ConfirmActionProps<T> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  /** Função que executa a action. Recebe `dryRun:boolean` e devolve a resposta. */
  exec: (dryRun: boolean) => Promise<T>;
  /** Renderiza preview do resultado do dry_run. */
  renderPreview: (result: T) => React.ReactNode;
  /** Callback final (sucesso real). */
  onSuccess: (result: T) => void;
  /** Quando o endpoint não suporta dry_run, pula a etapa de preview. */
  skipDryRun?: boolean;
}

function ConfirmActionDialog<T>({
  open,
  onOpenChange,
  title,
  description,
  exec,
  renderPreview,
  onSuccess,
  skipDryRun,
}: ConfirmActionProps<T>) {
  const [phase, setPhase] = useState<"preview" | "ready" | "running">("preview");
  const [previewResult, setPreviewResult] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setPhase(skipDryRun ? "ready" : "preview");
      setPreviewResult(null);
      setError(null);
    }
  }, [open, skipDryRun]);

  const runPreview = async () => {
    setError(null);
    setPhase("running");
    try {
      const r = await exec(true);
      setPreviewResult(r);
      setPhase("ready");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPhase("preview");
    }
  };

  const runReal = async () => {
    setError(null);
    setPhase("running");
    try {
      const r = await exec(false);
      onSuccess(r);
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPhase("ready");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-amber-500" />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {error && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </div>
        )}

        {!skipDryRun && phase === "preview" && (
          <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            <p className="font-semibold text-foreground">
              1. Preview (dry_run)
            </p>
            <p className="mt-1">
              Vamos consultar o servidor sem efetivar nada. Confira os números e
              só então execute de verdade.
            </p>
          </div>
        )}

        {phase === "ready" && previewResult && (
          <div className="space-y-2 rounded-md border border-success/40 bg-success/5 px-3 py-2 text-xs">
            <p className="font-semibold uppercase tracking-wider text-success">
              Preview validado
            </p>
            {renderPreview(previewResult)}
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={phase === "running"}
          >
            Cancelar
          </Button>
          {!skipDryRun && phase !== "ready" ? (
            <Button onClick={runPreview} disabled={phase === "running"}>
              {phase === "running" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              Rodar dry_run
            </Button>
          ) : (
            <Button
              variant="destructive"
              onClick={runReal}
              disabled={phase === "running"}
            >
              {phase === "running" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ArrowRight className="h-3.5 w-3.5" />
              )}
              Executar de verdade
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------------------- */
/* Action picker — menu de cards clicáveis para abrir cada ação                */
/* -------------------------------------------------------------------------- */

interface ActionItem {
  id: string;
  action: string;
  title: string;
  subtitle: string;
  icon: typeof Gift;
  tone?: "default" | "danger" | "warning" | "premium";
  render: () => React.ReactNode;
}

interface VisibilityProps {
  isSuperadmin?: boolean;
  cardVisibility?: Record<string, boolean>;
  onToggleVisibility?: (cardId: string) => void;
}

function ActionPicker({
  items,
  caps,
  emptyHint,
  isSuperadmin,
  cardVisibility = {},
  onToggleVisibility,
}: {
  items: ActionItem[];
  caps: Map<string, GmCommandCapability>;
  emptyHint?: string;
} & VisibilityProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = items.find((i) => i.id === activeId) ?? null;
  const { canAction: opCan, loading: opLoading } = useOperatorPermissions();

  // Filter hidden cards for non-superadmin, then filter by operator permissions.
  // Items the operator has no permission for are hidden entirely (not just disabled).
  const visibleItems = (isSuperadmin ? items : items.filter((i) => isCardVisible(i.id, cardVisibility)))
    .filter((i) => opLoading || opCan(i.action));

  return (
    <div>
      {emptyHint && (
        <p className="mb-3 text-[11px] text-muted-foreground">{emptyHint}</p>
      )}
      <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {visibleItems.map((item) => {
          const supported = isSupported(item.action, caps);
          const hidden = !isCardVisible(item.id, cardVisibility);
          const toneRing =
            item.tone === "danger"
              ? "border-destructive/30 hover:border-destructive/60 hover:shadow-[0_0_20px_-6px_hsl(1_71%_64%/0.25)]"
              : item.tone === "warning"
                ? "border-amber-500/30 hover:border-amber-500/60 hover:shadow-[0_0_20px_-6px_hsl(38_80%_58%/0.25)]"
                : item.tone === "premium"
                  ? "border-purple-500/30 hover:border-purple-500/60 hover:shadow-[0_0_20px_-6px_hsl(270_60%_55%/0.25)]"
                  : "border-border/50 hover:border-primary/50 hover:shadow-[0_0_20px_-6px_hsl(210_85%_60%/0.2)]";
          const iconRing =
            item.tone === "danger"
              ? "bg-destructive/10 text-destructive"
              : item.tone === "warning"
                ? "bg-amber-500/10 text-amber-500"
                : item.tone === "premium"
                  ? "bg-purple-500/10 text-purple-400"
                  : "bg-primary/10 text-primary";
          const Icon = item.icon;
          return (
            <div key={item.id} className={cn("relative", hidden && isSuperadmin && "opacity-50")}>
              <button
                type="button"
                onClick={() => supported && setActiveId(item.id)}
                disabled={!supported}
                className={cn(
                  "group flex w-full items-center gap-3 rounded-xl border bg-card/40 px-3 py-2.5 text-left backdrop-blur-sm transition-all duration-200 hover:bg-card/70",
                  toneRing,
                  !supported && "cursor-not-allowed opacity-40 grayscale",
                )}
              >
                <div
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-transform duration-200 group-hover:scale-110",
                    iconRing,
                  )}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-[11px] font-bold text-foreground">
                    {item.title}
                  </h3>
                  <p className="truncate text-[10px] text-muted-foreground">
                    {item.subtitle}
                  </p>
                </div>
                {supported && (
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40 transition-all group-hover:translate-x-0.5 group-hover:text-primary" />
                )}
              </button>
              {isSuperadmin && onToggleVisibility && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onToggleVisibility(item.id); }}
                  className={cn(
                    "absolute -right-1 -top-1 z-10 flex h-6 w-6 items-center justify-center rounded-full border shadow-sm transition-all duration-200",
                    hidden
                      ? "border-destructive/50 bg-destructive/20 text-destructive hover:bg-destructive/30"
                      : "border-emerald-500/50 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30",
                  )}
                  title={hidden ? "Oculto para usuários" : "Visível para usuários"}
                >
                  {hidden ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Overlay dialog — opens selected card with blurred backdrop */}
      <Dialog open={!!active} onOpenChange={(o) => !o && setActiveId(null)}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto border-border/60 bg-card/95 backdrop-blur-xl sm:rounded-2xl">
          {active && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3">
                  {(() => {
                    const Icon = active.icon;
                    const iconRing =
                      active.tone === "danger"
                        ? "bg-destructive/10 text-destructive"
                        : active.tone === "warning"
                          ? "bg-amber-500/10 text-amber-500"
                          : active.tone === "premium"
                            ? "bg-purple-500/10 text-purple-400"
                            : "bg-primary/10 text-primary";
                    return (
                      <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl", iconRing)}>
                        <Icon className="h-5 w-5" />
                      </div>
                    );
                  })()}
                  <div>
                    <DialogTitle className="text-sm font-extrabold uppercase tracking-wider">
                      {active.title}
                    </DialogTitle>
                    <DialogDescription className="text-[11px]">
                      {active.subtitle}
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>
              <Separator className="bg-border/40" />
              <div>{active.render()}</div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Compensação                                                                 */
/* -------------------------------------------------------------------------- */

function CompensationTab({
  caps,
  onActed,
  isSuperadmin,
  cardVisibility,
  onToggleVisibility,
}: {
  caps: Map<string, GmCommandCapability>;
  onActed: () => void;
} & VisibilityProps) {
  const items: ActionItem[] = [
    {
      id: "mail-item",
      action: "sendMailItem",
      title: "Enviar Item",
      subtitle: "Anexa um item ao correio do personagem alvo.",
      icon: Mail,
      render: () => <SendMailItemCard caps={caps} onActed={onActed} />,
    },
    {
      id: "mail-gold",
      action: "sendMailGold",
      title: "Enviar Moedas",
      subtitle: "Moedas NORMAIS no inventário (não é gold da loja).",
      icon: Coins,
      render: () => <SendMailGoldCard caps={caps} onActed={onActed} />,
    },
    {
      id: "mall-cash",
      action: "grantMallCash",
      title: "Gold da Loja",
      subtitle: "Gold/CASH da Mall. NÃO confundir com sendMailGold.",
      icon: Wallet,
      tone: "premium",
      render: () => <GrantMallCashCard caps={caps} onActed={onActed} />,
    },
  ];
  return (
    <ActionPicker
      items={items}
      caps={caps}
      emptyHint="Selecione uma ação de compensação para abrir o formulário."
      isSuperadmin={isSuperadmin}
      cardVisibility={cardVisibility}
      onToggleVisibility={onToggleVisibility}
    />
  );
}

function SendMailItemCard({
  caps,
  onActed,
}: {
  caps: Map<string, GmCommandCapability>;
  onActed: () => void;
}) {
  const toast = useFeedback();
  const { active } = useServers();
  const [lookup, setLookup] = useState("");
  const [roleid, setRoleid] = useState("");
  const [itemId, setItemId] = useState("");
  const [count, setCount] = useState("1");
  const [subject, setSubject] = useState("Compensação");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [resolving, setResolving] = useState(false);

  const resolveTarget = async () => {
    const raw = lookup.trim();
    if (!raw) {
      toast.error("Informe nick ou roleid");
      return;
    }
    setResolving(true);
    try {
      const query = /^\d+$/.test(raw) ? { roleid: Number(raw) } : { name: raw };
      const res = await pwApi.getPlayerTargetProfile(query);
      const rid = res.profile?.roleid;
      if (!rid) {
        const note =
          (res.profile as { resolution_note?: string } | undefined)?.resolution_note ??
          "Personagem sem roleid (conta vazia?)";
        toast.error(note);
        return;
      }
      setRoleid(String(rid));
      toast.success(`Alvo: ${res.profile?.name ?? rid} (roleid ${rid})`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setResolving(false);
    }
  };

  const submit = async () => {
    const r = Number(roleid);
    const i = Number(itemId);
    const c = Number(count);
    if (!r || !i || c <= 0) {
      toast.error("Informe roleid, item_id e count válidos");
      return;
    }
    setBusy(true);
    try {
      const res = await pwApi.sendMailItem({
        roleid: r,
        subject,
        body,
        item: { item_id: i, count: c },
      });
      if (res.success) {
        toast.success(`Item enviado · mail_id ${res.mail_id ?? "—"}`);
        void logAuditEvent({
          action: "gm.sendMailItem",
          tenantId: active?.id ?? null,
          target: String(r),
          status: "ok",
          metadata: { item_id: i, count: c },
        });
        setItemId("");
        onActed();
      } else {
        toast.error(res.error ?? "Falhou");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <GmCard
      icon={Mail}
      title="Enviar Item por Correio"
      subtitle="Anexa um item ao correio do personagem alvo."
      action="sendMailItem"
      caps={caps}
    >
      <FieldRow label="Buscar alvo (nick ou roleid)">
        <div className="flex gap-2">
          <Input value={lookup} onChange={(e) => setLookup(e.target.value)} placeholder="Azumy ou 1184" />
          <Button type="button" variant="outline" size="sm" onClick={() => void resolveTarget()} disabled={resolving}>
            {resolving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Crosshair className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </FieldRow>
      <FieldRow label="Roleid">
        <Input value={roleid} onChange={(e) => setRoleid(e.target.value)} placeholder="1024" />
      </FieldRow>
      <FieldRow label="Item ID">
        <Input value={itemId} onChange={(e) => setItemId(e.target.value)} placeholder="22272" />
      </FieldRow>
      <FieldRow label="Quantidade">
        <Input
          type="number"
          min={1}
          value={count}
          onChange={(e) => setCount(e.target.value)}
        />
      </FieldRow>
      <FieldRow label="Assunto">
        <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
      </FieldRow>
      <FieldRow label="Corpo">
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={2}
          placeholder="Mensagem opcional…"
        />
      </FieldRow>
      <Button onClick={submit} disabled={busy} className="w-full">
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
        Enviar item
      </Button>
    </GmCard>
  );
}

function SendMailGoldCard({
  caps,
  onActed,
}: {
  caps: Map<string, GmCommandCapability>;
  onActed: () => void;
}) {
  const toast = useFeedback();
  const { active } = useServers();
  const [roleid, setRoleid] = useState("");
  const [amount, setAmount] = useState("");
  const [subject, setSubject] = useState("Compensação");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const r = Number(roleid);
    const a = Number(amount);
    if (!r || a <= 0) {
      toast.error("Informe roleid e valor válidos");
      return;
    }
    setBusy(true);
    try {
      const res = await pwApi.sendMailGold({ roleid: r, subject, body, amount: a });
      if (res.success) {
        toast.success(`Moedas enviadas · mail_id ${res.mail_id ?? "—"}`);
        void logAuditEvent({
          action: "gm.sendMailGold",
          tenantId: active?.id ?? null,
          target: String(r),
          status: "ok",
          metadata: { amount: a },
        });
        setAmount("");
        onActed();
      } else {
        toast.error(res.error ?? "Falhou");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <GmCard
      icon={Coins}
      title="Enviar Moedas por Correio"
      subtitle="Moedas NORMAIS no inventário (não é gold da loja)."
      action="sendMailGold"
      caps={caps}
    >
      <FieldRow label="Roleid">
        <Input value={roleid} onChange={(e) => setRoleid(e.target.value)} placeholder="1024" />
      </FieldRow>
      <FieldRow label="Valor (em copper)">
        <Input
          type="number"
          min={1}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="10000 = 1 gold"
        />
      </FieldRow>
      <FieldRow label="Assunto">
        <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
      </FieldRow>
      <FieldRow label="Corpo">
        <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={2} />
      </FieldRow>
      <Button onClick={submit} disabled={busy} className="w-full">
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Coins className="h-3.5 w-3.5" />}
        Enviar moedas
      </Button>
    </GmCard>
  );
}

function MallCashNotifyMailSettings() {
  const toast = useFeedback();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [title, setTitle] = useState("Gold da Loja creditado");
  const [thanks, setThanks] = useState("");
  const [bodyTemplate, setBodyTemplate] = useState("");
  const [placeholders, setPlaceholders] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    pwApi
      .getMallCashNotifyMailConfig()
      .then((res) => {
        if (cancelled || !res.config) return;
        setEnabled(res.config.enabled);
        setTitle(res.config.title);
        setThanks(res.config.thanks);
        setBodyTemplate(res.config.body_template);
        setPlaceholders(res.placeholders ?? {});
      })
      .catch((e) => {
        if (!cancelled) {
          toast.error(e instanceof Error ? e.message : String(e));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [toast]);

  const save = async () => {
    setSaving(true);
    try {
      const res = await pwApi.saveMallCashNotifyMailConfig({
        enabled,
        title: title.trim(),
        thanks: thanks.trim(),
        body_template: bodyTemplate,
      });
      if (res.config) {
        setEnabled(res.config.enabled);
        setTitle(res.config.title);
        setThanks(res.config.thanks);
        setBodyTemplate(res.config.body_template);
      }
      toast.success("Correio pós-grant salvo");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-md border border-purple-500/25 bg-purple-500/5 p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-purple-300">Correio após creditar</p>
          <p className="text-[10px] text-muted-foreground">Enviado automaticamente ao jogador após grantMallCash.</p>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={enabled} onCheckedChange={setEnabled} id="mall-mail-enabled" />
          <Label htmlFor="mall-mail-enabled" className="text-[10px]">
            Ativo
          </Label>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-3">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <FieldRow label="Título do correio">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} className="text-xs" />
          </FieldRow>
          <FieldRow label="Corpo (template)">
            <Textarea
              value={bodyTemplate}
              onChange={(e) => setBodyTemplate(e.target.value)}
              rows={6}
              className="text-xs font-mono"
            />
          </FieldRow>
          <FieldRow label="Agradecimento ({thanks})">
            <Input value={thanks} onChange={(e) => setThanks(e.target.value)} className="text-xs" />
          </FieldRow>
          {Object.keys(placeholders).length > 0 && (
            <p className="text-[10px] text-muted-foreground">
              Placeholders: {Object.keys(placeholders).join(", ")}
            </p>
          )}
          <Button type="button" variant="outline" size="sm" onClick={() => void save()} disabled={saving} className="w-full">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Settings className="h-3.5 w-3.5" />}
            Salvar template do correio
          </Button>
        </>
      )}
    </div>
  );
}

function GrantMallCashCard({
  caps,
  onActed,
}: {
  caps: Map<string, GmCommandCapability>;
  onActed: () => void;
}) {
  const toast = useFeedback();
  const { active } = useServers();
  const [lookup, setLookup] = useState("");
  const [roleid, setRoleid] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("manual-test");
  const [walletLoading, setWalletLoading] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [wallet, setWallet] = useState<NormalizedMallCashBalance | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [showUnits, setShowUnits] = useState(false);
  const [targetOnline, setTargetOnline] = useState<boolean | null>(null);

  const fetchWallet = useCallback(async (rid?: number) => {
    const r = rid ?? Number(roleid);
    if (!r) {
      toast.error("Informe um roleid valido");
      return;
    }
    setWalletLoading(true);
    try {
      const raw = await pwApi.getMallCashBalance(r);
      setWallet(normalizeMallCashBalance(raw));
    } catch (e) {
      setWallet(null);
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setWalletLoading(false);
    }
  }, [roleid, toast]);

  const resolveTarget = async () => {
    const raw = lookup.trim();
    if (!raw) {
      toast.error("Informe nick ou roleid");
      return;
    }
    setResolving(true);
    try {
      const query = /^\d+$/.test(raw) ? { roleid: Number(raw) } : { name: raw };
      const res = await pwApi.getPlayerTargetProfile(query);
      const rid = res.profile?.roleid;
      if (!rid) {
        const note =
          (res.profile as { resolution_note?: string } | undefined)?.resolution_note ??
          "Personagem sem roleid (conta vazia?)";
        toast.error(note);
        return;
      }
      setRoleid(String(rid));
      setTargetOnline(res.profile?.online === true ? true : res.profile?.online === false ? false : null);
      await fetchWallet(rid);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setResolving(false);
    }
  };

  const exec = async (dryRun: boolean): Promise<GrantMallCashResponse> => {
    const r = Number(roleid);
    const a = Number(amount);
    return pwApi.grantMallCash({
      roleid: r,
      amount: a,
      reason,
      ...(dryRun ? { dry_run: true } : { confirm: "GRANT_MALL_CASH" as const }),
    });
  };

  const onSuccess = (res: GrantMallCashResponse) => {
    const change = res.balance_change?.cash_total_gold ?? 0;
    const queued = Boolean(res.grant_queued);
    const operationallyOk =
      res.success &&
      (change > 0 || res.grant_result?.error_code === 0 || queued);
    if (operationallyOk) {
      const mailOk = res.notification_mail?.success;
      const mailWarn = res.notification_mail_warning;
      if (queued) {
        toast.success(
          `Gold enfileirado (+${Number(amount)} gold) · jogador deve sair do jogo para creditar`,
          res.warning ? { description: res.warning } : undefined,
        );
      } else {
        toast.success(
          `Grant aplicado · +${change} gold (saldo loja: ${
            res.wallet_after?.cash_total_gold ?? "—"
          })${mailOk ? " · correio enviado" : mailWarn ? " · correio falhou" : ""}`,
          mailWarn ? { description: mailWarn } : res.warning ? { description: res.warning } : undefined,
        );
      }
      void logAuditEvent({
        action: "gm.grantMallCash",
        tenantId: active?.id ?? null,
        target: String(roleid),
        status: queued ? "queued" : "ok",
        metadata: {
          amount: Number(amount),
          balance_change: res.balance_change,
          error_code: res.grant_result?.error_code,
          grant_queued: queued,
        },
      });
    } else {
      toast.warning(
        `Resposta ambígua · error_code=${
          res.grant_result?.error_code ?? "?"
        }, change=${change}`,
      );
    }
    setWallet(
      normalizeMallCashBalance({
        success: true,
        roleid: Number(roleid),
        wallet: res.wallet_after ?? {},
        target: { roleid: Number(roleid) },
      }),
    );
    onActed();
  };

  const handleOpenConfirm = () => {
    const r = Number(roleid);
    const a = Number(amount);
    if (!r || a <= 0 || !reason.trim()) {
      toast.error("Roleid, amount > 0 e reason são obrigatórios");
      return;
    }
    setConfirmOpen(true);
  };

  return (
    <GmCard
      icon={Wallet}
      title="Adicionar Gold da Loja"
      subtitle="Gold/CASH da Mall (loja). NÃO é o mesmo que sendMailGold."
      action="grantMallCash"
      caps={caps}
      tone="premium"
    >
      <FieldRow label="Buscar alvo (nick ou roleid)">
        <div className="flex gap-2">
          <Input value={lookup} onChange={(e) => setLookup(e.target.value)} placeholder="Azumy ou 1184" />
          <Button type="button" variant="outline" size="sm" onClick={() => void resolveTarget()} disabled={resolving}>
            {resolving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Crosshair className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </FieldRow>
      <FieldRow label="Roleid">
        <div className="flex gap-2">
          <Input value={roleid} onChange={(e) => setRoleid(e.target.value)} placeholder="1024" />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void fetchWallet()}
            disabled={walletLoading}
          >
            {walletLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Saldo
          </Button>
        </div>
      </FieldRow>

      {wallet && <WalletPreview wallet={wallet.wallet} showUnits={showUnits} account={wallet.account} />}
      {targetOnline === true && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          Personagem <strong>online</strong>. O gold pode ir para a fila <code className="text-[10px]">usecashnow</code> (error -8) até sair do jogo. Teste com valores pequenos (ex: 10 gold) ou peça logout completo antes.
        </div>
      )}
      <div className="flex items-center justify-end gap-2 text-[10px] text-muted-foreground">
        <Switch checked={showUnits} onCheckedChange={setShowUnits} id="units" />
        <Label htmlFor="units" className="text-[10px]">
          Detalhe técnico (units)
        </Label>
      </div>

      <Separator />

      <FieldRow label="Amount (gold)">
        <Input
          type="number"
          min={1}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="10"
        />
      </FieldRow>
      <FieldRow label="Reason">
        <Input value={reason} onChange={(e) => setReason(e.target.value)} />
      </FieldRow>

      <MallCashNotifyMailSettings />

      <Button onClick={handleOpenConfirm} className="w-full" variant="default">
        <Sparkles className="h-3.5 w-3.5" />
        Conceder gold da loja
      </Button>

      <ConfirmActionDialog<GrantMallCashResponse>
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Conceder gold da Mall"
        description={`+${amount} gold para roleid ${roleid}. Dry_run só valida alvo/saldo — o grant real chama usecash.`}
        exec={exec}
        onSuccess={onSuccess}
        renderPreview={(res) => (
          <div className="space-y-1 text-xs">
            <Row label="userid" value={res.target?.userid ?? res.userid ?? "—"} />
            <Row
              label="usecash units"
              value={
                res.grant?.cash_units ??
                (res.dry_run && Number(amount) > 0 ? Number(amount) * 100 : "—")
              }
            />
            <Row label="cash_total antes" value={res.wallet_before?.cash_total_gold ?? "—"} />
            {res.dry_run ? (
              <p className="mt-1 text-muted-foreground">
                Dry-run não executa usecash. Confira o alvo e clique em Executar de verdade.
              </p>
            ) : (
              <>
                <Row label="error_code" value={res.grant_result?.error_code ?? "—"} />
                <Row label="cash_total depois" value={res.wallet_after?.cash_total_gold ?? "—"} />
                <Row
                  label="balance_change"
                  value={`+${res.balance_change?.cash_total_gold ?? 0} gold`}
                />
                {res.grant_queued && (
                  <p className="mt-1 text-amber-500">Enfileirado em usecashnow — logout necessário.</p>
                )}
              </>
            )}
            {res.warning && (
              <p className="mt-1 italic text-amber-500">⚠ {res.warning}</p>
            )}
          </div>
        )}
      />
    </GmCard>
  );
}

function WalletPreview({
  wallet,
  showUnits,
  account,
}: {
  wallet?: MallCashWallet | null;
  showUnits: boolean;
  account?: string | null;
}) {
  const safeWallet = wallet && typeof wallet === "object" ? wallet : {};
  const accountLabel = typeof account === "string" ? account : null;
  return (
    <div className="rounded-md border border-purple-500/30 bg-purple-500/5 p-2.5 text-xs">
      <div className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-purple-400">
        Carteira da Mall
      </div>
      {accountLabel ? (
        <Row label="conta" value={accountLabel} />
      ) : null}
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        <WalletStat
          label="Saldo loja"
          main={safeWallet.shop_balance_gold ?? safeWallet.cash_total_gold}
          sub={showUnits ? (safeWallet.shop_balance_units ?? safeWallet.cash_total_units) : undefined}
          highlight
        />
        <WalletStat label="Recarregado" main={safeWallet.cash_add_gold} sub={showUnits ? safeWallet.cash_add_units : undefined} />
        <WalletStat label="Gasto" main={safeWallet.cash_used_gold} sub={showUnits ? safeWallet.cash_used_units : undefined} />
        <WalletStat label="cash" main={safeWallet.cash_gold} sub={showUnits ? safeWallet.cash_units : undefined} />
      </div>
      <p className="mt-1.5 text-[10px] italic text-muted-foreground">
        <strong>Saldo loja</strong> = recarregado − gasto (igual ao saldo in-game).
        <code className="ml-1">cash_add</code> sozinho nao e o saldo atual.
      </p>
    </div>
  );
}

function WalletStat({
  label,
  main,
  sub,
  highlight,
}: {
  label: string;
  main?: number;
  sub?: number;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded border px-2 py-1.5",
        highlight
          ? "border-purple-500/50 bg-purple-500/10"
          : "border-border/60 bg-card/40",
      )}
    >
      <div className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      <div className="font-mono text-sm font-extrabold text-foreground">
        {main ?? "—"}
        <span className="ml-1 text-[10px] font-normal text-muted-foreground">g</span>
      </div>
      {sub != null && (
        <div className="font-mono text-[10px] text-muted-foreground">{sub} u</div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Moderação                                                                   */
/* -------------------------------------------------------------------------- */

function formatDurationLabel(seconds: number): string {
  if (seconds <= 0) return "—";
  if (seconds >= 86400 && seconds % 86400 === 0) {
    const d = seconds / 86400;
    return d === 1 ? "1 dia" : `${d} dias`;
  }
  if (seconds >= 3600 && seconds % 3600 === 0) {
    const h = seconds / 3600;
    return h === 1 ? "1 hora" : `${h} horas`;
  }
  if (seconds >= 60 && seconds % 60 === 0) {
    const m = seconds / 60;
    return m === 1 ? "1 min" : `${m} min`;
  }
  return `${seconds}s`;
}

function gmFromSecurity(res: SecurityActionResponse) {
  return { ...res, ...(res.gm_action ?? {}) };
}

function feedbackSecurityAction(
  toast: FeedbackAPI,
  res: SecurityActionResponse,
  okTitle: string,
  okDescription?: string,
) {
  const gm = gmFromSecurity(res);
  if (!res.success && gm.success !== true) {
    toast.error(String(gm.error ?? res.error ?? "Falhou"));
    return false;
  }
  toast.success(okTitle, {
    description: okDescription ?? (typeof gm.message === "string" ? gm.message : undefined),
  });
  const warn = (gm as { warning?: string }).warning;
  if (warn) toast.warning(String(warn));
  return true;
}

function ModerationPlayerLookup({
  onResolved,
  hint,
}: {
  onResolved: (profile: PlayerTargetProfile) => void;
  hint?: string;
}) {
  const toast = useFeedback();
  const [lookup, setLookup] = useState("");
  const [resolving, setResolving] = useState(false);
  const [resolvedName, setResolvedName] = useState<string | null>(null);

  const resolveTarget = async () => {
    const raw = lookup.trim();
    if (!raw) {
      toast.error("Informe nick ou roleid");
      return;
    }
    setResolving(true);
    try {
      const query = /^\d+$/.test(raw) ? { roleid: Number(raw) } : { name: raw };
      const res = await pwApi.getPlayerTargetProfile(query);
      const profile = res.profile;
      if (!profile?.roleid && !profile?.userid) {
        toast.error(
          (profile as { resolution_note?: string } | undefined)?.resolution_note ??
            "Jogador não encontrado",
        );
        return;
      }
      setResolvedName(profile?.name ?? null);
      onResolved(profile);
      toast.success(
        `Alvo: ${profile?.name ?? "—"} · roleid ${profile?.roleid ?? "—"} · userid ${profile?.userid ?? "—"}${
          profile?.online === true ? " · online" : profile?.online === false ? " · offline" : ""
        }`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setResolving(false);
    }
  };

  return (
    <>
      <FieldRow label="Buscar jogador (nick ou roleid)">
        <div className="flex gap-2">
          <Input
            value={lookup}
            onChange={(e) => setLookup(e.target.value)}
            placeholder="Nick ou roleid"
            onKeyDown={(e) => e.key === "Enter" && void resolveTarget()}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={resolving || !lookup.trim()}
            onClick={() => void resolveTarget()}
          >
            {resolving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Target className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      </FieldRow>
      {resolvedName && (
        <p className="mb-1 text-[10px] text-success">Resolvido: {resolvedName}</p>
      )}
      {hint && <p className="mb-2 text-[10px] text-muted-foreground">{hint}</p>}
    </>
  );
}

function QuickPunishmentCard({
  caps,
  onActed,
}: {
  caps: Map<string, GmCommandCapability>;
  onActed: () => void;
}) {
  const toast = useFeedback();
  const { active } = useServers();
  const [presets, setPresets] = useState<QuickPunishmentPreset[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [presetKey, setPresetKey] = useState("");
  const [lookup, setLookup] = useState("");
  const [roleid, setRoleid] = useState("");
  const [userid, setUserid] = useState("");
  const [resolvedName, setResolvedName] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [durationSeconds, setDurationSeconds] = useState("");
  const [kickOnline, setKickOnline] = useState(true);
  const [resolving, setResolving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const selected = presets.find((p) => p.key === presetKey) ?? null;
  const roleidNum = Number(roleid);
  const useridNum = Number(userid);
  const durationNum = Number(durationSeconds);
  const roleTargetOk = Number.isFinite(roleidNum) && roleidNum > 0;
  const accountTargetOk =
    (Number.isFinite(useridNum) && useridNum > 0) || roleTargetOk;
  const targetOk =
    selected?.target_scope === "account" ? accountTargetOk : roleTargetOk;
  const durationOk =
    !selected?.duration_required ||
    (Number.isFinite(durationNum) && durationNum > 0);
  const reasonOk = reason.trim().length > 0;
  const canSubmit = !!selected && targetOk && durationOk && reasonOk;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setCatalogLoading(true);
      try {
        const res = await pwApi.getQuickPunishmentCatalog();
        if (cancelled) return;
        const list = res.presets ?? [];
        setPresets(list);
        if (list.length > 0) {
          setPresetKey(list[0].key);
          setDurationSeconds(String(list[0].default_duration_seconds || ""));
        }
      } catch (e) {
        if (!cancelled) {
          toast.error(e instanceof Error ? e.message : String(e));
        }
      } finally {
        if (!cancelled) setCatalogLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [toast]);

  useEffect(() => {
    if (!selected) return;
    setDurationSeconds(String(selected.default_duration_seconds || ""));
    if (!selected.supports_kick_online) setKickOnline(false);
    else setKickOnline(true);
  }, [selected?.key]);

  const resolveTarget = async () => {
    const raw = lookup.trim();
    if (!raw) {
      toast.error("Informe nick ou roleid");
      return;
    }
    setResolving(true);
    try {
      const query = /^\d+$/.test(raw) ? { roleid: Number(raw) } : { name: raw };
      const res = await pwApi.getPlayerTargetProfile(query);
      const profile = res.profile;
      const rid = profile?.roleid;
      const uid = profile?.userid;
      if (!rid && !uid) {
        toast.error(
          (profile as { resolution_note?: string } | undefined)?.resolution_note ??
            "Jogador não encontrado",
        );
        return;
      }
      if (rid) setRoleid(String(rid));
      if (uid) setUserid(String(uid));
      setResolvedName(profile?.name ?? null);
      toast.success(
        `Alvo: ${profile?.name ?? "—"} · roleid ${rid ?? "—"} · userid ${uid ?? "—"}`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setResolving(false);
    }
  };

  const buildPayload = () => {
    if (!selected) throw new Error("Preset não selecionado");
    const payload: {
      preset_key: string;
      reason: string;
      roleid?: number;
      userid?: number;
      duration_seconds?: number;
      kick_online?: boolean;
    } = {
      preset_key: selected.key,
      reason: reason.trim(),
    };
    if (selected.duration_required && durationNum > 0) {
      payload.duration_seconds = durationNum;
    }
    if (selected.supports_kick_online && kickOnline) {
      payload.kick_online = true;
    }
    if (selected.target_scope === "account") {
      if (useridNum > 0) payload.userid = useridNum;
      if (roleidNum > 0) payload.roleid = roleidNum;
    } else if (roleidNum > 0) {
      payload.roleid = roleidNum;
    }
    return payload;
  };

  const renderPlanPreview = (plan: QuickPunishmentPreviewResponse["plan"]) => {
    if (!plan) return <p className="text-xs">Sem plano de preview.</p>;
    return (
      <div className="space-y-1 text-xs">
        <Row label="Preset" value={plan.label ?? plan.preset_key ?? "—"} />
        <Row label="Ação" value={plan.underlying_action ?? "—"} />
        <Row label="Escopo" value={plan.target_scope ?? "—"} />
        <Row
          label="Alvo"
          value={`roleid ${plan.target?.roleid ?? "—"} · userid ${plan.target?.userid ?? "—"}`}
        />
        {plan.duration_seconds != null && plan.duration_seconds > 0 && (
          <Row
            label="Duração"
            value={`${plan.duration_seconds}s (${formatDurationLabel(plan.duration_seconds)})`}
          />
        )}
        {plan.permanent && <Row label="Permanente" value="sim" />}
        {plan.kick_online && <Row label="Kick online" value="sim" />}
        {plan.reason && <Row label="Motivo" value={plan.reason} />}
        {Array.isArray(plan.warnings) && plan.warnings.length > 0 && (
          <ul className="mt-2 list-disc space-y-0.5 pl-4 text-[10px] text-amber-600">
            {plan.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        )}
      </div>
    );
  };

  return (
    <GmCard
      icon={Zap}
      title="Punições Rápidas"
      subtitle="Presets de kick, mute e ban com preview do plano antes de executar."
      action="executeQuickPunishment"
      caps={caps}
      tone="danger"
    >
      {catalogLoading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Carregando catálogo…
        </div>
      ) : presets.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Nenhum preset disponível nesta versão da API.
        </p>
      ) : (
        <>
          <FieldRow label="Preset">
            <Select value={presetKey} onValueChange={setPresetKey}>
              <SelectTrigger>
                <SelectValue placeholder="Escolha a punição" />
              </SelectTrigger>
              <SelectContent>
                {presets.map((p) => (
                  <SelectItem key={p.key} value={p.key}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selected?.summary && (
              <p className="mt-1 text-[10px] text-muted-foreground">{selected.summary}</p>
            )}
          </FieldRow>

          <FieldRow label="Buscar jogador (nick ou roleid)">
            <div className="flex gap-2">
              <Input
                value={lookup}
                onChange={(e) => setLookup(e.target.value)}
                placeholder="Nick ou roleid"
                onKeyDown={(e) => e.key === "Enter" && void resolveTarget()}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={resolving || !lookup.trim()}
                onClick={() => void resolveTarget()}
              >
                {resolving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Target className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
          </FieldRow>

          {selected?.target_scope === "account" ? (
            <FieldRow label="Userid (conta)">
              <Input
                value={userid}
                onChange={(e) => setUserid(e.target.value)}
                placeholder="Ex.: 512"
                inputMode="numeric"
              />
              <p className="mt-1 text-[10px] text-muted-foreground">
                Pode informar userid direto ou resolver pelo nick acima (roleid também aceito).
              </p>
            </FieldRow>
          ) : null}

          <FieldRow
            label={
              selected?.target_scope === "account"
                ? "Roleid (opcional, para resolver conta)"
                : "Roleid (personagem)"
            }
          >
            <Input
              value={roleid}
              onChange={(e) => setRoleid(e.target.value)}
              placeholder="Ex.: 1024"
              inputMode="numeric"
            />
            {resolvedName && (
              <p className="mt-1 text-[10px] text-success">
                Resolvido: {resolvedName}
              </p>
            )}
          </FieldRow>

          {selected?.duration_required && (
            <FieldRow label="Duração (segundos)">
              <Input
                value={durationSeconds}
                onChange={(e) => setDurationSeconds(e.target.value)}
                placeholder={String(selected.default_duration_seconds || 3600)}
                inputMode="numeric"
              />
              <div className="mt-1 flex flex-wrap gap-1">
                {[
                  { label: "1h", s: 3600 },
                  { label: "6h", s: 21600 },
                  { label: "24h", s: 86400 },
                  { label: "7d", s: 604800 },
                ].map(({ label, s }) => (
                  <Button
                    key={label}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-6 px-2 text-[10px]"
                    onClick={() => setDurationSeconds(String(s))}
                  >
                    {label}
                  </Button>
                ))}
              </div>
              {durationNum > 0 && (
                <p className="mt-1 text-[10px] text-muted-foreground">
                  ≈ {formatDurationLabel(durationNum)}
                </p>
              )}
            </FieldRow>
          )}

          {selected?.supports_kick_online && (
            <FieldRow label="Kick se online">
              <Switch checked={kickOnline} onCheckedChange={setKickOnline} />
            </FieldRow>
          )}

          <FieldRow label="Motivo (obrigatório)">
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex.: spam no chat global"
            />
          </FieldRow>

          <Button
            variant="destructive"
            className="w-full"
            disabled={!canSubmit}
            onClick={() => setConfirmOpen(true)}
          >
            <Zap className="h-3.5 w-3.5" />
            {selected ? `Aplicar: ${selected.label}` : "Aplicar punição"}
          </Button>

          <ConfirmActionDialog<
            QuickPunishmentPreviewResponse | QuickPunishmentExecuteResponse
          >
            open={confirmOpen}
            onOpenChange={setConfirmOpen}
            title={selected ? `Punição: ${selected.label}` : "Punição rápida"}
            description="Primeiro rodamos o preview do plano (sem efetivar). Confira alvo, duração e avisos antes de executar."
            exec={async (preview) => {
              const payload = buildPayload();
              if (preview) return pwApi.previewQuickPunishment(payload);
              return pwApi.executeQuickPunishment(payload);
            }}
            onSuccess={(res) => {
              const execRes = res as QuickPunishmentExecuteResponse;
              if (execRes.success) {
                toast.success(`${execRes.preset?.label ?? "Punição"} aplicada`, {
                  description: execRes.result?.message ?? execRes.plan?.underlying_action,
                });
                if (execRes.result?.warning) {
                  toast.warning(execRes.result.warning);
                }
              } else {
                toast.error(execRes.error ?? execRes.result?.error ?? "Falhou");
              }
              void logAuditEvent({
                action: "gm.executeQuickPunishment",
                tenantId: active?.id ?? null,
                target: `preset:${presetKey}:roleid:${roleidNum || "—"}:userid:${useridNum || "—"}`,
                status: execRes.success ? "ok" : "error",
                metadata: { plan: execRes.plan, result: execRes.result },
              });
              onActed();
            }}
            renderPreview={(res) => renderPlanPreview(res.plan)}
          />
        </>
      )}
    </GmCard>
  );
}

function ModerationTab({
  caps,
  onActed,
  isSuperadmin,
  cardVisibility,
  onToggleVisibility,
}: {
  caps: Map<string, GmCommandCapability>;
  onActed: () => void;
} & VisibilityProps) {
  const items: ActionItem[] = [
    {
      id: "quick-punishment",
      action: "executeQuickPunishment",
      title: "Punições Rápidas",
      subtitle: "Kick, mute e ban com presets — preview do plano antes de executar.",
      icon: Zap,
      tone: "danger",
      render: () => <QuickPunishmentCard caps={caps} onActed={onActed} />,
    },
    {
      id: "kick",
      action: "kickRole",
      title: "Kick Personagem",
      subtitle: "Desconecta o personagem online (roleid). Não bane a conta.",
      icon: LogOut,
      tone: "warning",
      render: () => <KickRoleCard caps={caps} onActed={onActed} />,
    },
    {
      id: "ban",
      action: "banAccount",
      title: "Banir Conta",
      subtitle: "Bane a conta inteira (userid). Afeta todos os personagens.",
      icon: Ban,
      tone: "danger",
      render: () => <BanAccountCard caps={caps} onActed={onActed} />,
    },
    {
      id: "unban",
      action: "unbanAccount",
      title: "Desbanir Conta",
      subtitle: "Remove o ban de uma conta (userid).",
      icon: ShieldOff,
      render: () => <UnbanAccountCard caps={caps} onActed={onActed} />,
    },
    {
      id: "mute-account",
      action: "muteAccount",
      title: "Mutar Conta",
      subtitle: "Silencia a conta (userid) — afeta todos os personagens dela.",
      icon: VolumeX,
      tone: "warning",
      render: () => (
        <MuteCard
          caps={caps}
          onActed={onActed}
          variant="account"
          action="muteAccount"
          title="Mutar Conta"
          subtitle="Silencia a conta (userid). Afeta todos os personagens dessa conta."
        />
      ),
    },
    {
      id: "mute-role",
      action: "muteRole",
      title: "Mutar Personagem",
      subtitle: "Silencia apenas um personagem específico (roleid).",
      icon: VolumeX,
      tone: "warning",
      render: () => (
        <MuteCard
          caps={caps}
          onActed={onActed}
          variant="role"
          action="muteRole"
          title="Mutar Personagem"
          subtitle="Silencia apenas um personagem específico (roleid)."
        />
      ),
    },
    {
      id: "clearpk",
      action: "clearRolePk",
      title: "Clear PK",
      subtitle: "Remove estado PK persistido de um personagem (roleid).",
      icon: ShieldCheck,
      tone: "warning",
      render: () => <ClearRolePkCard caps={caps} onActed={onActed} />,
    },
  ];
  return (
    <ActionPicker
      items={items}
      caps={caps}
      emptyHint="Selecione uma ação de moderação para abrir o formulário."
      isSuperadmin={isSuperadmin}
      cardVisibility={cardVisibility}
      onToggleVisibility={onToggleVisibility}
    />
  );
}

function KickRoleCard({
  caps,
  onActed,
}: {
  caps: Map<string, GmCommandCapability>;
  onActed: () => void;
}) {
  const toast = useFeedback();
  const { active } = useServers();
  const [roleid, setRoleid] = useState("");
  const [reason, setReason] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const roleidNum = Number(roleid);
  const roleidValid = Number.isFinite(roleidNum) && roleidNum > 0;

  return (
    <GmCard
      icon={LogOut}
      title="Kick Personagem"
      subtitle="Desconecta o personagem online (não bane). Exige roleid — não confundir com userid da conta."
      action="kickRole"
      caps={caps}
      tone="warning"
    >
      <ModerationPlayerLookup
        hint="Kick só funciona com o personagem online. Use a busca para confirmar roleid."
        onResolved={(p) => {
          if (p.roleid) setRoleid(String(p.roleid));
        }}
      />
      <FieldRow label="Roleid (personagem)">
        <Input
          value={roleid}
          onChange={(e) => setRoleid(e.target.value)}
          placeholder="Ex.: 1024"
          inputMode="numeric"
        />
      </FieldRow>
      {!roleidValid && roleid.length > 0 && (
        <p className="text-[10px] text-destructive">
          roleid deve ser numérico (id do personagem, não da conta).
        </p>
      )}
      <FieldRow label="Motivo">
        <Input value={reason} onChange={(e) => setReason(e.target.value)} />
      </FieldRow>
      <Button
        variant="outline"
        className="w-full border-amber-500/50 text-amber-500"
        disabled={!roleidValid || !reason.trim()}
        onClick={() => setConfirmOpen(true)}
      >
        <LogOut className="h-3.5 w-3.5" />
        Kickar Personagem #{roleidValid ? roleidNum : "—"}
      </Button>
      <ConfirmActionDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        skipDryRun
        title={`Kick Personagem #${roleidNum}`}
        description={`Desconectar Personagem #${roleidNum}? Esta operação é imediata. Não afeta a conta.`}
        exec={async () => pwApi.kickRole({ roleid: roleidNum, reason })}
        onSuccess={(res) => {
          if (
            feedbackSecurityAction(
              toast,
              res,
              `Personagem #${roleidNum} desconectado`,
            )
          ) {
            void logAuditEvent({
              action: "gm.kickRole",
              tenantId: active?.id ?? null,
              target: `roleid:${roleidNum}`,
              status: "ok",
            });
            onActed();
          }
        }}
        renderPreview={() => null}
      />
    </GmCard>
  );
}

function BanAccountCard({
  caps,
  onActed,
}: {
  caps: Map<string, GmCommandCapability>;
  onActed: () => void;
}) {
  const toast = useFeedback();
  const { active } = useServers();
  const [userid, setUserid] = useState("");
  const [roleid, setRoleid] = useState("");
  const [reason, setReason] = useState("");
  const [duration, setDuration] = useState("3600");
  const [permanent, setPermanent] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [kickAfterBan, setKickAfterBan] = useState(true);
  const [kickSeconds, setKickSeconds] = useState("10");
  

  const useridNum = Number(userid);
  const useridValid = Number.isFinite(useridNum) && useridNum > 0;
  const roleidNum = Number(roleid);
  const roleidValid = Number.isFinite(roleidNum) && roleidNum > 0;
  const durationNum = Number(duration);
  const durationValid = permanent || (Number.isFinite(durationNum) && durationNum > 0);
  const kickSecondsNum = Number(kickSeconds);
  const kickSecondsValid = Number.isFinite(kickSecondsNum) && kickSecondsNum >= 0;

  return (
    <GmCard
      icon={Ban}
      title="Banir Conta"
      subtitle="Bane a CONTA (afeta todos os personagens). Exige userid — não confundir com roleid do personagem."
      action="banAccount"
      caps={caps}
      tone="danger"
    >
      <ModerationPlayerLookup
        onResolved={(p) => {
          if (p.userid) setUserid(String(p.userid));
          if (p.roleid) setRoleid(String(p.roleid));
        }}
      />
      <FieldRow label="Userid (conta)">
        <Input
          value={userid}
          onChange={(e) => setUserid(e.target.value)}
          placeholder="Ex.: 1234"
          inputMode="numeric"
        />
      </FieldRow>
      {!useridValid && userid.length > 0 && (
        <p className="text-[10px] text-destructive">
          userid deve ser numérico (id da conta, não do personagem).
        </p>
      )}
      <FieldRow label="Roleid (personagem online — opcional)">
        <Input
          value={roleid}
          onChange={(e) => setRoleid(e.target.value)}
          placeholder="Ex.: 1024"
          inputMode="numeric"
        />
      </FieldRow>
      {!roleidValid && roleid.length > 0 && (
        <p className="text-[10px] text-destructive">
          roleid deve ser numérico (id do personagem).
        </p>
      )}
      {roleidValid && (
        <div className="flex items-center justify-between rounded-md border border-border bg-card/40 px-2 py-1.5">
          <div className="flex-1">
            <Label className="text-[11px]">Kick após ban</Label>
            <p className="text-[10px] text-muted-foreground">
              Derrubar personagem #{roleidNum} após o ban
            </p>
          </div>
          <Switch checked={kickAfterBan} onCheckedChange={setKickAfterBan} />
        </div>
      )}
      {roleidValid && kickAfterBan && (
        <FieldRow label="Tempo de aviso antes do kick (s)">
          <Input
            type="number"
            min={0}
            value={kickSeconds}
            onChange={(e) => setKickSeconds(e.target.value)}
            placeholder="10"
          />
        </FieldRow>
      )}
      <FieldRow label="Motivo">
        <Input value={reason} onChange={(e) => setReason(e.target.value)} />
      </FieldRow>
      <div className="flex items-center justify-between rounded-md border border-border bg-card/40 px-2 py-1.5">
        <Label className="text-[11px]">Permanente</Label>
        <Switch checked={permanent} onCheckedChange={setPermanent} />
      </div>
      {!permanent && (
        <FieldRow label="Duração (segundos)">
          <Input
            type="number"
            min={1}
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
          />
        </FieldRow>
      )}
      <div className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2">
        <p className="text-[10px] text-amber-400">
          <strong>Nota:</strong> Em servidores legados, o ban da conta pode valer apenas no próximo login.
          {roleidValid
            ? " Use o kick automático para remover a sessão atual."
            : " A conta será bloqueada, mas a sessão online atual pode continuar sem kick. Informe o roleid para derrubar o personagem."}
        </p>
      </div>
      <Button
        variant="destructive"
        className="w-full"
        disabled={!useridValid || !reason.trim() || !durationValid}
        onClick={() => setConfirmOpen(true)}
      >
        <Ban className="h-3.5 w-3.5" />
        Banir Conta #{useridValid ? useridNum : "—"}
        {roleidValid && kickAfterBan && " + Kick"}
      </Button>
      <ConfirmActionDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Banir Conta #${useridNum}`}
        description={`Banir Conta #${useridNum} ${
          permanent ? "PERMANENTEMENTE" : `por ${durationNum}s`
        }? Afeta todos os personagens dessa conta.${
          roleidValid && kickAfterBan
            ? ` Após o ban, o personagem #${roleidNum} será desconectado automaticamente.`
            : ""
        }`}
        exec={async (dryRun) =>
          pwApi.banAccount({
            userid: useridNum,
            roleid: roleidValid ? roleidNum : undefined,
            reason,
            permanent,
            duration_seconds: permanent ? undefined : durationNum,
            dry_run: dryRun,
            kick_online: roleidValid && kickAfterBan ? true : undefined,
            kick_seconds: roleidValid && kickAfterBan && kickSecondsValid ? kickSecondsNum : undefined,
          })
        }
        onSuccess={(res) => {
          const gm = gmFromSecurity(res);
          if (!feedbackSecurityAction(toast, res, `Conta #${useridNum} banida`)) return;

          const ab = gm.account_ban;
          const sk = gm.session_kick;
          if (ab?.forbid_until || ab?.forbid_until_unix) {
            toast.info(
              `Bloqueio até: ${ab.forbid_until ?? fmtDate(ab.forbid_until_unix as number)}`,
            );
          }
          if (sk?.success) {
            toast.info("Sessão online derrubada");
          }

          void logAuditEvent({
            action: "gm.banAccount",
            tenantId: active?.id ?? null,
            target: `userid:${useridNum}`,
            status: "ok",
            metadata: {
              permanent,
              duration_seconds: durationNum,
              account_forbid_backend: gm.account_forbid_backend ?? null,
              kick_online: roleidValid && kickAfterBan,
              roleid: roleidValid ? roleidNum : null,
            },
          });
          onActed();
        }}
        renderPreview={(res) => {
          const gm = res.gm_action;
          const ab = gm?.account_ban;
          const sk = gm?.session_kick;
          const forbidUntil = ab?.forbid_until ?? (gm?.delivery as any)?.forbid_until;
          const forbidUntilUnix = ab?.forbid_until_unix ?? (gm?.delivery as any)?.forbid_until_unix;
          const banDuration = ab?.duration_seconds;
          const backendLabel =
            gm?.account_forbid_backend === "forbid_table"
              ? "tabela forbid"
              : gm?.account_forbid_backend === "gamedbd"
                ? "gamedbd"
                : gm?.account_forbid_backend ?? "—";
          return (
            <div className="space-y-2 text-xs">
              {/* ── Bloqueio de login (account_ban) ── */}
              <div className="rounded-md border border-border/50 bg-card/30 p-2 space-y-1">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Bloqueio de Login</p>
                {ab?.blocks_login != null && (
                  <Row label="login bloqueado" value={ab.blocks_login ? "sim" : "não"} />
                )}
                {ab?.permanent && <Row label="ban" value="PERMANENTE" />}
                {banDuration != null && !ab?.permanent && (
                  <Row label="duração do ban" value={`${banDuration}s`} />
                )}
                {(forbidUntil || forbidUntilUnix) && (
                  <Row
                    label="conta bloqueada até"
                    value={forbidUntil ?? (forbidUntilUnix ? fmtDate(forbidUntilUnix) : "—")}
                  />
                )}
                {!ab && res.ban_until != null && (
                  <Row label="ban_until (legacy)" value={fmtDate(res.ban_until)} />
                )}
                <Row label="backend" value={backendLabel} />
                <Row label="state" value={res.state ?? "—"} />
              </div>

              {/* ── Sessão online (session_kick) ── */}
              {(sk || (roleidValid && kickAfterBan)) && (
                <div className="rounded-md border border-border/50 bg-card/30 p-2 space-y-1">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Sessão Online</p>
                  {sk ? (
                    <>
                      <Row label="kick" value={sk.success ? "sessão derrubada ✓" : `roleid:${sk.roleid ?? roleidNum}`} />
                      {sk.seconds != null && <Row label="aviso" value={`${sk.seconds}s`} />}
                      {sk.message && <Row label="msg" value={sk.message} />}
                    </>
                  ) : (
                    <Row label="kick (pendente)" value={`roleid:${roleidNum} (${kickSecondsNum}s)`} />
                  )}
                </div>
              )}

              {/* ── Aviso sem roleid ── */}
              {!roleidValid && !sk && (
                <p className="text-[10px] text-amber-400">
                  ⚠ Sem roleid — a conta será bloqueada, mas a sessão online atual pode continuar sem kick.
                </p>
              )}

              {/* ── deliveryd_forbid ── */}
              {gm?.deliveryd_forbid && (
                <div className="rounded-md border border-border/50 bg-card/30 p-2 space-y-1">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Delivery Forbid</p>
                  <Row label="notificação" value={gm.deliveryd_forbid.success ? "entregue ✓" : "falhou ✗"} />
                  {gm.deliveryd_forbid.message && <Row label="msg" value={String(gm.deliveryd_forbid.message)} />}
                </div>
              )}

              <DeliveryDetails gm={gm} variant="ban" />
            </div>
          );
        }}
      />
    </GmCard>
  );
}

function UnbanAccountCard({
  caps,
  onActed,
}: {
  caps: Map<string, GmCommandCapability>;
  onActed: () => void;
}) {
  const toast = useFeedback();
  const { active } = useServers();
  const [userid, setUserid] = useState("");
  const [roleid, setRoleid] = useState("");
  const [reason, setReason] = useState("");
  const [refreshLogin, setRefreshLogin] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const useridNum = Number(userid);
  const useridValid = Number.isFinite(useridNum) && useridNum > 0;
  const roleidNum = Number(roleid);
  const roleidValid = Number.isFinite(roleidNum) && roleidNum > 0;

  return (
    <GmCard
      icon={ShieldOff}
      title="Desbanir Conta"
      subtitle="Remove o ban de uma CONTA. Envie userid obrigatório e roleid para limpar bloqueio residual do personagem."
      action="unbanAccount"
      caps={caps}
    >
      <ModerationPlayerLookup
        onResolved={(p) => {
          if (p.userid) setUserid(String(p.userid));
          if (p.roleid) setRoleid(String(p.roleid));
        }}
      />
      <FieldRow label="Userid (conta)">
        <Input
          value={userid}
          onChange={(e) => setUserid(e.target.value)}
          placeholder="Ex.: 1024"
          inputMode="numeric"
        />
      </FieldRow>
      {!useridValid && userid.length > 0 && (
        <p className="text-[10px] text-destructive">
          userid deve ser numérico (id da conta).
        </p>
      )}
      <FieldRow label="Roleid (personagem, opcional)">
        <Input
          value={roleid}
          onChange={(e) => setRoleid(e.target.value)}
          placeholder="Ex.: 1024"
          inputMode="numeric"
        />
      </FieldRow>
      {!roleidValid && roleid.length > 0 && (
        <p className="text-[10px] text-destructive">
          roleid deve ser numérico.
        </p>
      )}
      {!roleidValid && useridValid && (
        <p className="text-[10px] text-amber-500">
          ⚠ Sem roleid — o bloqueio residual do personagem não será removido.
        </p>
      )}
      <FieldRow label="Motivo (opcional)">
        <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex.: cleanup" />
      </FieldRow>
      <FieldRow label="Refresh de login (authd + gdeliveryd)">
        <Switch checked={refreshLogin} onCheckedChange={setRefreshLogin} />
      </FieldRow>
      {refreshLogin && (
        <p className="text-[10px] text-amber-500">
          ⚠ Reiniciar authd e gdeliveryd pode afetar autenticação e fluxos online de outros jogadores. Use apenas quando a conta continuar bloqueada após o unban lógico.
        </p>
      )}
      <Button
        onClick={() => setConfirmOpen(true)}
        disabled={!useridValid}
        className="w-full"
        variant="outline"
      >
        <ShieldOff className="h-3.5 w-3.5" />
        {refreshLogin ? "Liberar conta e limpar cache de login" : "Liberar conta"}
        {" #"}{useridValid ? useridNum : "—"}
        {roleidValid ? ` + Personagem #${roleidNum}` : ""}
      </Button>
      <ConfirmActionDialog<SecurityActionResponse>
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Desbanir Conta #${useridNum}${roleidValid ? ` + Role #${roleidNum}` : ""}`}
        description={`Remover ban da Conta #${useridNum}${roleidValid ? ` e bloqueio residual do personagem #${roleidNum}` : ""}?`}
        exec={async (dryRun) =>
          pwApi.unbanAccount({
            userid: useridNum,
            roleid: roleidValid ? roleidNum : undefined,
            reason: reason || undefined,
            refresh_services: refreshLogin ? ["authd", "gdeliveryd"] : undefined,
            dry_run: dryRun,
          })
        }
        onSuccess={(res) => {
          if (res.success) {
            const gm = res.gm_action;
            const delivery = extractDelivery(gm);
            const afterEmpty = !delivery?.after_type_ids?.length;
            const roleCleared = gm?.role_clear?.cleared === true;
            const lcr = gm?.login_cache_refresh;
            const refreshResults = lcr?.results;
            const authOk = refreshResults?.authd?.success === true;
            const gdeliverydOk = refreshResults?.gdeliveryd?.success === true;

            const lines: string[] = ["✅ Conta liberada com sucesso"];
            if (afterEmpty) {
              lines.push("✅ Bloqueio da conta removido");
            }
            if (roleCleared) {
              lines.push("✅ Bloqueio residual do personagem removido");
            }
            if (refreshResults) {
              if (authOk && gdeliverydOk) {
                lines.push("✅ Cache de login atualizado");
                lines.push("✅ Serviços reiniciados: authd, gdeliveryd");
              } else {
                const ok: string[] = [];
                const fail: string[] = [];
                for (const [svc, r] of Object.entries(refreshResults)) {
                  (r?.success ? ok : fail).push(svc);
                }
                if (ok.length) lines.push(`✅ Refresh OK: ${ok.join(", ")}`);
                if (fail.length) lines.push(`⚠ Refresh falhou: ${fail.join(", ")}`);
              }
            }

            toast.success(lines.join("\n"));
            const gmWarn = (gm as { warning?: string } | undefined)?.warning;
            if (gmWarn) toast.warning(String(gmWarn));
            void logAuditEvent({
              action: "gm.unbanAccount",
              tenantId: active?.id ?? null,
              target: `userid:${useridNum}${roleidValid ? ` roleid:${roleidNum}` : ""}`,
              status: "ok",
              metadata: {
                account_forbid_backend: gm?.account_forbid_backend ?? null,
                after_type_ids_empty: afterEmpty,
                role_cleared: roleCleared,
                refresh_services: refreshLogin ? ["authd", "gdeliveryd"] : null,
                refresh_authd_ok: authOk || null,
                refresh_gdeliveryd_ok: gdeliverydOk || null,
              },
            });
            onActed();
          } else {
            toast.error(res.error ?? "Falhou");
          }
        }}
        renderPreview={(res) => {
          const gm = res.gm_action;
          const delivery = extractDelivery(gm);
          const afterEmpty = !delivery?.after_type_ids?.length;
          const roleCleared = gm?.role_clear?.cleared === true;
          const lcr = gm?.login_cache_refresh;

          return (
            <div className="space-y-2 text-xs">
              <Row label="state" value={res.state ?? "—"} />

              {/* Account unban section */}
              <div className="rounded-md border border-border/40 p-2 space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Bloqueio da Conta
                </p>
                {afterEmpty ? (
                  <p className="text-success font-medium">✅ Bloqueio da conta removido</p>
                ) : (
                  <p className="text-amber-500 font-medium">⚠ after_type_ids não vazio — verificar</p>
                )}
                <DeliveryDetails gm={gm} variant="unban" />
              </div>

              {/* Role clear section */}
              {gm?.role_clear && (
                <div className="rounded-md border border-border/40 p-2 space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Bloqueio do Personagem
                  </p>
                  {roleCleared ? (
                    <p className="text-success font-medium">✅ Bloqueio residual do personagem removido</p>
                  ) : (
                    <p className="text-amber-500 font-medium">⚠ role_clear não confirmado</p>
                  )}
                  {gm.role_clear.roleid != null && (
                    <Row label="roleid" value={String(gm.role_clear.roleid)} />
                  )}
                  {gm.role_clear.message && (
                    <Row label="mensagem" value={gm.role_clear.message} />
                  )}
                </div>
              )}

              {/* Login cache refresh section */}
              {lcr && (
                <div className="rounded-md border border-border/40 p-2 space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Cache de Login
                  </p>
                  {lcr.requested && (
                    <Row label="serviços solicitados" value={Array.isArray(lcr.requested) ? lcr.requested.join(", ") : String(lcr.requested)} />
                  )}
                  {lcr.results && Object.entries(lcr.results).map(([svc, r]) => (
                    <Row
                      key={svc}
                      label={svc}
                      value={r?.success ? "✅ reiniciado" : `⚠ ${r?.message ?? "falhou"}`}
                    />
                  ))}
                </div>
              )}

              {/* Pending refresh warning */}
              {refreshLogin && !lcr && (
                <p className="text-[10px] text-amber-400">
                  ⚠ Refresh de authd + gdeliveryd será executado após confirmação.
                </p>
              )}
            </div>
          );
        }}
      />
    </GmCard>
  );
}

function MuteCard({
  caps,
  onActed,
  variant,
  action,
  title,
  subtitle,
}: {
  caps: Map<string, GmCommandCapability>;
  onActed: () => void;
  variant: "account" | "role";
  action: "muteAccount" | "muteRole";
  title: string;
  subtitle: string;
}) {
  const toast = useFeedback();
  const { active } = useServers();
  const [target, setTarget] = useState("");
  const [reason, setReason] = useState("");
  const [duration, setDuration] = useState("3600");
  const [permanent, setPermanent] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const isAccount = variant === "account";
  const idLabel = isAccount ? "Userid (conta)" : "Roleid (personagem)";
  const entityLabel = isAccount ? "Conta" : "Personagem";
  const fieldKey = isAccount ? "userid" : "roleid";
  const targetNum = Number(target);
  const targetValid = Number.isFinite(targetNum) && targetNum > 0;
  const durationNum = Number(duration);
  const durationValid = permanent || (Number.isFinite(durationNum) && durationNum > 0);
  const composedTitle = `Mutar ${entityLabel} #${targetValid ? targetNum : "—"}`;

  return (
    <GmCard
      icon={VolumeX}
      title={title}
      subtitle={subtitle}
      action={action}
      caps={caps}
      tone="warning"
    >
      <ModerationPlayerLookup
        hint={
          isAccount
            ? "Preenche userid (e roleid se disponível)."
            : "Preenche roleid do personagem."
        }
        onResolved={(p) => {
          if (isAccount) {
            if (p.userid) setTarget(String(p.userid));
            else if (p.roleid) setTarget(String(p.roleid));
          } else if (p.roleid) {
            setTarget(String(p.roleid));
          }
        }}
      />
      <FieldRow label={idLabel}>
        <Input
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          placeholder={isAccount ? "Ex.: 1234" : "Ex.: 1024"}
          inputMode="numeric"
        />
      </FieldRow>
      {!targetValid && target.length > 0 && (
        <p className="text-[10px] text-destructive">
          {isAccount
            ? "userid deve ser numérico (id da conta, não do personagem)."
            : "roleid deve ser numérico (id do personagem, não da conta)."}
        </p>
      )}
      {!targetValid && target.length === 0 && (
        <p className="text-[10px] text-muted-foreground">
          {isAccount
            ? "Ação de conta — informe o userid (não use roleid)."
            : "Ação de personagem — informe o roleid (não use userid)."}
        </p>
      )}
      <FieldRow label="Motivo">
        <Input value={reason} onChange={(e) => setReason(e.target.value)} />
      </FieldRow>
      <div className="flex items-center justify-between rounded-md border border-border bg-card/40 px-2 py-1.5">
        <Label className="text-[11px]">Permanente</Label>
        <Switch checked={permanent} onCheckedChange={setPermanent} />
      </div>
      {!permanent && (
        <FieldRow label="Duração (segundos)">
          <Input
            type="number"
            min={1}
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
          />
        </FieldRow>
      )}
      <Button
        variant="outline"
        className="w-full border-amber-500/50 text-amber-500"
        disabled={!targetValid || !reason.trim() || !durationValid}
        onClick={() => setConfirmOpen(true)}
      >
        <VolumeX className="h-3.5 w-3.5" />
        {composedTitle}
      </Button>
      <ConfirmActionDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={composedTitle}
        description={`Silenciar ${entityLabel} #${targetNum} ${
          permanent ? "PERMANENTEMENTE" : `por ${durationNum}s`
        }? ${
          isAccount
            ? "A ação afeta a conta inteira (todos os personagens)."
            : "A ação afeta apenas este personagem."
        }`}
        exec={async (dryRun) => {
          const base = {
            reason,
            permanent,
            duration_seconds: permanent ? undefined : durationNum,
            dry_run: dryRun,
          };
          if (isAccount) {
            return pwApi.muteAccount({ userid: targetNum, ...base });
          }
          return pwApi.muteRole({ roleid: targetNum, ...base });
        }}
        onSuccess={(res) => {
          if (
            feedbackSecurityAction(
              toast,
              res,
              `${entityLabel} #${targetNum} silenciado`,
            )
          ) {
            void logAuditEvent({
              action: `gm.${action}`,
              tenantId: active?.id ?? null,
              target: `${fieldKey}:${targetNum}`,
              status: "ok",
              metadata: { permanent, duration_seconds: durationNum },
            });
            onActed();
          }
        }}
        renderPreview={(res) => (
          <div className="space-y-1 text-xs">
            <Row label="state" value={res.state ?? "—"} />
            <Row label="seconds" value={res.seconds ?? "—"} />
          </div>
        )}
      />
    </GmCard>
  );
}

function ClearRolePkCard({
  caps,
  onActed,
}: {
  caps: Map<string, GmCommandCapability>;
  onActed: () => void;
}) {
  const toast = useFeedback();
  const { active } = useServers();
  const [roleid, setRoleid] = useState("");
  const [reason, setReason] = useState("pk-clear");
  const [kickOnline, setKickOnline] = useState(true);
  const [kickSeconds, setKickSeconds] = useState("10");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const roleidNum = Number(roleid);
  const roleidValid = Number.isFinite(roleidNum) && roleidNum > 0;
  const kickSecondsNum = Number(kickSeconds);

  return (
    <GmCard
      icon={ShieldCheck}
      title="Clear PK"
      subtitle="Remove o estado PK persistido do personagem (pk_count, invader_state, invader_time, pariah_time)."
      action="clearRolePk"
      caps={caps}
      tone="warning"
    >
      <FieldRow label="Roleid (personagem)">
        <Input
          value={roleid}
          onChange={(e) => setRoleid(e.target.value)}
          placeholder="Ex.: 1024"
          inputMode="numeric"
        />
      </FieldRow>
      {!roleidValid && roleid.length > 0 && (
        <p className="text-[10px] text-destructive">
          roleid deve ser numérico (id do personagem).
        </p>
      )}
      <FieldRow label="Motivo">
        <Input value={reason} onChange={(e) => setReason(e.target.value)} />
      </FieldRow>
      <FieldRow label="Kick se online">
        <div className="flex items-center gap-2">
          <Switch checked={kickOnline} onCheckedChange={setKickOnline} />
          {kickOnline && (
            <Input
              value={kickSeconds}
              onChange={(e) => setKickSeconds(e.target.value)}
              placeholder="10"
              inputMode="numeric"
              className="w-20"
            />
          )}
          {kickOnline && <span className="text-[10px] text-muted-foreground">segundos</span>}
        </div>
      </FieldRow>
      <Button
        variant="outline"
        className="w-full border-amber-500/50 text-amber-500"
        disabled={!roleidValid}
        onClick={() => setConfirmOpen(true)}
      >
        <ShieldCheck className="h-3.5 w-3.5" />
        Limpar PK do Personagem #{roleidValid ? roleidNum : "—"}
      </Button>
      <ConfirmActionDialog<ClearRolePkResponse>
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Clear PK — Personagem #${roleidNum}`}
        description={`Remover estado PK persistido do Personagem #${roleidNum}? O dry_run vai mostrar o estado atual antes de executar.`}
        exec={async (dryRun) =>
          pwApi.clearRolePk({
            roleid: roleidNum,
            reason,
            kick_online: kickOnline,
            kick_seconds: kickOnline ? kickSecondsNum : undefined,
            dry_run: dryRun,
          })
        }
        onSuccess={(res) => {
          const pk = res.gm_action?.pk_clear;
          const sr = res.gm_action?.session_refresh;
          if (res.success && pk) {
            if (pk.changed) {
              toast.success("Estado PK persistido removido com sucesso", {
                description: `Personagem #${roleidNum} — pk_count: ${pk.before?.pk_count ?? "?"} → ${pk.after?.pk_count ?? 0}`,
              });
            } else if (pk.cleared) {
              toast.info("O personagem já estava sem estado PK persistido");
            } else {
              toast.success("Operação concluída");
            }
            if (sr?.success) {
              toast.info("Sessão online recarregada");
            }
            if (sr?.role_forbid_cleanup?.cleared) {
              toast.info("Residual temporário do refresh removido");
            }
          } else {
            toast.error(res.error ?? "Falhou");
          }
          void logAuditEvent({
            action: "gm.clearRolePk",
            tenantId: active?.id ?? null,
            target: `roleid:${roleidNum}`,
            status: res.success ? "ok" : "error",
            metadata: { gm_action: res.gm_action },
          });
          onActed();
        }}
        renderPreview={(preview) => {
          const pk = preview.gm_action?.pk_clear;
          if (!pk?.before) return <p className="text-xs">Sem dados de preview.</p>;
          return (
            <div className="space-y-1 text-xs">
              <p className="font-semibold">Estado PK atual:</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 font-mono text-[11px]">
                <span className="text-muted-foreground">pk_count</span>
                <span>{pk.before.pk_count ?? 0}</span>
                <span className="text-muted-foreground">invader_state</span>
                <span>{pk.before.invader_state ?? 0}</span>
                <span className="text-muted-foreground">invader_time</span>
                <span>{pk.before.invader_time ?? 0}</span>
                <span className="text-muted-foreground">pariah_time</span>
                <span>{pk.before.pariah_time ?? 0}</span>
              </div>
              {pk.role_forbid_before != null && (
                <>
                  <p className="font-semibold mt-2">role_forbid (antes):</p>
                  <pre className="text-[10px] bg-muted/30 rounded p-1 overflow-x-auto">
                    {JSON.stringify(pk.role_forbid_before, null, 2)}
                  </pre>
                </>
              )}
            </div>
          );
        }}
      />
    </GmCard>
  );
}



/* -------------------------------------------------------------------------- */
/* Comunicação                                                                 */
/* -------------------------------------------------------------------------- */

function CommunicationTab({
  caps,
  onActed,
  isSuperadmin: isSA,
  cardVisibility = {},
  onToggleVisibility,
}: {
  caps: Map<string, GmCommandCapability>;
  onActed: () => void;
} & VisibilityProps) {
  const toast = useFeedback();
  const { active } = useServers();
  const [message, setMessage] = useState("");
  const [kind, setKind] = useState<"system" | "broadcast" | "tip" | "world">("system");
  const [priority, setPriority] = useState<"low" | "normal" | "high">("normal");
  const [busy, setBusy] = useState(false);

  const submit = async (dryRun: boolean) => {
    if (!message.trim()) {
      toast.error("Mensagem obrigatória");
      return;
    }
    setBusy(true);
    try {
      const res = await pwApi.sendSystemMessage({
        message,
        kind,
        priority,
        dry_run: dryRun,
      });
      if (res.success) {
        if (dryRun) {
          toast.info(`Preview OK · método ${res.method ?? "—"} · ${res.length ?? 0} chars`);
        } else {
          toast.success(`Mensagem ${res.delivered ? "entregue" : "enfileirada"}`);
          void logAuditEvent({
            action: "gm.sendSystemMessage",
            tenantId: active?.id ?? null,
            target: kind,
            status: "ok",
            metadata: { kind, priority, length: res.length },
          });
          setMessage("");
          onActed();
        }
      } else {
        toast.error(res.error ?? "Falhou");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const commCardId = "system-message";
  const commHidden = !isCardVisible(commCardId, cardVisibility);
  if (!isSA && commHidden) return <p className="text-xs text-muted-foreground">Nenhum card disponível nesta seção.</p>;

  return (
    <div className={cn("grid gap-4 lg:grid-cols-2", commHidden && isSA && "opacity-50")}>
      {isSA && onToggleVisibility && (
        <div className="lg:col-span-2 flex justify-end">
          <button
            type="button"
            onClick={() => onToggleVisibility(commCardId)}
            className={cn(
              "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11px] font-medium transition-all",
              commHidden
                ? "border-destructive/50 bg-destructive/10 text-destructive hover:bg-destructive/20"
                : "border-emerald-500/50 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20",
            )}
          >
            {commHidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            {commHidden ? "Oculto para usuários" : "Visível para usuários"}
          </button>
        </div>
      )}
      <GmCard
        icon={MessageSquare}
        title="Mensagem Global"
        subtitle="Envia para todos os jogadores online via gdeliveryd."
        action="sendSystemMessage"
        caps={caps}
        tone="premium"
      >
        <FieldRow label="Tipo">
          <Select value={kind} onValueChange={(v) => setKind(v as typeof kind)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="system">system</SelectItem>
              <SelectItem value="broadcast">broadcast</SelectItem>
              <SelectItem value="tip">tip</SelectItem>
              <SelectItem value="world">world</SelectItem>
            </SelectContent>
          </Select>
        </FieldRow>
        <FieldRow label="Prioridade">
          <Select value={priority} onValueChange={(v) => setPriority(v as typeof priority)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">low</SelectItem>
              <SelectItem value="normal">normal</SelectItem>
              <SelectItem value="high">high</SelectItem>
            </SelectContent>
          </Select>
        </FieldRow>
        <FieldRow label="Mensagem">
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            maxLength={200}
          />
          <div className="text-right text-[10px] text-muted-foreground">
            {message.length}/200
          </div>
        </FieldRow>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => void submit(true)}
            disabled={busy}
          >
            <Sparkles className="h-3.5 w-3.5" />
            Dry-run
          </Button>
          <Button
            className="flex-1"
            onClick={() => void submit(false)}
            disabled={busy}
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MessageSquare className="h-3.5 w-3.5" />}
            Enviar
          </Button>
        </div>
      </GmCard>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Permissoes GM — PW 1.7.8 (addGM / DELETE auth)                              */
/* -------------------------------------------------------------------------- */

function extractGmRuleIds(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === "number" && Number.isFinite(item)) return item;
      if (typeof item === "string" && item.trim() !== "" && Number.isFinite(Number(item))) {
        return Number(item);
      }
      if (item && typeof item === "object") {
        const obj = item as { rid?: unknown; id?: unknown };
        if (obj.rid != null && Number.isFinite(Number(obj.rid))) return Number(obj.rid);
        if (obj.id != null && Number.isFinite(Number(obj.id))) return Number(obj.id);
      }
      return NaN;
    })
    .filter((n) => Number.isFinite(n) && n >= 0);
}

function currentGmRuleCount(state: GmPermissionStateResponse | null): number {
  if (!state) return 0;
  const ps = state.permission_state;
  return extractGmRuleIds(ps?.current_rule_ids ?? ps?.current_rules ?? state.current_rules).length;
}

function GmPermissionsTab({
  caps,
  onActed,
  isSuperadmin: isSA,
  cardVisibility = {},
  onToggleVisibility,
}: {
  caps: Map<string, GmCommandCapability>;
  onActed: () => void;
} & VisibilityProps) {
  const toast = useFeedback();
  const { active } = useServers();
  const [lookup, setLookup] = useState<{ kind: "name" | "userid" | "roleid"; value: string }>(
    { kind: "name", value: "" },
  );
  const [target, setTarget] = useState<{ kind: "userid" | "roleid"; value: string }>(
    { kind: "userid", value: "" },
  );
  const [reason, setReason] = useState("gm-permission-update");
  const [zoneid, setZoneid] = useState("1");
  const [gamesysNote, setGamesysNote] = useState("");
  const [state, setState] = useState<GmPermissionStateResponse | null>(null);
  const [resolvedProfile, setResolvedProfile] = useState<PlayerTargetProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [missing, setMissing] = useState(false);
  const [kickOnline, setKickOnline] = useState(true);
  const [lastResult, setLastResult] = useState<GmPermissionMutationResponse | null>(null);

  const supportedRead = isSupported("getGmPermissionState", caps);
  const supportedGrant = isSupported("grantGmPermission", caps);
  const supportedRevoke = isSupported("revokeGmPermission", caps);

  const currentRuleCount = useMemo(() => currentGmRuleCount(state), [state]);

  const hasGm = currentRuleCount > 0;

  const applyPermissionState = useCallback((res: GmPermissionStateResponse) => {
    setState(res);
    const gs = (res as GmPermissionStateResponse & {
      gamesys?: { effective_zoneid?: number; note?: string; zoneid_mismatch?: boolean };
      effective_zoneid?: number;
    }).gamesys;
    const effectiveZone =
      gs?.effective_zoneid ??
      (res as GmPermissionStateResponse & { effective_zoneid?: number }).effective_zoneid;
    if (effectiveZone != null && effectiveZone > 0) {
      setZoneid(String(effectiveZone));
    }
    if (gs?.note) {
      setGamesysNote(gs.note);
    } else if (gs?.zoneid_mismatch) {
      setGamesysNote("gdeliveryd e gamedbd tem zoneid diferente — confira gamesys.conf");
    } else {
      setGamesysNote("");
    }
  }, []);

  const loadState = useCallback(async () => {
    const v = Number(target.value);
    if (!v) {
      toast.error(`Informe ${target.kind} valido`);
      return;
    }
    setLoading(true);
    setMissing(false);
    setLastResult(null);
    try {
      const res = await pwApi.getGmPermissionState({ [target.kind]: v });
      applyPermissionState(res);
    } catch (e) {
      if (e instanceof EndpointMissingError) setMissing(true);
      else toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [applyPermissionState, target, toast]);

  const consultResolvedTarget = useCallback(
    async (nextTarget: { kind: "userid" | "roleid"; value: string }) => {
      const v = Number(nextTarget.value);
      if (!v) {
        toast.error(`Informe ${nextTarget.kind} valido`);
        return;
      }
      setLoading(true);
      setMissing(false);
      setLastResult(null);
      try {
        const res = await pwApi.getGmPermissionState({ [nextTarget.kind]: v });
        applyPermissionState(res);
      } catch (e) {
        if (e instanceof EndpointMissingError) setMissing(true);
        else toast.error(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    },
    [applyPermissionState, toast],
  );

  const pickResolvedTarget = useCallback(
    (
      profile: PlayerTargetProfile,
      preferredKind: "name" | "userid" | "roleid",
    ): { kind: "userid" | "roleid"; value: string } => {
      if (preferredKind === "roleid") {
        return { kind: "roleid", value: String(profile.roleid) };
      }
      if (preferredKind === "userid" && profile.userid != null && profile.userid > 0) {
        return { kind: "userid", value: String(profile.userid) };
      }
      if (profile.userid != null && profile.userid > 0) {
        return { kind: "userid", value: String(profile.userid) };
      }
      return { kind: "roleid", value: String(profile.roleid) };
    },
    [],
  );

  const useResolvedTarget = useCallback(
    async (kind: "userid" | "roleid") => {
      if (!resolvedProfile) return;
      if (kind === "userid" && (resolvedProfile.userid == null || resolvedProfile.userid <= 0)) {
        toast.error("Esse alvo nao expoe userid no perfil resolvido");
        return;
      }
      const nextTarget =
        kind === "userid"
          ? { kind: "userid" as const, value: String(resolvedProfile.userid) }
          : { kind: "roleid" as const, value: String(resolvedProfile.roleid) };
      setTarget(nextTarget);
      await consultResolvedTarget(nextTarget);
    },
    [consultResolvedTarget, resolvedProfile, toast],
  );

  const resolveTarget = useCallback(async () => {
    const raw = lookup.value.trim();
    if (!raw) {
      toast.error(
        lookup.kind === "name"
          ? "Informe o nick do personagem"
          : `Informe ${lookup.kind} valido`,
      );
      return;
    }

    const query: { roleid?: number; userid?: number; name?: string } = {};
    if (lookup.kind === "name") {
      query.name = raw;
    } else {
      const numericValue = Number(raw);
      if (!numericValue) {
        toast.error(`Informe ${lookup.kind} valido`);
        return;
      }
      query[lookup.kind] = numericValue;
    }

    setResolving(true);
    setMissing(false);
    setLastResult(null);
    try {
      const res = await pwApi.getPlayerTargetProfile(query);
      const profile = res.profile;
      setResolvedProfile(profile);
      const nextTarget = pickResolvedTarget(profile, lookup.kind);
      setTarget(nextTarget);
      await consultResolvedTarget(nextTarget);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setResolving(false);
    }
  }, [consultResolvedTarget, lookup, pickResolvedTarget, toast]);

  const buildPayload = () => {
    const v = Number(target.value);
    const z = Number(zoneid);
    const payload: {
      reason: string;
      kick_online: boolean;
      userid?: number;
      roleid?: number;
      zoneid?: number;
    } = {
      reason,
      kick_online: kickOnline,
      [target.kind]: v,
    };
    if (resolvedProfile?.userid != null && resolvedProfile.userid > 0) {
      payload.userid = resolvedProfile.userid;
    }
    if (resolvedProfile?.roleid != null && resolvedProfile.roleid > 0) {
      payload.roleid = resolvedProfile.roleid;
    }
    if (Number.isFinite(z) && z > 0) {
      payload.zoneid = z;
    }
    return payload;
  };

  const runGmAction = async (type: "grant" | "revoke") => {
    const v = Number(target.value);
    if (!v) {
      toast.error(`Informe ${target.kind} valido`);
      return;
    }
    if (!reason.trim()) {
      toast.error("Motivo obrigatorio");
      return;
    }

    setBusy(true);
    try {
      const fn = type === "grant" ? pwApi.grantGmPermission : pwApi.revokeGmPermission;
      const res = await fn(buildPayload());
      setLastResult(res);
      if (res.success) {
        const afterCount =
          res.permission_summary_after?.after_rule_count ??
          res.permission_summary_after?.current_rule_count ??
          0;
        if (type === "grant" && afterCount <= 0) {
          toast.error("addGM nao gravou permissoes na auth. Verifique MySQL e procedure addGM na VPS.");
          return;
        }
        toast.success(
          res.message ||
            (type === "grant"
              ? `Permissao GM aplicada via addGM (zoneid ${zoneid})`
              : "Permissao GM removida via auth (PW 1.7.8)"),
        );
        void logAuditEvent({
          action: `gm.${type}GmPermission`,
          tenantId: active?.id ?? null,
          target: `${target.kind}:${v}`,
          status: "ok",
          metadata: {
            zoneid: Number(zoneid) || 1,
            method: type === "grant" ? "addGM" : "delete_auth",
            message: res.message,
            after_rule_count: afterCount,
            kick_online: kickOnline,
          },
        });
        await loadState();
        onActed();
      } else {
        toast.error(res.error ?? "Falhou");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  if (!supportedRead && !supportedGrant && !supportedRevoke) {
    return <EndpointMissingNotice action="getGmPermissionState" />;
  }
  if (missing) return <EndpointMissingNotice action="getGmPermissionState" />;

  const permCardId = "gm-permissions";
  const permHidden = !isCardVisible(permCardId, cardVisibility);
  if (!isSA && permHidden) {
    return <p className="text-xs text-muted-foreground">Nenhum card disponivel nesta secao.</p>;
  }

  return (
    <div className={cn("space-y-4", permHidden && isSA && "opacity-50")}>
      {isSA && onToggleVisibility && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => onToggleVisibility(permCardId)}
            className={cn(
              "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11px] font-medium transition-all",
              permHidden
                ? "border-destructive/50 bg-destructive/10 text-destructive hover:bg-destructive/20"
                : "border-emerald-500/50 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20",
            )}
          >
            {permHidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            {permHidden ? "Oculto para usuarios" : "Visivel para usuarios"}
          </button>
        </div>
      )}

      <Card className="bg-card/40">
        <CardHeader className="pb-3">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-500/10 text-purple-400">
              <Shield className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-sm font-extrabold uppercase tracking-wider">
                  Permissoes GM (PW 1.7.8)
                </CardTitle>
                <CapBadge action="getGmPermissionState" caps={caps} />
              </div>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Mesmo metodo do admin_testserver: <code>addGM</code> para aplicar e{" "}
                <code>DELETE auth</code> para remover.
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-[140px_1fr_auto]">
            <Select
              value={lookup.kind}
              onValueChange={(v) =>
                setLookup((current) => ({ ...current, kind: v as "name" | "userid" | "roleid" }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name">nick</SelectItem>
                <SelectItem value="userid">userid</SelectItem>
                <SelectItem value="roleid">roleid</SelectItem>
              </SelectContent>
            </Select>
            <Input
              value={lookup.value}
              onChange={(e) => setLookup((current) => ({ ...current, value: e.target.value }))}
              placeholder={
                lookup.kind === "name"
                  ? "Nome do personagem"
                  : lookup.kind === "userid"
                    ? "128"
                    : "1184"
              }
            />
            <Button onClick={() => void resolveTarget()} disabled={resolving}>
              {resolving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Crosshair className="h-3.5 w-3.5" />
              )}
              Resolver alvo
            </Button>
          </div>

          {resolvedProfile && (
            <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 px-3 py-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-purple-400">
                    Alvo resolvido
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-foreground">
                    <span>{resolvedProfile.name || `roleid ${resolvedProfile.roleid}`}</span>
                    {resolvedProfile.online ? (
                      <Badge variant="outline" className="border-emerald-500/40 text-emerald-400">
                        online
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">
                        offline
                      </Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                    <span>
                      roleid: <code>{resolvedProfile.roleid}</code>
                    </span>
                    {resolvedProfile.userid != null && resolvedProfile.userid > 0 && (
                      <span>
                        userid: <code>{resolvedProfile.userid}</code>
                      </span>
                    )}
                    {resolvedProfile.class_name && <span>classe: {resolvedProfile.class_name}</span>}
                    {resolvedProfile.level != null && <span>lvl {resolvedProfile.level}</span>}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {resolvedProfile.userid != null && resolvedProfile.userid > 0 && (
                    <Button
                      size="sm"
                      variant={
                        target.kind === "userid" && target.value === String(resolvedProfile.userid)
                          ? "default"
                          : "outline"
                      }
                      onClick={() => void useResolvedTarget("userid")}
                    >
                      Usar userid
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant={
                      target.kind === "roleid" && target.value === String(resolvedProfile.roleid)
                        ? "default"
                        : "outline"
                    }
                    onClick={() => void useResolvedTarget("roleid")}
                  >
                    Usar roleid
                  </Button>
                </div>
              </div>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-[140px_1fr_auto]">
            <Select
              value={target.kind}
              onValueChange={(v) => setTarget((t) => ({ ...t, kind: v as "userid" | "roleid" }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="userid">userid</SelectItem>
                <SelectItem value="roleid">roleid</SelectItem>
              </SelectContent>
            </Select>
            <Input
              value={target.value}
              onChange={(e) => setTarget((t) => ({ ...t, value: e.target.value }))}
              placeholder={target.kind === "userid" ? "128" : "1184"}
            />
            <Button onClick={() => void loadState()} disabled={loading || !supportedRead}>
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              Consultar
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <FieldRow label="Zone ID (addGM)">
              <Input
                type="number"
                min={1}
                value={zoneid}
                onChange={(e) => setZoneid(e.target.value)}
                placeholder="1"
              />
            </FieldRow>
            <FieldRow label="Motivo (auditoria)">
              <Input value={reason} onChange={(e) => setReason(e.target.value)} />
            </FieldRow>
          </div>
          <p className="text-[11px] text-muted-foreground">
            PW 1.7.8: <code>addGM(userid, zoneid)</code> — zoneid vem do gamesys.conf (
            gdeliveryd ou gamedbd). Valor atual sugerido: <strong>{zoneid}</strong>.
          </p>
          {gamesysNote && (
            <p className="text-[11px] text-amber-400">{gamesysNote}</p>
          )}

          <div className="flex items-center justify-between gap-4 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2.5">
            <div>
              <div className="text-xs font-semibold text-amber-200">Kick + relog apos aplicar GM</div>
              <div className="text-[11px] text-muted-foreground">
                GM so aparece no jogo depois de relogar. Recomendado manter ligado.
              </div>
            </div>
            <Switch checked={kickOnline} onCheckedChange={setKickOnline} />
          </div>
          <p className="text-[11px] text-muted-foreground">
            &quot;Coroa&quot; no chat do jogo e patente/VIP — nao indica GM. GM vem da tabela auth (addGM) e
            so ativa apos relogar.
          </p>
        </CardContent>
      </Card>

      {state && (
        <div className="grid gap-2 sm:grid-cols-2">
          <SummaryStat
            label="Permissoes na auth"
            value={currentRuleCount}
            tone={hasGm ? "success" : "default"}
          />
          <SummaryStat
            label="Status GM"
            value={hasGm ? "COM GM" : "SEM GM"}
            tone={hasGm ? "success" : "warning"}
          />
        </div>
      )}

      <Card className="border-purple-500/30 bg-card/40">
        <CardHeader className="pb-3">
          <CardTitle className="text-xs font-extrabold uppercase tracking-widest text-purple-400">
            Aplicar / remover GM
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button
            onClick={() => void runGmAction("grant")}
            disabled={busy || !supportedGrant || !target.value}
            className="gap-1.5"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
            Aplicar GM (addGM)
          </Button>
          <Button
            variant="destructive"
            onClick={() => void runGmAction("revoke")}
            disabled={busy || !supportedRevoke || !target.value}
            className="gap-1.5"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldOff className="h-3.5 w-3.5" />}
            Remover GM (auth)
          </Button>
        </CardContent>
      </Card>

      {lastResult && (
        <Card className="border-success/40 bg-success/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-extrabold uppercase tracking-widest text-success">
              Ultimo resultado
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-[11px]">
            <p className="font-medium text-foreground">{lastResult.message}</p>
            <div className="grid gap-1.5 sm:grid-cols-2">
              <Row
                label="permissoes antes"
                value={lastResult.permission_summary_before?.current_rule_count ?? "—"}
              />
              <Row
                label="permissoes depois"
                value={lastResult.permission_summary_after?.current_rule_count ?? "—"}
              />
              <Row label="metodo" value={lastResult.permission_change?.gm_method ?? "addGM"} />
              <Row
                label="zoneid"
                value={String(lastResult.permission_change?.gm_zoneid ?? zoneid)}
              />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function MeridianTitlesTab({
  caps,
  onActed,
}: {
  caps: Map<string, GmCommandCapability>;
  onActed: () => void;
}) {
  const toast = useFeedback();
  const { active } = useServers();
  const [lookup, setLookup] = useState("");
  const [roleid, setRoleid] = useState("");
  const [presets, setPresets] = useState<MeridianTitlePreset[]>([]);
  const [presetKey, setPresetKey] = useState("");
  const [kickOnline, setKickOnline] = useState(true);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<MeridianTitlePreviewResponse | null>(null);
  const [applyResult, setApplyResult] = useState<MeridianTitleApplyResponse | null>(null);
  const [missing, setMissing] = useState(false);

  const selectedPreset = presets.find((p) => p.key === presetKey);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await pwApi.getMeridianTitlePresetCatalog();
        if (cancelled) return;
        const list = res.presets ?? [];
        setPresets(list);
        const preferred =
          list.find((p) => p.key === "full_meridian_titles") ??
          list.find((p) => (p.applies ?? []).includes("meridian") && (p.applies ?? []).includes("titles")) ??
          list[0];
        if (preferred) setPresetKey(preferred.key);
      } catch (e) {
        if (e instanceof EndpointMissingError) setMissing(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const resolveRole = async () => {
    const raw = lookup.trim();
    if (!raw) {
      toast.error("Informe o nick ou roleid");
      return;
    }
    setLoading(true);
    try {
      const query = /^\d+$/.test(raw) ? { roleid: Number(raw) } : { name: raw };
      const res = await pwApi.getPlayerTargetProfile(query);
      const rid = res.profile?.roleid;
      if (!rid) {
        toast.error(
          (res.profile as { resolution_note?: string } | undefined)?.resolution_note ??
            "Personagem sem roleid",
        );
        return;
      }
      setRoleid(String(rid));
      toast.success(`Alvo: ${res.profile?.name || rid}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const buildBody = (dryRun: boolean) => ({
    preset_key: presetKey,
    roleid: Number(roleid),
    kick_online: kickOnline,
    ...(dryRun ? { dry_run: true } : {}),
  });

  const runPreview = async () => {
    const r = Number(roleid);
    if (!r || !presetKey) {
      toast.error("Resolva o alvo e escolha um preset");
      return;
    }
    setBusy(true);
    try {
      const res = await pwApi.previewMeridianTitlePreset(buildBody(true));
      setPreview(res);
      if (res.would_change) toast.info("Preview: havera alteracao");
      else toast.info("Preview: nada a alterar");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const runApply = async () => {
    const r = Number(roleid);
    if (!r || !presetKey) {
      toast.error("Resolva o alvo e escolha um preset");
      return;
    }
    setBusy(true);
    setApplyResult(null);
    try {
      const res = await pwApi.applyMeridianTitlePreset(buildBody(false));
      setApplyResult(res);
      if (res.success) {
        const after = res.after as { has_full_meridian?: boolean; has_full_titles?: boolean } | undefined;
        const mer = after?.has_full_meridian ? "meridiano full" : "meridiano parcial";
        const tit = after?.has_full_titles ? "titulos full" : "titulos parcial";
        toast.success(
          res.message ||
            (res.changed === false
              ? "Preset ja estava aplicado."
              : `Aplicado (${mer}, ${tit}). Relogue para ver no cliente.`),
        );
        void logAuditEvent({
          action: "gm.applyMeridianTitlePreset",
          tenantId: active?.id ?? null,
          target: String(r),
          status: "ok",
          metadata: { preset_key: presetKey, changed: res.changed ?? true },
        });
        onActed();
      } else {
        toast.error(res.error ?? "Falhou");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  if (missing) return <EndpointMissingNotice action="getMeridianTitlePresetCatalog" />;

  return (
    <Card className="bg-card/40">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-wider">
          <BookOpen className="h-4 w-4 text-primary" />
          Meridiano e Titulos (PW 1.7.8)
        </CardTitle>
        <p className="text-[11px] text-muted-foreground">
          Presets legados de meridiano/titulos. Escolha &quot;Full Meridiano + Titulos&quot; para aplicar
          ambos. Personagem online precisa de kick + relog.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <Input
            value={lookup}
            onChange={(e) => setLookup(e.target.value)}
            placeholder="Nick ou roleid"
          />
          <Button onClick={() => void resolveRole()} disabled={loading}>
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Crosshair className="h-3.5 w-3.5" />}
            Resolver
          </Button>
        </div>
        <FieldRow label="Roleid alvo">
          <Input value={roleid} onChange={(e) => setRoleid(e.target.value)} placeholder="1024" />
        </FieldRow>
        <FieldRow label="Preset">
          <Select value={presetKey} onValueChange={setPresetKey}>
            <SelectTrigger>
              <SelectValue placeholder="Escolha o preset" />
            </SelectTrigger>
            <SelectContent>
              {presets.map((p) => (
                <SelectItem key={p.key} value={p.key}>
                  {p.label}
                  {(p.applies ?? []).length > 0
                    ? ` (${(p.applies ?? []).join(" + ")})`
                    : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FieldRow>
        {selectedPreset?.summary && (
          <p className="text-[10px] text-muted-foreground">{selectedPreset.summary}</p>
        )}
        <div className="flex items-center justify-between gap-4 rounded-md border border-border/60 px-3 py-2">
          <span className="text-xs text-muted-foreground">Kick se online (recomendado)</span>
          <Switch checked={kickOnline} onCheckedChange={setKickOnline} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void runPreview()} disabled={busy || !Number(roleid)}>
            Preview
          </Button>
          <Button
            onClick={() => void runApply()}
            disabled={busy || !Number(roleid) || !presetKey || !isSupported("applyMeridianTitlePreset", caps)}
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            Aplicar preset
          </Button>
        </div>
        {!isSupported("applyMeridianTitlePreset", caps) && (
          <p className="text-[10px] text-amber-500">
            Aplicar desabilitado: action ausente no catalogo GM desta VPS.
          </p>
        )}
        {preview && (
          <div className="rounded-md border border-border/60 bg-muted/20 p-3 text-[11px] space-y-1">
            <Row label="altera" value={preview.would_change ? "sim" : "nao"} />
            <Row label="meridiano atual" value={preview.current?.has_full_meridian ? "full" : "parcial/sem"} />
            <Row label="titulos atual" value={preview.current?.has_full_titles ? "full" : "parcial/sem"} />
            <Row label="meridiano depois" value={preview.after?.has_full_meridian ? "full" : "parcial/sem"} />
            <Row label="titulos depois" value={preview.after?.has_full_titles ? "full" : "parcial/sem"} />
            {(preview.warnings ?? []).map((w) => (
              <p key={w} className="text-amber-400">
                ⚠{" "}
                {kickOnline &&
                /online/i.test(w) &&
                /kick_online/i.test(w)
                  ? "Personagem online — kick automatico sera aplicado antes do preset."
                  : w}
              </p>
            ))}
          </div>
        )}
        {applyResult?.success && (
          <div className="rounded-md border border-success/40 bg-success/5 p-3 text-[11px] space-y-1">
            <Row
              label="resultado"
              value={
                applyResult.changed === false
                  ? "ja estava aplicado"
                  : "salvo no gamedbd"
              }
            />
            <Row
              label="meridiano"
              value={
                (applyResult.after as { has_full_meridian?: boolean } | undefined)?.has_full_meridian
                  ? "full"
                  : "parcial/sem"
              }
            />
            <Row
              label="titulos"
              value={
                (applyResult.after as { has_full_titles?: boolean } | undefined)?.has_full_titles
                  ? "full"
                  : "parcial/sem"
              }
            />
            <p className="text-success">
              Saia do jogo e entre de novo para ver meridiano/titulos no cliente.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SummaryStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone: "default" | "success" | "warning";
}) {
  const ring =
    tone === "success"
      ? "border-success/40 bg-success/5 text-success"
      : tone === "warning"
        ? "border-amber-500/40 bg-amber-500/5 text-amber-500"
        : "border-border bg-card/40 text-foreground";
  return (
    <div className={cn("rounded-lg border px-3 py-2", ring)}>
      <div className="text-[9px] font-bold uppercase tracking-widest opacity-70">
        {label}
      </div>
      <div className="mt-0.5 font-mono text-base font-extrabold">{value}</div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Histórico                                                                   */
/* -------------------------------------------------------------------------- */

function HistoryTab({ tick }: { tick: number }) {
  const [entries, setEntries] = useState<GmActionHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setMissing(false);
    try {
      const res = await pwApi.getGmActionHistory({ limit: 20 });
      setEntries(res.entries ?? []);
    } catch (e) {
      if (e instanceof EndpointMissingError) setMissing(true);
      else setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, tick]);

  if (missing) return <EndpointMissingNotice action="getGmActionHistory" />;

  return (
    <Card className="bg-card/40">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-wider">
          <HistoryIcon className="h-4 w-4 text-primary" />
          Últimas 20 ações GM
        </CardTitle>
        <Button size="sm" variant="outline" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          Atualizar
        </Button>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="mb-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </div>
        )}
        {loading && entries.length === 0 ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-9 rounded-md" />
            ))}
          </div>
        ) : entries.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground">
            Nenhuma ação registrada ainda.
          </p>
        ) : (
          <ScrollArea className="h-[480px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[140px]">Quando</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Alvo</TableHead>
                  <TableHead className="w-[90px]">Status</TableHead>
                  <TableHead className="w-[70px]">Dry</TableHead>
                  <TableHead>Mensagem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((e, i) => (
                  <TableRow key={e.id ?? i}>
                    <TableCell className="font-mono text-[11px]">
                      {fmtDate(e.ts)}
                    </TableCell>
                    <TableCell className="font-mono text-[11px] font-semibold">
                      {e.action}
                    </TableCell>
                    <TableCell className="font-mono text-[11px]">
                      {(() => {
                        const toStr = (v: any): string => {
                          if (v == null) return "";
                          if (typeof v === "object")
                            return String(
                              v.roleid ?? v.userid ?? v.role_name ?? v.account ?? JSON.stringify(v),
                            );
                          return String(v);
                        };
                        return toStr(e.target) || toStr(e.roleid) || toStr(e.account) || "—";
                      })()}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={e.status} />
                    </TableCell>
                    <TableCell>
                      {e.dry_run ? (
                        <Badge variant="outline" className="text-[9px]">
                          dry
                        </Badge>
                      ) : null}
                    </TableCell>
                    <TableCell className="max-w-[280px] truncate text-[11px] text-muted-foreground">
                      {(() => {
                        const v = e.error ?? e.message;
                        if (v == null) return "—";
                        return typeof v === "object" ? JSON.stringify(v) : String(v);
                      })()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* Util                                                                        */
/* -------------------------------------------------------------------------- */

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      <span className="font-mono text-xs font-semibold">{value}</span>
    </div>
  );
}

/** Extracts the flat ForbidDelivery from gm_action.delivery (ban has it flat, unban nests under .account) */
function extractDelivery(gm: GmActionBlock | undefined): ForbidDelivery | undefined {
  if (!gm?.delivery) return undefined;
  const d = gm.delivery as Record<string, unknown>;
  if ("account" in d && typeof d.account === "object" && d.account !== null) {
    return d.account as ForbidDelivery;
  }
  return gm.delivery as ForbidDelivery;
}

/** Renders backend label + delivery type_ids for ban/unban results */
function DeliveryDetails({
  gm,
  variant,
}: {
  gm?: GmActionBlock;
  variant: "ban" | "unban";
}) {
  if (!gm) return null;
  const backend = gm.account_forbid_backend;
  const delivery = extractDelivery(gm);
  const backendLabel =
    backend === "forbid_table"
      ? "tabela forbid"
      : backend === "gamedbd"
        ? "gamedbd"
        : backend ?? "—";

  return (
    <div className="space-y-1">
      {gm.message && <Row label="mensagem" value={gm.message} />}
      <Row
        label="backend"
        value={
          <span className="inline-flex items-center gap-1.5 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium">
            {backendLabel}
          </span>
        }
      />
      {delivery && (
        <>
          <Row label="before_type_ids" value={delivery.before_type_ids?.join(", ") ?? "—"} />
          <Row label="applied_type_ids" value={delivery.applied_type_ids?.join(", ") ?? "—"} />
          <Row label="after_type_ids" value={delivery.after_type_ids?.join(", ") ?? "—"} />
          {variant === "ban" && delivery.inserted_type_ids !== undefined && (
            <Row label="inserted_type_ids" value={delivery.inserted_type_ids?.join(", ") ?? "—"} />
          )}
          {variant === "unban" && delivery.deleted_type_ids !== undefined && (
            <Row label="deleted_type_ids" value={delivery.deleted_type_ids?.join(", ") ?? "—"} />
          )}
        </>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "ok") {
    return (
      <Badge variant="outline" className="border-success/50 text-success">
        ok
      </Badge>
    );
  }
  if (status === "error") {
    return (
      <Badge variant="outline" className="border-destructive/50 text-destructive">
        error
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="border-amber-500/50 text-amber-500">
      {status}
    </Badge>
  );
}

function fmtDate(ts: number | string): string {
  if (!ts) return "—";
  const date = typeof ts === "number" ? new Date(ts * (ts < 1e12 ? 1000 : 1)) : new Date(ts);
  if (Number.isNaN(date.getTime())) return String(ts);
  return date.toLocaleString();
}
