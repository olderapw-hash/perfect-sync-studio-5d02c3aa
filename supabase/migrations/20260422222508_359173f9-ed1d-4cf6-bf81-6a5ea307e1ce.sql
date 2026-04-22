-- ============================================================
-- 1) ENUM de papéis dentro de um servidor
-- ============================================================
DO $$ BEGIN
  CREATE TYPE public.server_role AS ENUM ('owner', 'admin', 'editor', 'readonly');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 2) Defaults centralizados (usados pelo trigger e pelo helper)
-- ============================================================
CREATE OR REPLACE FUNCTION public.default_permissions_for_role(_role public.server_role)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE _role
    WHEN 'owner' THEN jsonb_build_object(
      'view', true,
      'save_templates', true,
      'save_real_roles', true,
      'restore_backup', true,
      'compare_backup', true,
      'clear_sections', true,
      'bulk_apply', true,
      'manage_servers', true,
      'view_audit', true,
      'manage_members', true
    )
    WHEN 'admin' THEN jsonb_build_object(
      'view', true,
      'save_templates', true,
      'save_real_roles', true,
      'restore_backup', true,
      'compare_backup', true,
      'clear_sections', true,
      'bulk_apply', true,
      'manage_servers', false,
      'view_audit', true,
      'manage_members', false
    )
    WHEN 'editor' THEN jsonb_build_object(
      'view', true,
      'save_templates', true,
      'save_real_roles', false,
      'restore_backup', false,
      'compare_backup', true,
      'clear_sections', true,
      'bulk_apply', false,
      'manage_servers', false,
      'view_audit', true,
      'manage_members', false
    )
    WHEN 'readonly' THEN jsonb_build_object(
      'view', true,
      'save_templates', false,
      'save_real_roles', false,
      'restore_backup', false,
      'compare_backup', true,
      'clear_sections', false,
      'bulk_apply', false,
      'manage_servers', false,
      'view_audit', false,
      'manage_members', false
    )
  END;
$$;

-- ============================================================
-- 3) server_members
-- ============================================================
CREATE TABLE IF NOT EXISTS public.server_members (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL,
  role        public.server_role NOT NULL DEFAULT 'editor',
  permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, user_id)
);

CREATE INDEX IF NOT EXISTS server_members_user_id_idx
  ON public.server_members (user_id);
CREATE INDEX IF NOT EXISTS server_members_tenant_id_idx
  ON public.server_members (tenant_id);

ALTER TABLE public.server_members ENABLE ROW LEVEL SECURITY;

-- updated_at automático (reaproveita a função pública existente)
DROP TRIGGER IF EXISTS server_members_set_updated_at ON public.server_members;
CREATE TRIGGER server_members_set_updated_at
  BEFORE UPDATE ON public.server_members
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 4) Helpers SECURITY DEFINER (evita recursão de RLS)
-- ============================================================
-- É membro do servidor?
CREATE OR REPLACE FUNCTION public.is_server_member(_tenant_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.server_members
    WHERE tenant_id = _tenant_id AND user_id = _user_id
  )
  OR EXISTS (
    -- Owner do tenant é sempre membro mesmo antes do trigger rodar
    SELECT 1 FROM public.tenants
    WHERE id = _tenant_id AND owner_id = _user_id
  );
$$;

-- Tem permissão específica neste servidor? Owner tem tudo.
CREATE OR REPLACE FUNCTION public.has_server_permission(
  _tenant_id uuid,
  _user_id uuid,
  _permission text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _is_owner boolean;
  _perms jsonb;
BEGIN
  SELECT (owner_id = _user_id) INTO _is_owner
    FROM public.tenants WHERE id = _tenant_id;
  IF _is_owner THEN
    RETURN true;
  END IF;

  SELECT permissions INTO _perms
    FROM public.server_members
   WHERE tenant_id = _tenant_id AND user_id = _user_id;

  IF _perms IS NULL THEN
    RETURN false;
  END IF;

  RETURN COALESCE((_perms ->> _permission)::boolean, false);
END;
$$;

-- Devolve role + permissions efetivas pra UI (jsonb).
CREATE OR REPLACE FUNCTION public.get_my_server_permissions(_tenant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _is_owner boolean;
  _row record;
BEGIN
  SELECT (owner_id = auth.uid()) INTO _is_owner
    FROM public.tenants WHERE id = _tenant_id;

  IF _is_owner THEN
    RETURN jsonb_build_object(
      'role', 'owner',
      'permissions', public.default_permissions_for_role('owner')
    );
  END IF;

  SELECT role, permissions INTO _row
    FROM public.server_members
   WHERE tenant_id = _tenant_id AND user_id = auth.uid();

  IF _row IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object('role', _row.role, 'permissions', _row.permissions);
END;
$$;

-- ============================================================
-- 5) RLS de server_members
-- ============================================================
DROP POLICY IF EXISTS "Members can view co-members"   ON public.server_members;
DROP POLICY IF EXISTS "Manage members can insert"    ON public.server_members;
DROP POLICY IF EXISTS "Manage members can update"    ON public.server_members;
DROP POLICY IF EXISTS "Manage members can delete"    ON public.server_members;
DROP POLICY IF EXISTS "Service role manages members" ON public.server_members;

CREATE POLICY "Members can view co-members"
  ON public.server_members FOR SELECT
  TO authenticated
  USING (public.is_server_member(tenant_id, auth.uid()));

CREATE POLICY "Manage members can insert"
  ON public.server_members FOR INSERT
  TO authenticated
  WITH CHECK (public.has_server_permission(tenant_id, auth.uid(), 'manage_members'));

CREATE POLICY "Manage members can update"
  ON public.server_members FOR UPDATE
  TO authenticated
  USING (public.has_server_permission(tenant_id, auth.uid(), 'manage_members'))
  WITH CHECK (public.has_server_permission(tenant_id, auth.uid(), 'manage_members'));

CREATE POLICY "Manage members can delete"
  ON public.server_members FOR DELETE
  TO authenticated
  USING (
    public.has_server_permission(tenant_id, auth.uid(), 'manage_members')
    -- Owner não pode ser removido por essa via; remoção do owner =
    -- transferência (TODO próxima rodada).
    AND role <> 'owner'
  );

CREATE POLICY "Service role manages members"
  ON public.server_members FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- 6) Trigger: ao criar um tenant, criar a membership do owner.
--    (Idempotente — funciona pra tenants já existentes via backfill abaixo.)
-- ============================================================
CREATE OR REPLACE FUNCTION public.tenants_create_owner_membership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.server_members (tenant_id, user_id, role, permissions)
  VALUES (
    NEW.id,
    NEW.owner_id,
    'owner'::public.server_role,
    public.default_permissions_for_role('owner')
  )
  ON CONFLICT (tenant_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tenants_create_owner_membership ON public.tenants;
CREATE TRIGGER tenants_create_owner_membership
  AFTER INSERT ON public.tenants
  FOR EACH ROW
  EXECUTE FUNCTION public.tenants_create_owner_membership();

-- Backfill: cria memberships de owner para tenants já existentes.
INSERT INTO public.server_members (tenant_id, user_id, role, permissions)
SELECT t.id, t.owner_id, 'owner'::public.server_role,
       public.default_permissions_for_role('owner')
  FROM public.tenants t
ON CONFLICT (tenant_id, user_id) DO NOTHING;

-- ============================================================
-- 7) server_invites — convites pendentes
-- ============================================================
DO $$ BEGIN
  CREATE TYPE public.invite_status AS ENUM ('pending', 'accepted', 'revoked', 'expired');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.server_invites (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  email       text NOT NULL,
  role        public.server_role NOT NULL DEFAULT 'editor',
  permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
  status      public.invite_status NOT NULL DEFAULT 'pending',
  invited_by  uuid NOT NULL,
  invited_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  accepted_at timestamptz,
  accepted_by uuid
);

CREATE UNIQUE INDEX IF NOT EXISTS server_invites_pending_unique
  ON public.server_invites (tenant_id, lower(email))
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS server_invites_email_idx
  ON public.server_invites (lower(email));

ALTER TABLE public.server_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Manage members can read invites"   ON public.server_invites;
DROP POLICY IF EXISTS "Manage members can insert invites" ON public.server_invites;
DROP POLICY IF EXISTS "Manage members can revoke invites" ON public.server_invites;
DROP POLICY IF EXISTS "Invitee can read own invites"      ON public.server_invites;
DROP POLICY IF EXISTS "Service role manages invites"      ON public.server_invites;

-- Quem gerencia membros vê os convites do servidor
CREATE POLICY "Manage members can read invites"
  ON public.server_invites FOR SELECT
  TO authenticated
  USING (public.has_server_permission(tenant_id, auth.uid(), 'manage_members'));

-- Quem é o destinatário pode ver os próprios convites pendentes
CREATE POLICY "Invitee can read own invites"
  ON public.server_invites FOR SELECT
  TO authenticated
  USING (
    status = 'pending'
    AND lower(email) = lower(COALESCE((auth.jwt() ->> 'email')::text, ''))
  );

CREATE POLICY "Manage members can insert invites"
  ON public.server_invites FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_server_permission(tenant_id, auth.uid(), 'manage_members')
    AND invited_by = auth.uid()
  );

-- Update apenas para revogar (quem gerencia) ou aceitar (RPC abaixo via service definer)
CREATE POLICY "Manage members can revoke invites"
  ON public.server_invites FOR UPDATE
  TO authenticated
  USING (public.has_server_permission(tenant_id, auth.uid(), 'manage_members'))
  WITH CHECK (public.has_server_permission(tenant_id, auth.uid(), 'manage_members'));

CREATE POLICY "Service role manages invites"
  ON public.server_invites FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- 8) RPC: criar convite (valida permissão e normaliza defaults)
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_server_invite(
  _tenant_id uuid,
  _email text,
  _role public.server_role
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.has_server_permission(_tenant_id, auth.uid(), 'manage_members') THEN
    RAISE EXCEPTION 'Permission denied: manage_members';
  END IF;
  IF _role = 'owner' THEN
    RAISE EXCEPTION 'Cannot invite as owner; use ownership transfer';
  END IF;

  INSERT INTO public.server_invites (tenant_id, email, role, permissions, invited_by)
  VALUES (
    _tenant_id,
    lower(trim(_email)),
    _role,
    public.default_permissions_for_role(_role),
    auth.uid()
  )
  ON CONFLICT (tenant_id, lower(email)) WHERE status = 'pending'
  DO UPDATE SET role = EXCLUDED.role,
                permissions = EXCLUDED.permissions,
                invited_by = EXCLUDED.invited_by,
                invited_at = now(),
                expires_at = now() + interval '14 days'
  RETURNING id INTO _id;

  RETURN _id;
END;
$$;

-- ============================================================
-- 9) RPC: aceitar convite (chamada pelo convidado logado)
-- ============================================================
CREATE OR REPLACE FUNCTION public.accept_server_invite(_invite_id uuid)
RETURNS uuid  -- tenant_id resultante
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _email text;
  _inv record;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT lower(COALESCE((auth.jwt() ->> 'email')::text, '')) INTO _email;

  SELECT * INTO _inv
    FROM public.server_invites
   WHERE id = _invite_id
     AND status = 'pending'
     AND lower(email) = _email
     AND expires_at > now()
   FOR UPDATE;

  IF _inv IS NULL THEN
    RAISE EXCEPTION 'Invite not found, expired or for another email';
  END IF;

  INSERT INTO public.server_members (tenant_id, user_id, role, permissions)
  VALUES (_inv.tenant_id, auth.uid(), _inv.role, _inv.permissions)
  ON CONFLICT (tenant_id, user_id)
  DO UPDATE SET role = EXCLUDED.role,
                permissions = EXCLUDED.permissions;

  UPDATE public.server_invites
     SET status = 'accepted',
         accepted_at = now(),
         accepted_by = auth.uid()
   WHERE id = _invite_id;

  RETURN _inv.tenant_id;
END;
$$;

-- ============================================================
-- 10) Grants
-- ============================================================
GRANT EXECUTE ON FUNCTION public.is_server_member(uuid, uuid)               TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_server_permission(uuid, uuid, text)     TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_server_permissions(uuid)             TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_server_invite(uuid, text, public.server_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_server_invite(uuid)                  TO authenticated;
GRANT EXECUTE ON FUNCTION public.default_permissions_for_role(public.server_role) TO authenticated;