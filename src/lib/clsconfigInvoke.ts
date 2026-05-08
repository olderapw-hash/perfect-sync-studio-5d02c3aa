// Wrapper único para chamar a edge function `clsconfig-proxy`.
// Garante que TODA chamada inclua o header `x-server-id` com o tenant
// que o usuário escolheu (via /servers). Sem isso, a edge function
// cai pro tenant ativo do owner — o que pode ser inseguro quando o
// usuário convidado está operando um servidor de outra pessoa.
//
// Também trata 401 (sessão expirou) e 403 (permissão negada) de
// forma centralizada via handleMaybeAuthOrForbidden.
import { supabase } from "@/integrations/supabase/client";
import {
  handleMaybeAuthOrForbidden,
  NoServerSelectedError,
} from "@/lib/authErrors";

interface InvokeOptions {
  method?: "GET" | "POST";
  body?: unknown;
  /** Quando true, NÃO exige tenant ativo (ex.: superadmin global). */
  allowNoServer?: boolean;
}

/** Lê o tenant ativo (is_active=true) do user logado. */
async function readActiveTenantId(): Promise<string | null> {
  const { data: session } = await supabase.auth.getSession();
  const uid = session.session?.user?.id;
  if (!uid) return null;
  // 1) tenant onde sou owner e está ativo
  const { data: ownRow } = await supabase
    .from("tenants")
    .select("id")
    .eq("owner_id", uid)
    .eq("is_active", true)
    .maybeSingle();
  if (ownRow?.id) return ownRow.id;
  // 2) qualquer servidor onde sou membro (preferindo o mais recente)
  const { data: memberRow } = await supabase
    .from("server_members")
    .select("tenant_id, updated_at")
    .eq("user_id", uid)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return memberRow?.tenant_id ?? null;
}

/**
 * Chama uma rota do clsconfig-proxy com:
 *  - header `x-server-id` resolvido a partir do tenant ativo;
 *  - tratamento padronizado de 401/403.
 *
 * @throws NoServerSelectedError se não houver tenant ativo (a menos
 *         que `allowNoServer=true`).
 */
export async function invokeClsconfigProxy<T = unknown>(
  path: string,
  opts: InvokeOptions = {},
): Promise<{ data: T | null; error: Error | null; status: number; rawBody: string }> {
  const method = opts.method ?? "GET";

  // Curto-circuito: se a sessão já expirou, evita disparar a edge function
  // (que retornaria 401 e geraria toast + log de erro desnecessário).
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) {
    handleMaybeAuthOrForbidden(new Error("401 Unauthorized: sessão expirada"));
    return {
      data: null,
      error: new Error("Sessão expirada. Faça login novamente."),
      status: 401,
      rawBody: "",
    };
  }

  const tenantId = await readActiveTenantId();
  if (!tenantId && !opts.allowNoServer) {
    throw new NoServerSelectedError();
  }

  const headers: Record<string, string> = {};
  if (tenantId) headers["x-server-id"] = tenantId;

  // Injeta headers do operador para o sistema de permissões da VPS.
  // A VPS resolve o operador via registry real (operators.json).
  const user = sessionData.session.user;
  if (user) {
    headers["x-operator-id"] = user.id;
    headers["x-operator-email"] = user.email ?? "";
    // Nome vem do metadata do perfil (se disponível).
    const name = user.user_metadata?.full_name ?? user.user_metadata?.name ?? "";
    if (name) headers["x-operator-name"] = name;
  }

  // Tenta até 2x quando o runtime do Supabase responde 503
  // (SUPABASE_EDGE_RUNTIME_ERROR — cold start / worker reiniciando).
  let data: unknown = null;
  let error: { message: string; context?: Response } | null = null;
  let status = 0;
  let rawBody = "";

  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await supabase.functions.invoke(path, {
      method,
      body: method === "POST" ? (opts.body ?? {}) : undefined,
      headers,
    });
    data = res.data;
    error = res.error as typeof error;
    status = 0;
    rawBody = "";

    if (!error) break;

    const ctx = (error as unknown as { context?: Response }).context;
    if (ctx) {
      status = ctx.status ?? 0;
      try {
        rawBody = await ctx.text();
      } catch {
        /* ignore */
      }
    }
    // Só faz retry para 503 transitório do runtime
    const isTransient503 =
      status === 503 && /SUPABASE_EDGE_RUNTIME_ERROR|temporarily unavailable/i.test(rawBody);
    if (!isTransient503 || attempt === 1) break;
    await new Promise((r) => setTimeout(r, 600));
  }

  if (error) {
    // Centraliza 401/403 — toast amigável já é mostrado aqui.
    handleMaybeAuthOrForbidden(new Error(`${status} ${rawBody || error.message}`));
    return { data: null, error: error instanceof Error ? error : new Error(String(error)), status, rawBody };
  }

  return { data: data as T, error: null, status: 200, rawBody: "" };
}
