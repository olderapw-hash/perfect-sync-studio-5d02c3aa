
-- 1) Licenses: remove broad "client_email match" SELECT, keep only owner (created_by).
--    Email-assigned users still get their activation token via SECURITY DEFINER RPC
--    public.get_my_vps_activation_token() / ensure_my_vps_activation_token().
DROP POLICY IF EXISTS "Users can view own license" ON public.licenses;

CREATE POLICY "Users can view licenses they created"
ON public.licenses
FOR SELECT
TO authenticated
USING (created_by = auth.uid());

-- 2) server_invites: add explicit is_server_member guard on revoke UPDATE policy
DROP POLICY IF EXISTS "Manage members can revoke invites" ON public.server_invites;

CREATE POLICY "Manage members can revoke invites"
ON public.server_invites
FOR UPDATE
TO authenticated
USING (
  public.is_server_member(tenant_id, auth.uid())
  AND public.has_server_permission(tenant_id, auth.uid(), 'manage_members'::text)
)
WITH CHECK (
  public.is_server_member(tenant_id, auth.uid())
  AND public.has_server_permission(tenant_id, auth.uid(), 'manage_members'::text)
);

-- 3) mail_send_log: add explicit is_server_member guard to SELECT policy for defense-in-depth
DROP POLICY IF EXISTS "View own or audited mail send log" ON public.mail_send_log;

CREATE POLICY "View own or audited mail send log"
ON public.mail_send_log
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR (
    public.is_server_member(tenant_id, auth.uid())
    AND public.has_server_permission(tenant_id, auth.uid(), 'view_audit'::text)
  )
);
