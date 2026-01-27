-- Allow customers to update their own rides (specifically for payment/cancellation)
-- This fixes the "Payment not saving" issue.

CREATE POLICY "Customers can update their own rides"
ON rides FOR UPDATE
USING ( auth.uid() = customer_id )
WITH CHECK ( auth.uid() = customer_id );

-- Optional: If you want to be more restrictive, you can limit it to specific columns if utilizing a trigger or function,
-- but standard RLS via Supabase Client updates row-by-row.
