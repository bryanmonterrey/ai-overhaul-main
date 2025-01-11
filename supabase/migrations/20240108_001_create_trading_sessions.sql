-- First migration: Create the base table
begin;

-- Drop existing table if it exists
drop table if exists public.trading_sessions;

create table public.trading_sessions (
  id uuid default gen_random_uuid() primary key,
  public_key text not null,
  signature text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  expires_at timestamptz not null,
  wallet_data jsonb,
  is_active boolean default true
);

-- Add unique constraint
alter table public.trading_sessions 
  add constraint trading_sessions_public_key_key unique (public_key);

commit; 