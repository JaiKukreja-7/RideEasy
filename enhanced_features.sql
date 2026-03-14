-- Phase 3: Subscription System
create table if not exists subscriptions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) not null,
  plan_type text check (plan_type in ('free', 'silver', 'gold', 'platinum')),
  status text default 'active',
  start_date timestamp with time zone default now(),
  end_date timestamp with time zone,
  created_at timestamp with time zone default now()
);

-- Phase 5: Ratings & Feedback
create table if not exists ratings (
  id uuid default gen_random_uuid() primary key,
  ride_id uuid references rides(id) not null,
  reviewer_id uuid references profiles(id) not null,
  reviewee_id uuid references profiles(id) not null,
  rating integer check (rating >= 1 and rating <= 5),
  feedback text,
  created_at timestamp with time zone default now()
);

-- Phase 5: Promo Codes & Coupons
create table if not exists coupons (
  id uuid default gen_random_uuid() primary key,
  code text unique not null,
  discount_percent integer not null,
  max_discount_amount decimal,
  is_active boolean default true,
  expiry_date timestamp with time zone,
  created_at timestamp with time zone default now()
);

-- Enhance Rides table for State Machine and Payment Verification
alter table rides 
add column if not exists razorpay_payment_id text,
add column if not exists razorpay_signature text,
add column if not exists otp_code text, -- For safe trip start
add column if not exists cancellation_reason text;

-- RLS Policies for new tables
alter table subscriptions enable row level security;
alter table ratings enable row level security;
alter table coupons enable row level security;

create policy "Users can view their own subscription"
  on subscriptions for select using ( auth.uid() = user_id );

create policy "Users can view ratings related to them"
  on ratings for select using ( auth.uid() = reviewer_id or auth.uid() = reviewee_id );

create policy "Anyone can view active coupons"
  on coupons for select using ( is_active = true );

-- PostGIS RPC for nearby drivers
create or replace function get_nearby_drivers(pickup_lat decimal, pickup_lng decimal)
returns setof driver_locations as $$
begin
  return query
  select *
  from driver_locations
  where is_online = true and is_busy = false
  order by st_distance(
    st_point(lng, lat)::geography,
    st_point(pickup_lng, pickup_lat)::geography
  )
  limit 10;
end;
$$ language plpgsql security definer;
