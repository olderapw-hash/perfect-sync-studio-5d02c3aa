CREATE OR REPLACE FUNCTION public.ensure_my_vps_activation_token()
RETURNS TABLE(
    activation_token TEXT,
    license_status TEXT,
    vps_status TEXT,
    vps_ip TEXT,
    vps_hostname TEXT,
    activated_at TIMESTAMPTZ,
    last_validated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_email TEXT;
    v_existing UUID;
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
$$;

GRANT EXECUTE ON FUNCTION public.ensure_my_vps_activation_token() TO authenticated;