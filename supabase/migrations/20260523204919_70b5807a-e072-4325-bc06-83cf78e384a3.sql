
CREATE OR REPLACE FUNCTION public.admin_set_user_plan(
  target_user_id uuid,
  new_plan text,
  expires_at timestamp with time zone DEFAULT NULL::timestamp with time zone,
  env text DEFAULT 'live'::text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _product_id text;
  _e text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'superadmin'::app_role) THEN
    RAISE EXCEPTION 'Access denied: superadmin only';
  END IF;
  IF new_plan NOT IN ('free','iniciante','pro','ultimate') THEN
    RAISE EXCEPTION 'Invalid plan: %', new_plan;
  END IF;

  IF new_plan = 'free' THEN
    DELETE FROM public.subscriptions WHERE user_id = target_user_id;
    RETURN;
  END IF;

  _product_id := CASE new_plan
    WHEN 'ultimate'  THEN 'pw_admin_ultimate'
    WHEN 'pro'       THEN 'pw_admin_pro'
    WHEN 'iniciante' THEN 'pw_admin_iniciante'
  END;

  DELETE FROM public.subscriptions WHERE user_id = target_user_id;

  FOREACH _e IN ARRAY ARRAY['sandbox','live'] LOOP
    INSERT INTO public.subscriptions (
      user_id, environment, status, is_trial,
      product_id, price_id,
      paddle_subscription_id, paddle_customer_id,
      current_period_start, current_period_end
    ) VALUES (
      target_user_id, _e, 'active', false,
      _product_id, _product_id || '_admin_override',
      NULL, NULL, now(), expires_at
    );
  END LOOP;
END;
$function$;

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
    WHEN s.product_id = 'pw_admin_iniciante' THEN 'iniciante'
    ELSE 'free'
  END INTO _plan
  FROM public.subscriptions s
  WHERE s.user_id = _user_id
    AND s.status IN ('active','trialing')
    AND (s.current_period_end IS NULL OR s.current_period_end > now())
  ORDER BY s.created_at DESC
  LIMIT 1;

  IF _plan IS NULL THEN _plan := 'free'; END IF;

  IF public.has_role(_user_id, 'superadmin'::app_role) THEN
    _plan := 'ultimate';
  END IF;

  _max := CASE _plan
    WHEN 'ultimate'  THEN 999
    WHEN 'pro'       THEN 3
    WHEN 'iniciante' THEN 1
    ELSE 1
  END;

  RETURN jsonb_build_object('plan', _plan, 'max_devices', _max);
END;
$$;
