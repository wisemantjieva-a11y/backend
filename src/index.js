require('dotenv').config();
const express = require('express');
const cors = require('cors');

const shopRoutes    = require('./routes/shops');
const bookingRoutes = require('./routes/bookings');
const authRoutes    = require('./routes/auth');

const app = express();

app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', app: 'CutBook API' }));

// Routes
app.use('/api/auth',     authRoutes);
app.use('/api/shops',    shopRoutes);
const bookingsRouter = require('./routes/bookings');
app.use('/api/bookings', bookingsRouter);
app.use('/api/bookings', bookingRoutes);
app.use('/api/admin',   require('./routes/admin-routes'));

// Global error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`CutBook API running on port ${PORT}`));
