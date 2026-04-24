-- ============================================================
-- mail_templates: templates de recompensas (item / gold)
-- ============================================================
CREATE TABLE public.mail_templates (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_by      uuid NOT NULL,
  name            text NOT NULL,
  description     text,
  -- 'item' = entrega item(ns); 'gold' = entrega moedas/gold
  kind            text NOT NULL CHECK (kind IN ('item','gold')),
  -- Visibilidade igual aos initial_kits
  visibility      text NOT NULL DEFAULT 'server' CHECK (visibility IN ('server','private')),
  -- Assunto/corpo padrão do correio (opcionais — caller pode sobrescrever)
  subject         text,
  body            text,
  -- Payload tipado conforme kind:
  --   kind='item'  → { item_id, count, max_count?, proctype?, expire_date?, mask?, guid1?, guid2?, data? }
  --   kind='gold'  → { amount }  (sempre em "moedas de cobre" — caller pode interpretar)
  payload         jsonb NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_mail_templates_tenant     ON public.mail_templates(tenant_id);
CREATE INDEX idx_mail_templates_created_by ON public.mail_templates(created_by);

ALTER TABLE public.mail_templates ENABLE ROW LEVEL SECURITY;

-- SELECT: membro do tenant + (visibility=server OU dono do template)
CREATE POLICY "Members can view server mail templates"
  ON public.mail_templates
  FOR SELECT TO authenticated
  USING (
    public.is_server_member(tenant_id, auth.uid())
    AND (visibility = 'server' OR (visibility = 'private' AND created_by = auth.uid()))
  );

-- INSERT: precisa manage_kits + created_by=self
CREATE POLICY "Manage kits can create mail templates"
  ON public.mail_templates
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND public.has_server_permission(tenant_id, auth.uid(), 'manage_kits')
  );

-- UPDATE: criador OU manage_kits
CREATE POLICY "Manage kits or owner can update mail templates"
  ON public.mail_templates
  FOR UPDATE TO authenticated
  USING (
    created_by = auth.uid()
    OR public.has_server_permission(tenant_id, auth.uid(), 'manage_kits')
  )
  WITH CHECK (
    created_by = auth.uid()
    OR public.has_server_permission(tenant_id, auth.uid(), 'manage_kits')
  );

-- DELETE: criador OU manage_kits
CREATE POLICY "Manage kits or owner can delete mail templates"
  ON public.mail_templates
  FOR DELETE TO authenticated
  USING (
    created_by = auth.uid()
    OR public.has_server_permission(tenant_id, auth.uid(), 'manage_kits')
  );

-- Trigger updated_at
CREATE TRIGGER mail_templates_updated_at
  BEFORE UPDATE ON public.mail_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- mail_send_log: histórico de envios
-- ============================================================
CREATE TABLE public.mail_send_log (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id           uuid NOT NULL,
  template_id       uuid REFERENCES public.mail_templates(id) ON DELETE SET NULL,
  kind              text NOT NULL CHECK (kind IN ('item','gold')),
  -- Destinatário no jogo
  target_roleid     bigint NOT NULL,
  target_name       text,
  -- Conteúdo enviado (snapshot — não depende do template, que pode mudar/ser excluído)
  subject           text,
  body              text,
  payload           jsonb NOT NULL,
  -- Status do envio:
  --   'success'           → VPS confirmou
  --   'error'             → VPS retornou erro
  --   'endpoint_missing'  → action ainda não implementada na VPS
  --   'pending'           → enviado, sem confirmação (offline?)
  status            text NOT NULL CHECK (status IN ('success','error','endpoint_missing','pending')),
  http_status       integer,
  error_message     text,
  -- Resposta bruta da VPS (best-effort)
  response          jsonb,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_mail_send_log_tenant      ON public.mail_send_log(tenant_id, created_at DESC);
CREATE INDEX idx_mail_send_log_user        ON public.mail_send_log(user_id, created_at DESC);
CREATE INDEX idx_mail_send_log_target      ON public.mail_send_log(target_roleid);
CREATE INDEX idx_mail_send_log_status      ON public.mail_send_log(status);
CREATE INDEX idx_mail_send_log_kind        ON public.mail_send_log(kind);

ALTER TABLE public.mail_send_log ENABLE ROW LEVEL SECURITY;

-- SELECT: ver próprios envios OU view_audit no tenant
CREATE POLICY "View own or audited mail send log"
  ON public.mail_send_log
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_server_permission(tenant_id, auth.uid(), 'view_audit')
  );

-- INSERT: precisa save_real_roles + user_id=self
CREATE POLICY "Save real roles can insert mail send log"
  ON public.mail_send_log
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.has_server_permission(tenant_id, auth.uid(), 'save_real_roles')
  );

-- Sem UPDATE/DELETE: histórico é imutável.
