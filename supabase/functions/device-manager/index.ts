// Device validation & management for license enforcement per browser.
// Actions: check | register | revoke | list_all (superadmin)
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PLAN_LIMITS: Record<string, number> = {
  free: 1,
  trial: 1,
  pro: 3,
  ultimate: 999,
};

function mask(s: string | null | undefined, keep = 4): string {
  if (!s) return "—";
  if (s.length <= keep * 2) return s;
  return s.slice(0, keep) + "…" + s.slice(-keep);
}

function clientIp(req: Request): string | null {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-real-ip") ||
    null
  );
}

function labelFromUA(ua: string | null): string {
  if (!ua) return "Dispositivo desconhecido";
  const browser =
    /Edg\//.test(ua) ? "Edge" :
    /Chrome\//.test(ua) ? "Chrome" :
    /Firefox\//.test(ua) ? "Firefox" :
    /Safari\//.test(ua) ? "Safari" : "Navegador";
  const os =
    /Windows/.test(ua) ? "Windows" :
    /Mac OS X|Macintosh/.test(ua) ? "macOS" :
    /Android/.test(ua) ? "Android" :
    /iPhone|iPad|iOS/.test(ua) ? "iOS" :
    /Linux/.test(ua) ? "Linux" : "OS";
  return `${browser} em ${os}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";

    // Identify user via their JWT
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;
    const admin = createClient(supabaseUrl, serviceKey);

    const body = await req.json().catch(() => ({}));
    const action = body?.action as string;

    // Plan/limit lookup
    const { data: planData } = await admin.rpc("get_user_plan_limits", { _user_id: userId });
    const plan = (planData?.plan as string) ?? "free";
    const maxDevices = PLAN_LIMITS[plan] ?? 1;

    // Superadmin check
    const { data: isSuperadminData } = await admin.rpc("has_role", {
      _user_id: userId,
      _role: "superadmin",
    });
    const isSuperadmin = !!isSuperadminData;

    /* ─────────── ACTIONS ─────────── */

    if (action === "check") {
      const deviceId = String(body.device_id ?? "");
      if (!deviceId) return json({ error: "device_id required" }, 400);

      const { data: existing } = await admin
        .from("account_devices")
        .select("id, revoked_at")
        .eq("user_id", userId)
        .eq("device_id", deviceId)
        .maybeSingle();

      if (existing && !existing.revoked_at) {
        // Bump last_seen
        await admin
          .from("account_devices")
          .update({ last_seen_at: new Date().toISOString(), ip_address: clientIp(req) })
          .eq("id", existing.id);
        return json({ status: "ok", plan, max_devices: maxDevices });
      }

      // Needs validation → return license token & current active count
      const { data: license } = await admin
        .from("licenses")
        .select("license_key, vps_activation_token")
        .or(`created_by.eq.${userId},client_email.eq.${userData.user.email ?? ""}`)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const { data: activeDevices } = await admin
        .from("account_devices")
        .select("id, device_id, device_label, last_seen_at")
        .eq("user_id", userId)
        .is("revoked_at", null);

      return json({
        status: "needs_validation",
        plan,
        max_devices: maxDevices,
        devices_count: activeDevices?.length ?? 0,
        license_token: license?.vps_activation_token ?? license?.license_key ?? null,
        active_devices: activeDevices ?? [],
      });
    }

    if (action === "register") {
      const deviceId = String(body.device_id ?? "");
      const licenseKey = String(body.license_key ?? "").trim();
      if (!deviceId || !licenseKey) return json({ error: "device_id e license_key obrigatórios" }, 400);

      // Validate token belongs to this user OR is a global active license
      const { data: license } = await admin
        .from("licenses")
        .select("id, status, expires_at, vps_activation_token, license_key, created_by, client_email")
        .or(`license_key.eq.${licenseKey},vps_activation_token.eq.${licenseKey}`)
        .maybeSingle();

      if (!license) return json({ error: "Token de licença inválido." }, 400);
      if (license.status !== "active") return json({ error: `Licença ${license.status}.` }, 400);
      if (license.expires_at && new Date(license.expires_at) < new Date()) {
        return json({ error: "Licença expirada." }, 400);
      }

      // Must belong to current user
      const belongs =
        license.created_by === userId ||
        (license.client_email && license.client_email === userData.user.email);
      if (!belongs && !isSuperadmin) {
        return json({ error: "Este token de licença não pertence à sua conta." }, 403);
      }

      // Enforce device limit (count non-revoked)
      const { data: activeDevices } = await admin
        .from("account_devices")
        .select("id, device_id, device_label, last_seen_at, ip_address")
        .eq("user_id", userId)
        .is("revoked_at", null);

      const isAlready = activeDevices?.some((d) => d.device_id === deviceId);
      if (!isAlready && (activeDevices?.length ?? 0) >= maxDevices) {
        return json(
          {
            error: "device_limit_reached",
            message: `Limite de ${maxDevices} dispositivo(s) atingido para o plano ${plan}. Revogue um dispositivo antes.`,
            max_devices: maxDevices,
            plan,
            active_devices: activeDevices ?? [],
          },
          409,
        );
      }

      const ua = req.headers.get("user-agent");
      const ip = clientIp(req);

      const row = {
        user_id: userId,
        device_id: deviceId,
        license_id: license.id,
        license_key_masked: mask(licenseKey),
        device_label: String(body.label ?? "").trim() || labelFromUA(ua),
        user_agent: ua,
        ip_address: ip,
        last_seen_at: new Date().toISOString(),
        revoked_at: null,
      };

      const { error: upErr } = await admin
        .from("account_devices")
        .upsert(row, { onConflict: "user_id,device_id" });
      if (upErr) return json({ error: upErr.message }, 500);

      return json({ status: "ok", plan, max_devices: maxDevices });
    }

    if (action === "revoke") {
      const deviceRowId = String(body.id ?? "");
      if (!deviceRowId) return json({ error: "id required" }, 400);

      // Confirm ownership unless superadmin
      const { data: row } = await admin
        .from("account_devices")
        .select("id, user_id")
        .eq("id", deviceRowId)
        .maybeSingle();
      if (!row) return json({ error: "Dispositivo não encontrado." }, 404);
      if (row.user_id !== userId && !isSuperadmin) {
        return json({ error: "forbidden" }, 403);
      }

      const { error: delErr } = await admin
        .from("account_devices")
        .delete()
        .eq("id", deviceRowId);
      if (delErr) return json({ error: delErr.message }, 500);

      return json({ status: "ok" });
    }

    if (action === "list_mine") {
      const { data } = await admin
        .from("account_devices")
        .select("*")
        .eq("user_id", userId)
        .is("revoked_at", null)
        .order("last_seen_at", { ascending: false });
      return json({ devices: data ?? [], plan, max_devices: maxDevices });
    }

    if (action === "list_all") {
      if (!isSuperadmin) return json({ error: "forbidden" }, 403);
      const { data } = await admin
        .from("account_devices")
        .select("*, license:license_id(client_name, client_email, plan, license_key)")
        .is("revoked_at", null)
        .order("last_seen_at", { ascending: false });
      return json({ devices: data ?? [] });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    console.error("device-manager error:", e);
    return json({ error: e instanceof Error ? e.message : "server_error" }, 500);
  }

  function json(payload: unknown, status = 200) {
    return new Response(JSON.stringify(payload), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
