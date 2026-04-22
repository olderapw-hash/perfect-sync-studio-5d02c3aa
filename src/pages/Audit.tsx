// Página /audit — visualização dos audit_logs.
//
// - Usuário comum vê apenas seus próprios logs (RLS já garante via SELECT policy
//   "Users can view own audit logs").
// - Superadmin vê logs de todos (policy "Superadmin can view all audit logs").
// - Filtros: servidor, usuário (apenas superadmin), action, status, período.
// - Click em uma linha abre painel lateral com JSON completo do metadata.
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  Filter,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useServers } from "@/hooks/useServers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

interface AuditRow {
  id: string;
  created_at: string;
  user_id: string;
  tenant_id: string | null;
  action: string;
  target: string | null;
  status: string;
  http_status: number | null;
  error: string | null;
  metadata: Record<string, unknown> | null;
}

type StatusFilter = "all" | "ok" | "error";

const PAGE_SIZE = 100;

const Audit = () => {
  const navigate = useNavigate();
  const { session, loading: authLoading, isAdmin, isSuperadmin } = useAuth();
  const { servers, loading: serversLoading } = useServers();

  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<AuditRow | null>(null);

  // Filtros.
  const [serverId, setServerId] = useState<string>("all");
  const [userIdFilter, setUserIdFilter] = useState<string>("");
  const [actionFilter, setActionFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");

  useEffect(() => {
    if (!authLoading && !session) navigate("/auth", { replace: true });
    if (!authLoading && session && !isAdmin && !isSuperadmin) {
      navigate("/admin", { replace: true });
    }
  }, [authLoading, session, isAdmin, isSuperadmin, navigate]);

  const fetchLogs = async () => {
    setLoading(true);
    let q = supabase
      .from("audit_logs")
      .select(
        "id, created_at, user_id, tenant_id, action, target, status, http_status, error, metadata",
      )
      .order("created_at", { ascending: false })
      .limit(PAGE_SIZE);

    if (serverId !== "all") q = q.eq("tenant_id", serverId);
    if (userIdFilter && isSuperadmin) q = q.eq("user_id", userIdFilter);
    if (actionFilter) q = q.ilike("action", `%${actionFilter}%`);
    if (statusFilter !== "all") q = q.eq("status", statusFilter);
    if (fromDate) q = q.gte("created_at", new Date(fromDate).toISOString());
    if (toDate) {
      const to = new Date(toDate);
      to.setHours(23, 59, 59, 999);
      q = q.lte("created_at", to.toISOString());
    }

    const { data, error } = await q;
    if (error) {
      console.error("audit fetch:", error);
      setRows([]);
    } else {
      setRows((data ?? []) as AuditRow[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!session) return;
    fetchLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, serverId, statusFilter, fromDate, toDate]);

  const serverNameById = useMemo(() => {
    const m = new Map<string, string>();
    servers.forEach((s) => m.set(s.id, s.server_name));
    return m;
  }, [servers]);

  // Extrai roleid do metadata, se presente.
  const extractRoleid = (row: AuditRow): number | null => {
    const md = row.metadata;
    if (!md || typeof md !== "object") return null;
    const m = md as Record<string, unknown>;
    if (typeof m.roleid === "number") return m.roleid;
    if (typeof m.roleid === "string" && /^\d+$/.test(m.roleid)) return Number(m.roleid);
    if (typeof row.target === "string") {
      const match = row.target.match(/roleid[=:](\d+)/i);
      if (match) return Number(match[1]);
    }
    return null;
  };

  const summary = (row: AuditRow): string => {
    if (row.error) return row.error.slice(0, 80);
    const md = row.metadata;
    if (md && typeof md === "object") {
      const m = md as Record<string, unknown>;
      if (typeof m.summary === "string") return m.summary;
      if (typeof m.endpoint === "string") return String(m.endpoint);
    }
    return row.target ?? "—";
  };

  if (authLoading || serversLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60 bg-card/30">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/admin")}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
            </Button>
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/15">
              <ShieldCheck className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h1 className="text-sm font-extrabold uppercase tracking-wider">Auditoria</h1>
              <p className="text-xs text-muted-foreground">
                {isSuperadmin
                  ? "Todos os logs de todos os usuários"
                  : "Suas ações nos seus servidores"}
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={fetchLogs} disabled={loading}>
            {loading ? (
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-3.5 w-3.5" />
            )}
            Atualizar
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">
        {/* Filtros */}
        <section className="mb-4 rounded-xl border border-border bg-card/40 p-4">
          <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            <Filter className="h-3.5 w-3.5" /> Filtros
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3 lg:grid-cols-6">
            <div>
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Servidor
              </Label>
              <Select value={serverId} onValueChange={setServerId}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {servers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.server_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {isSuperadmin && (
              <div>
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Usuário (UUID)
                </Label>
                <Input
                  value={userIdFilter}
                  onChange={(e) => setUserIdFilter(e.target.value)}
                  placeholder="user_id"
                  className="h-9 font-mono text-[11px]"
                  onBlur={fetchLogs}
                />
              </div>
            )}

            <div>
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Action contém
              </Label>
              <Input
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                placeholder="ex: saveRole"
                className="h-9 text-xs"
                onBlur={fetchLogs}
              />
            </div>

            <div>
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Status
              </Label>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="ok">Sucesso</SelectItem>
                  <SelectItem value="error">Erro</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                De
              </Label>
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="h-9 text-xs"
              />
            </div>

            <div>
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Até
              </Label>
              <Input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="h-9 text-xs"
              />
            </div>
          </div>
          <div className="mt-3 flex justify-end">
            <Button size="sm" variant="outline" onClick={fetchLogs}>
              <Search className="mr-2 h-3.5 w-3.5" /> Aplicar
            </Button>
          </div>
        </section>

        {/* Tabela */}
        <section className="overflow-hidden rounded-xl border border-border bg-card/30">
          {loading ? (
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : rows.length === 0 ? (
            <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
              Nenhum log encontrado para esses filtros.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="border-b border-border bg-card/60 text-[10px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left">Data</th>
                    <th className="px-3 py-2 text-left">Servidor</th>
                    {isSuperadmin && <th className="px-3 py-2 text-left">Usuário</th>}
                    <th className="px-3 py-2 text-left">Action</th>
                    <th className="px-3 py-2 text-left">RoleID</th>
                    <th className="px-3 py-2 text-left">Status</th>
                    <th className="px-3 py-2 text-left">Resumo</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const ok = r.status === "ok";
                    const roleid = extractRoleid(r);
                    return (
                      <tr
                        key={r.id}
                        onClick={() => setSelected(r)}
                        className={cn(
                          "cursor-pointer border-b border-border/40 transition-colors hover:bg-card/60",
                          !ok && "bg-destructive/5",
                        )}
                      >
                        <td className="whitespace-nowrap px-3 py-2 font-mono text-[11px] text-muted-foreground">
                          {format(new Date(r.created_at), "yyyy-MM-dd HH:mm:ss")}
                        </td>
                        <td className="px-3 py-2">
                          {r.tenant_id
                            ? serverNameById.get(r.tenant_id) ?? (
                                <span className="font-mono text-[10px] text-muted-foreground">
                                  {r.tenant_id.slice(0, 8)}…
                                </span>
                              )
                            : "—"}
                        </td>
                        {isSuperadmin && (
                          <td className="px-3 py-2 font-mono text-[10px] text-muted-foreground">
                            {r.user_id.slice(0, 8)}…
                          </td>
                        )}
                        <td className="whitespace-nowrap px-3 py-2 font-mono">{r.action}</td>
                        <td className="px-3 py-2 font-mono">
                          {roleid != null ? roleid : "—"}
                        </td>
                        <td className="px-3 py-2">
                          {ok ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-500">
                              <CheckCircle2 className="h-3 w-3" />
                              OK
                              {r.http_status ? ` ${r.http_status}` : ""}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-bold text-destructive">
                              <XCircle className="h-3 w-3" />
                              {r.http_status ?? "ERR"}
                            </span>
                          )}
                        </td>
                        <td className="max-w-[420px] truncate px-3 py-2 text-muted-foreground">
                          {summary(r)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="border-t border-border bg-card/40 px-3 py-2 text-[11px] text-muted-foreground">
                {rows.length} registro(s) · limite {PAGE_SIZE}
              </div>
            </div>
          )}
        </section>
      </main>

      {/* Detalhes JSON */}
      <Sheet open={selected != null} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle className="font-mono text-sm">{selected.action}</SheetTitle>
                <SheetDescription className="text-xs">
                  {format(new Date(selected.created_at), "yyyy-MM-dd HH:mm:ss")} ·{" "}
                  {selected.status === "ok" ? "Sucesso" : "Erro"}
                  {selected.http_status ? ` · HTTP ${selected.http_status}` : ""}
                </SheetDescription>
              </SheetHeader>

              <div className="mt-4 space-y-4 text-xs">
                <Field label="ID" value={selected.id} mono />
                <Field
                  label="Servidor"
                  value={
                    selected.tenant_id
                      ? `${serverNameById.get(selected.tenant_id) ?? selected.tenant_id}`
                      : "—"
                  }
                />
                <Field label="User ID" value={selected.user_id} mono />
                <Field label="Target" value={selected.target ?? "—"} mono />
                {selected.error && (
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-destructive">
                      Erro
                    </div>
                    <pre className="mt-1 whitespace-pre-wrap break-all rounded-md border border-destructive/40 bg-destructive/10 p-3 text-[11px] text-destructive">
                      {selected.error}
                    </pre>
                  </div>
                )}
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Metadata
                  </div>
                  <pre className="mt-1 max-h-[60vh] overflow-auto rounded-md border border-border bg-card/60 p-3 font-mono text-[11px]">
                    {JSON.stringify(selected.metadata ?? {}, null, 2)}
                  </pre>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

const Field = ({ label, value, mono }: { label: string; value: string; mono?: boolean }) => (
  <div>
    <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
      {label}
    </div>
    <div className={cn("mt-0.5 break-all", mono && "font-mono text-[11px]")}>{value}</div>
  </div>
);

export default Audit;
