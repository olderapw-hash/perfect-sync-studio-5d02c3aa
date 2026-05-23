-- account_devices: dispositivos validados por usuário
CREATE TABLE public.account_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  license_id uuid REFERENCES public.licenses(id) ON DELETE SET NULL,
  license_key_masked text,
  device_id text NOT NULL,
  device_label text,
  user_agent text,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  UNIQUE (user_id, device_id)
);

CREATE INDEX idx_account_devices_user ON public.account_devices(user_id) WHERE revoked_at IS NULL;
CREATE INDEX idx_account_devices_license ON public.account_devices(license_id) WHERE revoked_at IS NULL;

ALTER TABLE public.account_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own devices"
  ON public.account_devices FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR has_role(auth.uid(), 'superadmin'::app_role));

CREATE POLICY "Users delete own devices"
  ON public.account_devices FOR DELETE
  TO authenticated
  USING (user_id = auth.uid() OR has_role(auth.uid(), 'superadmin'::app_role));

CREATE POLICY "Service role manages devices"
  ON public.account_devices FOR ALL
  TO public
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- RPC: retorna plano e limite de dispositivos
CREATE OR REPLACE FUNCTION public.get_user_plan_limits(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _plan text;
  _max int;
BEGIN
  SELECT CASE
    WHEN s.is_trial THEN 'trial'
    WHEN s.product_id = 'pw_admin_ultimate' THEN 'ultimate'
    WHEN s.product_id IN ('pw_admin_pro','pw_admin') THEN 'pro'
    ELSE 'free'
  END INTO _plan
  FROM public.subscriptions s
  WHERE s.user_id = _user_id
    AND s.status IN ('active','trialing')
    AND (s.current_period_end IS NULL OR s.current_period_end > now())
  ORDER BY s.created_at DESC
  LIMIT 1;

  IF _plan IS NULL THEN _plan := 'free'; END IF;

  -- Superadmin → ilimitado
  IF public.has_role(_user_id, 'superadmin'::app_role) THEN
    _plan := 'ultimate';
  END IF;

  _max := CASE _plan
    WHEN 'ultimate' THEN 999
    WHEN 'pro' THEN 3
    ELSE 1
  END;

  RETURN jsonb_build_object('plan', _plan, 'max_devices', _max);
END;
$$;