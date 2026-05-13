// GM Commander v3 — Broadcast agendado / campanha de anúncio
//
// Endpoint REAL: POST /apicls/api_cls.php?action=queueBroadcastMessage
// O backend é a única fonte de verdade — não persistimos nada localmente.
// `style` ainda não é funcional no protocolo (apenas metadado).
import { useState } from "react";
import { CalendarClock, Loader2, Megaphone, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useOperatorPermissions } from "@/hooks/useOperatorPermissions";
import { cn } from "@/lib/utils";
import {
  pwApi,
  type QueueBroadcastMessagePayload,
  type QueueBroadcastMessageResponse,
} from "@/lib/pwApiActions";

export function BroadcastScheduleTab() {
  const { canAction, loading: permLoading } = useOperatorPermissions();
  const can = canAction("queueBroadcastMessage");

  const [message, setMessage] = useState("");
  const [kind, setKind] = useState("system");
  const [priority, setPriority] = useState("normal");
  // Backend exige `channel` numérico entre 1 e 255 — default seguro = 1 (global).
  const [channel, setChannel] = useState<string>("1");
  const [style, setStyle] = useState("");
  const [repeatCount, setRepeatCount] = useState("1");
  const [repeatInterval, setRepeatInterval] = useState("");
  const [scheduleAt, setScheduleAt] = useState("");

  const [busy, setBusy] = useState<"none" | "preview" | "submit">("none");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<QueueBroadcastMessageResponse | null>(null);
  const [resultKind, setResultKind] = useState<"preview" | "submit" | null>(null);

  const channelNumber = (() => {
    const n = Number(channel.trim());
    if (!Number.isFinite(n) || !Number.isInteger(n)) return null;
    if (n < 1 || n > 255) return null;
    return n;
  })();
  const channelInvalid = channel.trim() !== "" && channelNumber == null;

  const buildPayload = (dryRun: boolean): QueueBroadcastMessagePayload | null => {
    if (!message.trim()) return null;
    if (channelInvalid) return null;
    const payload: QueueBroadcastMessagePayload = { message: message.trim() };
    if (kind.trim()) payload.kind = kind.trim();
    if (priority.trim()) payload.priority = priority.trim();
    if (channelNumber != null) payload.channel = channelNumber;
    if (style.trim()) payload.style = style.trim();
    if (repeatCount.trim()) {
      const n = Number(repeatCount.trim());
      if (Number.isFinite(n) && n > 0) payload.repeat_count = n;
    }
    if (repeatInterval.trim()) {
      const n = Number(repeatInterval.trim());
      if (Number.isFinite(n) && n > 0) payload.repeat_interval_seconds = n;
    }
    if (scheduleAt.trim()) payload.schedule_at = scheduleAt.trim();
    if (dryRun) payload.dry_run = true;
    return payload;
  };

  const submit = async (dryRun: boolean) => {
    const payload = buildPayload(dryRun);
    if (!payload) return;
    setBusy(dryRun ? "preview" : "submit");
    setError(null);
    setResult(null);
    setResultKind(dryRun ? "preview" : "submit");
    try {
      const res = await pwApi.queueBroadcastMessage(payload);
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy("none");
    }
  };

  return (
    <div className="space-y-4">
      <Card className="border-border/50 bg-card/40 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Megaphone className="h-4 w-4 text-primary" />
            <CardTitle className="text-base font-bold">Broadcast agendado</CardTitle>
          </div>
          <p className="text-xs text-muted-foreground">
            Cria uma campanha de mensagens via <code>queueBroadcastMessage</code>.
            Use <strong>Simular</strong> para validar (dry_run) sem enfileirar jobs.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label className="text-xs">Mensagem</Label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              placeholder="Texto que será exibido aos jogadores"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label className="text-xs">kind</Label>
              <Input value={kind} onChange={(e) => setKind(e.target.value)} placeholder="system" />
            </div>
            <div>
              <Label className="text-xs">priority</Label>
              <Input value={priority} onChange={(e) => setPriority(e.target.value)} placeholder="normal" />
            </div>
            <div>
              <Label className="text-xs">channel</Label>
              <Input value={channel} onChange={(e) => setChannel(e.target.value)} placeholder="global" />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label className="text-xs">repeat_count</Label>
              <Input
                value={repeatCount}
                onChange={(e) => setRepeatCount(e.target.value)}
                inputMode="numeric"
                placeholder="1"
              />
            </div>
            <div>
              <Label className="text-xs">repeat_interval_seconds</Label>
              <Input
                value={repeatInterval}
                onChange={(e) => setRepeatInterval(e.target.value)}
                inputMode="numeric"
                placeholder="ex: 600"
              />
            </div>
            <div>
              <Label className="text-xs">schedule_at (ISO)</Label>
              <Input
                value={scheduleAt}
                onChange={(e) => setScheduleAt(e.target.value)}
                placeholder="2026-05-12T20:00:00Z"
              />
            </div>
          </div>
          <div>
            <Label className="text-xs">
              style{" "}
              <Badge variant="outline" className="ml-1 border-amber-500/40 text-[9px] uppercase text-amber-400">
                metadado — não funcional
              </Badge>
            </Label>
            <Input value={style} onChange={(e) => setStyle(e.target.value)} placeholder="(opcional)" />
            <p className="mt-1 text-[10px] text-muted-foreground">
              O protocolo atual ainda não interpreta <code>style</code>. Será enviado como metadado para auditoria.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => void submit(true)}
              disabled={permLoading || !can || busy !== "none" || !message.trim()}
            >
              {busy === "preview" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Simular
            </Button>
            <Button
              onClick={() => void submit(false)}
              disabled={permLoading || !can || busy !== "none" || !message.trim()}
            >
              {busy === "submit" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Agendar
            </Button>
            {!can && !permLoading && (
              <span className="text-[11px] text-amber-400">
                Operador sem permissão de broadcast.
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {(result || error) && (
        <Card className={cn("border-border/50 bg-card/40 backdrop-blur-sm", error && "border-destructive/40 bg-destructive/5")}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold">
              {error
                ? "Erro retornado pela VPS"
                : resultKind === "preview"
                  ? "Simulação"
                  : "Campanha agendada"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            {error && <div className="text-destructive">{error}</div>}
            {result && <BroadcastResultView result={result} />}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function BroadcastResultView({ result }: { result: QueueBroadcastMessageResponse }) {
  return (
    <div className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-2">
        <Field label="campaign_id" value={result.campaign_id} />
        <Field label="dry_run" value={String(result.dry_run ?? false)} />
        <Field label="repeat_count" value={result.repeat_count} />
        <Field label="repeat_interval_seconds" value={result.repeat_interval_seconds} />
        <Field label="schedule_at" value={result.schedule_at} />
        <Field label="schedule_timezone" value={result.schedule_timezone} />
        <Field label="not_before_at" value={result.not_before_at} />
      </div>
      {result.warnings && result.warnings.length > 0 && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-2 text-amber-400">
          {result.warnings.map((w, i) => (
            <div key={i} className="flex items-start gap-1.5">
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
              <span>{w}</span>
            </div>
          ))}
        </div>
      )}
      {result.jobs && result.jobs.length > 0 && (
        <div className="rounded-lg border border-border/40 bg-background/40 p-2">
          <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            <CalendarClock className="h-3 w-3" />
            {result.jobs.length} job(s) planejado(s)
          </div>
          <div className="space-y-1">
            {result.jobs.map((j, i) => (
              <div
                key={j.job_id ?? i}
                className="flex flex-wrap items-center justify-between gap-2 rounded border border-border/30 bg-card/40 px-2 py-1 text-[11px]"
              >
                <span className="font-mono text-muted-foreground">#{j.index ?? i + 1}</span>
                {j.job_id && <span className="font-mono">{j.job_id}</span>}
                {j.schedule_at && <span>{j.schedule_at}</span>}
                {j.not_before_at && (
                  <span className="text-muted-foreground">not_before: {j.not_before_at}</span>
                )}
                {j.status && <Badge variant="outline">{j.status}</Badge>}
              </div>
            ))}
          </div>
        </div>
      )}
      {result.context && Object.keys(result.context).length > 0 && (
        <pre className="max-h-40 overflow-auto rounded bg-muted/30 p-2 text-[10px]">
          {JSON.stringify(result.context, null, 2)}
        </pre>
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
