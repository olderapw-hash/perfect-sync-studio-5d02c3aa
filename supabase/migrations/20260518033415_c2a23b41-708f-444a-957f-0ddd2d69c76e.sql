DROP POLICY IF EXISTS "Admins can insert catalogs" ON public.item_catalogs;
DROP POLICY IF EXISTS "Admins can update catalogs" ON public.item_catalogs;
DROP POLICY IF EXISTS "Admins can delete catalogs" ON public.item_catalogs;

CREATE POLICY "Admins or superadmins can insert catalogs"
ON public.item_catalogs FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superadmin'));

CREATE POLICY "Admins or superadmins can update catalogs"
ON public.item_catalogs FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superadmin'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superadmin'));

CREATE POLICY "Admins or superadmins can delete catalogs"
ON public.item_catalogs FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superadmin'));