-- Enum de status da entrega de recompensa
CREATE TYPE public.attendance_delivery_status AS ENUM (
  'pending',
  'sent',
  'error',
  'duplicate_blocked'
);

-- =========================================================================
-- attendance_events
-- =========================================================================
CREATE TABLE public.attendance_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_by uuid NOT NULL,
  name text NOT NULL,
  description text,
  status_active boolean NOT NULL DEFAULT true,
  period_start timestamptz,
  period_end timestamptz,
  daily_reset boolean NOT NULL DEFAULT true,
  streak_enabled boolean NOT NULL DEFAULT false,
  timezone text NOT NULL DEFAULT 'America/Sao_Paulo',
  -- payload flexível: { items: [{item_id, count, ...}], gold?: number, subject?, body? }
  reward_payload jsonb NOT NULL DEFAULT '{"items":[]}'::jsonb,
  streak_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_attendance_events_tenant ON public.attendance_events(tenant_id);
CREATE INDEX idx_attendance_events_active ON public.attendance_events(tenant_id, status_active);

CREATE TRIGGER set_updated_at_attendance_events
  BEFORE UPDATE ON public.attendance_events
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.attendance_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view attendance events"
  ON public.attendance_events
  FOR SELECT
  TO authenticated
  USING (public.is_server_member(tenant_id, auth.uid()));

CREATE POLICY "Manage kits can create attendance events"
  ON public.attendance_events
  FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND public.has_server_permission(tenant_id, auth.uid(), 'manage_kits')
  );

CREATE POLICY "Manage kits can update attendance events"
  ON public.attendance_events
  FOR UPDATE
  TO authenticated
  USING (public.has_server_permission(tenant_id, auth.uid(), 'manage_kits'))
  WITH CHECK (public.has_server_permission(tenant_id, auth.uid(), 'manage_kits'));

CREATE POLICY "Manage kits can delete attendance events"
  ON public.attendance_events
  FOR DELETE
  TO authenticated
  USING (public.has_server_permission(tenant_id, auth.uid(), 'manage_kits'));

-- =========================================================================
-- attendance_claims
-- =========================================================================
CREATE TABLE public.attendance_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.attendance_events(id) ON DELETE CASCADE,
  roleid bigint NOT NULL,
  role_name text,
  -- Chave de idempotência: YYYY-MM-DD calculado no fuso do evento
  date_key text NOT NULL,
  claimed_by uuid NOT NULL,
  claimed_at timestamptz NOT NULL DEFAULT now(),
  -- Snapshot da posição na sequência, mesmo sem lógica de streak ativa nesta fase
  streak_count integer NOT NULL DEFAULT 1,
  metadata jsonb,
  CONSTRAINT attendance_claims_unique UNIQUE (event_id, roleid, date_key)
);

CREATE INDEX idx_attendance_claims_tenant ON public.attendance_claims(tenant_id);
CREATE INDEX idx_attendance_claims_event ON public.attendance_claims(event_id);
CREATE INDEX idx_attendance_claims_roleid ON public.attendance_claims(roleid);
CREATE INDEX idx_attendance_claims_date ON public.attendance_claims(event_id, date_key);

ALTER TABLE public.attendance_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view attendance claims"
  ON public.attendance_claims
  FOR SELECT
  TO authenticated
  USING (public.is_server_member(tenant_id, auth.uid()));

CREATE POLICY "Save real roles can register attendance"
  ON public.attendance_claims
  FOR INSERT
  TO authenticated
  WITH CHECK (
    claimed_by = auth.uid()
    AND public.has_server_permission(tenant_id, auth.uid(), 'save_real_roles')
  );

-- =========================================================================
-- attendance_reward_deliveries
-- =========================================================================
CREATE TABLE public.attendance_reward_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.attendance_events(id) ON DELETE CASCADE,
  claim_id uuid REFERENCES public.attendance_claims(id) ON DELETE SET NULL,
  roleid bigint NOT NULL,
  role_name text,
  date_key text NOT NULL,
  status public.attendance_delivery_status NOT NULL DEFAULT 'pending',
  -- Lista de mail_send_log ids gerados (1 entry para cada item / gold enviado)
  mail_log_ids uuid[] NOT NULL DEFAULT ARRAY[]::uuid[],
  reward_snapshot jsonb NOT NULL,
  error_message text,
  delivered_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_attendance_deliveries_tenant ON public.attendance_reward_deliveries(tenant_id);
CREATE INDEX idx_attendance_deliveries_event ON public.attendance_reward_deliveries(event_id);
CREATE INDEX idx_attendance_deliveries_claim ON public.attendance_reward_deliveries(claim_id);

CREATE TRIGGER set_updated_at_attendance_deliveries
  BEFORE UPDATE ON public.attendance_reward_deliveries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.attendance_reward_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view attendance deliveries"
  ON public.attendance_reward_deliveries
  FOR SELECT
  TO authenticated
  USING (public.is_server_member(tenant_id, auth.uid()));

CREATE POLICY "Save real roles can insert attendance deliveries"
  ON public.attendance_reward_deliveries
  FOR INSERT
  TO authenticated
  WITH CHECK (
    delivered_by = auth.uid()
    AND public.has_server_permission(tenant_id, auth.uid(), 'save_real_roles')
  );

CREATE POLICY "Save real roles can update attendance deliveries"
  ON public.attendance_reward_deliveries
  FOR UPDATE
  TO authenticated
  USING (public.has_server_permission(tenant_id, auth.uid(), 'save_real_roles'))
  WITH CHECK (public.has_server_permission(tenant_id, auth.uid(), 'save_real_roles'));