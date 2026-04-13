-- ==============================================
-- 🛠️ FIX: CASCADE DELETES FOR PROFILES
-- Run this script in the Supabase SQL Editor to fix the foreign key constraints
-- ==============================================

-- 1. FIX RATINGS TABLE
-- Drop existing constraints if they exist (Postgres automatically gives these names)
ALTER TABLE ratings DROP CONSTRAINT IF EXISTS ratings_reviewer_id_fkey;
ALTER TABLE ratings DROP CONSTRAINT IF EXISTS ratings_reviewee_id_fkey;
ALTER TABLE ratings DROP CONSTRAINT IF EXISTS ratings_ride_id_fkey;

-- Re-add with ON DELETE CASCADE
ALTER TABLE ratings
  ADD CONSTRAINT ratings_reviewer_id_fkey 
  FOREIGN KEY (reviewer_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE ratings
  ADD CONSTRAINT ratings_reviewee_id_fkey 
  FOREIGN KEY (reviewee_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- Also fix ride_id in ratings if it wasn't cascading
ALTER TABLE ratings
  ADD CONSTRAINT ratings_ride_id_fkey 
  FOREIGN KEY (ride_id) REFERENCES rides(id) ON DELETE CASCADE;


-- 2. FIX RIDES TABLE
ALTER TABLE rides DROP CONSTRAINT IF EXISTS rides_customer_id_fkey;
ALTER TABLE rides DROP CONSTRAINT IF EXISTS rides_driver_id_fkey;

ALTER TABLE rides
  ADD CONSTRAINT rides_customer_id_fkey 
  FOREIGN KEY (customer_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE rides
  ADD CONSTRAINT rides_driver_id_fkey 
  FOREIGN KEY (driver_id) REFERENCES profiles(id) ON DELETE SET NULL; -- Keep ride history if driver is deleted, or use CASCADE


-- 3. FIX SUBSCRIPTIONS TABLE
ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_user_id_fkey;

ALTER TABLE subscriptions
  ADD CONSTRAINT subscriptions_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;


-- 4. FIX DRIVER_LOCATIONS TABLE
ALTER TABLE driver_locations DROP CONSTRAINT IF EXISTS driver_locations_user_id_fkey;

ALTER TABLE driver_locations
  ADD CONSTRAINT driver_locations_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;


-- 5. FIX RIDE_MESSAGES TABLE
ALTER TABLE ride_messages DROP CONSTRAINT IF EXISTS ride_messages_sender_id_fkey;
ALTER TABLE ride_messages
  ADD CONSTRAINT ride_messages_sender_id_fkey 
  FOREIGN KEY (sender_id) REFERENCES profiles(id) ON DELETE CASCADE;


-- 6. FIX USER_FAVORITES TABLE
ALTER TABLE user_favorites DROP CONSTRAINT IF EXISTS user_favorites_user_id_fkey;
ALTER TABLE user_favorites
  ADD CONSTRAINT user_favorites_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


-- 7. FIX PAYOUTS TABLE
ALTER TABLE payouts DROP CONSTRAINT IF EXISTS payouts_driver_id_fkey;
ALTER TABLE payouts
  ADD CONSTRAINT payouts_driver_id_fkey 
  FOREIGN KEY (driver_id) REFERENCES auth.users(id) ON DELETE CASCADE;


-- Notify pgrst to reload schema cache
NOTIFY pgrst, 'reload schema';
