import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getDeviceId } from "@/hooks/useDeviceId";
import { useAuth } from "@/hooks/useAuth";

export interface AccountDevice {
  id: string;
  device_id: string;
  device_label: string | null;
  user_agent: string | null;
  ip_address: string | null;
  last_seen_at: string;
  created_at: string;
  license_key_masked: string | null;
  license_id?: string | null;
  user_id?: string;
  license?: {
    client_name?: string | null;
    client_email?: string | null;
    plan?: string | null;
    license_key?: string | null;
  } | null;
}

interface CheckResult {
  status: "ok" | "needs_validation";
  plan: string;
  max_devices: number;
  devices_count?: number;
  license_token?: string | null;
  active_devices?: AccountDevice[];
}

/** Calls device-manager edge function and returns whether this browser is validated. */
export function useDeviceValidation() {
  const { user, loading } = useAuth();
  const [result, setResult] = useState<CheckResult | null>(null);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const check = useCallback(async () => {
    if (!user) {
      setChecking(false);
      return;
    }
    setChecking(true);
    setError(null);
    try {
      const { data, error: invErr } = await supabase.functions.invoke("device-manager", {
        body: { action: "check", device_id: getDeviceId() },
      });
      if (invErr) throw invErr;
      setResult(data as CheckResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao verificar dispositivo.");
    } finally {
      setChecking(false);
    }
  }, [user]);

  useEffect(() => {
    if (!loading) check();
  }, [loading, check]);

  return { result, checking, error, recheck: check };
}

/** Lists devices (own or all if superadmin). */
export function useAccountDevices(scope: "mine" | "all" = "mine") {
  const [devices, setDevices] = useState<AccountDevice[]>([]);
  const [plan, setPlan] = useState<string>("free");
  const [maxDevices, setMaxDevices] = useState<number>(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: invErr } = await supabase.functions.invoke("device-manager", {
        body: { action: scope === "all" ? "list_all" : "list_mine" },
      });
      if (invErr) throw invErr;
      setDevices((data?.devices ?? []) as AccountDevice[]);
      if (data?.plan) setPlan(data.plan);
      if (data?.max_devices) setMaxDevices(data.max_devices);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar dispositivos.");
    } finally {
      setLoading(false);
    }
  }, [scope]);

  useEffect(() => {
    reload();
  }, [reload]);

  const revoke = useCallback(
    async (id: string) => {
      const { error: invErr } = await supabase.functions.invoke("device-manager", {
        body: { action: "revoke", id },
      });
      if (invErr) throw invErr;
      await reload();
    },
    [reload],
  );

  return { devices, plan, maxDevices, loading, error, reload, revoke };
}

/** Registers the current browser with a license token. */
export async function registerCurrentDevice(licenseKey: string, label?: string) {
  const { data, error } = await supabase.functions.invoke("device-manager", {
    body: {
      action: "register",
      device_id: getDeviceId(),
      license_key: licenseKey,
      label,
    },
  });
  if (error) {
    // edge function returns 4xx with json body in error.context.body
    let msg = error.message || "Erro ao registrar dispositivo.";
    try {
      const body = await (error as { context?: { body?: unknown } }).context?.body;
      if (body && typeof body === "object" && "message" in body) {
        msg = String((body as { message?: string }).message ?? msg);
      }
    } catch { /* ignore */ }
    throw new Error(msg);
  }
  return data;
}
