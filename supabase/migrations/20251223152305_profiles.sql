create table public.profiles (
  id uuid not null references auth.users on delete cascade,
  first_name text,
  last_name text,
  propic text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  deleted_at timestamp with time zone,

  primary key (id)
);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

alter table public.profiles enable row level security;

create trigger set_updated_at before update on public.profiles for each row execute function set_updated_at();

-- inserts a row into public.profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, first_name, last_name)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data ->> 'first_name',
    NEW.raw_user_meta_data ->> 'last_name'
  )
  ON CONFLICT (id) DO UPDATE
  SET
    first_name = EXCLUDED.first_name,
    last_name  = EXCLUDED.last_name,
    updated_at = NOW(); 
  RETURN NEW;
END;
$$;

-- trigger the function every time a user is created
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


  -- inserts a row into public.profiles
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, first_name, last_name)
  values (new.id, new.raw_user_meta_data ->> 'first_name', new.raw_user_meta_data ->> 'last_name');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
-- trigger the function every time a user is created
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


alter table public.profiles enable row level security;

create policy "Allow read access for all users" on public.profiles for select using (true);
create policy "Allow update access for authenticated users" on public.profiles for update using (auth.uid() = id);

-- Fix the handle_new_user function to use correct column names
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, first_name, last_name)
  values (new.id, new.raw_user_meta_data ->> 'first_name', new.raw_user_meta_data ->> 'last_name');
  return new;
end;
$$;


create table public.params (
  id uuid not null default gen_random_uuid (),
  created_at timestamp with time zone not null default now(),
  key text not null,
  value text not null,
  constraint params_pkey primary key (id)
) TABLESPACE pg_default;

alter table params enable row level security;

-- policies
create policy "Allow read access for all users" on public.params FOR SELECT TO authenticated using (true);