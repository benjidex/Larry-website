(function () {
  const form = document.getElementById('booking-form');
  const messageBox = document.getElementById('form-message');

  if (!form || !messageBox) return;

  async function getSupabaseClient() {
    // Wait for the async config fetch to finish before reading values off it
    if (window.__APP_CONFIG_READY__) {
      try { await window.__APP_CONFIG_READY__; } catch (e) { /* ignore, fall through to defaults */ }
    }

    const supabaseUrl = window.__APP_CONFIG__?.supabaseUrl || window.__SUPABASE_URL__ || '';
    const supabaseAnonKey = window.__APP_CONFIG__?.supabaseAnonKey || window.__SUPABASE_ANON_KEY__ || '';

    const canUseSupabase = !!(supabaseUrl && supabaseAnonKey && window.supabase && window.supabase.createClient);
    return canUseSupabase
      ? window.supabase.createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } })
      : null;
  }

  async function showMessage(text, isError = false) {
    messageBox.textContent = text;
    messageBox.classList.add('visible');
    messageBox.style.color = isError ? '#b91c1c' : '';
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const payload = {
      name: form.elements.name.value.trim(),
      email: form.elements.email.value.trim(),
      phone: form.elements.phone.value.trim(),
      date: form.elements.date.value,
      service: form.elements.service.value,
      message: form.elements.message?.value?.trim?.() || ''
    };

    if (!payload.name || !payload.email || !payload.phone || !payload.date || !payload.service || !payload.message) {
      await showMessage('Please fill in all fields before reserving a slot.', true);
      return;
    }

    const supabase = await getSupabaseClient();
    if (!supabase) {
      await showMessage('Booking is temporarily unavailable. Please try again later.', true);
      return;
    }

    try {
      await showMessage('Reserving your session slot...');

      // Use the database RPC instead of inserting directly. This keeps the
      // browser independent of table column names and works with RLS enabled.
      const { data, error } = await supabase.rpc('create_booking', {
        p_name: payload.name,
        p_email: payload.email,
        p_phone: payload.phone,
        p_date: payload.date,
        p_service: payload.service,
        p_message: payload.message
      });

      if (error) {
        throw new Error(error.message || 'Could not reserve slot.');
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Could not reserve slot.');
      }

      await showMessage(`Booking request received for ${payload.date}. It is pending confirmation.`, false);
      form.reset();
    } catch (err) {
      await showMessage(err.message || 'Could not complete booking.', true);
    }
  });
})();
