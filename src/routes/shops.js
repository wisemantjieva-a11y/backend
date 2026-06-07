const express  = require('express');
const router = express.Router();
const pool = require('../db');

router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM barbershops');
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

module.exports = router;// POST /api/shops — register a new barbershop
router.post('/', async (req, res, next) => {
  try {
    const db = pool; const { name, area, address, phone, whatsapp, description } = req.body;
    if (!name || !area || !address || !phone) {
      return res.status(400).json({ error: 'Name, area, address and phone are required' });
    }
    const result = await db.query(`
      INSERT INTO barbershops (name, area, address, phone, whatsapp, description)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [name, area, address, phone, whatsapp || null, description || null]);
    const shop = result.rows[0];
    await db.query(`
      INSERT INTO subscriptions (shop_id, plan, next_billing)
      VALUES ($1, 'basic', NOW() + INTERVAL '30 days')
    `, [shop.id]);
    res.status(201).json({ shop, message: 'Barbershop registered successfully' });
  } catch (err) { next(err); }
});