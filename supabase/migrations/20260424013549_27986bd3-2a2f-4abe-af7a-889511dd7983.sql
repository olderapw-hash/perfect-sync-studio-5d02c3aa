
CREATE OR REPLACE FUNCTION public.default_permissions_for_role(_role server_role)
 RETURNS jsonb
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
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
      'manage_members', true,
      'manage_kits', true,
      'manage_security', true
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
      'manage_members', false,
      'manage_kits', true,
      'manage_security', true
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
      'manage_members', false,
      'manage_kits', true,
      'manage_security', false
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
      'manage_members', false,
      'manage_kits', false,
      'manage_security', false
    )
  END;
$function$;

-- Backfill existing memberships: owners/admins get manage_security=true.
UPDATE public.server_members sm
SET permissions = sm.permissions || jsonb_build_object('manage_security',
  CASE WHEN sm.role IN ('owner','admin') THEN true ELSE false END)
WHERE NOT (sm.permissions ? 'manage_security');
