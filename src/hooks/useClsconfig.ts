import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { normalizeClsconfigResponse } from "@/lib/clsconfig";
import type { ClsconfigResponse } from "@/types/clsconfig";

interface State {
  data: ClsconfigResponse | null;
  loading: boolean;
  error: string | null;
}

export function useClsconfig() {
  const [state, setState] = useState<State>({ data: null, loading: true, error: null });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setState((s) => ({ ...s, loading: true, error: null }));
      try {
        const { data, error } = await supabase.functions.invoke("clsconfig-proxy/clsconfig", {
          method: "GET",
        });
        if (error) throw error;
        const normalized = normalizeClsconfigResponse(data);
        if (!cancelled) setState({ data: normalized, loading: false, error: null });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Falha ao carregar clsconfig";
        if (!cancelled) setState({ data: null, loading: false, error: msg });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  return { ...state, reload: () => setReloadKey((k) => k + 1) };
}
