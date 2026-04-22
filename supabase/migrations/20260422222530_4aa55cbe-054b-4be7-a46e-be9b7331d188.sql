CREATE OR REPLACE FUNCTION public.default_permissions_for_role(_role public.server_role)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = public
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