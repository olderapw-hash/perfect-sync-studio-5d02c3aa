// GM Commander v3 — Punições rápidas
//
// Consome 100% da API real (api_cls.php):
//   GET  ?action=getQuickPunishmentCatalog
//   POST ?action=previewQuickPunishment
//   POST ?action=executeQuickPunishment
//
// Contrato real do catálogo:
//   preset.key, preset.status, preset.duration_required, preset.required_role
//
// Resposta real (preview/execute):
//   { preset: { key, label }, plan: { underlying_action, target_scope,
//     target, duration_seconds, warnings }, result: { ... } }
//
// Gating: além do canAction(), respeitamos preset.required_role contra
// o role real do operador retornado pela VPS.
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Ban, Hammer, Loader2, Lock, RefreshCw, ShieldAlert, VolumeX } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { EndpointMissingNotice } from "@/components/admin/EndpointMissingNotice";
import { roleMeetsRequirement, useOperatorPermissions } from "@/hooks/useOperatorPermissions";
import { cn } from "@/lib/utils";
import {
  EndpointMissingError,
  pwApi,
  type QuickPunishmentCatalogResponse,
  type QuickPunishmentPreset,
  type QuickPunishmentRequest,
  type QuickPunishmentResponse,
} from "@/lib/pwApiActions";

const PRESET_ICON: Record<string, typeof Hammer> = {
  kick_role: Hammer,
  mute_account_temporary: VolumeX,
  mute_role_temporary: VolumeX,
  ban_account_temporary: Ban,
  ban_account_permanent: Ban,
  jail: ShieldAlert,
};

/** Chave canônica do preset (compat com VPS antigas que ainda mandam `id`). */
function presetKey(p: QuickPunishmentPreset): string {
  return (p.key ?? p.id ?? "") as string;
}

/** Status oficial (compat com `state` legado). */
function presetStatus(p: QuickPunishmentPreset): string | undefined {
  return p.status ?? p.state;
}

/** Indica se o backend marca este preset como suportado. */
function isSupported(p: QuickPunishmentPreset): boolean {
  const st = presetStatus(p);
  if (!st) return presetKey(p) !== "jail";
  return st === "supported";
}

/** Duração obrigatória? Compat com `supports_duration` legado. */
function durationRequired(p: QuickPunishmentPreset): boolean {
  return Boolean(p.duration_required ?? p.supports_duration);
}

export function QuickPunishmentTab() {
  const { canAction, role: operatorRole, loading: permLoading } = useOperatorPermissions();
  const [catalog, setCatalog] = useState<QuickPunishmentCatalogResponse | null>(null);
  const [catalogMissing, setCatalogMissing] = useState(false);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  const [presetKeyState, setPresetKeyState] = useState<string | null>(null);
  const [roleid, setRoleid] = useState("");
  const [reason, setReason] = useState("");
  const [duration, setDuration] = useState("");
  const [kickOnline, setKickOnline] = useState(false);

  const [previewBusy, setPreviewBusy] = useState(false);
  const [executeBusy, setExecuteBusy] = useState(false);
  const [result, setResult] = useState<QuickPunishmentResponse | null>(null);
  const [resultKind, setResultKind] = useState<"preview" | "execute" | null>(null);
  const [resultError, setResultError] = useState<string | null>(null);

  const loadCatalog = useCallback(async () => {
    setCatalogLoading(true);
    setCatalogMissing(false);
    setCatalogError(null);
    try {
      const res = await pwApi.getQuickPunishmentCatalog();
      setCatalog(res);
    } catch (e) {
      if (e instanceof EndpointMissingError) {
        setCatalogMissing(true);
        setCatalog(null);
      } else {
        setCatalogError(e instanceof Error ? e.message : String(e));
      }
    } finally {
      setCatalogLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  const presets = useMemo(() => catalog?.presets ?? [], [catalog]);
  /** Presets explicitamente marcados como não suportados pelo backend
   *  (ex.: jail). Renderizamos visivelmente bloqueados. */
  const unsupportedPresets = useMemo(
    () => catalog?.unsupported_presets ?? [],
    [catalog],
  );
  const selected = useMemo(
    () => presets.find((p) => presetKey(p) === presetKeyState) ?? null,
    [presets, presetKeyState],
  );

  /** O operador real atende ao required_role do preset selecionado? */
  const operatorMeetsRole = useMemo(() => {
    if (!selected) return true;
    return roleMeetsRequirement(operatorRole, selected.required_role);
  }, [selected, operatorRole]);

  const canPreview = canAction("previewQuickPunishment") && operatorMeetsRole;
  const canExecute = canAction("executeQuickPunishment") && operatorMeetsRole;

  const buildPayload = (dryRun: boolean): QuickPunishmentRequest | null => {
    if (!selected) return null;
    if (!roleid.trim() || !reason.trim()) return null;
    const payload: QuickPunishmentRequest = {
      preset: presetKey(selected),
      roleid: roleid.trim(),
      reason: reason.trim(),
    };
    if (durationRequired(selected) && duration.trim()) {
      const n = Number(duration.trim());
      if (Number.isFinite(n) && n > 0) payload.duration_seconds = n;
    }
    if (selected.supports_kick_online && kickOnline) payload.kick_online = true;
    if (dryRun) payload.dry_run = true;
    return payload;
  };

  const runPreview = async () => {
    const payload = buildPayload(true);
    if (!payload) return;
    setPreviewBusy(true);
    setResultError(null);
    setResult(null);
    setResultKind("preview");
    try {
      const res = await pwApi.previewQuickPunishment(payload);
      setResult(res);
    } catch (e) {
      setResultError(e instanceof Error ? e.message : String(e));
    } finally {
      setPreviewBusy(false);
    }
  };

  const runExecute = async () => {
    const payload = buildPayload(false);
    if (!payload) return;
    setExecuteBusy(true);
    setResultError(null);
    setResult(null);
    setResultKind("execute");
    try {
      const res = await pwApi.executeQuickPunishment(payload);
      setResult(res);
    } catch (e) {
      setResultError(e instanceof Error ? e.message : String(e));
    } finally {
      setExecuteBusy(false);
    }
  };

  if (catalogMissing) {
    return <EndpointMissingNotice action="getQuickPunishmentCatalog" />;
  }

  return (
    <div className="space-y-4">
      <Card className="border-border/50 bg-card/40 backdrop-blur-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-base font-bold">Catálogo da VPS</CardTitle>
            <p className="text-xs text-muted-foreground">
              Presets retornados em tempo real por <code>getQuickPunishmentCatalog</code>.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void loadCatalog()}
            disabled={catalogLoading}
          >
            <RefreshCw className={cn("h-3.5 w-3.5", catalogLoading && "animate-spin")} />
            Recarregar
          </Button>
        </CardHeader>
        <CardContent>
          {catalogError && (
            <div className="mb-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
              {catalogError}
            </div>
          )}
          {catalogLoading && presets.length === 0 ? (
            <div className="grid gap-2 sm:grid-cols-2">
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
            </div>
          ) : presets.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Catálogo vazio — nenhum preset retornado pela VPS.
            </p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {presets.map((p) => {
                const k = presetKey(p);
                const Icon = PRESET_ICON[k] ?? Hammer;
                const supported = isSupported(p);
                const meetsRole = roleMeetsRequirement(operatorRole, p.required_role);
                const usable = supported && meetsRole;
                const active = presetKeyState === k;
                const status = presetStatus(p);
                return (
                  <button
                    key={k}
                    type="button"
                    disabled={!usable}
                    onClick={() => usable && setPresetKeyState(k)}
                    className={cn(
                      "rounded-xl border p-3 text-left transition-all",
                      usable
                        ? active
                          ? "border-primary bg-primary/10 shadow-[0_0_18px_-6px_hsl(var(--primary)/0.4)]"
                          : "border-border/50 bg-card/50 hover:border-primary/40 hover:bg-primary/5"
                        : "cursor-not-allowed border-border/30 bg-muted/20 opacity-60",
                    )}
                    title={
                      !supported
                        ? `Não suportado (${status ?? "n/a"})`
                        : !meetsRole
                          ? `Requer role ${p.required_role}`
                          : undefined
                    }
                  >
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-primary" />
                      <span className="text-sm font-bold text-foreground">{p.label}</span>
                      {!supported && (
                        <Badge variant="outline" className="ml-auto border-amber-500/40 text-[9px] uppercase text-amber-400">
                          {status ?? "não suportado"}
                        </Badge>
                      )}
                      {supported && !meetsRole && (
                        <Badge variant="outline" className="ml-auto border-destructive/40 text-[9px] uppercase text-destructive">
                          <Lock className="mr-0.5 h-2.5 w-2.5" />
                          {p.required_role}
                        </Badge>
                      )}
                    </div>
                    {p.summary && (
                      <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">
                        {p.summary}
                      </p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-1 text-[9px] uppercase tracking-wider text-muted-foreground">
                      {p.underlying_action && <Badge variant="secondary">{p.underlying_action}</Badge>}
                      {p.target_scope && <Badge variant="outline">{p.target_scope}</Badge>}
                      {p.required_role && (
                        <Badge variant="outline" className="border-primary/30 text-primary">
                          {p.required_role}
                        </Badge>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
          {unsupportedPresets.length > 0 && (
            <div className="mt-4">
              <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                <Lock className="h-3 w-3" />
                Presets não suportados pelo backend
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {unsupportedPresets.map((p) => {
                  const k = presetKey(p);
                  const Icon = PRESET_ICON[k] ?? Hammer;
                  const status = presetStatus(p) ?? "unsupported";
                  return (
                    <div
                      key={k}
                      className="cursor-not-allowed rounded-xl border border-border/30 bg-muted/10 p-3 opacity-60"
                      title={`Não suportado (${status})`}
                    >
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-bold text-muted-foreground line-through">
                          {p.label ?? k}
                        </span>
                        <Badge
                          variant="outline"
                          className="ml-auto border-amber-500/40 text-[9px] uppercase text-amber-400"
                        >
                          {status}
                        </Badge>
                      </div>
                      {p.summary && (
                        <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">
                          {p.summary}
                        </p>
                      )}
                      <div className="mt-2 flex flex-wrap gap-1 text-[9px] uppercase tracking-wider text-muted-foreground">
                        {p.underlying_action && <Badge variant="secondary">{p.underlying_action}</Badge>}
                        {p.required_role && (
                          <Badge variant="outline" className="border-primary/30 text-primary">
                            {p.required_role}
                          </Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {selected && (
        <Card className="border-border/50 bg-card/40 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold">{selected.label}</CardTitle>
            {selected.description && (
              <p className="text-xs text-muted-foreground">{selected.description}</p>
            )}
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label className="text-xs">Roleid alvo</Label>
                <Input
                  value={roleid}
                  onChange={(e) => setRoleid(e.target.value)}
                  placeholder="ex: 1024"
                  inputMode="numeric"
                />
              </div>
              {durationRequired(selected) && (
                <div>
                  <Label className="text-xs">Duração (segundos)</Label>
                  <Input
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    placeholder={
                      selected.default_duration_seconds
                        ? String(selected.default_duration_seconds)
                        : "ex: 3600"
                    }
                    inputMode="numeric"
                  />
                  {selected.duration_presets_seconds && selected.duration_presets_seconds.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {selected.duration_presets_seconds.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setDuration(String(s))}
                          className="rounded border border-border/40 bg-card/60 px-1.5 py-0.5 text-[10px] hover:border-primary/40"
                        >
                          {s}s
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div>
              <Label className="text-xs">Motivo</Label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Motivo registrado na auditoria do servidor"
                rows={2}
              />
            </div>
            {selected.supports_kick_online && (
              <div className="flex items-center gap-2 rounded-lg border border-border/40 bg-card/40 p-2">
                <Switch checked={kickOnline} onCheckedChange={setKickOnline} />
                <Label className="text-xs">Kickar se o personagem estiver online</Label>
              </div>
            )}
            {selected.warnings && selected.warnings.length > 0 && (
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-2 text-[11px] text-amber-400">
                {selected.warnings.map((w, i) => (
                  <div key={i} className="flex items-start gap-1.5">
                    <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                    <span>{w}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => void runPreview()}
                disabled={
                  permLoading ||
                  !canPreview ||
                  previewBusy ||
                  executeBusy ||
                  !roleid.trim() ||
                  !reason.trim()
                }
              >
                {previewBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                Simular (dry_run)
              </Button>
              <Button
                onClick={() => void runExecute()}
                disabled={
                  permLoading ||
                  !canExecute ||
                  previewBusy ||
                  executeBusy ||
                  !roleid.trim() ||
                  !reason.trim()
                }
              >
                {executeBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                Executar agora
              </Button>
              {!operatorMeetsRole && !permLoading && (
                <span className="text-[11px] text-destructive">
                  Operador não atende ao required_role: <code>{selected.required_role}</code>.
                </span>
              )}
              {operatorMeetsRole && !canExecute && !permLoading && (
                <span className="text-[11px] text-amber-400">
                  Operador sem permissão real para executar (canAction=false).
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {(result || resultError) && (
        <Card
          className={cn(
            "border-border/50 bg-card/40 backdrop-blur-sm",
            resultError && "border-destructive/40 bg-destructive/5",
          )}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold">
              {resultError
                ? "Erro retornado pela VPS"
                : resultKind === "preview"
                  ? "Pré-visualização"
                  : "Execução"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            {resultError && <div className="text-destructive">{resultError}</div>}
            {result && <PunishmentResultView result={result} />}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function PunishmentResultView({ result }: { result: QuickPunishmentResponse }) {
  const plan = result.plan ?? {};
  const presetKeyOut = result.preset?.key;
  const presetLabel = result.preset?.label;
  return (
    <div className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-2">
        <Field label="preset.key" value={presetKeyOut} />
        <Field label="preset.label" value={presetLabel} />
        <Field label="plan.underlying_action" value={plan.underlying_action} />
        <Field label="plan.target_scope" value={plan.target_scope} />
        <Field label="plan.duration_seconds" value={plan.duration_seconds} />
        <Field label="dry_run" value={String(result.dry_run ?? false)} />
        <Field label="success" value={String(result.success)} />
      </div>
      {plan.target && Object.keys(plan.target).length > 0 && (
        <div className="rounded-lg border border-border/40 bg-background/40 p-2">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            plan.target
          </div>
          <pre className="mt-1 max-h-40 overflow-auto rounded bg-muted/30 p-2 text-[10px]">
            {JSON.stringify(plan.target, null, 2)}
          </pre>
        </div>
      )}
      {result.resolved && (
        <div className="rounded-lg border border-border/40 bg-background/40 p-2">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Alvo resolvido
          </div>
          <div className="mt-1 grid gap-1 sm:grid-cols-2">
            <Field label="roleid" value={result.resolved.roleid} />
            <Field label="userid" value={result.resolved.userid} />
            <Field label="account" value={result.resolved.account} />
            <Field label="name" value={result.resolved.name} />
          </div>
        </div>
      )}
      {plan.warnings && plan.warnings.length > 0 && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-2 text-amber-400">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider">plan.warnings</div>
          {plan.warnings.map((w, i) => (
            <div key={i}>⚠ {w}</div>
          ))}
        </div>
      )}
      {result.warnings && result.warnings.length > 0 && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-2 text-amber-400">
          {result.warnings.map((w, i) => (
            <div key={i}>⚠ {w}</div>
          ))}
        </div>
      )}
      {result.result && (
        <div className="rounded-lg border border-border/40 bg-background/40 p-2">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            result
          </div>
          {result.result.message && (
            <div className="text-foreground">{result.result.message}</div>
          )}
          {result.result.warning && (
            <div className="mt-1 text-amber-400">⚠ {result.result.warning}</div>
          )}
          <pre className="mt-2 max-h-40 overflow-auto rounded bg-muted/30 p-2 text-[10px]">
            {JSON.stringify(result.result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: unknown }) {
  if (value === undefined || value === null || value === "") return null;
  return (
    <div className="flex items-center justify-between gap-2 rounded border border-border/30 bg-background/40 px-2 py-1">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className="truncate font-mono text-[11px] text-foreground">{String(value)}</span>
    </div>
  );
}
