-- Fix missing columns in order_items table
ALTER TABLE order_items 
ADD COLUMN IF NOT EXISTS extras jsonb;

ALTER TABLE order_items 
ADD COLUMN IF NOT EXISTS selected_size text;

-- Refresh cache hints
GRANT ALL ON order_items TO authenticated;
GRANT ALL ON order_items TO service_role;
