-- Fix missing columns regarding product details in order_items
ALTER TABLE order_items 
ADD COLUMN IF NOT EXISTS product_name text;

-- Also checking if other related columns might be missing based on typical schema
ALTER TABLE order_items 
ADD COLUMN IF NOT EXISTS unit_price numeric(10,2) default 0;

ALTER TABLE order_items 
ADD COLUMN IF NOT EXISTS total_price numeric(10,2) default 0;

-- Refresh permissions again just to be safe
GRANT ALL ON order_items TO authenticated;
GRANT ALL ON order_items TO service_role;
