-- Add 'arrived' to the allowed statuses for the rides table
-- We first need to drop the existing constraint if it exists. 
-- In Supabase/Postgres, we can find the constraint name or just try to replace it.
-- Usually, it's safer to just alter the check constraint.

DO $$ 
BEGIN 
    ALTER TABLE rides DROP CONSTRAINT IF EXISTS rides_status_check;
    ALTER TABLE rides ADD CONSTRAINT rides_status_check 
        CHECK (status IN ('requested', 'accepted', 'arrived', 'in_progress', 'completed', 'cancelled'));
EXCEPTION
    WHEN others THEN 
        -- If the constraint had a different name, we might need a different approach
        -- but 'rides_status_check' is the standard for 'check (status in ...)'
        RAISE NOTICE 'Could not update constraint automatically. Please check constraint names.';
END $$;
