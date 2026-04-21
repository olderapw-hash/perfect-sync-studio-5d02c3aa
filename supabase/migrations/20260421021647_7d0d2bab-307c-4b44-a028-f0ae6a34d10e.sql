
-- Bucket público pra ícones de itens e arquivos .tab
insert into storage.buckets (id, name, public)
values ('pw-assets', 'pw-assets', true)
on conflict (id) do nothing;

-- Políticas: leitura pública, upload/update/delete livre (admin tool interno)
create policy "pw-assets public read"
on storage.objects for select
using (bucket_id = 'pw-assets');

create policy "pw-assets public write"
on storage.objects for insert
with check (bucket_id = 'pw-assets');

create policy "pw-assets public update"
on storage.objects for update
using (bucket_id = 'pw-assets');

create policy "pw-assets public delete"
on storage.objects for delete
using (bucket_id = 'pw-assets');

-- Tabela com o catálogo .tab parseado (1 ativo por vez)
create table public.item_catalogs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  tab_path text not null,
  icons_prefix text not null default 'icons/',
  item_count integer not null default 0,
  is_active boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.item_catalogs enable row level security;

create policy "item_catalogs public read"
on public.item_catalogs for select
using (true);

create policy "item_catalogs public insert"
on public.item_catalogs for insert
with check (true);

create policy "item_catalogs public update"
on public.item_catalogs for update
using (true);

create policy "item_catalogs public delete"
on public.item_catalogs for delete
using (true);

-- Trigger pra garantir só 1 catálogo ativo
create or replace function public.ensure_single_active_catalog()
returns trigger
language plpgsql
as $$
begin
  if new.is_active then
    update public.item_catalogs
    set is_active = false
    where id <> new.id and is_active = true;
  end if;
  return new;
end;
$$;

create trigger trg_single_active_catalog
before insert or update on public.item_catalogs
for each row execute function public.ensure_single_active_catalog();
