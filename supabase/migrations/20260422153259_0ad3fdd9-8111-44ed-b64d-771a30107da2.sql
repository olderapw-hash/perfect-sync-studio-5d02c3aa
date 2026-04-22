-- Function to list users with their roles and subscription status
-- Only callable by superadmin (enforced inside the function)
CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE (
  user_id uuid,
  email text,
  created_at timestamptz,
  is_admin boolean,
  is_superadmin boolean,
  has_subscription boolean,
  tenant_server_name text,
  onboarding_completed boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only superadmin can list users
  IF NOT public.has_role(auth.uid(), 'superadmin'::app_role) THEN
    RAISE EXCEPTION 'Access denied: superadmin only';
  END IF;

  RETURN QUERY
  SELECT
    u.id AS user_id,
    u.email::text,
    u.created_at,
    EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = u.id AND ur.role = 'admin'::app_role) AS is_admin,
    EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = u.id AND ur.role = 'superadmin'::app_role) AS is_superadmin,
    public.has_active_subscription(u.id, 'live') OR public.has_active_subscription(u.id, 'sandbox') AS has_subscription,
    t.server_name AS tenant_server_name,
    COALESCE(t.onboarding_completed, false) AS onboarding_completed
  FROM auth.users u
  LEFT JOIN public.tenants t ON t.owner_id = u.id
  ORDER BY u.created_at DESC;
END;
$$;

-- Promote a user to admin (superadmin only)
CREATE OR REPLACE FUNCTION public.admin_grant_admin(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'superadmin'::app_role) THEN
    RAISE EXCEPTION 'Access denied: superadmin only';
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (target_user_id, 'admin'::app_role)
  ON CONFLICT (user_id, role) DO NOTHING;
END;
$$;

-- Revoke admin role (superadmin only). Cannot revoke superadmin via this function.
CREATE OR REPLACE FUNCTION public.admin_revoke_admin(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'superadmin'::app_role) THEN
    RAISE EXCEPTION 'Access denied: superadmin only';
  END IF;

  DELETE FROM public.user_roles
  WHERE user_id = target_user_id AND role = 'admin'::app_role;
END;
$$;

-- Make sure user_roles has a unique constraint on (user_id, role) for ON CONFLICT
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_roles_user_id_role_key'
  ) THEN
    ALTER TABLE public.user_roles
    ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);
  END IF;
END$$;