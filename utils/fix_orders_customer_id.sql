-- Fix missing customer_id column in orders table that is causing the "schema cache" error
-- Run this in your Supabase SQL Editor

ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS customer_id BIGINT REFERENCES customers(id);

-- Optional: ensure RLS policies allow access to this new column (implicitly covered by "ALL" or existing policies, but good to check)
-- No specific policy needed just for a column if table policies exist.
