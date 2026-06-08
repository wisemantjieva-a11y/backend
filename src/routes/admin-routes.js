const express = require('express');
const router  = express.Router();
const pool    = require('../db');

const ADMIN_KEY = process.env.ADMIN_KEY || 'cutbook_admin_2026';

function adminAuth(req, res, next) {
  const key = req.headers['x-admin-key'];
  if (key !== ADMIN_KEY) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

router.get('/shops', adminAuth, async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT s.id, s.name, s.area, s.address, s.phone,
        s.is_active, s.created_at,
        COALESCE(sub.plan,'basic') AS plan,
        COALESCE(sub.status,'pending') AS sub_status,
        sub.next_billing,
        COUNT(b.id) AS booking_count
      FROM barbershops s
      LEFT JOIN subscriptions sub ON sub.shop_id = s.id
      LEFT JOIN bookings b ON b.shop_id = s.id
      GROUP BY s.id, sub.plan, sub.status, sub.next_billing
      ORDER BY s.created_at DESC
    `);
    res.json(rows);
  } catch (err) { next(err); }
});

router.patch('/shops/:id/approve', adminAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    await pool.query(`UPDATE barbershops SET is_active = true WHERE id = $1`, [id]);
    await pool.query(`
      INSERT INTO subscriptions (shop_id, plan, status, next_billing)
      VALUES ($1, 'basic', 'active', NOW() + INTERVAL '30 days')
      ON CONFLICT (shop_id) DO UPDATE SET status='active', next_billing=NOW() + INTERVAL '30 days'
    `, [id]);
    res.json({ message: 'Shop approved' });
  } catch (err) { next(err); }
});

router.patch('/shops/:id/reject', adminAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    await pool.query(`UPDATE barbershops SET is_active = false WHERE id = $1`, [id]);
    await pool.query(`UPDATE subscriptions SET status = 'suspended' WHERE shop_id = $1`, [id]);
    res.json({ message: 'Shop rejected' });
  } catch (err) { next(err); }
});

router.patch('/shops/:id/lock', adminAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    await pool.query(`UPDATE barbershops SET is_active = false WHERE id = $1`, [id]);
    await pool.query(`UPDATE subscriptions SET status = 'unpaid' WHERE shop_id = $1`, [id]);
    res.json({ message: 'Shop locked' });
  } catch (err) { next(err); }
});

router.patch('/shops/:id/unlock', adminAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    await pool.query(`UPDATE barbershops SET is_active = true WHERE id = $1`, [id]);
    await pool.query(`
      UPDATE subscriptions SET status = 'active', next_billing = NOW() + INTERVAL '30 days'
      WHERE shop_id = $1
    `, [id]);
    res.json({ message: 'Shop unlocked' });
  } catch (err) { next(err); }
});

router.get('/stats', adminAuth, async (req, res, next) => {
  try {
    const shops = await pool.query(`SELECT COUNT(*) FROM barbershops WHERE is_active = true`);
    const bookings = await pool.query(`SELECT COUNT(*) FROM bookings WHERE status != 'cancelled'`);
    res.json({
      active_shops: parseInt(shops.rows[0].count),
      total_bookings: parseInt(bookings.rows[0].count),
      total_revenue: 0,
      monthly_recurring: parseInt(shops.rows[0].count) * 150,
    });
  } catch (err) { next(err); }
});

module.exports = router;
