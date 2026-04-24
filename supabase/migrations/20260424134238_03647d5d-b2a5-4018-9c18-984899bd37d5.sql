
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS background_url text,
  ADD COLUMN IF NOT EXISTS favicon_url text;

INSERT INTO storage.buckets (id, name, public)
VALUES ('branding', 'branding', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Branding is publicly readable" ON storage.objects;
CREATE POLICY "Branding is publicly readable"
ON storage.objects FOR SELECT
USING (bucket_id = 'branding');

DROP POLICY IF EXISTS "Superadmins can upload branding" ON storage.objects;
CREATE POLICY "Superadmins can upload branding"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'branding'
  AND public.has_role(auth.uid(), 'superadmin')
);

DROP POLICY IF EXISTS "Superadmins can update branding" ON storage.objects;
CREATE POLICY "Superadmins can update branding"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'branding'
  AND public.has_role(auth.uid(), 'superadmin')
);

DROP POLICY IF EXISTS "Superadmins can delete branding" ON storage.objects;
CREATE POLICY "Superadmins can delete branding"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'branding'
  AND public.has_role(auth.uid(), 'superadmin')
);

DROP FUNCTION IF EXISTS public.get_public_branding();

CREATE FUNCTION public.get_public_branding()
RETURNS TABLE (
  server_name text,
  logo_url text,
  primary_color text,
  background_url text,
  favicon_url text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT server_name, logo_url, primary_color, background_url, favicon_url
  FROM public.app_settings
  WHERE id = 1
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_branding() TO anon, authenticated;
