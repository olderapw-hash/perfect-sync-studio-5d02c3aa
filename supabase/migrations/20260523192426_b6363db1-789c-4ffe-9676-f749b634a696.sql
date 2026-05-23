
-- 1) Drop overly permissive photo write policies (table)
DROP POLICY IF EXISTS "Auth users can insert class photos" ON public.class_photos;
DROP POLICY IF EXISTS "Auth users can update class photos" ON public.class_photos;
DROP POLICY IF EXISTS "Auth users can delete class photos" ON public.class_photos;
DROP POLICY IF EXISTS "Auth users can insert character photos" ON public.character_photos;
DROP POLICY IF EXISTS "Auth users can update character photos" ON public.character_photos;
DROP POLICY IF EXISTS "Auth users can delete character photos" ON public.character_photos;

-- 2) Drop overly permissive storage policies for photos paths
DROP POLICY IF EXISTS "Auth users can upload class/character photos" ON storage.objects;
DROP POLICY IF EXISTS "Auth users can update class/character photos" ON storage.objects;
DROP POLICY IF EXISTS "Auth users can delete class/character photos" ON storage.objects;

-- Replace storage policies with admin/superadmin-scoped versions
CREATE POLICY "Admins can upload class/character photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'pw-assets'
  AND (name LIKE 'photos/class/%' OR name LIKE 'photos/character/%')
  AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'superadmin'::app_role))
);

CREATE POLICY "Admins can update class/character photos"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'pw-assets'
  AND (name LIKE 'photos/class/%' OR name LIKE 'photos/character/%')
  AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'superadmin'::app_role))
)
WITH CHECK (
  bucket_id = 'pw-assets'
  AND (name LIKE 'photos/class/%' OR name LIKE 'photos/character/%')
  AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'superadmin'::app_role))
);

CREATE POLICY "Admins can delete class/character photos"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'pw-assets'
  AND (name LIKE 'photos/class/%' OR name LIKE 'photos/character/%')
  AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'superadmin'::app_role))
);

-- 3) Allow license owners to read their own license
CREATE POLICY "Users can view own license"
ON public.licenses FOR SELECT TO authenticated
USING (
  created_by = auth.uid()
  OR client_email = (SELECT email FROM auth.users WHERE id = auth.uid())
);

-- 4) Allow VPS activation owners to read their own record
CREATE POLICY "Owners can view own vps activation"
ON public.vps_activations FOR SELECT TO authenticated
USING (owner_id = auth.uid());
