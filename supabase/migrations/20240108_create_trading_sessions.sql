-- Enable required extensions
create extension if not exists "pg_cron";

-- Part 1: Create base table
create table if not exists public.trading_sessions (
  id uuid default gen_random_uuid() primary key,
  public_key text not null,
  signature text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  expires_at timestamptz not null,
  wallet_data jsonb,
  is_active boolean default true
);

-- Add unique constraint if it doesn't exist
do $$
begin
  if not exists (
    select 1 
    from information_schema.table_constraints 
    where constraint_name = 'trading_sessions_public_key_key'
  ) then
    alter table public.trading_sessions 
      add constraint trading_sessions_public_key_key unique (public_key);
  end if;
end$$;

-- Part 2: Add indexes (after table is created)
do $$
begin
  -- Create indexes if they don't exist
  if not exists (select 1 from pg_indexes where indexname = 'trading_sessions_active_lookup') then
    create index trading_sessions_active_lookup 
      on public.trading_sessions (public_key, is_active);
  end if;

  if not exists (select 1 from pg_indexes where indexname = 'trading_sessions_expires_at') then
    create index trading_sessions_expires_at 
      on public.trading_sessions (expires_at);
  end if;
end$$;

-- Part 3: Add RLS policies
alter table public.trading_sessions enable row level security;

do $$
begin
  -- Create policies if they don't exist
  if not exists (
    select 1 
    from pg_policies 
    where policyname = 'Enable read access for all users'
  ) then
    create policy "Enable read access for all users"
      on public.trading_sessions for select
      using (true);
  end if;

  if not exists (
    select 1 
    from pg_policies 
    where policyname = 'Enable insert for authenticated users only'
  ) then
    create policy "Enable insert for authenticated users only"
      on public.trading_sessions for insert
      with check (auth.role() = 'authenticated');
  end if;

  if not exists (
    select 1 
    from pg_policies 
    where policyname = 'Enable update for authenticated users only'
  ) then
    create policy "Enable update for authenticated users only"
      on public.trading_sessions for update
      using (auth.role() = 'authenticated')
      with check (auth.role() = 'authenticated');
  end if;
end$$;

-- Part 4: Add triggers and functions
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1 
    from pg_trigger 
    where tgname = 'handle_trading_sessions_updated_at'
  ) then
    create trigger handle_trading_sessions_updated_at
      before update on public.trading_sessions
      for each row
      execute function public.handle_updated_at();
  end if;
end$$;

-- Part 5: Add cleanup function and schedule
create or replace function public.cleanup_expired_sessions()
returns void
language plpgsql
as $$
begin
  update public.trading_sessions
  set is_active = false
  where expires_at < now() and is_active = true;
end;
$$;

-- Drop existing schedule if it exists
select cron.unschedule('cleanup-expired-sessions');

-- Create new schedule
select cron.schedule(
  'cleanup-expired-sessions',
  '*/5 * * * *',
  $$select public.cleanup_expired_sessions()$$
);