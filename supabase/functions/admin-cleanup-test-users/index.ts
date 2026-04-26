// Edge function rodada via cron (de hora em hora) para limpar usuários de
// teste expirados. Usa service role: faz purge de dados + remove auth.users.
// Também aceita chamada manual de superadmin.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Lista expirados
    const { data: expired, error: listErr } = await admin
      .from("test_users")
      .select("user_id, email")
      .lte("expires_at", new Date().toISOString());

    if (listErr) return json({ error: listErr.message }, 500);

    const results: Array<{ email: string; status: string; error?: string }> = [];

    for (const row of expired ?? []) {
      try {
        // Purge dados de aplicação. Como a RPC `admin_purge_user_data` exige
        // superadmin via auth.uid(), usamos um delete manual mais leve aqui:
        // apenas remove tenants do dono e a conta auth — test users não
        // costumam acumular muita coisa.
        const { data: tenants } = await admin
          .from("tenants")
          .select("id")
          .eq("owner_id", row.user_id);

        for (const t of tenants ?? []) {
          // Limpeza em cascata via função existente (chama service role direto).
          await admin
            .from("attendance_reward_deliveries").delete().eq("tenant_id", t.id);
          await admin.from("attendance_claims").delete().eq("tenant_id", t.id);
          await admin.from("attendance_events").delete().eq("tenant_id", t.id);
          await admin.from("ingame_reward_deliveries").delete().eq("tenant_id", t.id);
          await admin.from("ingame_winners").delete().eq("tenant_id", t.id);
          await admin.from("ingame_participations").delete().eq("tenant_id", t.id);
          await admin.from("ingame_events").delete().eq("tenant_id", t.id);
          await admin.from("initial_kits").delete().eq("tenant_id", t.id);
          await admin.from("mail_send_log").delete().eq("tenant_id", t.id);
          await admin.from("mail_templates").delete().eq("tenant_id", t.id);
          await admin.from("item_favorites").delete().eq("tenant_id", t.id);
          await admin.from("server_invites").delete().eq("tenant_id", t.id);
          await admin.from("server_members").delete().eq("tenant_id", t.id);
          await admin.from("audit_logs").delete().eq("tenant_id", t.id);
          await admin.from("tenants").delete().eq("id", t.id);
        }

        await admin.from("server_members").delete().eq("user_id", row.user_id);
        await admin.from("subscriptions").delete().eq("user_id", row.user_id);
        await admin.from("user_roles").delete().eq("user_id", row.user_id);
        await admin.from("audit_logs").delete().eq("user_id", row.user_id);
        await admin.from("test_users").delete().eq("user_id", row.user_id);

        const { error: delErr } = await admin.auth.admin.deleteUser(row.user_id);
        if (delErr) {
          results.push({ email: row.email, status: "error", error: delErr.message });
          continue;
        }

        results.push({ email: row.email, status: "deleted" });
      } catch (e) {
        results.push({ email: row.email, status: "error", error: (e as Error).message });
      }
    }

    return json({ ok: true, processed: results.length, results });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
