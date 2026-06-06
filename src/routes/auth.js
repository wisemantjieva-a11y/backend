const express = require('express');
const router  = express.Router();
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const db      = require('../db');

// We keep shop owner credentials in a separate table from barbershops
// so we can add admin accounts later too.

// POST /api/auth/register — called during onboarding after shop is created
router.post('/register', async (req, res, next) => {
  try {
    const { shop_id, name, email, password } = req.body;
    if (!shop_id || !name || !email || !password) {
      return res.status(400).json({ error: 'All fields required' });
    }

    // Check shop exists
    const shop = await db.query(`SELECT id FROM barbershops WHERE id = $1`, [shop_id]);
    if (!shop.rows[0]) return res.status(404).json({ error: 'Shop not found' });

    const hash = await bcrypt.hash(password, 10);

    await db.query(`
      CREATE TABLE IF NOT EXISTS shop_owners (
        id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        shop_id   UUID NOT NULL REFERENCES barbershops(id) UNIQUE,
        name      VARCHAR(100) NOT NULL,
        email     VARCHAR(150) NOT NULL UNIQUE,
        password  TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    const { rows } = await db.query(`
      INSERT INTO shop_owners (shop_id, name, email, password)
      VALUES ($1, $2, $3, $4)
      RETURNING id, shop_id, name, email
    `, [shop_id, name, email, hash]);

    const token = jwt.sign(
      { owner_id: rows[0].id, shop_id: rows[0].shop_id },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.status(201).json({ token, owner: rows[0] });
  } catch (err) { next(err); }
});

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    await db.query(`
      CREATE TABLE IF NOT EXISTS shop_owners (
        id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        shop_id   UUID NOT NULL REFERENCES barbershops(id) UNIQUE,
        name      VARCHAR(100) NOT NULL,
        email     VARCHAR(150) NOT NULL UNIQUE,
        password  TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    const { rows } = await db.query(
      `SELECT * FROM shop_owners WHERE email = $1`, [email]
    );

    if (!rows[0]) return res.status(401).json({ error: 'Invalid email or password' });

    const valid = await bcrypt.compare(password, rows[0].password);
    if (!valid)  return res.status(401).json({ error: 'Invalid email or password' });

    const token = jwt.sign(
      { owner_id: rows[0].id, shop_id: rows[0].shop_id },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({ token, owner: { id: rows[0].id, shop_id: rows[0].shop_id, name: rows[0].name, email: rows[0].email } });
  } catch (err) { next(err); }
});

module.exports = router;
