
-- 1. Create tenant_secrets table for storing PW API secrets separately
CREATE TABLE public.tenant_secrets (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  pw_api_secret text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Enable RLS
ALTER TABLE public.tenant_secrets ENABLE ROW LEVEL SECURITY;

-- 3. Owner-only read access
CREATE POLICY "Owner can view own tenant secret"
  ON public.tenant_secrets FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.tenants WHERE id = tenant_secrets.tenant_id AND owner_id = auth.uid()
  ));

-- 4. Owner can insert
CREATE POLICY "Owner can insert own tenant secret"
  ON public.tenant_secrets FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.tenants WHERE id = tenant_secrets.tenant_id AND owner_id = auth.uid()
  ));

-- 5. Owner can update
CREATE POLICY "Owner can update own tenant secret"
  ON public.tenant_secrets FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.tenants WHERE id = tenant_secrets.tenant_id AND owner_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.tenants WHERE id = tenant_secrets.tenant_id AND owner_id = auth.uid()
  ));

-- 6. Service role full access (for edge functions)
CREATE POLICY "Service role manages tenant secrets"
  ON public.tenant_secrets FOR ALL
  TO public
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- 7. Migrate existing secrets
INSERT INTO public.tenant_secrets (tenant_id, pw_api_secret)
SELECT id, pw_api_secret FROM public.tenants WHERE pw_api_secret IS NOT NULL
ON CONFLICT DO NOTHING;

-- 8. Update get_my_tenant_secret to read from new table
CREATE OR REPLACE FUNCTION public.get_my_tenant_secret()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT ts.pw_api_secret
  FROM public.tenant_secrets ts
  JOIN public.tenants t ON t.id = ts.tenant_id
  WHERE t.owner_id = auth.uid()
    AND t.is_active = true
  ORDER BY t.updated_at DESC
  LIMIT 1;
$$;

-- 9. Update get_tenant_secret to read from new table
CREATE OR REPLACE FUNCTION public.get_tenant_secret(_tenant_id uuid)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT ts.pw_api_secret
  FROM public.tenant_secrets ts
  JOIN public.tenants t ON t.id = ts.tenant_id
  WHERE ts.tenant_id = _tenant_id
    AND t.owner_id = auth.uid()
  LIMIT 1;
$$;

-- 10. Clear secrets from tenants table so members can no longer read them
UPDATE public.tenants SET pw_api_secret = NULL;

-- 11. Add updated_at trigger
CREATE TRIGGER set_tenant_secrets_updated_at
  BEFORE UPDATE ON public.tenant_secrets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
