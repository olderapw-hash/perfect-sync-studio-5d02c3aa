// GM Commander v3 — Full Meridiano / Full Títulos
//
// Endpoints REAIS roteados pelo gateway dedicado api_cls_meridian_titles.php:
//   GET  ?action=getMeridianTitlePresetCatalog
//   POST ?action=previewMeridianTitlePreset
//   POST ?action=applyMeridianTitlePreset
//
// Contrato real:
//   - preset.key (não "id")
//   - cls_template.roleid (não "id" / "cls_template_id")
//   - request envia `roleid` para os dois target_modes
//   - response: target.target_mode, preset.baseline_source
//   - NÃO existe `verified` no topo (apenas `changed` + `save`).
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Crown, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EndpointMissingNotice } from "@/components/admin/EndpointMissingNotice";
import { roleMeetsRequirement, useOperatorPermissions } from "@/hooks/useOperatorPermissions";
import { cn } from "@/lib/utils";
import {
  EndpointMissingError,
  pwApi,
  type MeridianTargetMode,
  type MeridianTitleApplyResponse,
  type MeridianTitlePresetCatalogResponse,
  type MeridianTitlePresetMeta,
  type MeridianTitlePresetRequest,
  type MeridianTitlePreviewResponse,
} from "@/lib/pwApiActions";

/** preset.key oficial (compat com VPS antigas que ainda mandam `id`). */
function pKey(p: MeridianTitlePresetMeta): string {
  return (p.key ?? p.id ?? "") as string;
}

/** Normaliza preset retornado: pode vir como string ou objeto. */
function readPreset(
  p: MeridianTitlePreviewResponse["preset"] | MeridianTitleApplyResponse["preset"],
): { key?: string; label?: string; baseline_source?: string } {
  if (!p) return {};
  if (typeof p === "string") return { key: p };
  return { key: p.key, label: p.label, baseline_source: p.baseline_source };
}

export function MeridianTitlesTab() {
  const { canAction, role: operatorRole, loading: permLoading } = useOperatorPermissions();
  const canPreview = canAction("previewMeridianTitlePreset");
  const canApplyAction = canAction("applyMeridianTitlePreset");

  const [catalog, setCatalog] = useState<MeridianTitlePresetCatalogResponse | null>(null);
  const [catalogMissing, setCatalogMissing] = useState(false);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  const [presetKeyState, setPresetKeyState] = useState<string | null>(null);
  const [targetMode, setTargetMode] = useState<MeridianTargetMode>("role");
  const [roleid, setRoleid] = useState("");
  const [templateRoleid, setTemplateRoleid] = useState<string>("");
  const [kickOnline, setKickOnline] = useState(false);

  const [previewBusy, setPreviewBusy] = useState(false);
  const [applyBusy, setApplyBusy] = useState(false);
  const [preview, setPreview] = useState<MeridianTitlePreviewResponse | null>(null);
  const [apply, setApply] = useState<MeridianTitleApplyResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  /** Gating fino: backend exige gm_admin para target_mode=role
   *  e super_admin para target_mode=cls_template. */
  const requiredApplyRole = targetMode === "cls_template" ? "super_admin" : "gm_admin";
  const operatorMeetsApplyRole = roleMeetsRequirement(operatorRole, requiredApplyRole);
  const canApply = canApplyAction && operatorMeetsApplyRole;

  const loadCatalog = useCallback(async () => {
    setCatalogLoading(true);
    setCatalogMissing(false);
    setCatalogError(null);
    try {
      const res = await pwApi.getMeridianTitlePresetCatalog();
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
  const targetModes = useMemo(
    () => catalog?.target_modes ?? (["role", "cls_template"] as MeridianTargetMode[]),
    [catalog],
  );
  const clsTemplates = useMemo(() => catalog?.cls_templates ?? [], [catalog]);
  const selected = useMemo<MeridianTitlePresetMeta | null>(
    () => presets.find((p) => pKey(p) === presetKeyState) ?? null,
    [presets, presetKeyState],
  );

  const buildPayload = (): MeridianTitlePresetRequest | null => {
    if (!selected) return null;
    const payload: MeridianTitlePresetRequest = {
      preset: pKey(selected),
      target_mode: targetMode,
    };
    if (targetMode === "role") {
      if (!roleid.trim()) return null;
      payload.roleid = roleid.trim();
      if (kickOnline) payload.kick_online = true;
    } else {
      // cls_template → backend espera `roleid` do template (não cls_template_id).
      if (!templateRoleid) return null;
      payload.roleid = templateRoleid;
    }
    return payload;
  };

  const runPreview = async () => {
    const payload = buildPayload();
    if (!payload) return;
    setPreviewBusy(true);
    setError(null);
    setPreview(null);
    setApply(null);
    try {
      const res = await pwApi.previewMeridianTitlePreset(payload);
      setPreview(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPreviewBusy(false);
    }
  };

  const runApply = async () => {
    const payload = buildPayload();
    if (!payload) return;
    setApplyBusy(true);
    setError(null);
    setApply(null);
    try {
      const res = await pwApi.applyMeridianTitlePreset(payload);
      setApply(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setApplyBusy(false);
    }
  };

  if (catalogMissing) {
    return <EndpointMissingNotice action="getMeridianTitlePresetCatalog" />;
  }

  return (
    <div className="space-y-4">
      <Card className="border-border/50 bg-card/40 backdrop-blur-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div className="flex items-center gap-2">
            <Crown className="h-4 w-4 text-primary" />
            <div>
              <CardTitle className="text-base font-bold">Meridiano & Títulos</CardTitle>
              <p className="text-xs text-muted-foreground">
                Catálogo via gateway dedicado{" "}
                <code>api_cls_meridian_titles.php</code>.
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => void loadCatalog()} disabled={catalogLoading}>
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
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
            </div>
          ) : presets.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Nenhum preset retornado pela VPS.
            </p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {presets.map((p) => {
                const k = pKey(p);
                const active = presetKeyState === k;
                const isReset = k.startsWith("reset_") || p.kind === "reset";
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setPresetKeyState(k)}
                    className={cn(
                      "rounded-xl border p-3 text-left transition-all",
                      active
                        ? "border-primary bg-primary/10 shadow-[0_0_18px_-6px_hsl(var(--primary)/0.4)]"
                        : "border-border/50 bg-card/50 hover:border-primary/40 hover:bg-primary/5",
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-3.5 w-3.5 text-primary" />
                      <span className="text-sm font-bold text-foreground">{p.label}</span>
                      <Badge
                        variant="outline"
                        className={cn(
                          "ml-auto text-[9px] uppercase",
                          isReset
                            ? "border-amber-500/40 text-amber-400"
                            : "border-primary/40 text-primary",
                        )}
                      >
                        {isReset ? "reset → baseline" : "full → preset"}
                      </Badge>
                    </div>
                    {p.summary && (
                      <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">{p.summary}</p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-1">
                      {p.scope && (
                        <Badge variant="secondary" className="text-[9px] uppercase">
                          {p.scope}
                        </Badge>
                      )}
                      {p.baseline_source && (
                        <Badge variant="outline" className="text-[9px] uppercase">
                          baseline: {p.baseline_source}
                        </Badge>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {selected && (
        <Card className="border-border/50 bg-card/40 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold">{selected.label}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label className="text-xs">target_mode</Label>
                <Select value={targetMode} onValueChange={(v) => setTargetMode(v as MeridianTargetMode)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {targetModes.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {targetMode === "role" ? (
                <div>
                  <Label className="text-xs">roleid</Label>
                  <Input
                    value={roleid}
                    onChange={(e) => setRoleid(e.target.value)}
                    inputMode="numeric"
                    placeholder="ex: 1024"
                  />
                </div>
              ) : (
                <div>
                  <Label className="text-xs">cls_template (roleid)</Label>
                  <Select value={templateRoleid} onValueChange={setTemplateRoleid}>
                    <SelectTrigger>
                      <SelectValue placeholder={clsTemplates.length === 0 ? "Catálogo vazio" : "Selecione…"} />
                    </SelectTrigger>
                    <SelectContent>
                      {clsTemplates.map((t) => {
                        const rid = String(t.roleid ?? t.id ?? "");
                        return (
                          <SelectItem key={rid} value={rid}>
                            {t.label ?? `template ${rid}`}
                            {typeof t.cls === "number" ? ` · cls ${t.cls}` : ""}
                            {` · roleid ${rid}`}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            {targetMode === "role" && (
              <div className="flex items-center gap-2 rounded-lg border border-border/40 bg-card/40 p-2">
                <Switch checked={kickOnline} onCheckedChange={setKickOnline} />
                <Label className="text-xs">Kickar se o personagem estiver online</Label>
              </div>
            )}
            {selected.warnings && selected.warnings.length > 0 && (
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-2 text-[11px] text-amber-400">
                {selected.warnings.map((w, i) => (
                  <div key={i}>⚠ {w}</div>
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
                  applyBusy ||
                  !buildPayload()
                }
              >
                {previewBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                Preview
              </Button>
              <Button
                onClick={() => void runApply()}
                disabled={
                  permLoading ||
                  !canApply ||
                  previewBusy ||
                  applyBusy ||
                  !buildPayload()
                }
              >
                {applyBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                Aplicar
              </Button>
              {!canApplyAction && !permLoading && (
                <span className="text-[11px] text-amber-400">
                  Operador sem permissão para aplicar (canAction=false).
                </span>
              )}
              {canApplyAction && !operatorMeetsApplyRole && !permLoading && (
                <span className="text-[11px] text-destructive">
                  target_mode <code>{targetMode}</code> exige role <code>{requiredApplyRole}</code>.
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {error && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="py-3 text-xs text-destructive">{error}</CardContent>
        </Card>
      )}

      {preview && <PreviewView preview={preview} />}
      {apply && <ApplyView apply={apply} />}
    </div>
  );
}

function PreviewView({ preview }: { preview: MeridianTitlePreviewResponse }) {
  const presetInfo = readPreset(preview.preset);
  const targetMode = preview.target?.target_mode;
  const diff = preview.diff ?? {};
  const wouldChange = diff.would_change;
  const baseline = diff.baseline;
  const baselineSource = presetInfo.baseline_source ?? diff.baseline_source;
  const current = diff.current;
  const after = diff.after;
  return (
    <Card className="border-border/50 bg-card/40 backdrop-blur-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-bold">Pré-visualização</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-xs">
        <div className="flex flex-wrap gap-2">
          {presetInfo.key && <Badge variant="outline">preset: {presetInfo.key}</Badge>}
          {targetMode && <Badge variant="outline">{targetMode}</Badge>}
          {wouldChange != null && (
            <Badge variant={wouldChange ? "default" : "secondary"}>
              would_change: {String(wouldChange)}
            </Badge>
          )}
          {baselineSource && <Badge variant="outline">baseline_source: {baselineSource}</Badge>}
        </div>
        {preview.warnings && preview.warnings.length > 0 && (
          <div className="rounded border border-amber-500/40 bg-amber-500/5 p-2 text-amber-400">
            {preview.warnings.map((w, i) => (
              <div key={i} className="flex items-start gap-1.5">
                <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                <span>{w}</span>
              </div>
            ))}
          </div>
        )}
        <div className="grid gap-2 sm:grid-cols-2">
          <DiffBlock title="target" data={preview.target} />
          <DiffBlock title="current" data={current} />
          <DiffBlock title="after" data={after} />
          {baseline && <DiffBlock title="baseline" data={baseline} />}
        </div>
      </CardContent>
    </Card>
  );
}

function ApplyView({ apply }: { apply: MeridianTitleApplyResponse }) {
  const presetInfo = readPreset(apply.preset);
  const targetMode = apply.target?.target_mode;
  return (
    <Card
      className={cn(
        "border-border/50 bg-card/40 backdrop-blur-sm",
        apply.success ? "border-emerald-500/40" : "border-destructive/40",
      )}
    >
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-bold">Resultado da aplicação</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-xs">
        <div className="flex flex-wrap gap-2">
          <Badge variant={apply.success ? "default" : "destructive"}>success: {String(apply.success)}</Badge>
          {presetInfo.key && <Badge variant="outline">preset: {presetInfo.key}</Badge>}
          {targetMode && <Badge variant="outline">{targetMode}</Badge>}
          {apply.changed != null && (
            <Badge variant={apply.changed ? "default" : "secondary"}>changed: {String(apply.changed)}</Badge>
          )}
          {presetInfo.baseline_source && (
            <Badge variant="outline">baseline_source: {presetInfo.baseline_source}</Badge>
          )}
        </div>
        {apply.warnings && apply.warnings.length > 0 && (
          <div className="rounded border border-amber-500/40 bg-amber-500/5 p-2 text-amber-400">
            {apply.warnings.map((w, i) => <div key={i}>⚠ {w}</div>)}
          </div>
        )}
        {apply.audit_file && (
          <div className="rounded border border-border/30 bg-background/40 p-2 font-mono text-[11px]">
            audit_file: {apply.audit_file}
          </div>
        )}
        <div className="grid gap-2 sm:grid-cols-2">
          <DiffBlock title="target" data={apply.target} />
          <DiffBlock title="save" data={apply.save} />
          {apply.session_kick && (
            <DiffBlock
              title="session_kick"
              data={typeof apply.session_kick === "boolean" ? { kicked: apply.session_kick } : apply.session_kick}
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function DiffBlock({ title, data }: { title: string; data: unknown }) {
  if (data === undefined || data === null) return null;
  return (
    <div className="rounded border border-border/30 bg-background/40 p-2">
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </div>
      <pre className="max-h-40 overflow-auto text-[10px] leading-tight text-foreground">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}
