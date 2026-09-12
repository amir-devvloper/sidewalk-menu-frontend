-- Migration for the new panel features.
-- Run this once against the Supabase project (SQL editor or psql).

-- 5) End-of-day inventory: a product can be marked "sold out for today"
--    without touching its permanent `available` flag. It naturally stops
--    applying once the date rolls over, since the app compares this to
--    the current date on every read — no cron/reset job needed.
ALTER TABLE products
    ADD COLUMN IF NOT EXISTS sold_out_date date;

-- Helpful index for the reports/CSV export date-range queries.
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders (created_at);
CREATE INDEX IF NOT EXISTS idx_orders_customer_phone ON orders (customer_phone);

-- Note: `orders.status` is a free-text column (no DB-level enum), so the
-- new "در حال ارسال" status introduced in routes/orders.js needs no
-- schema change — it's validated in application code only.


-- Aban Gateway payment state for customer orders.
ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'unpaid',
    ADD COLUMN IF NOT EXISTS payment_invoice_id TEXT,
    ADD COLUMN IF NOT EXISTS payment_url TEXT,
    ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_orders_payment_invoice_id
    ON orders (payment_invoice_id);
