// /admin/events/rank-pvp — Subsessão "Rank PvP" do hub Eventos.
// Toda a operação roteia pelo proxy clsconfig-proxy → api_cls.php
// (ver docs em LOVABLE_RANK_PVP_PROMPT.md). Sem SQL/regras no client.
import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  ChevronDown,
  Loader2,
  Pause,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Save,
  Swords,
  Trash2,
  Trophy,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { EndpointMissingNotice } from "@/components/admin/EndpointMissingNotice";
import {
  OperatorPermissionsProvider,
  useOperatorPermissions,
} from "@/hooks/useOperatorPermissions";
import {
  EndpointMissingError,
  pwApi,
  type PvpRankingEntry,
  type PvpRewardConfig,
  type PvpRewardExecutionResponse,
  type PvpRewardHistoryEntry,
  type PvpRewardPreviewResponse,
  type PvpScheduleSummary,
} from "@/lib/pwApiActions";
import { cn } from "@/lib/utils";

const POSITIONS = [1, 2, 3] as const;
const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];

const DEFAULT_REWARDS: PvpRewardConfig[] = [
  {
    position: 1,
    item_id: 0,
    count: 1,
    money: 1_000_000,
    title: "Campeao PvP",
    message: "Parabens, {player_name}. Voce ficou em {position}o lugar com {points} pontos.",
  },
  {
    position: 2,
    item_id: 0,
    count: 1,
    money: 500_000,
    title: "Vice PvP",
    message: "Parabens, {player_name}. Voce ficou em {position}o lugar.",
  },
  {
    position: 3,
    item_id: 0,
    count: 1,
    money: 250_000,
    title: "Top 3 PvP",
    message: "Parabens, {player_name}. Voce ficou em {position}o lugar.",
  },
];

const RankPvpPage = () => (
  <OperatorPermissionsProvider>
    <RankPvpInner />
  </OperatorPermissionsProvider>
);

const RankPvpInner = () => {
  const { canAction, loading: opLoading } = useOperatorPermissions();
  const canExecute = canAction("executePvpRankingRewards");
  const canSchedule = canAction("savePvpRankingRewardSchedule");

  const [rewards, setRewards] = useState<PvpRewardConfig[]>(DEFAULT_REWARDS);
  const [resetRanking, setResetRanking] = useState(true);
  const [resetOnlyOnFullSuccess, setResetOnlyOnFullSuccess] = useState(true);

  const [leaderboard, setLeaderboard] = useState<PvpRankingEntry[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [endpointMissing, setEndpointMissing] = useState<string | null>(null);

  const [history, setHistory] = useState<PvpRewardHistoryEntry[]>([]);
  const [schedules, setSchedules] = useState<PvpScheduleSummary[]>([]);
  const [preview, setPreview] = useState<PvpRewardPreviewResponse | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [lastExecution, setLastExecution] = useState<PvpRewardExecutionResponse | null>(null);

  /* ─── carga inicial / refresh ─── */
  const loadAll = useCallback(async () => {
    setEndpointMissing(null);
    setLeaderboardLoading(true);
    try {
      const [lb, hist, sch] = await Promise.allSettled([
        pwApi.getPvpRankingLeaderboard({ limit: 3 }),
        pwApi.getPvpRankingRewardHistory({ limit: 20 }),
        pwApi.getPvpRankingRewardSchedules({ limit: 20 }),
      ]);

      if (lb.status === "fulfilled") {
        const entries = lb.value.entries ?? lb.value.leaderboard ?? [];
        setLeaderboard(entries);
      } else if (lb.reason instanceof EndpointMissingError) {
        setEndpointMissing(lb.reason.action);
      } else {
        toast.error("Erro ao carregar leaderboard", {
          description: humanError(lb.reason),
        });
      }

      if (hist.status === "fulfilled") {
        setHistory(hist.value.entries ?? hist.value.history ?? []);
      }
      if (sch.status === "fulfilled") {
        setSchedules(sch.value.schedules ?? []);
      }
    } finally {
      setLeaderboardLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  /* ─── ações ─── */
  const updateReward = (position: number, patch: Partial<PvpRewardConfig>) => {
    setRewards((prev) =>
      prev.map((r) => (r.position === position ? { ...r, ...patch } : r)),
    );
  };

  const buildExecutionPayload = () => ({
    rewards,
    reset_ranking: resetRanking,
    reset_only_on_full_success: resetOnlyOnFullSuccess,
  });

  const handlePreview = async () => {
    setPreviewLoading(true);
    setPreview(null);
    try {
      const res = await pwApi.previewPvpRankingRewards(buildExecutionPayload());
      setPreview(res);
      toast.success("Preview gerado");
    } catch (e) {
      if (e instanceof EndpointMissingError) {
        setEndpointMissing(e.action);
      } else {
        toast.error("Falha no preview", { description: humanError(e) });
      }
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleExecute = async () => {
    if (!confirm("Confirmar execução da premiação agora?")) return;
    setExecuting(true);
    try {
      const res = await pwApi.executePvpRankingRewards(buildExecutionPayload());
      setLastExecution(res);
      toast.success(
        `Execução concluída — ${res.completed_count ?? 0} entregues, ${res.failed_count ?? 0} falhas`,
      );
      await loadAll();
    } catch (e) {
      if (e instanceof EndpointMissingError) {
        setEndpointMissing(e.action);
      } else {
        toast.error("Falha ao executar premiação", { description: humanError(e) });
      }
    } finally {
      setExecuting(false);
    }
  };

  if (endpointMissing) {
    return (
      <div className="h-full overflow-y-auto p-6">
        <div className="mx-auto max-w-4xl">
          <EndpointMissingNotice action={endpointMissing} />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header */}
        <header className="rounded-2xl border-2 border-primary/40 bg-primary/5 p-5">
          <div className="flex items-start gap-3">
            <Swords className="mt-0.5 h-6 w-6 shrink-0 text-primary" />
            <div className="flex-1">
              <p className="text-xs font-bold uppercase tracking-wider text-primary">
                Eventos · Rank PvP
              </p>
              <h1 className="mt-0.5 text-xl font-extrabold text-foreground">
                Ranking PvP — premiação semanal
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Configure as recompensas do TOP 3, gere preview, execute manualmente
                ou agende a premiação automática.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadAll()}
              disabled={leaderboardLoading}
            >
              {leaderboardLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              <span className="ml-2">Atualizar</span>
            </Button>
          </div>
        </header>

        {/* 1. Leaderboard */}
        <Section
          title="Leaderboard atual"
          icon={<Trophy className="h-4 w-4 text-primary" />}
        >
          <LeaderboardTable entries={leaderboard} loading={leaderboardLoading} />
        </Section>

        {/* 2. Recompensas */}
        <Section
          title="Configuração de recompensas"
          icon={<Pencil className="h-4 w-4 text-primary" />}
        >
          <div className="grid gap-4 lg:grid-cols-3">
            {POSITIONS.map((pos) => {
              const r = rewards.find((x) => x.position === pos)!;
              return <RewardCard key={pos} reward={r} onChange={(p) => updateReward(pos, p)} />;
            })}
          </div>

          <div className="mt-4 grid gap-3 rounded-lg border border-border bg-card/40 p-4 sm:grid-cols-2">
            <label className="flex items-center gap-3 text-sm">
              <Switch
                checked={resetRanking}
                onCheckedChange={setResetRanking}
              />
              <span>Resetar ranking após premiação</span>
            </label>
            <label className="flex items-center gap-3 text-sm">
              <Switch
                checked={resetOnlyOnFullSuccess}
                onCheckedChange={setResetOnlyOnFullSuccess}
                disabled={!resetRanking}
              />
              <span>Resetar apenas se tudo der certo</span>
            </label>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={handlePreview} disabled={previewLoading || opLoading} variant="outline">
              {previewLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              <span className="ml-2">Visualizar premiação</span>
            </Button>
            <Button
              onClick={handleExecute}
              disabled={executing || opLoading || !canExecute}
              title={!canExecute ? "Requer nível gm_admin" : undefined}
            >
              {executing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              <span className="ml-2">Executar premiação agora</span>
            </Button>
          </div>
        </Section>

        {/* 3. Preview */}
        {preview && (
          <Section title="Preview da premiação">
            <PreviewBlock preview={preview} />
          </Section>
        )}

        {/* 4. Última execução */}
        {lastExecution && (
          <Section title="Resultado da última execução">
            <ExecutionResultBlock result={lastExecution} />
          </Section>
        )}

        {/* 5. Agendamento */}
        <Section title="Agendamento automático">
          <ScheduleManager
            schedules={schedules}
            rewards={rewards}
            resetRanking={resetRanking}
            resetOnlyOnFullSuccess={resetOnlyOnFullSuccess}
            canSchedule={canSchedule}
            onChanged={() => loadAll()}
          />
        </Section>

        {/* 6. Histórico */}
        <Section title="Histórico das rodadas">
          <HistoryList entries={history} />
        </Section>
      </div>
    </div>
  );
};

/* ─────────── Subcomponentes ─────────── */

const Section = ({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) => (
  <section className="rounded-2xl border border-border bg-card/40 p-5 shadow-sm backdrop-blur-md">
    <h2 className="mb-4 flex items-center gap-2 text-sm font-extrabold uppercase tracking-wider text-foreground">
      {icon}
      {title}
    </h2>
    {children}
  </section>
);

const LeaderboardTable = ({
  entries,
  loading,
}: {
  entries: PvpRankingEntry[];
  loading: boolean;
}) => {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando…
      </div>
    );
  }
  if (entries.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-border bg-muted/20 p-4 text-center text-sm text-muted-foreground">
        Nenhum jogador elegível no ranking PvP atual.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
            <th className="px-3 py-2">Posição</th>
            <th className="px-3 py-2">Personagem</th>
            <th className="px-3 py-2">Classe</th>
            <th className="px-3 py-2 text-right">Kills</th>
            <th className="px-3 py-2 text-right">Deaths</th>
            <th className="px-3 py-2 text-right">Pontos</th>
            <th className="px-3 py-2">Última kill</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr key={`${e.position}-${e.roleid}`} className="border-b border-border/50">
              <td className="px-3 py-2 font-mono font-bold text-primary">#{e.position}</td>
              <td className="px-3 py-2 font-semibold">{e.role_name ?? `roleid ${e.roleid}`}</td>
              <td className="px-3 py-2 text-muted-foreground">
                {e.class_name ?? (e.class_id != null ? `cls ${e.class_id}` : "—")}
              </td>
              <td className="px-3 py-2 text-right">{e.kills ?? 0}</td>
              <td className="px-3 py-2 text-right">{e.deaths ?? 0}</td>
              <td className="px-3 py-2 text-right font-bold">{e.points ?? 0}</td>
              <td className="px-3 py-2 text-xs text-muted-foreground">
                {formatTime(e.last_kill_at)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const RewardCard = ({
  reward,
  onChange,
}: {
  reward: PvpRewardConfig;
  onChange: (p: Partial<PvpRewardConfig>) => void;
}) => (
  <div className="rounded-xl border border-border bg-background/40 p-4">
    <div className="mb-3 flex items-center gap-2">
      <span className="rounded-md bg-primary/15 px-2 py-0.5 font-mono text-xs font-bold text-primary">
        #{reward.position}
      </span>
      <span className="text-sm font-extrabold">
        {reward.position}º lugar
      </span>
    </div>
    <div className="space-y-2">
      <Field label="item_id">
        <Input
          type="number"
          value={reward.item_id ?? 0}
          onChange={(e) => onChange({ item_id: Number(e.target.value) || 0 })}
        />
      </Field>
      <Field label="count">
        <Input
          type="number"
          min={1}
          value={reward.count ?? 1}
          onChange={(e) => onChange({ count: Number(e.target.value) || 1 })}
        />
      </Field>
      <Field label="money (cobre)">
        <Input
          type="number"
          value={reward.money ?? 0}
          onChange={(e) => onChange({ money: Number(e.target.value) || 0 })}
        />
      </Field>
      <Field label="title">
        <Input
          value={reward.title ?? ""}
          onChange={(e) => onChange({ title: e.target.value })}
        />
      </Field>
      <Field label="message">
        <Textarea
          rows={3}
          value={reward.message ?? ""}
          onChange={(e) => onChange({ message: e.target.value })}
        />
      </Field>
      <p className="text-[10px] text-muted-foreground">
        {(reward.item_id ?? 0) > 0
          ? "→ enviado como item"
          : "→ enviado como gold por correio"}
      </p>
    </div>
  </div>
);

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <Label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
      {label}
    </Label>
    {children}
  </div>
);

const PreviewBlock = ({ preview }: { preview: PvpRewardPreviewResponse }) => {
  const lb = preview.leaderboard ?? [];
  const results = preview.results ?? [];
  const missing = preview.missing_positions ?? [];
  return (
    <div className="space-y-3 text-sm">
      {missing.length > 0 && (
        <p className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-500">
          Posições sem alvo: {missing.join(", ")}
        </p>
      )}
      <div className="grid gap-3 lg:grid-cols-3">
        {POSITIONS.map((pos) => {
          const player = lb.find((e) => e.position === pos);
          const r = results.find((x) => x.position === pos);
          return (
            <div key={pos} className="rounded-lg border border-border bg-background/40 p-3">
              <div className="mb-1 text-xs font-bold uppercase text-primary">#{pos}</div>
              <div className="text-sm font-semibold">
                {player?.role_name ?? "(vazio)"}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {r?.delivery && <>Entrega: {r.delivery} · </>}
                Status: <span className="font-mono">{r?.status ?? "—"}</span>
              </div>
              {r?.error && (
                <div className="mt-1 text-xs text-destructive">{r.error}</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const ExecutionResultBlock = ({ result }: { result: PvpRewardExecutionResponse }) => (
  <div className="space-y-2 text-sm">
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
      <Stat label="Status" value={result.status ?? "—"} />
      <Stat label="Entregues" value={result.completed_count ?? 0} />
      <Stat label="Falhas" value={result.failed_count ?? 0} tone={result.failed_count ? "danger" : "ok"} />
      <Stat label="Skipped" value={result.skipped_count ?? 0} />
      <Stat
        label="Reset"
        value={result.reset_performed ? "sim" : "não"}
        tone={result.reset_performed ? "ok" : "muted"}
      />
    </div>
    {result.results && result.results.length > 0 && (
      <details className="rounded-md border border-border bg-background/40 p-3 text-xs">
        <summary className="cursor-pointer font-semibold">Detalhe por posição</summary>
        <pre className="mt-2 overflow-x-auto text-[11px]">
          {JSON.stringify(result.results, null, 2)}
        </pre>
      </details>
    )}
  </div>
);

const Stat = ({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string | number;
  tone?: "default" | "ok" | "danger" | "muted";
}) => (
  <div
    className={cn(
      "rounded-md border bg-background/40 p-2 text-center",
      tone === "ok" && "border-success/40 text-success",
      tone === "danger" && "border-destructive/40 text-destructive",
      tone === "muted" && "border-border text-muted-foreground",
      tone === "default" && "border-border",
    )}
  >
    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    <div className="mt-0.5 font-mono text-sm font-bold">{value}</div>
  </div>
);

/* ─── Schedules (estilo BulkScheduleManager) ─── */

const DEFAULT_TIMEZONE = "America/Sao_Paulo";

/** PvP usa 1=Dom .. 7=Sab (mantém compatibilidade com o backend atual) */
const PVP_DAY_LABELS: Record<number, string> = {
  1: "Domingo", 2: "Segunda", 3: "Terça", 4: "Quarta",
  5: "Quinta", 6: "Sexta", 7: "Sábado",
};

const PVP_DAY_BUTTONS: [number, string][] = [
  [2, "Seg"], [3, "Ter"], [4, "Qua"], [5, "Qui"],
  [6, "Sex"], [7, "Sáb"], [1, "Dom"],
];

function pvpIsEveryDay(s: PvpScheduleSummary): boolean {
  return (s.weekdays?.length ?? 0) === 7;
}

function pvpWeekdaysLabel(weekdays: number[] = []): string {
  if (weekdays.length === 7) return "Todos os dias";
  return weekdays.map((d) => PVP_DAY_LABELS[d] || `Dia ${d}`).join(", ");
}

function pvpFormatRelative(date: Date): string {
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffH = Math.floor(diffMs / 3600000);
  const diffD = Math.floor(diffH / 24);
  if (diffD > 0) return `em ${diffD}d ${diffH % 24}h`;
  if (diffH > 0) return `em ${diffH}h`;
  const diffM = Math.floor(diffMs / 60000);
  return diffM > 0 ? `em ${diffM}min` : "agora";
}

const ScheduleManager = ({
  schedules,
  rewards,
  resetRanking,
  resetOnlyOnFullSuccess,
  canSchedule,
  onChanged,
}: {
  schedules: PvpScheduleSummary[];
  rewards: PvpRewardConfig[];
  resetRanking: boolean;
  resetOnlyOnFullSuccess: boolean;
  canSchedule: boolean;
  onChanged: () => void;
}) => {
  const [showCreate, setShowCreate] = useState(false);
  const [editSchedule, setEditSchedule] = useState<PvpScheduleSummary | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await onChanged();
    } finally {
      setRefreshing(false);
    }
  };

  const toggleActive = async (s: PvpScheduleSummary) => {
    try {
      await pwApi.savePvpRankingRewardSchedule({
        id: s.id,
        name: s.name ?? "Ranking PvP",
        weekdays: s.weekdays ?? [],
        time_of_day: s.time_of_day ?? "00:05:00",
        timezone: s.timezone ?? DEFAULT_TIMEZONE,
        enabled: !s.enabled,
        reset_ranking: s.reset_ranking ?? true,
        reset_only_on_full_success: s.reset_only_on_full_success ?? true,
        rewards: s.rewards ?? rewards,
      });
      toast.success(s.enabled ? "Agendamento pausado" : "Agendamento ativado");
      onChanged();
    } catch (e) {
      toast.error("Falha ao alternar status", { description: humanError(e) });
    }
  };

  const remove = async (s: PvpScheduleSummary) => {
    if (!confirm(`Excluir agendamento "${s.name ?? s.id}"?`)) return;
    try {
      await pwApi.deletePvpRankingRewardSchedule({ id: s.id, name: s.name });
      toast.success("Agendamento excluído");
      onChanged();
    } catch (e) {
      toast.error("Falha ao excluir", { description: humanError(e) });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-foreground">
            <PvpCalendarIcon />
            Agendamentos Semanais
          </h4>
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            Premiação automática executada pelo scheduler da VPS. Horários em {DEFAULT_TIMEZONE}.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleRefresh}
            disabled={refreshing}
            className="border-border/60 bg-card/60"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
          </Button>
          <Button
            size="sm"
            onClick={() => setShowCreate(true)}
            disabled={!canSchedule}
            title={!canSchedule ? "Requer nível gm_admin" : undefined}
            className="gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            Novo
          </Button>
        </div>
      </div>

      {schedules.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/60 bg-card/20 py-10 text-center">
          <PvpCalendarIcon className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
          <p className="text-xs text-muted-foreground">Nenhum agendamento criado</p>
          <Button
            size="sm"
            variant="outline"
            className="mt-3"
            disabled={!canSchedule}
            onClick={() => setShowCreate(true)}
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            Criar primeiro agendamento
          </Button>
        </div>
      ) : (
        <div className="grid gap-3">
          {schedules.map((s, idx) => {
            const everyDay = pvpIsEveryDay(s);
            const tz = s.timezone || DEFAULT_TIMEZONE;
            const positions = (s.rewards ?? []).map((r) => r.position).filter(Boolean);

            return (
              <div
                key={s.id ?? `${s.name ?? "schedule"}-${idx}`}
                className={cn(
                  "rounded-xl border border-border/40 bg-card/40 p-4 backdrop-blur-sm transition-all",
                  !s.enabled && "opacity-60",
                )}
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold text-foreground">
                        {s.name ?? "(sem nome)"}
                      </span>
                      <span className="rounded-md border border-primary/30 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                        Rank PvP
                      </span>
                      <span
                        className={cn(
                          "rounded-md border px-1.5 py-0.5 text-[10px] font-medium",
                          everyDay
                            ? "border-amber-500/30 text-amber-400"
                            : "border-blue-500/30 text-blue-400",
                        )}
                      >
                        {everyDay ? "Diário" : "Semanal"}
                      </span>
                      <span
                        className={cn(
                          "rounded-md border px-1.5 py-0.5 text-[10px] font-medium",
                          s.enabled
                            ? "border-emerald-500/30 text-emerald-400"
                            : "border-muted-foreground/30 text-muted-foreground",
                        )}
                      >
                        {s.enabled ? "Ativo" : "Pausado"}
                      </span>
                    </div>

                    <div className="mt-1.5 flex flex-col gap-1 text-[10px] text-muted-foreground">
                      <div className="flex items-center gap-1 text-foreground/80 font-medium">
                        <PvpClockIcon />
                        <span>
                          {everyDay
                            ? `Todos os dias às ${s.time_of_day}`
                            : `${pvpWeekdaysLabel(s.weekdays)} às ${s.time_of_day}`}
                        </span>
                        <span className="font-normal text-muted-foreground">({tz})</span>
                      </div>

                      {s.enabled && s.next_run_at && (
                        <div className="ml-4 flex items-center gap-1">
                          <span className="text-primary/80">
                            Próximo:{" "}
                            {new Date(s.next_run_at).toLocaleString("pt-BR", {
                              day: "2-digit",
                              month: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                              timeZone: tz,
                            })}{" "}
                            ({pvpFormatRelative(new Date(s.next_run_at))})
                          </span>
                        </div>
                      )}

                      <div className="ml-4 flex flex-wrap items-center gap-3">
                        <span>
                          Reset: {s.reset_ranking ? "sim" : "não"}
                          {s.reset_ranking && s.reset_only_on_full_success
                            ? " (só se 100% ok)"
                            : ""}
                        </span>
                        <span>Posições: {positions.length ? positions.join(",") : "—"}</span>
                      </div>

                      {s.last_run_at ? (
                        <div className="ml-4 flex flex-wrap items-center gap-3">
                          <span>
                            Último disparo: {formatTime(s.last_run_at) || "—"}
                          </span>
                          {s.last_status && (
                            <span className="font-mono">status: {s.last_status}</span>
                          )}
                          {s.last_error && (
                            <span
                              className="max-w-[240px] truncate text-destructive"
                              title={s.last_error}
                            >
                              {s.last_error}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="ml-4 italic text-muted-foreground/50">
                          Ainda não executado
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => toggleActive(s)}
                      disabled={!canSchedule}
                      title={s.enabled ? "Pausar" : "Ativar"}
                    >
                      {s.enabled ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => setEditSchedule(s)}
                      disabled={!canSchedule}
                      title="Editar"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => remove(s)}
                      disabled={!canSchedule}
                      title="Excluir"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {(showCreate || editSchedule) && (
        <PvpScheduleFormDialog
          schedule={editSchedule}
          rewards={rewards}
          resetRanking={resetRanking}
          resetOnlyOnFullSuccess={resetOnlyOnFullSuccess}
          onClose={() => {
            setShowCreate(false);
            setEditSchedule(null);
          }}
          onSaved={() => {
            setShowCreate(false);
            setEditSchedule(null);
            onChanged();
          }}
        />
      )}
    </div>
  );
};

/* ─── ícones inline (evitam novos imports) ─── */
const PvpCalendarIcon = ({ className }: { className?: string }) => (
  <Trophy className={cn("h-3.5 w-3.5 text-primary", className)} />
);
const PvpClockIcon = () => <RefreshCw className="h-3 w-3 text-primary/60" />;

/* ─── Dialog (espelha BulkScheduleManager) ─── */

const PvpScheduleFormDialog = ({
  schedule,
  rewards,
  resetRanking,
  resetOnlyOnFullSuccess,
  onClose,
  onSaved,
}: {
  schedule: PvpScheduleSummary | null;
  rewards: PvpRewardConfig[];
  resetRanking: boolean;
  resetOnlyOnFullSuccess: boolean;
  onClose: () => void;
  onSaved: () => void;
}) => {
  const isEdit = !!schedule;
  const [name, setName] = useState(schedule?.name || "Ranking PvP semanal");
  const [everyDay, setEveryDay] = useState(schedule ? pvpIsEveryDay(schedule) : false);
  const [selectedWeekdays, setSelectedWeekdays] = useState<number[]>(
    schedule?.weekdays?.length ? schedule.weekdays : [1],
  );
  const [time, setTime] = useState((schedule?.time_of_day || "00:05:00").slice(0, 5));
  const [timezone, setTimezone] = useState(schedule?.timezone || DEFAULT_TIMEZONE);
  const [enabled, setEnabled] = useState(schedule?.enabled ?? true);
  const [resetFlag, setResetFlag] = useState(schedule?.reset_ranking ?? resetRanking);
  const [resetOnlyOk, setResetOnlyOk] = useState(
    schedule?.reset_only_on_full_success ?? resetOnlyOnFullSuccess,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!name.trim()) {
      setError("Nome obrigatório");
      return;
    }
    const weekdays = everyDay ? [1, 2, 3, 4, 5, 6, 7] : selectedWeekdays;
    if (weekdays.length === 0) {
      setError("Selecione pelo menos um dia da semana");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await pwApi.savePvpRankingRewardSchedule({
        id: schedule?.id,
        name: name.trim(),
        weekdays,
        time_of_day: time.length === 5 ? `${time}:00` : time,
        timezone,
        enabled,
        reset_ranking: resetFlag,
        reset_only_on_full_success: resetOnlyOk,
        rewards: schedule?.rewards ?? rewards,
      });
      toast.success(isEdit ? "Agendamento atualizado" : "Agendamento criado");
      onSaved();
    } catch (e) {
      setError(humanError(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto border-border/40 bg-card/95 backdrop-blur-xl">
        <DialogHeader>
          <DialogTitle className="text-sm font-extrabold">
            {isEdit ? "Editar Agendamento" : "Novo Agendamento"}
          </DialogTitle>
          <DialogDescription className="text-[11px]">
            Premiação semanal do Rank PvP. Usa as recompensas configuradas atualmente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-[10px] text-destructive">
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
              {error}
            </div>
          )}

          <div className="space-y-1">
            <Label className="text-[11px]">Nome do Agendamento</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Ranking PvP semanal"
              className="h-9 text-xs"
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Checkbox
                id="pvp-every-day"
                checked={everyDay}
                onCheckedChange={(v) => setEveryDay(!!v)}
              />
              <Label htmlFor="pvp-every-day" className="cursor-pointer text-[11px]">
                Todos os dias (executar diariamente)
              </Label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {!everyDay && (
                <div className="space-y-1">
                  <Label className="text-[11px]">Dias da Semana</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {PVP_DAY_BUTTONS.map(([d, label]) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() =>
                          setSelectedWeekdays((prev) =>
                            prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort(),
                          )
                        }
                        className={cn(
                          "rounded-lg border px-2 py-1 text-[10px] font-medium transition-all",
                          selectedWeekdays.includes(d)
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border/40 text-muted-foreground hover:border-primary/30",
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className={cn("space-y-1", everyDay && "col-span-2")}>
                <Label className="text-[11px]">Horário ({timezone})</Label>
                <Input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-[11px]">Timezone</Label>
            <Input
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="h-9 text-xs"
            />
          </div>

          <div className="space-y-2 rounded-lg border border-border/40 bg-background/30 p-3">
            <div className="flex items-center gap-3">
              <Switch checked={resetFlag} onCheckedChange={setResetFlag} id="pvp-reset" />
              <Label htmlFor="pvp-reset" className="text-[11px]">
                Resetar ranking após premiação
              </Label>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={resetOnlyOk}
                onCheckedChange={setResetOnlyOk}
                disabled={!resetFlag}
                id="pvp-reset-ok"
              />
              <Label htmlFor="pvp-reset-ok" className="text-[11px]">
                Resetar apenas se tudo der certo
              </Label>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Switch checked={enabled} onCheckedChange={setEnabled} id="pvp-active" />
            <Label htmlFor="pvp-active" className="text-xs">
              Ativo
            </Label>
          </div>

          <p className="rounded-md border border-border/40 bg-muted/20 p-2 text-[10px] text-muted-foreground">
            As recompensas usadas serão as configuradas no topo da página
            ({rewards.length} posições).
          </p>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5">
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            {isEdit ? "Salvar" : "Criar Agendamento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

/* ─── Histórico ─── */

const HistoryList = ({ entries }: { entries: PvpRewardHistoryEntry[] }) => {
  const [open, setOpen] = useState<string | null>(null);
  if (entries.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-border bg-muted/20 p-3 text-center text-sm text-muted-foreground">
        Sem rodadas registradas ainda.
      </p>
    );
  }
  return (
    <div className="space-y-2">
      {entries.map((h, idx) => {
        const id = h.id ?? `${h.executed_at ?? idx}`;
        const isOpen = open === id;
        const operatorName =
          typeof h.operator === "string"
            ? h.operator
            : h.operator?.name ?? h.operator?.email ?? "—";
        return (
          <div key={id} className="rounded-lg border border-border bg-background/40">
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : id)}
              className="flex w-full items-center justify-between gap-3 p-3 text-left text-sm"
            >
              <div className="min-w-0 flex-1">
                <div className="font-semibold">{formatTime(h.executed_at) || "—"}</div>
                <div className="text-xs text-muted-foreground">
                  origem: {h.source ?? "—"} · status:{" "}
                  <span className="font-mono">{h.status ?? "—"}</span> · operador:{" "}
                  {operatorName} · entregues: {h.completed_count ?? 0} · skipped:{" "}
                  {h.skipped_count ?? 0} · reset:{" "}
                  {h.reset_performed ? "sim" : "não"}
                </div>
              </div>
              <ChevronDown
                className={cn(
                  "h-4 w-4 shrink-0 transition-transform",
                  isOpen && "rotate-180",
                )}
              />
            </button>
            {isOpen && (
              <div className="border-t border-border p-3">
                <pre className="overflow-x-auto rounded bg-muted/30 p-2 text-[11px]">
                  {JSON.stringify(
                    {
                      leaderboard: h.leaderboard,
                      results: h.results,
                      reset_result: h.reset_result,
                    },
                    null,
                    2,
                  )}
                </pre>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

/* ─────────── helpers ─────────── */

function humanError(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  return JSON.stringify(e);
}

function formatTime(t: string | number | null | undefined): string {
  if (t == null) return "";
  try {
    const d = typeof t === "number" ? new Date(t * (t < 1e12 ? 1000 : 1)) : new Date(t);
    if (Number.isNaN(d.getTime())) return String(t);
    return d.toLocaleString();
  } catch {
    return String(t);
  }
}

export default RankPvpPage;
