-- Booking RPCs for the canonical date-only booking schema.
-- Run supabase-booking-schema.sql before this file.

begin;

-- Required because CREATE OR REPLACE cannot rename p_booking_date to p_date.
drop function if exists public.create_booking(text, text, text, date, text, text);

create or replace function public.set_booking_user_id()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null then new.user_id := auth.uid(); end if;
  return new;
end;
$$;

drop trigger if exists trg_set_booking_user_id on public.bookings;
create trigger trg_set_booking_user_id before insert on public.bookings
for each row execute function public.set_booking_user_id();

create function public.create_booking(
  p_name text, p_email text, p_phone text, p_date date, p_service text, p_message text
)
returns json language plpgsql security definer set search_path = public as $$
declare v_booking_id uuid;
begin
  insert into public.bookings (
    customer_name, customer_email, customer_phone, date, service, message, status
  ) values (
    p_name, p_email, p_phone, p_date, p_service, p_message, 'pending'
  ) returning id into v_booking_id;

  return json_build_object('success', true, 'booking_id', v_booking_id, 'status', 'pending');
end;
$$;

-- Call only from a trusted payment webhook or server using the service role.
create or replace function public.confirm_booking_after_payment(
  p_booking_id uuid, p_payment_status text
)
returns json language plpgsql security definer set search_path = public as $$
declare v_booking public.bookings%rowtype;
begin
  if p_payment_status is distinct from 'succeeded' then
    return json_build_object('success', false, 'error', 'Payment was not successful.');
  end if;
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then return json_build_object('success', false, 'error', 'Booking not found.'); end if;
  if v_booking.status = 'confirmed' then
    return json_build_object('success', true, 'booking_id', v_booking.id, 'status', 'confirmed');
  end if;
  if v_booking.status = 'cancelled' then
    return json_build_object('success', false, 'error', 'This booking has been cancelled.');
  end if;
  begin
    update public.bookings set status = 'confirmed' where id = v_booking.id;
  exception when unique_violation then
    return json_build_object('success', false, 'error', 'This date has already been booked.');
  end;
  return json_build_object('success', true, 'booking_id', v_booking.id, 'status', 'confirmed');
end;
$$;

create or replace function public.cancel_booking(p_booking_id uuid)
returns json language plpgsql security definer set search_path = public as $$
begin
  update public.bookings set status = 'cancelled' where id = p_booking_id;
  if not found then return json_build_object('success', false, 'error', 'Booking not found.'); end if;
  return json_build_object('success', true, 'booking_id', p_booking_id, 'status', 'cancelled');
end;
$$;

revoke all on function public.confirm_booking_after_payment(uuid, text) from public, anon, authenticated;
revoke all on function public.cancel_booking(uuid) from public, anon, authenticated;
grant execute on function public.create_booking(text, text, text, date, text, text) to anon, authenticated;
grant execute on function public.confirm_booking_after_payment(uuid, text) to service_role;
grant execute on function public.cancel_booking(uuid) to service_role;

commit;
