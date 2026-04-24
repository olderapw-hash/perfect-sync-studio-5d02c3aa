create table if not exists public.site_content (
  id integer primary key default 1,
  content jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  constraint site_content_singleton check (id = 1)
);

insert into public.site_content (id, content)
values (1, '{}'::jsonb)
on conflict (id) do nothing;

alter table public.site_content enable row level security;

drop policy if exists "Public can read site content" on public.site_content;
create policy "Public can read site content"
  on public.site_content
  for select
  to anon, authenticated
  using (true);

drop policy if exists "Superadmin can insert site content" on public.site_content;
create policy "Superadmin can insert site content"
  on public.site_content
  for insert
  to authenticated
  with check (public.has_role(auth.uid(), 'superadmin'::public.app_role));

drop policy if exists "Superadmin can update site content" on public.site_content;
create policy "Superadmin can update site content"
  on public.site_content
  for update
  to authenticated
  using (public.has_role(auth.uid(), 'superadmin'::public.app_role))
  with check (public.has_role(auth.uid(), 'superadmin'::public.app_role));