-- Enable required extensions
begin;

create extension if not exists "pg_cron";

-- Add indexes
create index if not exists trading_sessions_active_lookup 
  on public.trading_sessions (public_key, is_active);

create index if not exists trading_sessions_expires_at 
  on public.trading_sessions (expires_at);

-- Add RLS policies
alter table public.trading_sessions enable row level security;

create policy "Enable read access for all users"
  on public.trading_sessions for select
  using (true);

create policy "Enable insert for service role"
  on public.trading_sessions for insert
  with check (auth.jwt() is null);  -- Allow unauthenticated/service role inserts

create policy "Enable update for service role"
  on public.trading_sessions for update
  using (auth.jwt() is null)  -- Allow unauthenticated/service role updates
  with check (auth.jwt() is null);

-- Add triggers and functions
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists handle_trading_sessions_updated_at on public.trading_sessions;
create trigger handle_trading_sessions_updated_at
  before update on public.trading_sessions
  for each row
  execute function public.handle_updated_at();

-- Add cleanup function and schedule
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

-- Safely manage cron job
do $$
begin
  -- Try to unschedule if exists
  begin
    perform cron.unschedule('cleanup-expired-sessions');
  exception when others then
    -- Job doesn't exist, ignore error
  end;

  -- Create new schedule
  perform cron.schedule(
    'cleanup-expired-sessions',
    '*/5 * * * *',
    $$select public.cleanup_expired_sessions()$$
  );
end$$;

commit; 