-- Table for scheduled bulk commands (weekly automated rewards)
CREATE TABLE public.gm_bulk_schedules (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL,
  name text NOT NULL,
  command_key text NOT NULL CHECK (command_key IN ('sendMailItem', 'sendMailGold', 'grantMallCash')),
  selection jsonb NOT NULL DEFAULT '{}'::jsonb,
  command_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  day_of_week smallint NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  time_utc text NOT NULL DEFAULT '12:00',
  timezone text NOT NULL DEFAULT 'America/Sao_Paulo',
  is_active boolean NOT NULL DEFAULT true,
  last_run_at timestamptz,
  last_run_status text,
  last_run_job_id text,
  last_error text,
  created_by uuid NOT NULL,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.gm_bulk_schedules ENABLE ROW LEVEL SECURITY;

-- RLS: server members with manage_security can manage schedules
CREATE POLICY "Members with manage_security can view schedules"
  ON public.gm_bulk_schedules FOR SELECT TO authenticated
  USING (public.has_server_permission(tenant_id, auth.uid(), 'manage_security'));

CREATE POLICY "Members with manage_security can create schedules"
  ON public.gm_bulk_schedules FOR INSERT TO authenticated
  WITH CHECK (
    public.has_server_permission(tenant_id, auth.uid(), 'manage_security')
    AND created_by = auth.uid()
  );

CREATE POLICY "Members with manage_security can update schedules"
  ON public.gm_bulk_schedules FOR UPDATE TO authenticated
  USING (public.has_server_permission(tenant_id, auth.uid(), 'manage_security'))
  WITH CHECK (public.has_server_permission(tenant_id, auth.uid(), 'manage_security'));

CREATE POLICY "Members with manage_security can delete schedules"
  ON public.gm_bulk_schedules FOR DELETE TO authenticated
  USING (public.has_server_permission(tenant_id, auth.uid(), 'manage_security'));

-- Service role for the edge function scheduler
CREATE POLICY "Service role manages schedules"
  ON public.gm_bulk_schedules FOR ALL TO public
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Updated at trigger
CREATE TRIGGER update_gm_bulk_schedules_updated_at
  BEFORE UPDATE ON public.gm_bulk_schedules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Index for the scheduler query
CREATE INDEX idx_gm_bulk_schedules_active ON public.gm_bulk_schedules (is_active, day_of_week, time_utc) WHERE is_active = true;