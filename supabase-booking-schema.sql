-- Reservation schema for Supabase
-- Time-related fields and functions have been removed.

create extension if not exists pgcrypto;

-- =========================
-- BOOKINGS TABLE
-- =========================

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,

  customer_name text not null,
  customer_email text not null,
  customer_phone text not null,

  booking_date date not null,

  service text not null,
  message text not null,

  status text not null default 'pending',

  constraint bookings_status_chk
    check (status in ('pending', 'confirmed', 'cancelled'))
);

-- Prevent more than one confirmed booking for the same date.
-- Remove this index if multiple customers should be allowed
-- to book on the same date.
create unique index if not exists idx_bookings_confirmed_date
on public.bookings(booking_date)
where status = 'confirmed';

create index if not exists idx_bookings_date_status
on public.bookings(booking_date, status);


-- =========================
-- ROW LEVEL SECURITY
-- =========================

alter table public.bookings enable row level security;


-- =========================
-- AUTOMATIC USER ID
-- =========================

create or replace function public.set_booking_user_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin

  if auth.uid() is not null then
    new.user_id := auth.uid();
  end if;

  return new;

end;
$$;


drop trigger if exists trg_set_booking_user_id
on public.bookings;


create trigger trg_set_booking_user_id
before insert on public.bookings
for each row
execute function public.set_booking_user_id();


-- =========================
-- CREATE BOOKING
-- =========================

create or replace function public.create_booking(
  p_name text,
  p_email text,
  p_phone text,
  p_booking_date date,
  p_service text,
  p_message text
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare

  v_booking_id uuid;
  v_existing_booking_count integer;

begin

  -- Check if the date is already booked
  select count(*)
  into v_existing_booking_count
  from public.bookings
  where booking_date = p_booking_date
    and status = 'confirmed';


  if v_existing_booking_count > 0 then

    return json_build_object(
      'success', false,
      'error', 'This date is already booked.'
    );

  end if;


  begin

    insert into public.bookings (
      customer_name,
      customer_email,
      customer_phone,
      booking_date,
      service,
      message,
      status
    )
    values (
      p_name,
      p_email,
      p_phone,
      p_booking_date,
      p_service,
      p_message,
      'pending'
    )
    returning id into v_booking_id;


    return json_build_object(
      'success', true,
      'booking_id', v_booking_id,
      'status', 'pending'
    );


  exception
    when unique_violation then

      return json_build_object(
        'success', false,
        'error', 'This date is already booked.'
      );

  end;

end;
$$;


-- =========================
-- CONFIRM BOOKING AFTER PAYMENT
-- =========================

create or replace function public.confirm_booking_after_payment(
  p_booking_id uuid,
  p_payment_status text
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare

  v_booking public.bookings%rowtype;
  v_existing_booking_count integer;

begin

  if p_payment_status is null
     or p_payment_status <> 'succeeded' then

    return json_build_object(
      'success', false,
      'error', 'Payment was not successful.'
    );

  end if;


  select *
  into v_booking
  from public.bookings
  where id = p_booking_id
  for update;


  if not found then

    return json_build_object(
      'success', false,
      'error', 'Booking not found.'
    );

  end if;


  if v_booking.status = 'confirmed' then

    return json_build_object(
      'success', true,
      'booking_id', v_booking.id,
      'status', 'confirmed'
    );

  end if;


  if v_booking.status = 'cancelled' then

    return json_build_object(
      'success', false,
      'error', 'This booking has been cancelled.'
    );

  end if;


  -- Check whether another confirmed booking already uses this date
  select count(*)
  into v_existing_booking_count
  from public.bookings
  where booking_date = v_booking.booking_date
    and status = 'confirmed'
    and id <> v_booking.id;


  if v_existing_booking_count > 0 then

    return json_build_object(
      'success', false,
      'error', 'This date has already been booked.'
    );

  end if;


  begin

    update public.bookings
    set status = 'confirmed'
    where id = v_booking.id;


    return json_build_object(
      'success', true,
      'booking_id', v_booking.id,
      'status', 'confirmed'
    );


  exception
    when unique_violation then

      return json_build_object(
        'success', false,
        'error', 'This date has already been booked.'
      );

  end;

end;
$$;


-- =========================
-- CANCEL BOOKING
-- =========================

create or replace function public.cancel_booking(
  p_booking_id uuid
)
returns json
language plpgsql
security definer
set search_path = public
as $$
begin

  update public.bookings
  set status = 'cancelled'
  where id = p_booking_id;


  if not found then

    return json_build_object(
      'success', false,
      'error', 'Booking not found.'
    );

  end if;


  return json_build_object(
    'success', true,
    'booking_id', p_booking_id,
    'status', 'cancelled'
  );

end;
$$;


-- =========================
-- RLS POLICIES
-- =========================

drop policy if exists
"Allow anonymous insert on bookings"
on public.bookings;


create policy "Allow anonymous insert on bookings"
on public.bookings
for insert
to anon
with check (true);


drop policy if exists
"Allow authenticated insert on bookings"
on public.bookings;


create policy "Allow authenticated insert on bookings"
on public.bookings
for insert
to authenticated
with check (true);


drop policy if exists
"Allow authenticated read own bookings"
on public.bookings;


create policy "Allow authenticated read own bookings"
on public.bookings
for select
to authenticated
using (user_id = auth.uid());