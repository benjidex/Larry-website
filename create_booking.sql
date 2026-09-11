CREATE OR REPLACE FUNCTION public.create_booking(
  p_name text,
  p_email text,
  p_phone text,
  p_date date,
  p_service text,
  p_message text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booking_id uuid;
BEGIN

DROP INDEX IF EXISTS idx_bookings_confirmed_date;

CREATE UNIQUE INDEX idx_bookings_confirmed_date
ON public.bookings(date)
WHERE status = 'confirmed';

  -- Check if the date is already booked
  IF EXISTS (
    SELECT 1
    FROM public.bookings
    WHERE date = p_date
      AND status = 'confirmed'
  ) THEN

    RETURN json_build_object(
      'success', false,
      'error', 'This date is already booked.'
    );

  END IF;


  INSERT INTO public.bookings (
    customer_name,
    customer_email,
    customer_phone,
    date,
    service,
    message,
    status
  )
  VALUES (
    p_name,
    p_email,
    p_phone,
    p_date,
    p_service,
    p_message,
    'pending'
  )
  RETURNING id INTO v_booking_id;


  RETURN json_build_object(
    'success', true,
    'booking_id', v_booking_id,
    'status', 'pending'
  );


EXCEPTION
  WHEN unique_violation THEN

    RETURN json_build_object(
      'success', false,
      'error', 'This date is already booked.'
    );

END;
$$;