-- Create a table for driver locations
create table if not exists driver_locations (
  user_id uuid references profiles(id) on delete cascade primary key,
  lat numeric not null,
  lng numeric not null,
  is_online boolean default true,
  updated_at timestamp with time zone default now()
);

-- Enable RLS
alter table driver_locations enable row level security;

-- Policies
drop policy if exists "Driver locations are viewable by everyone" on driver_locations;
create policy "Driver locations are viewable by everyone"
  on driver_locations for select
  using ( is_online = true );

drop policy if exists "Drivers can update their own location" on driver_locations;
create policy "Drivers can update their own location"
  on driver_locations for insert
  with check ( auth.uid() = user_id );

drop policy if exists "Drivers can update their own location update" on driver_locations;
create policy "Drivers can update their own location update"
  on driver_locations for update
  using ( auth.uid() = user_id );
ALTER TABLE driver_locations ADD COLUMN IF NOT EXISTS is_busy boolean DEFAULT false;
