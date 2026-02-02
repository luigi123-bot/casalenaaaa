-- 1. Ensure Columns Exist (Fixes Schema)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_name text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS table_number text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS total_amount numeric(10,2) default 0;

-- Ensure Enums
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_status') THEN 
        create type order_status as enum ('pending', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled'); 
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_type') THEN 
        create type order_type as enum ('dine-in', 'takeout', 'delivery'); 
    END IF;
END $$;

-- Add Enum Columns if missing
ALTER TABLE orders ADD COLUMN IF NOT EXISTS status order_status default 'pending';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_type order_type default 'dine-in';

-- 2. FIX PERMISSIONS (RLS)
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- Drop old policies to clean up
DROP POLICY IF EXISTS "Users can view their own orders" ON orders;
DROP POLICY IF EXISTS "Users can create their own orders" ON orders;
DROP POLICY IF EXISTS "Staff can view all orders" ON orders;
DROP POLICY IF EXISTS "Staff can update orders" ON orders;

DROP POLICY IF EXISTS "Users can view their own order items" ON order_items;
DROP POLICY IF EXISTS "Users can create their own order items" ON order_items;
DROP POLICY IF EXISTS "Staff can view all order items" ON order_items;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON orders;
DROP POLICY IF EXISTS "Enable read access for all users" ON orders;

-- Create Permissive Policies for Development (simplifies troubleshooting)
-- ORDERS
CREATE POLICY "Users can create their own orders" ON orders FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view their own orders" ON orders FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Staff can manage all orders" ON orders USING (
  exists (select 1 from profiles where id = auth.uid() and role in ('administrador', 'cajero', 'cocina'))
);

-- ITEMS
CREATE POLICY "Users can create order items" ON order_items FOR INSERT WITH CHECK (
  exists (select 1 from orders where id = order_items.order_id and user_id = auth.uid())
);
CREATE POLICY "Users can view their order items" ON order_items FOR SELECT USING (
  exists (select 1 from orders where id = order_items.order_id and user_id = auth.uid())
);
CREATE POLICY "Staff can manage all items" ON order_items USING (
  exists (select 1 from profiles where id = auth.uid() and role in ('administrador', 'cajero', 'cocina'))
);

-- Grant privileges
GRANT ALL ON orders TO authenticated;
GRANT ALL ON orders TO service_role;
GRANT ALL ON order_items TO authenticated;
GRANT ALL ON order_items TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
