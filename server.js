const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

// ── Supabase client ──────────────────────────────────────────────────
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SECRET_KEY in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// ── Middleware ────────────────────────────────────────────────────────
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '200kb' }));

// ── Helpers ──────────────────────────────────────────────────────────

function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function normalizePayload(payload) {
  const name = String(payload?.name ?? '').trim();
  const email = String(payload?.email ?? '').trim();
  const phone = String(payload?.phone ?? '').trim();
  const date = String(payload?.date ?? '').trim();
  const service = String(payload?.service ?? '').trim();
  const message = String(payload?.message ?? '').trim();

  const dateOk = /^\d{4}-\d{2}-\d{2}$/.test(date);

  return { name, email, phone, date, service, message, dateOk };
}

const allowedServices = new Set([
  'Portrait',
  'Engagement',
  'Wedding',
  'Birthday',
  'Maternity',
  'Graduation'
]);

// ── Routes ───────────────────────────────────────────────────────────

app.post('/api/bookings', async (req, res) => {
  try {
    const { name, email, phone, date, service, message, dateOk } = normalizePayload(req.body);

    const errors = [];
    if (!name) errors.push('name is required');
    if (!isValidEmail(email)) errors.push('email is invalid');
    if (!phone) errors.push('phone is required');
    if (!dateOk) errors.push('date is invalid or missing');
    if (!allowedServices.has(service)) errors.push('service is invalid or missing');
    if (!message) errors.push('message is required');

    if (errors.length) {
      return res.status(400).json({ ok: false, error: 'Validation failed', details: errors });
    }

    const record = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      created_at: new Date().toISOString(),
      name,
      email,
      phone,
      date,
      service,
      message
    };

    const { data, error } = await supabase
      .from('bookings')
      .insert(record)
      .select()
      .single();

    if (error) {
      console.error('Supabase insert error:', error);
      return res.status(500).json({ ok: false, error: 'Database error', details: [error.message] });
    }

    return res.status(201).json({ ok: true, booking: data });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

app.get('/api/bookings', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase select error:', error);
      return res.status(500).json({ ok: false, error: 'Database error', details: [error.message] });
    }

    return res.json({ ok: true, bookings: data });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

// ── Start ────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Booking backend listening on http://localhost:${PORT}`);
  console.log(`Supabase: ${supabaseUrl ? 'configured' : 'missing'}`);
});

