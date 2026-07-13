const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '200kb' }));

const dataDir = path.join(__dirname, 'data');
const bookingsFile = path.join(dataDir, 'bookings.json');

function ensureStorage() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(bookingsFile)) fs.writeFileSync(bookingsFile, JSON.stringify([]), 'utf8');
}

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

  // Date is required from the <input type="date"> which returns yyyy-mm-dd
  const dateOk = /^\d{4}-\d{2}-\d{2}$/.test(date);

  return { name, email, phone, date, service, message, dateOk };
}

app.post('/api/bookings', (req, res) => {
  try {
    ensureStorage();

    const { name, email, phone, date, service, message, dateOk } = normalizePayload(req.body);

    const allowedServices = new Set([
      'Portrait',
      'Engagement',
      'Wedding',
      'Birthday',
      'Maternity',
      'Graduation'
    ]);

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

    const raw = fs.readFileSync(bookingsFile, 'utf8');
    const bookings = raw ? JSON.parse(raw) : [];

    const now = new Date();
    const record = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      createdAt: now.toISOString(),
      name,
      email,
      phone,
      date,
      service,
      message
    };

    bookings.push(record);
    fs.writeFileSync(bookingsFile, JSON.stringify(bookings, null, 2), 'utf8');

    return res.status(201).json({ ok: true, booking: record });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Booking backend listening on http://localhost:${PORT}`);
});

