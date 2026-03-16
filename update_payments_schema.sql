-- ==============================================
-- 🚀 UPDATE SUBSCRIPTION TABLES FOR PAYMENTS
-- ==============================================

-- 1. Add payment_id to driver_subscriptions
ALTER TABLE driver_subscriptions 
ADD COLUMN IF NOT EXISTS payment_id TEXT;

-- 2. Add payment_id to rider subscriptions
ALTER TABLE subscriptions 
ADD COLUMN IF NOT EXISTS payment_id TEXT;
