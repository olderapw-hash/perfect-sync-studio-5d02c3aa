
DROP POLICY IF EXISTS "Admins can upload photos to pw-assets" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update photos in pw-assets" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete photos in pw-assets" ON storage.objects;
DROP POLICY IF EXISTS "Admins can view pw-assets" ON storage.objects;

CREATE POLICY "Admins or superadmins can upload pw-assets"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'pw-assets' AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role)));

CREATE POLICY "Admins or superadmins can update pw-assets"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'pw-assets' AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role)));

CREATE POLICY "Admins or superadmins can delete pw-assets"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'pw-assets' AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role)));

CREATE POLICY "Admins or superadmins can view pw-assets"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'pw-assets' AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role)));
