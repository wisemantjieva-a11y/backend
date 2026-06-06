const express = require('express');
const router = express.Router();
const pool = require('../db');

router.post('/', async (req, res) => {
  const { shopId, serviceId, date, time, customerName, customerPhone } = req.body;

  try {
    // Create or find customer
    let customerResult = await pool.query(
      'INSERT INTO customers (name, phone) VALUES ($1, $2) ON CONFLICT (phone) DO UPDATE SET name = $1 RETURNING id',
      [customerName, customerPhone]
    );

    const customerId = customerResult.rows[0].id;

    // Create booking
    const bookingResult = await pool.query(
      `INSERT INTO bookings 
       (shop_id, service_id, customer_id, booking_date, booking_time, status) 
       VALUES ($1, $2, $3, $4, $5, 'confirmed') 
       RETURNING *`,
      [shopId, serviceId, customerId, date, time]
    );

    res.status(201).json({
      id: bookingResult.rows[0].id,
      ...bookingResult.rows[0],
      message: "Booking confirmed successfully!"
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create booking' });
  }
});

module.exports = router;