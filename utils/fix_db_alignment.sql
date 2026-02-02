-- MASTER DB ALIGNMENT SCRIPT
-- Run this to ensure all columns used in the Cashier and Shop code exist

BEGIN;

-- 1. FIX ORDERS TABLE
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_name text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS phone_number text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_address text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS table_number text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS total_amount numeric(10,2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tax_amount numeric(10,2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method text DEFAULT 'efectivo';

-- 2. FIX ORDER_ITEMS TABLE
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS product_name text;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS quantity integer DEFAULT 1;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS unit_price numeric(10,2) DEFAULT 0;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS total_price numeric(10,2) DEFAULT 0;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS selected_size text;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS extras jsonb;

-- 3. ENSURE PERMISSIONS
-- Grant permissions on the tables to the authenticated role
GRANT ALL ON orders TO authenticated;
GRANT ALL ON order_items TO authenticated;
GRANT ALL ON customers TO authenticated;

-- Ensure RLS is active and simplified for performance
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- Safety Drop
DROP POLICY IF EXISTS "staff_full_access" ON orders;
DROP POLICY IF EXISTS "order_items_staff_access" ON order_items;

-- Staff Policy for Orders (Simplified)
CREATE POLICY "staff_full_access" ON orders
FOR ALL TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = auth.uid() 
        AND role IN ('administrador', 'cajero', 'cocina')
    )
    OR auth.uid() = user_id
);

-- Staff Policy for Order Items
CREATE POLICY "order_items_staff_access" ON order_items
FOR ALL TO authenticated
USING (true); -- Usually items access depends on orders, but this is safer for performance

COMMIT;
