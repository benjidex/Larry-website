import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import { dirname, join as pathJoin } from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

dotenv.config();

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

app.use(express.static(__dirname));

// ── Supabase client ──────────────────────────────────────────────────
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY;
const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;

let supabase = null;
if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
} else {
  console.warn('Supabase not configured — falling back to local JSON storage for bookings.');
}

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
    const bName = booking.customer_name;
    const bEmail = booking.customer_email;
    const bPhone = booking.customer_phone;
    const bService = booking.service;
    const bDate = booking.date;
    const bMessage = booking.message;

    const mailOptions = {
      from: `"Larry Lar Studios" <${STUDIO_EMAIL}>`,
      to: STUDIO_EMAIL,
      subject: `📸 New Booking: ${bService} — ${bName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1a1a1a;">New Booking Request</h2>
          <table style="width: 100%; border-collapse: collapse; margin-top: 16px;">
            <tr>
              <td style="padding: 8px 12px; background: #f5f5f5; font-weight: bold; width: 120px;">Name</td>
              <td style="padding: 8px 12px;">${bName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 12px; background: #f5f5f5; font-weight: bold;">Email</td>
              <td style="padding: 8px 12px;">
                <a href="mailto:${bEmail}">${bEmail}</a>
              </td>
            </tr>
            <tr>
              <td style="padding: 8px 12px; background: #f5f5f5; font-weight: bold;">Phone</td>
              <td style="padding: 8px 12px;">${bPhone}</td>
            </tr>
            <tr>
              <td style="padding: 8px 12px; background: #f5f5f5; font-weight: bold;">Service</td>
              <td style="padding: 8px 12px;">${bService}</td>
            </tr>
            <tr>
              <td style="padding: 8px 12px; background: #f5f5f5; font-weight: bold;">Requested Date</td>
              <td style="padding: 8px 12px;">${bDate}</td>
            </tr>
            <tr>
              <td style="padding: 8px 12px; background: #f5f5f5; font-weight: bold;">Message</td>
              <td style="padding: 8px 12px;">${bMessage}</td>
            </tr>
          </table>
          <p style="margin-top: 20px; color: #666;">
            Reply to <a href="mailto:${bEmail}">${bEmail}</a> to follow up with this client.
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
      customer_name: name,
      customer_email: email,
      customer_phone: phone,
      date,
      service,
      message,
      status: 'pending'
    };

    if (supabase) {
      try {
        const { data, error } = await supabase
          .rpc('create_booking', {
            p_name: name,
            p_email: email,
            p_phone: phone,
            p_date: date,
            p_service: service,
            p_message: message
          });

        if (error) throw error;
        if (!data?.success) throw new Error(data?.error || 'Could not create booking.');

        const booking = { ...record, id: data.booking_id, status: data.status };
        sendBookingNotification(booking);
        return res.status(201).json({ ok: true, booking });
      } catch (prodErr) {
        console.error('Supabase booking RPC failed:', prodErr.message || prodErr);
        return res.status(500).json({ ok: false, error: 'Could not create booking.', details: [prodErr.message || String(prodErr)] });
      }
    }

    // Fallback: local JSON storage (data/bookings.json)
    try {
      const dbPath = pathJoin(__dirname, 'data', 'bookings.json');
      let content = '[]';
      try {
        content = await fs.readFile(dbPath, 'utf8');
      } catch (e) {
        // file may not exist yet; we'll create it
        content = '[]';
      }
      const list = JSON.parse(content || '[]');
      list.unshift(record);
      await fs.mkdir(pathJoin(__dirname, 'data'), { recursive: true });
      await fs.writeFile(dbPath, JSON.stringify(list, null, 2), 'utf8');

      // async email (best-effort)
      sendBookingNotification(record).catch(() => {});

      return res.status(201).json({ ok: true, booking: record });
    } catch (err) {
      console.error('Local storage error:', err);
      return res.status(500).json({ ok: false, error: 'Local storage error' });
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

app.get('/api/bookings', async (req, res) => {
  try {
    if (supabase) {
      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .order('date', { ascending: false });

      if (error) {
        console.error('Supabase select error:', error);
        return res.status(500).json({ ok: false, error: 'Database error', details: [error.message] });
      }

      return res.json({ ok: true, bookings: data });
    }

    // Fallback: read from local JSON
    try {
      const dbPath = pathJoin(__dirname, 'data', 'bookings.json');
      let content = '[]';
      try {
        content = await fs.readFile(dbPath, 'utf8');
      } catch (e) {
        content = '[]';
      }
      const list = JSON.parse(content || '[]');
      return res.json({ ok: true, bookings: list });
    } catch (err) {
      console.error('Local storage read error:', err);
      return res.status(500).json({ ok: false, error: 'Local storage error' });
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

app.get('/api/config', (req, res) => {
  res.json({
    supabaseUrl,
    supabaseAnonKey: publishableKey,
    storageBucket: process.env.SUPABASE_STORAGE_BUCKET || 'portfolio-images'
  });
});

// ── Start ────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Booking backend listening on http://localhost:${PORT}`);
  console.log(`Supabase URL: ${supabaseUrl ? supabaseUrl : 'missing'}`);
  console.log(`Supabase anon key available: ${publishableKey ? 'yes' : 'no'}`);
  console.log(`Email configured: ${process.env.EMAIL_USER ? 'yes' : 'no'}`);
});

