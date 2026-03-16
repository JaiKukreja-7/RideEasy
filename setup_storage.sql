-- ==============================================
-- 🚀 SETUP STORAGE FOR AVATARS
-- ==============================================

-- 1. Enable Storage extensions if not enabled
-- CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Create the 'avatars' bucket (Note: This might need to be done in UI, 
-- but we can try to insert into storage.buckets if using superuser, 
-- but RLS is more important)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Set up RLS Policies for 'avatars' bucket
-- Allow public access to read avatars
CREATE POLICY "Public Access" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'avatars');

-- Allow authenticated users to upload their own avatar
CREATE POLICY "Users can upload their own avatar" 
ON storage.objects FOR INSERT 
WITH CHECK (
    bucket_id = 'avatars' AND 
    auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to update their own avatar
CREATE POLICY "Users can update their own avatar" 
ON storage.objects FOR UPDATE 
USING (
    bucket_id = 'avatars' AND 
    auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to delete their own avatar
CREATE POLICY "Users can delete their own avatar" 
ON storage.objects FOR DELETE 
USING (
    bucket_id = 'avatars' AND 
    auth.uid()::text = (storage.foldername(name))[1]
);
