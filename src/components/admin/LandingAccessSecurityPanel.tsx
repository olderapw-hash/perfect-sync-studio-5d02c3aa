import { useCallback, useEffect, useState } from "react";
import {
  Globe,
  Loader2,
  RefreshCw,
  Save,
  Shield,
  Trash2,
  UserX,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { useServers } from "@/hooks/useServers";
import { useServerPermissions } from "@/hooks/useServerPermissions";
import { EndpointMissingError, pwApi } from "@/lib/pwApiActions";
import {
  canUseDirectGamePortalAdminSave,
  fetchLandingAccessSessions,
  gamePortalOperatorOpts,
  revokeAllLandingAccessSessions,
  revokeLandingAccessSession,
  saveGamePortalAdminConfigDirect,
  type LandingAccessSession,
} from "@/lib/gamePortalApi";

function formatWhen(value?: string) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString("pt-BR");
}

export function LandingAccessSecurityPanel() {
  const { isSuperadmin, user } = useAuth();
  const { active } = useServers();
  const { can } = useServerPermissions();

  const directSave = canUseDirectGamePortalAdminSave();
  const canManage = isSuperadmin || can("manage_security") || can("manage_servers");
  const canSave = canManage && (directSave || true);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [revokingAll, setRevokingAll] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [landingPasswordEnabled, setLandingPasswordEnabled] = useState(false);
  const [landingPassword, setLandingPassword] = useState("");
  const [landingPasswordConfigured, setLandingPasswordConfigured] = useState(false);
  const [sessions, setSessions] = useState<LandingAccessSession[]>([]);
  const [protectedSite, setProtectedSite] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = directSave
        ? await fetchLandingAccessSessions(gamePortalOperatorOpts(user))
        : await pwApi.listLandingAccessSessions();
      setLandingPasswordEnabled(!!res.landing_password_enabled);
      setLandingPasswordConfigured(!!res.landing_password_configured);
      setProtectedSite(!!res.protected);
      setSessions(res.sessions ?? []);
      setLandingPassword("");
    } catch (e) {
      if (e instanceof EndpointMissingError) {
        setError("Atualize api_cls.php e game_portal.php na VPS para usar sessoes da landing.");
      } else {
        setError(e instanceof Error ? e.message : String(e));
      }
    } finally {
      setLoading(false);
    }
  }, [directSave, user]);

  useEffect(() => {
    void load();
  }, [load, active?.id]);

  const onSaveLanding = async () => {
    if (!canSave) return;
    if (landingPasswordEnabled && !landingPasswordConfigured && !landingPassword.trim()) {
      toast.error("Defina uma senha antes de ativar a protecao");
      return;
    }
    if (landingPassword.trim() && landingPassword.trim().length < 4) {
      toast.error("Senha deve ter pelo menos 4 caracteres");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const payload = {
        landing_password_enabled: landingPasswordEnabled,
        ...(landingPassword.trim() ? { landing_password: landingPassword.trim() } : {}),
      };

      if (directSave) {
        const res = await saveGamePortalAdminConfigDirect(payload, gamePortalOperatorOpts(user));
        if (!res.success) throw new Error(res.error || "Falha ao salvar");
        toast.success(res.message || "Protecao da landing salva");
      } else {
        const res = await pwApi.saveGamePortalAdminConfig(payload);
        toast.success(res.message || "Protecao da landing salva");
      }

      await load();
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const onRevoke = async (sessionId: string) => {
    if (!canManage) return;
    setRevokingId(sessionId);
    try {
      if (directSave) {
        await revokeLandingAccessSession(sessionId, gamePortalOperatorOpts(user));
      } else {
        await pwApi.revokeLandingAccessSession(sessionId);
      }
      toast.success("Sessao removida — visitante precisara digitar a senha de novo");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setRevokingId(null);
    }
  };

  const onRevokeAll = async () => {
    if (!canManage) return;
    setRevokingAll(true);
    try {
      if (directSave) {
        await revokeAllLandingAccessSessions(gamePortalOperatorOpts(user));
      } else {
        await pwApi.revokeAllLandingAccessSessions();
      }
      toast.success("Todas as sessoes foram revogadas");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setRevokingAll(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="border-border bg-card/60 backdrop-blur-md">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-widest">
              <Shield className="h-4 w-4 text-primary" />
              Protecao da pagina inicial
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              Exige senha para acessar o IP raiz, cadastro publico e rotas /painel/* antes do login admin.
            </p>
          </div>
          <Button variant="outline" size="sm" className="h-8" onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          </Button>
        </CardHeader>
        <CardContent className="space-y-4 pb-5">
          {!canManage ? (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
              Permissao <strong>manage_security</strong> ou <strong>manage_servers</strong> necessaria.
            </div>
          ) : null}

          {loading ? (
            <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Carregando...
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-4 rounded-md border border-border/60 bg-background/40 px-3 py-2.5">
                <div>
                  <div className="text-sm font-medium">Exigir senha na landing page</div>
                  <div className="text-xs text-muted-foreground">
                    {protectedSite
                      ? "Protecao ativa — visitantes precisam autenticar"
                      : landingPasswordConfigured
                        ? "Senha configurada, mas protecao desligada"
                        : "Nenhuma senha configurada"}
                  </div>
                </div>
                <Switch
                  checked={landingPasswordEnabled}
                  onCheckedChange={setLandingPasswordEnabled}
                  disabled={!canSave}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  {landingPasswordConfigured ? "Nova senha de acesso" : "Senha de acesso"}
                </Label>
                <Input
                  type="password"
                  value={landingPassword}
                  onChange={(e) => setLandingPassword(e.target.value)}
                  disabled={!canSave}
                  className="h-9"
                  placeholder={landingPasswordConfigured ? "Deixe vazio para manter a atual" : "Minimo 4 caracteres"}
                  autoComplete="new-password"
                />
                <p className="text-xs text-muted-foreground">
                  Ao alterar a senha, todas as sessoes ativas sao invalidadas automaticamente.
                </p>
              </div>

              <Button size="sm" className="h-9" disabled={!canSave || saving} onClick={() => void onSaveLanding()}>
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                Salvar protecao e senha
              </Button>
            </>
          )}

          {error ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="border-border bg-card/60 backdrop-blur-md">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-widest">
              <Globe className="h-4 w-4 text-primary" />
              Sessoes conectadas
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              Quem acertou a senha da landing — IP, navegador e ultima atividade. Revogue para forcar nova senha.
            </p>
          </div>
          {sessions.length > 0 && canManage ? (
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-destructive hover:text-destructive"
              disabled={revokingAll}
              onClick={() => void onRevokeAll()}
            >
              {revokingAll ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              Revogar todas
            </Button>
          ) : null}
        </CardHeader>
        <CardContent className="pb-5">
          {loading ? null : sessions.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma sessao ativa registrada.</p>
          ) : (
            <div className="overflow-x-auto rounded-md border border-border/60">
              <table className="w-full min-w-[640px] text-left text-xs">
                <thead className="border-b border-border/60 bg-muted/30 text-[10px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Visitante</th>
                    <th className="px-3 py-2">IP</th>
                    <th className="px-3 py-2">Entrou em</th>
                    <th className="px-3 py-2">Ultima atividade</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2 text-right">Acao</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((session) => (
                    <tr key={session.id} className="border-b border-border/40 last:border-0">
                      <td className="px-3 py-2">
                        <div className="font-medium text-foreground">{session.label || "Visitante"}</div>
                        {session.token_suffix ? (
                          <div className="font-mono text-[10px] text-muted-foreground">…{session.token_suffix}</div>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 font-mono">{session.ip || "—"}</td>
                      <td className="px-3 py-2">{formatWhen(session.created_at)}</td>
                      <td className="px-3 py-2">{formatWhen(session.last_seen_at)}</td>
                      <td className="px-3 py-2">
                        {session.online ? (
                          <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-400">
                            ativo
                          </span>
                        ) : (
                          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                            inativo
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {canManage ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-destructive hover:text-destructive"
                            disabled={revokingId === session.id}
                            onClick={() => void onRevoke(session.id)}
                          >
                            {revokingId === session.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <UserX className="h-3.5 w-3.5" />
                            )}
                            Remover
                          </Button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
