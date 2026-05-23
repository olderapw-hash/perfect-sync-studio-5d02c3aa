
-- 1) Auto-create a license (with activation token) for every new user at signup
CREATE OR REPLACE FUNCTION public.handle_new_user_license()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only create if no license exists yet for this user/email
  IF NOT EXISTS (
    SELECT 1 FROM public.licenses
    WHERE created_by = NEW.id OR client_email = NEW.email
  ) THEN
    INSERT INTO public.licenses (
      created_by, client_name, client_email, plan, status, notes
    ) VALUES (
      NEW.id,
      COALESCE(NEW.email, 'Novo usuário'),
      NEW.email,
      'starter',
      'active'::license_status,
      'Auto-gerada no cadastro'
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_license ON auth.users;
CREATE TRIGGER on_auth_user_created_license
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_license();

-- 2) Look-up helper used by auth-email-hook when sending signup confirmation
CREATE OR REPLACE FUNCTION public.get_user_activation_key(_email text)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(vps_activation_token, license_key)
  FROM public.licenses
  WHERE client_email = _email
  ORDER BY created_at DESC
  LIMIT 1;
$$;

-- 3) Grant admin role to the caller if they own any active license
CREATE OR REPLACE FUNCTION public.grant_admin_for_current_user()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _email text;
  _has_lic boolean;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT email INTO _email FROM auth.users WHERE id = _uid;

  SELECT EXISTS (
    SELECT 1 FROM public.licenses
    WHERE (created_by = _uid OR client_email = _email)
      AND status = 'active'::license_status
      AND (expires_at IS NULL OR expires_at > now())
  ) INTO _has_lic;

  IF NOT _has_lic THEN
    RETURN false;
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (_uid, 'admin'::app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.grant_admin_for_current_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_activation_key(text) TO service_role;
