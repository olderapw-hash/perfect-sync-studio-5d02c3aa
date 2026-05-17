
-- Fix 1: Harden server_members INSERT policy — require actor to already be a member of the target tenant
DROP POLICY IF EXISTS "Manage members can insert" ON public.server_members;
CREATE POLICY "Manage members can insert"
ON public.server_members
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_server_member(tenant_id, auth.uid())
  AND public.has_server_permission(tenant_id, auth.uid(), 'manage_members')
  AND role <> 'owner'::public.server_role
  AND user_id <> auth.uid()
);

-- Also harden UPDATE and DELETE with the same is_server_member guard (defense-in-depth)
DROP POLICY IF EXISTS "Manage members can update" ON public.server_members;
CREATE POLICY "Manage members can update"
ON public.server_members
FOR UPDATE
TO authenticated
USING (
  public.is_server_member(tenant_id, auth.uid())
  AND public.has_server_permission(tenant_id, auth.uid(), 'manage_members')
  AND user_id <> auth.uid()
  AND role <> 'owner'::public.server_role
)
WITH CHECK (
  public.is_server_member(tenant_id, auth.uid())
  AND public.has_server_permission(tenant_id, auth.uid(), 'manage_members')
  AND user_id <> auth.uid()
  AND role <> 'owner'::public.server_role
);

DROP POLICY IF EXISTS "Manage members can delete" ON public.server_members;
CREATE POLICY "Manage members can delete"
ON public.server_members
FOR DELETE
TO authenticated
USING (
  public.is_server_member(tenant_id, auth.uid())
  AND public.has_server_permission(tenant_id, auth.uid(), 'manage_members')
  AND role <> 'owner'::public.server_role
  AND user_id <> auth.uid()
);

-- Fix 2: Allow authorized staff to delete attendance_claims (corrections/retractions)
CREATE POLICY "Save real roles or manage kits can delete attendance claims"
ON public.attendance_claims
FOR DELETE
TO authenticated
USING (
  public.has_server_permission(tenant_id, auth.uid(), 'save_real_roles')
  OR public.has_server_permission(tenant_id, auth.uid(), 'manage_kits')
);
