
create or replace function public.ensure_single_active_catalog()
returns trigger
language plpgsql
security invoker
set search_path = public
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
