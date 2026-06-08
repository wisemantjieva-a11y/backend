const express = require('express');
const router  = express.Router();
const pool    = require('../db');

// Helper to check if a shop is open right now based on local time
function checkIsOpen(availabilityRows) {
  if (!availabilityRows || availabilityRows.length === 0) return false;

  const options = { timeZone: 'Africa/Windhoek', hour12: false, hour: '2-digit', minute: '2-digit', weekday: 'short' };
  const formatter = new Intl.DateTimeFormat('en-US', options);
  const parts = formatter.formatToParts(new Date());
  
  let currentDayName = '';
  let currentHour = '';
  let currentMinute = '';
  
  parts.forEach(part => {
    if (part.type === 'weekday') currentDayName = part.value; 
    if (part.type === 'hour') currentHour = part.value;
    if (part.type === 'minute') currentMinute = part.value;
  });

  const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const currentDayIndex = DAYS.indexOf(currentDayName);
  
  const todayHours = availabilityRows.find(h => h.day_of_week === currentDayIndex);
  if (!todayHours || todayHours.is_closed) return false;

  const currentTotalMinutes = parseInt(currentHour) * 60 + parseInt(currentMinute);
  
  const [openH, openM] = todayHours.open_time.split(':').map(Number);
  const [closeH, closeM] = todayHours.close_time.split(':').map(Number);
  
  const openTotalMinutes = openH * 60 + openM;
  const closeTotalMinutes = closeH * 60 + closeM;

  return currentTotalMinutes >= openTotalMinutes && currentTotalMinutes < closeTotalMinutes;
}

router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM barbershops WHERE is_active = true ORDER BY created_at DESC');
    const shops = result.rows;

    for (let shop of shops) {
      const availability = await pool.query('SELECT * FROM availability WHERE shop_id = $1', [shop.id]);
      shop.is_open = checkIsOpen(availability.rows);
    }

    res.json(shops);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM barbershops WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Shop not found' });
    
    const shop = result.rows[0];
    const availability = await pool.query('SELECT * FROM availability WHERE shop_id = $1', [shop.id]);
    shop.is_open = checkIsOpen(availability.rows);
    
    res.json(shop);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:id/services', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM services WHERE shop_id = $1 AND is_active = true', [req.params.id]);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:id/availability/:date', async (req, res) => {
  try {
    const { id, date } = req.params;
    const duration = parseInt(req.query.duration) || 30;
    const dayOfWeek = new Date(date + 'T12:00:00').getDay();
    const hours = await pool.query(
      'SELECT * FROM availability WHERE shop_id = $1 AND day_of_week = $2', [id, dayOfWeek]
    );
    if (!hours.rows || hours.rows.length === 0 || hours.rows[0].is_closed) {
      return res.json({ slots: [], message: 'Shop is closed on this day' });
    }
    const h = hours.rows[0];
    const slots = [];
    const openParts = h.open_time.split(':').map(Number);
    const closeParts = h.close_time.split(':').map(Number);
    const openMin = openParts[0] * 60 + openParts[1];
    const closeMin = closeParts[0] * 60 + closeParts[1];
    const booked = await pool.query(
      "SELECT TO_CHAR(booking_time,'HH24:MI') AS t FROM bookings WHERE shop_id=$1 AND booking_date=$2 AND status!='cancelled'",
      [id, date]
    );
    const bookedSet = new Set(booked.rows.map(function(r){return r.t}));
    for (let m = openMin; m + duration <= closeMin; m += 30) {
      const hh = String(Math.floor(m / 60)).padStart(2, '0');
      const mm = String(m % 60).padStart(2, '0');
      const t = hh + ':' + mm;
      slots.push({ time: t, available: !bookedSet.has(t) });
    }
    res.json({ slots });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, area, address, phone, whatsapp, description, hours, services } = req.body;
    if (!name || !area || !address || !phone) {
      return res.status(400).json({ error: 'Name, area, address and phone are required' });
    }
    const result = await pool.query(`
      INSERT INTO barbershops (name, area, address, phone, whatsapp, description, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, false)
      RETURNING *
    `, [name, area, address, phone, whatsapp || null, description || null]);
    const shop = result.rows[0];

    await pool.query(`
      INSERT INTO subscriptions (shop_id, plan, status, next_billing)
      VALUES ($1, 'basic', 'pending', NOW() + INTERVAL '30 days')
      ON CONFLICT (shop_id) DO NOTHING
    `, [shop.id]);

    const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    if (hours && Array.isArray(hours)) {
      for (let i = 0; i < hours.length; i++) {
        const h = hours[i];
        const dayIndex = DAYS.indexOf(h.day);
        if (dayIndex >= 0) {
          await pool.query(`
            INSERT INTO availability (shop_id, day_of_week, open_time, close_time, is_closed)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (shop_id, day_of_week) DO UPDATE
            SET open_time=$3, close_time=$4, is_closed=$5
          `, [shop.id, dayIndex, h.open || '08:00', h.close || '18:00', h.closed ? true : false]);
        }
      }
    }

    if (services && Array.isArray(services)) {
      for (let i = 0; i < services.length; i++) {
        const s = services[i];
        if (s.name && s.price) {
          await pool.query(`
            INSERT INTO services (shop_id, name, price_nad, duration_min)
            VALUES ($1, $2, $3, $4)
          `, [shop.id, s.name, parseInt(s.price) || 0, parseInt(s.duration) || 30]);
        }
      }
    }

    res.status(201).json({ shop, message: 'Application submitted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
