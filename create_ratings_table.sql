-- Create a table for ratings
create table if not exists ratings (
  id uuid default gen_random_uuid() primary key,
  ride_id uuid references rides(id) on delete cascade not null,
  reviewer_id uuid references profiles(id) on delete cascade not null,
  reviewee_id uuid references profiles(id) on delete cascade not null,
  rating integer check (rating >= 1 and rating <= 5) not null,
  feedback text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table ratings enable row level security;

-- Policies for ratings
drop policy if exists "Ratings are viewable by everyone" on ratings;
create policy "Ratings are viewable by everyone"
  on ratings for select
  using ( true );

drop policy if exists "Users can insert their own reviews" on ratings;
create policy "Users can insert their own reviews"
  on ratings for insert
  with check ( auth.uid() = reviewer_id );

-- Enable Realtime safely
do $$
begin
  if not exists (
    select 1 from pg_publication_tables 
    where pubname = 'supabase_realtime' 
    and tablename = 'ratings'
  ) then
    alter publication supabase_realtime add table ratings;
  end if;
end $$;
