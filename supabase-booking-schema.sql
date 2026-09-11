-- Canonical Supabase schema for date-only reservations.
-- Run this file first, then run create_booking.sql.
-- This upgrades the known legacy column names without deleting existing rows.

begin;

create extension if not exists pgcrypto;

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  customer_name text not null,
  customer_email text not null,
  customer_phone text not null,
  date date not null,
  service text not null,
  message text not null,
  status text not null default 'pending',
  constraint bookings_status_chk check (status in ('pending', 'confirmed', 'cancelled'))
);

-- Upgrade the previous column names before adding canonical columns.
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'bookings' and column_name = 'booking_date')
     and not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'bookings' and column_name = 'date') then
    alter table public.bookings rename column booking_date to date;
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'bookings' and column_name = 'name')
     and not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'bookings' and column_name = 'customer_name') then
    alter table public.bookings rename column name to customer_name;
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'bookings' and column_name = 'email')
     and not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'bookings' and column_name = 'customer_email') then
    alter table public.bookings rename column email to customer_email;
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'bookings' and column_name = 'phone')
     and not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'bookings' and column_name = 'customer_phone') then
    alter table public.bookings rename column phone to customer_phone;
  end if;
end;
$$;

alter table public.bookings
  add column if not exists user_id uuid,
  add column if not exists customer_name text,
  add column if not exists customer_email text,
  add column if not exists customer_phone text,
  add column if not exists date date,
  add column if not exists service text,
  add column if not exists message text,
  add column if not exists status text not null default 'pending';

-- If a partial earlier upgrade left both old and new names, retain the value in
-- the canonical column, then remove the obsolete column.
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'bookings' and column_name = 'booking_date') then
    execute 'update public.bookings set date = coalesce(date, booking_date)';
    alter table public.bookings drop column booking_date;
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'bookings' and column_name = 'name') then
    execute 'update public.bookings set customer_name = coalesce(customer_name, name)';
    alter table public.bookings drop column name;
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'bookings' and column_name = 'email') then
    execute 'update public.bookings set customer_email = coalesce(customer_email, email)';
    alter table public.bookings drop column email;
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'bookings' and column_name = 'phone') then
    execute 'update public.bookings set customer_phone = coalesce(customer_phone, phone)';
    alter table public.bookings drop column phone;
  end if;
end;
$$;

-- Legacy text IDs are converted only if the table has no data. Existing non-UUID
-- IDs need a deliberate data migration rather than an unsafe automatic cast.
do $$
declare v_id_type text; v_row_count bigint;
begin
  select data_type into v_id_type from information_schema.columns
  where table_schema = 'public' and table_name = 'bookings' and column_name = 'id';
  if v_id_type <> 'uuid' then
    execute 'select count(*) from public.bookings' into v_row_count;
    if v_row_count > 0 then
      raise exception 'bookings.id is %, not uuid, and contains data. Back up and migrate those IDs before applying this schema.', v_id_type;
    end if;
    alter table public.bookings alter column id drop default;
    alter table public.bookings alter column id type uuid using gen_random_uuid();
    alter table public.bookings alter column id set default gen_random_uuid();
  end if;
end;
$$;

alter table public.bookings
  alter column customer_name set not null,
  alter column customer_email set not null,
  alter column customer_phone set not null,
  alter column date set not null,
  alter column service set not null,
  alter column message set not null,
  alter column status set default 'pending',
  alter column status set not null;

alter table public.bookings drop constraint if exists bookings_status_chk;
alter table public.bookings add constraint bookings_status_chk
  check (status in ('pending', 'confirmed', 'cancelled'));

alter table public.bookings
  drop column if exists booking_time,
  drop column if exists slot_time,
  drop column if exists created_at,
  drop column if exists updated_at,
  drop column if exists confirmed_at,
  drop column if exists expires_at;

drop index if exists public.idx_bookings_confirmed_date;
create unique index idx_bookings_confirmed_date
  on public.bookings (date) where status = 'confirmed';
create index if not exists idx_bookings_date_status
  on public.bookings (date, status);

alter table public.bookings enable row level security;
drop policy if exists "Allow anonymous insert on bookings" on public.bookings;
drop policy if exists "Allow authenticated insert on bookings" on public.bookings;
drop policy if exists "Allow anonymous inserts" on public.bookings;
drop policy if exists "Allow authenticated inserts" on public.bookings;
drop policy if exists "Allow authenticated read own bookings" on public.bookings;
drop policy if exists "Allow authenticated read own" on public.bookings;
drop policy if exists "Allow anon read own" on public.bookings;
create policy "Allow authenticated read own bookings"
  on public.bookings for select to authenticated using (user_id = auth.uid());

commit;
