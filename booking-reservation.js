(function () {
  const form = document.getElementById('booking-form');
  const messageBox = document.getElementById('form-message');

  if (!form || !messageBox) return;

  const supabaseUrl = window.__SUPABASE_URL__ || window.__APP_CONFIG__?.supabaseUrl || '';
  const supabaseAnonKey = window.__SUPABASE_ANON_KEY__ || window.__APP_CONFIG__?.supabaseAnonKey || '';

  const canUseSupabase = !!(supabaseUrl && supabaseAnonKey && window.supabase && window.supabase.createClient);
  const supabase = canUseSupabase ? window.supabase.createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } }) : null;

  const originIsFile = location.protocol === 'file:' || !location.hostname;
  const apiBase = originIsFile ? (`http://localhost:${window.__APP_CONFIG__?.port || '3001'}`) : '';

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

    try {
      await showMessage('Reserving your session slot...');

      const response = await fetch(apiBase + '/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok) {
        const errMsg = result?.error || (result?.details ? result.details.join('; ') : 'Unable to reserve your slot.');
        throw new Error(errMsg || 'Could not reserve slot.');
      }

      await showMessage(`Reserved! Your session for ${payload.date} is now confirmed.`, false);
      form.reset();
    } catch (err) {
      await showMessage(err.message || 'Could not complete booking.', true);
    }
  });
})();


