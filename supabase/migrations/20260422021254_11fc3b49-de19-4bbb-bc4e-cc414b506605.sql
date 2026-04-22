-- 1. item_catalogs: replace permissive write policies with admin-only ones
DROP POLICY IF EXISTS "item_catalogs public insert" ON public.item_catalogs;
DROP POLICY IF EXISTS "item_catalogs public update" ON public.item_catalogs;
DROP POLICY IF EXISTS "item_catalogs public delete" ON public.item_catalogs;

CREATE POLICY "Admins can insert catalogs"
  ON public.item_catalogs FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update catalogs"
  ON public.item_catalogs FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete catalogs"
  ON public.item_catalogs FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 2. pw-assets bucket: restrict writes to admins, keep public reads of individual files
DROP POLICY IF EXISTS "pw-assets public write" ON storage.objects;
DROP POLICY IF EXISTS "pw-assets public update" ON storage.objects;
DROP POLICY IF EXISTS "pw-assets public delete" ON storage.objects;
DROP POLICY IF EXISTS "pw-assets public read" ON storage.objects;

-- Public can read individual files by direct path (needed for serving icons / .tab)
CREATE POLICY "pw-assets public read individual files"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'pw-assets');

CREATE POLICY "Admins can upload pw-assets"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'pw-assets'
    AND public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Admins can update pw-assets"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'pw-assets'
    AND public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    bucket_id = 'pw-assets'
    AND public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Admins can delete pw-assets"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'pw-assets'
    AND public.has_role(auth.uid(), 'admin')
  );