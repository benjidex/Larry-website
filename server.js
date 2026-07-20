const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const nodemailer = require('nodemailer');
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

// ── Email transporter (Gmail SMTP) ──────────────────────────────────
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: Number(process.env.EMAIL_PORT) || 465,
  secure: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

const STUDIO_EMAIL = process.env.EMAIL_USER || 'larrylarstudios@gmail.com';

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

async function sendBookingNotification(booking) {
  try {
    const mailOptions = {
      from: `"Larry Lar Studio" <${STUDIO_EMAIL}>`,
      to: STUDIO_EMAIL,
      subject: `📸 New Booking: ${booking.service} — ${booking.name}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1a1a1a;">New Booking Request</h2>
          <table style="width: 100%; border-collapse: collapse; margin-top: 16px;">
            <tr>
              <td style="padding: 8px 12px; background: #f5f5f5; font-weight: bold; width: 120px;">Name</td>
              <td style="padding: 8px 12px;">${booking.name}</td>
            </tr>
            <tr>
              <td style="padding: 8px 12px; background: #f5f5f5; font-weight: bold;">Email</td>
              <td style="padding: 8px 12px;">
                <a href="mailto:${booking.email}">${booking.email}</a>
              </td>
            </tr>
            <tr>
              <td style="padding: 8px 12px; background: #f5f5f5; font-weight: bold;">Phone</td>
              <td style="padding: 8px 12px;">${booking.phone}</td>
            </tr>
            <tr>
              <td style="padding: 8px 12px; background: #f5f5f5; font-weight: bold;">Service</td>
              <td style="padding: 8px 12px;">${booking.service}</td>
            </tr>
            <tr>
              <td style="padding: 8px 12px; background: #f5f5f5; font-weight: bold;">Requested Date</td>
              <td style="padding: 8px 12px;">${booking.date}</td>
            </tr>
            <tr>
              <td style="padding: 8px 12px; background: #f5f5f5; font-weight: bold;">Message</td>
              <td style="padding: 8px 12px;">${booking.message}</td>
            </tr>
            <tr>
              <td style="padding: 8px 12px; background: #f5f5f5; font-weight: bold;">Booked At</td>
              <td style="padding: 8px 12px;">${new Date(booking.created_at).toLocaleString()}</td>
            </tr>
          </table>
          <p style="margin-top: 20px; color: #666;">
            Reply to <a href="mailto:${booking.email}">${booking.email}</a> to follow up with this client.
          </p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log(`📧 Email notification sent for booking ${booking.id}`);
  } catch (err) {
    console.error('Failed to send email notification:', err.message);
  }
}

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

    // Send email notification asynchronously (don't block response)
    sendBookingNotification(data);

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
  console.log(`Email: ${process.env.EMAIL_USER ? 'configured' : 'missing'}`);
});

