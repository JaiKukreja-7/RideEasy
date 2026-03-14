-- ==============================================
-- 🚀 RIDE EASY FULL DATABASE UPDATE SCRIPT (RETRY)
-- Copy ALL of this script and run it in the Supabase SQL Editor
-- ==============================================

-- 1. FIX THE RIDES STATUS CONSTRAINT (To let drivers mark "I Have Arrived")
DO $$ 
BEGIN 
    ALTER TABLE rides DROP CONSTRAINT IF EXISTS rides_status_check;
    ALTER TABLE rides ADD CONSTRAINT rides_status_check 
        CHECK (status IN ('requested', 'accepted', 'arrived', 'in_progress', 'completed', 'cancelled'));
EXCEPTION
    WHEN others THEN 
        RAISE NOTICE 'Could not update constraint automatically.';
END $$;

-- 2. CREATE DRIVER LOCATIONS TABLE (For real-time map tracking)
create table if not exists driver_locations (
  user_id uuid references profiles(id) primary key,
  lat numeric not null,
  lng numeric not null,
  is_online boolean default true,
  is_busy boolean default false,
  updated_at timestamp with time zone default now()
);

-- Safely add is_busy if table already existed but without the column
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='driver_locations' AND column_name='is_busy') THEN
        ALTER TABLE driver_locations ADD COLUMN is_busy boolean DEFAULT false;
    END IF;
END $$;

-- Enable RLS for Driver Locations
alter table driver_locations enable row level security;

-- Policies for Driver Locations (Safely drop and recreate or create if not exists)
DO $$
BEGIN
    DROP POLICY IF EXISTS "Driver locations are viewable by everyone" ON driver_locations;
    DROP POLICY IF EXISTS "Drivers can update their own location" ON driver_locations;
    DROP POLICY IF EXISTS "Drivers can update their own location update" ON driver_locations;
END $$;

create policy "Driver locations are viewable by everyone" on driver_locations for select using ( true );
create policy "Drivers can update their own location" on driver_locations for insert with check ( auth.uid() = user_id );
create policy "Drivers can update their own location update" on driver_locations for update using ( auth.uid() = user_id );

-- 3. FIX RATINGS TABLE
-- Dropping and recreating once to ensure clean schema (careful: wipes old ratings data)
DROP TABLE IF EXISTS ratings;

create table ratings (
    id uuid default gen_random_uuid() primary key,
    ride_id uuid references rides(id) unique not null,
    reviewer_id uuid references profiles(id) not null,
    reviewee_id uuid references profiles(id) not null,
    rating integer check (rating >= 1 and rating <= 5) not null,
    feedback text,
    created_at timestamp with time zone default now()
);

alter table ratings enable row level security;
DO $$
BEGIN
    DROP POLICY IF EXISTS "Customers can insert ratings for their rides" ON ratings;
    DROP POLICY IF EXISTS "Ratings are readable by everyone" ON ratings;
END $$;
create policy "Customers can insert ratings for their rides" on ratings for insert with check (true);
create policy "Ratings are readable by everyone" on ratings for select using (true);

-- 4. CREATE SUBSCRIPTIONS TABLE
create table if not exists subscriptions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) not null,
  plan_type text check (plan_type in ('free', 'silver', 'gold', 'platinum')),
  status text default 'active',
  start_date timestamp with time zone default now(),
  end_date timestamp with time zone,
  created_at timestamp with time zone default now()
);

alter table subscriptions enable row level security;

DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view their own subscription" ON subscriptions;
END $$;
create policy "Users can view their own subscription" on subscriptions for select using ( auth.uid() = user_id );

-- 5. CREATE COUPONS TABLE
create table if not exists coupons (
  id uuid default gen_random_uuid() primary key,
  code text unique not null,
  discount_percent integer not null,
  max_discount_amount decimal,
  is_active boolean default true,
  expiry_date timestamp with time zone,
  created_at timestamp with time zone default now()
);

alter table coupons enable row level security;

DO $$
BEGIN
    DROP POLICY IF EXISTS "Anyone can view active coupons" ON coupons;
END $$;
create policy "Anyone can view active coupons" on coupons for select using ( is_active = true );

-- 6. RELOAD SCHEMA CACHE
-- (Force Supabase to pick up new columns instantly)
NOTIFY pgrst, 'reload schema';
COMMIT;
