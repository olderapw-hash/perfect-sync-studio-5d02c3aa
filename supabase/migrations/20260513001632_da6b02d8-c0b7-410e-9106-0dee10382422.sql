CREATE OR REPLACE FUNCTION public.ensure_my_vps_activation_token()
 RETURNS TABLE(activation_token text, license_status text, vps_status text, vps_ip text, vps_hostname text, activated_at timestamp with time zone, last_validated_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_user_id UUID := auth.uid();
    v_email TEXT;
    v_existing UUID;
    v_has_sub BOOLEAN;
BEGIN
    IF v_user_id IS NULL THEN
        RETURN;
    END IF;

    SELECT email INTO v_email FROM auth.users WHERE id = v_user_id;

    SELECT id INTO v_existing
    FROM public.licenses
    WHERE created_by = v_user_id
       OR client_email = v_email
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_existing IS NULL THEN
        -- Authorization guard: only auto-create a license for users with a
        -- LIVE subscription or superadmin role. Sandbox subscriptions
        -- (free Paddle sandbox checkouts) MUST NOT grant production-grade
        -- active licenses — that would let any tester self-issue a valid
        -- license bypassing the superadmin-only INSERT RLS policy.
        v_has_sub := public.has_active_subscription(v_user_id, 'live')
                  OR public.has_role(v_user_id, 'superadmin'::app_role);

        IF NOT v_has_sub THEN
            RETURN;
        END IF;

        INSERT INTO public.licenses (
            created_by,
            client_name,
            client_email,
            plan,
            status,
            notes
        ) VALUES (
            v_user_id,
            COALESCE(v_email, 'Auto'),
            v_email,
            'auto',
            'active'::license_status,
            'Auto-generated on install'
        );
    END IF;

    RETURN QUERY
    SELECT
        l.vps_activation_token,
        l.status::TEXT AS license_status,
        COALESCE(v.status::TEXT, 'pending') AS vps_status,
        v.ip_address,
        v.hostname,
        v.activated_at,
        v.last_validated_at
    FROM public.licenses l
    LEFT JOIN public.vps_activations v ON v.activation_token = l.vps_activation_token
    WHERE l.created_by = v_user_id
       OR l.client_email = v_email
    ORDER BY l.created_at DESC
    LIMIT 1;
END;
$function$;