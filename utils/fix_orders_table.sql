-- Ensure ENUM exists first
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_type') THEN 
        create type order_type as enum ('dine-in', 'takeout', 'delivery'); 
    END IF;
END $$;

-- Fix missing columns in orders table
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS customer_name text;

ALTER TABLE orders
ADD COLUMN IF NOT EXISTS table_number text;

ALTER TABLE orders
ADD COLUMN IF NOT EXISTS order_type order_type default 'dine-in';

-- Also check total_amount just in case
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS total_amount numeric(10,2) not null default 0;

-- Refresh cache hints (Supabase usually handles this, but explicitly granting can help)
GRANT ALL ON orders TO authenticated;
GRANT ALL ON orders TO service_role;
