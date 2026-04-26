-- Tabela para rastrear usuários de teste criados pelo superadmin
-- com expiração automática.
CREATE TABLE public.test_users (
  user_id uuid PRIMARY KEY,
  email text NOT NULL,
  plan text NOT NULL CHECK (plan IN ('free','pro','ultimate')),
  expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid NOT NULL
);

CREATE INDEX idx_test_users_expires_at ON public.test_users(expires_at);

ALTER TABLE public.test_users ENABLE ROW LEVEL SECURITY;

-- Apenas superadmin pode listar/gerenciar
CREATE POLICY "Superadmin can view test users"
  ON public.test_users FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin'::app_role));

-- Service role gerencia inserts/deletes (via edge functions)
CREATE POLICY "Service role manages test users"
  ON public.test_users FOR ALL TO public
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- RPC: registrar metadados do test user (chamada pela edge function com service role).
-- Mantemos como SECURITY DEFINER pra ser chamada pelo edge consistente com o resto.
CREATE OR REPLACE FUNCTION public.admin_register_test_user(
  _user_id uuid,
  _email text,
  _plan text,
  _expires_at timestamp with time zone,
  _created_by uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.test_users (user_id, email, plan, expires_at, created_by)
  VALUES (_user_id, _email, _plan, _expires_at, _created_by);

  -- Aplica plano via função existente (free apenas registra sem subscription).
  IF _plan IN ('pro','ultimate') THEN
    PERFORM public.admin_set_user_plan(_user_id, _plan, _expires_at, 'live');
  END IF;
END;
$$;

-- RPC: lista test users ativos para a UI (já junta com expires_at).
CREATE OR REPLACE FUNCTION public.admin_list_test_users()
RETURNS TABLE(
  user_id uuid,
  email text,
  plan text,
  expires_at timestamp with time zone,
  created_at timestamp with time zone,
  is_expired boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'superadmin'::app_role) THEN
    RAISE EXCEPTION 'Access denied: superadmin only';
  END IF;

  RETURN QUERY
  SELECT
    t.user_id,
    t.email,
    t.plan,
    t.expires_at,
    t.created_at,
    (t.expires_at <= now()) AS is_expired
  FROM public.test_users t
  ORDER BY t.expires_at ASC;
END;
$$;