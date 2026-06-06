-- CutBook Database Schema
-- Run this file to set up the database from scratch

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── BARBERSHOPS ─────────────────────────────────────────────────────────────
CREATE TABLE barbershops (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          VARCHAR(100) NOT NULL,
  area          VARCHAR(100) NOT NULL,           -- e.g. Katutura, Khomasdal
  address       TEXT NOT NULL,
  phone         VARCHAR(20) NOT NULL,
  whatsapp      VARCHAR(20),
  logo_url      TEXT,
  cover_url     TEXT,
  description   TEXT,
  is_active     BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─── BARBERS (staff at each shop) ────────────────────────────────────────────
CREATE TABLE barbers (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id       UUID NOT NULL REFERENCES barbershops(id) ON DELETE CASCADE,
  name          VARCHAR(100) NOT NULL,
  photo_url     TEXT,
  is_active     BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─── SERVICES (menu of cuts/services per shop) ───────────────────────────────
CREATE TABLE services (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id       UUID NOT NULL REFERENCES barbershops(id) ON DELETE CASCADE,
  name          VARCHAR(100) NOT NULL,           -- e.g. "Haircut", "Fade + Beard"
  description   TEXT,
  price_nad     INTEGER NOT NULL,                -- price in Namibian dollars
  duration_min  INTEGER NOT NULL DEFAULT 30,     -- duration in minutes
  is_active     BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─── AVAILABILITY (weekly opening hours per shop) ────────────────────────────
CREATE TABLE availability (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id       UUID NOT NULL REFERENCES barbershops(id) ON DELETE CASCADE,
  day_of_week   INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sun, 6=Sat
  open_time     TIME NOT NULL,
  close_time    TIME NOT NULL,
  is_closed     BOOLEAN DEFAULT false,
  UNIQUE (shop_id, day_of_week)
);

-- ─── CUSTOMERS ───────────────────────────────────────────────────────────────
CREATE TABLE customers (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          VARCHAR(100) NOT NULL,
  phone         VARCHAR(20) NOT NULL UNIQUE,
  email         VARCHAR(150),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─── BOOKINGS ────────────────────────────────────────────────────────────────
CREATE TABLE bookings (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id       UUID NOT NULL REFERENCES barbershops(id),
  barber_id     UUID REFERENCES barbers(id),
  service_id    UUID NOT NULL REFERENCES services(id),
  customer_id   UUID NOT NULL REFERENCES customers(id),
  booking_date  DATE NOT NULL,
  booking_time  TIME NOT NULL,
  -- status: pending | confirmed | completed | cancelled | no_show
  status        VARCHAR(20) NOT NULL DEFAULT 'confirmed',
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  -- prevent double-booking the same barber at the same slot
  UNIQUE (barber_id, booking_date, booking_time)
);

-- ─── PAYMENTS ────────────────────────────────────────────────────────────────
CREATE TABLE payments (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id    UUID NOT NULL REFERENCES bookings(id) UNIQUE,
  amount_nad    INTEGER NOT NULL,
  -- method: cash | momo | card
  method        VARCHAR(20) NOT NULL DEFAULT 'cash',
  -- status: pending | paid | failed | refunded
  status        VARCHAR(20) NOT NULL DEFAULT 'pending',
  reference     VARCHAR(100),                   -- MoMo or card transaction ref
  paid_at       TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─── REVIEWS ─────────────────────────────────────────────────────────────────
CREATE TABLE reviews (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id    UUID NOT NULL REFERENCES bookings(id) UNIQUE,
  shop_id       UUID NOT NULL REFERENCES barbershops(id),
  customer_id   UUID NOT NULL REFERENCES customers(id),
  rating        INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment       TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─── SHOP SUBSCRIPTIONS (billing) ────────────────────────────────────────────
CREATE TABLE subscriptions (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id       UUID NOT NULL REFERENCES barbershops(id) UNIQUE,
  -- plan: basic (N$150) | pro (N$300)
  plan          VARCHAR(20) NOT NULL DEFAULT 'basic',
  status        VARCHAR(20) NOT NULL DEFAULT 'active',
  billing_day   INTEGER DEFAULT 1,              -- day of month to bill
  next_billing  DATE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─── INDEXES for performance ──────────────────────────────────────────────────
CREATE INDEX idx_bookings_shop_date   ON bookings(shop_id, booking_date);
CREATE INDEX idx_bookings_customer    ON bookings(customer_id);
CREATE INDEX idx_bookings_barber_date ON bookings(barber_id, booking_date);
CREATE INDEX idx_services_shop        ON services(shop_id);
CREATE INDEX idx_barbers_shop         ON barbers(shop_id);
CREATE INDEX idx_reviews_shop         ON reviews(shop_id);

-- ─── SEED: sample Windhoek barbershop ────────────────────────────────────────
INSERT INTO barbershops (name, area, address, phone, whatsapp, description) VALUES
  ('Fresh Cutz', 'Katutura', '14 Tobias Hainyeko St, Katutura, Windhoek', '+264811234567', '+264811234567',
   'Windhoek''s freshest cuts. Walk-ins welcome, bookings preferred.');

INSERT INTO barbers (shop_id, name) 
SELECT id, 'Kevin' FROM barbershops WHERE name = 'Fresh Cutz';

INSERT INTO services (shop_id, name, price_nad, duration_min) 
SELECT id, 'Haircut', 80, 30 FROM barbershops WHERE name = 'Fresh Cutz'
UNION ALL
SELECT id, 'Fade only', 60, 20 FROM barbershops WHERE name = 'Fresh Cutz'
UNION ALL
SELECT id, 'Haircut + Beard', 130, 45 FROM barbershops WHERE name = 'Fresh Cutz'
UNION ALL
SELECT id, 'Kids cut', 50, 25 FROM barbershops WHERE name = 'Fresh Cutz';

INSERT INTO availability (shop_id, day_of_week, open_time, close_time)
SELECT id, d, '08:00', '18:00' FROM barbershops, generate_series(1,6) AS d
WHERE name = 'Fresh Cutz';

INSERT INTO availability (shop_id, day_of_week, open_time, close_time, is_closed)
SELECT id, 0, '09:00', '14:00', true FROM barbershops WHERE name = 'Fresh Cutz';
