const express = require('express');
const router  = express.Router();
const pool    = require('../db');

router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM barbershops WHERE is_active = true');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM barbershops WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Shop not found' });
    res.json(result.rows[0]);
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
    const dayOfWeek = new Date(date).getDay();
    const hours = await pool.query(
      'SELECT * FROM availability WHERE shop_id = $1 AND day_of_week = $2', [id, dayOfWeek]
    );
    if (!hours.rows[0] || hours.rows[0].is_closed) {
      return res.json({ slots: [], message: 'Shop is closed on this day' });
    }
    const h = hours.rows[0];
    const slots = [];
    const [oh, om] = h.open_time.split(':').map(Number);
    const [ch, cm] = h.close_time.split(':').map(Number);
    const openMin = oh * 60 + om;
    const closeMin = ch * 60 + cm;
    for (let m = openMin; m + duration <= closeMin; m += 30) {
      const hh = String(Math.floor(m / 60)).padStart(2, '0');
      const mm = String(m % 60).padStart(2, '0');
      slots.push({ time: `${hh}:${mm}`, available: true });
    }
    res.json({ slots });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, area, address, phone, whatsapp, description } = req.body;
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
    // Save availability hours
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;