-- Subscriptions table (Paddle)
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  paddle_subscription_id text not null unique,
  paddle_customer_id text not null,
  product_id text not null,
  price_id text not null,
  status text not null default 'active',
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean default false,
  environment text not null default 'sandbox',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, environment)
);

create index idx_subscriptions_user_id on public.subscriptions(user_id);
create index idx_subscriptions_paddle_id on public.subscriptions(paddle_subscription_id);

alter table public.subscriptions enable row level security;

create policy "Users can view own subscription"
  on public.subscriptions for select
  using (auth.uid() = user_id);

create policy "Service role can manage subscriptions"
  on public.subscriptions for all
  using (auth.role() = 'service_role');

-- Helper function
create or replace function public.has_active_subscription(
  user_uuid uuid,
  check_env text default 'live'
)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.subscriptions
    where user_id = user_uuid
      and environment = check_env
      and status in ('active', 'trialing')
      and (current_period_end is null or current_period_end > now())
  );
$$;

-- Tenants table (multi-tenant config: each paying customer's VPS config)
create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade not null unique,
  server_name text not null default 'Meu Servidor PW',
  pw_api_base_url text,
  pw_api_secret text,
  icon_base_url text,
  logo_url text,
  primary_color text,
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_tenants_owner on public.tenants(owner_id);

alter table public.tenants enable row level security;

create policy "Users can view own tenant"
  on public.tenants for select
  using (auth.uid() = owner_id);

create policy "Users can insert own tenant"
  on public.tenants for insert
  with check (auth.uid() = owner_id);

create policy "Users can update own tenant"
  on public.tenants for update
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "Service role can manage tenants"
  on public.tenants for all
  using (auth.role() = 'service_role');

-- Trigger to keep updated_at fresh
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_subscriptions_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

create trigger trg_tenants_updated_at
  before update on public.tenants
  for each row execute function public.set_updated_at();