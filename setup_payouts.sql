-- Add payment details to profiles
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS upi_id TEXT,
ADD COLUMN IF NOT EXISTS bank_name TEXT,
ADD COLUMN IF NOT EXISTS bank_account_number TEXT,
ADD COLUMN IF NOT EXISTS bank_ifsc_code TEXT;

-- Create payouts table
CREATE TABLE IF NOT EXISTS payouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    method TEXT NOT NULL, -- 'upi' or 'bank'
    details JSONB NOT NULL, -- stores upi_id or bank details at time of request
    status TEXT DEFAULT 'pending', -- 'pending', 'processed', 'failed'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE payouts ENABLE ROW LEVEL SECURITY;

-- Policies for payouts
drop policy if exists "Drivers can view their own payouts" on payouts;
CREATE POLICY "Drivers can view their own payouts" 
ON payouts FOR SELECT 
USING (auth.uid() = driver_id);

drop policy if exists "Drivers can create payout requests" on payouts;
CREATE POLICY "Drivers can create payout requests" 
ON payouts FOR INSERT 
WITH CHECK (auth.uid() = driver_id);
