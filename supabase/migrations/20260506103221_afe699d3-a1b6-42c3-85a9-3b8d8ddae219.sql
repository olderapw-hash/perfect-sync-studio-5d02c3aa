
CREATE OR REPLACE FUNCTION public.validate_vps_activation(_token text, _fingerprint text, _ip text DEFAULT NULL::text, _hostname text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    _row public.vps_activations%ROWTYPE;
BEGIN
    SELECT * INTO _row FROM public.vps_activations WHERE activation_token = _token;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('valid', false, 'reason', 'not_found');
    END IF;
    IF _row.status = 'revoked' THEN
        RETURN jsonb_build_object('valid', false, 'reason', 'revoked');
    END IF;
    IF _row.status = 'suspended' THEN
        RETURN jsonb_build_object('valid', false, 'reason', 'suspended');
    END IF;

    -- First activation: bind fingerprint + IP
    IF _row.hardware_fingerprint IS NULL THEN
        UPDATE public.vps_activations
        SET hardware_fingerprint = _fingerprint,
            ip_address = _ip,
            hostname = _hostname,
            activated_at = now(),
            last_validated_at = now()
        WHERE id = _row.id;
        RETURN jsonb_build_object('valid', true, 'status', 'activated',
            'message', 'Token ativado e vinculado a esta VPS (IP + fingerprint).');
    END IF;

    -- Check fingerprint match
    IF _row.hardware_fingerprint <> _fingerprint THEN
        RETURN jsonb_build_object('valid', false, 'reason', 'fingerprint_mismatch',
            'message', 'Este token ja esta vinculado a outra VPS (fingerprint diferente).');
    END IF;

    -- Check IP match
    IF _row.ip_address IS NOT NULL AND _ip IS NOT NULL AND _row.ip_address <> _ip THEN
        RETURN jsonb_build_object('valid', false, 'reason', 'ip_mismatch',
            'message', 'Este token ja esta vinculado ao IP ' || left(_row.ip_address, 3) || '***. Nao pode ser usado em outra VPS.');
    END IF;

    -- Valid: update last_validated_at and hostname if changed
    UPDATE public.vps_activations
    SET last_validated_at = now(),
        hostname = COALESCE(_hostname, hostname)
    WHERE id = _row.id;
    RETURN jsonb_build_object('valid', true, 'status', 'validated');
END;
$function$;
