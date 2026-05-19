
-- Storage policies for pw-assets photos folders (authenticated users)
CREATE POLICY "Auth users can upload class/character photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'pw-assets'
  AND (name LIKE 'photos/class/%' OR name LIKE 'photos/character/%')
);

CREATE POLICY "Auth users can update class/character photos"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'pw-assets'
  AND (name LIKE 'photos/class/%' OR name LIKE 'photos/character/%')
)
WITH CHECK (
  bucket_id = 'pw-assets'
  AND (name LIKE 'photos/class/%' OR name LIKE 'photos/character/%')
);

CREATE POLICY "Auth users can delete class/character photos"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'pw-assets'
  AND (name LIKE 'photos/class/%' OR name LIKE 'photos/character/%')
);

-- Table policies: class_photos
CREATE POLICY "Auth users can insert class photos"
ON public.class_photos FOR INSERT TO authenticated
WITH CHECK (true);

CREATE POLICY "Auth users can update class photos"
ON public.class_photos FOR UPDATE TO authenticated
USING (true) WITH CHECK (true);

CREATE POLICY "Auth users can delete class photos"
ON public.class_photos FOR DELETE TO authenticated
USING (true);

-- Table policies: character_photos
CREATE POLICY "Auth users can insert character photos"
ON public.character_photos FOR INSERT TO authenticated
WITH CHECK (true);

CREATE POLICY "Auth users can update character photos"
ON public.character_photos FOR UPDATE TO authenticated
USING (true) WITH CHECK (true);

CREATE POLICY "Auth users can delete character photos"
ON public.character_photos FOR DELETE TO authenticated
USING (true);
