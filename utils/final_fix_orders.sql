-- MASTER FIX SCRIPT (Full Idempotent Version)
-- Run this to resolve RLS and status update issues without "Already Exists" errors

DO $$ 
BEGIN
    -- 1. DROP CONSTRAINTS AND POLICIES FOR A CLEAN START
    -- We use a DO block to safely drop constraints if they exist
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_status') THEN
        ALTER TABLE orders DROP CONSTRAINT check_status;
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_order_type') THEN
        ALTER TABLE orders DROP CONSTRAINT check_order_type;
    END IF;
END $$;

BEGIN;

-- Drop all possible existing policies to ensure clean slate
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON orders;
DROP POLICY IF EXISTS "Enable select for users based on user_id" ON orders;
DROP POLICY IF EXISTS "Enable update for staff" ON orders;
DROP POLICY IF EXISTS "Users can create their own orders" ON orders;
DROP POLICY IF EXISTS "Users can view their own orders" ON orders;
DROP POLICY IF EXISTS "Staff can manage all orders" ON orders;
DROP POLICY IF EXISTS "Public insert" ON orders;
DROP POLICY IF EXISTS "order_select_policy" ON orders;
DROP POLICY IF EXISTS "order_insert_policy" ON orders;
DROP POLICY IF EXISTS "order_update_policy" ON orders;

-- 2. ENSURE COLUMNS AND TYPES
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_name text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS table_number text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS total_amount numeric(10,2) default 0;

ALTER TABLE orders ALTER COLUMN status TYPE text;
ALTER TABLE orders ALTER COLUMN order_type TYPE text;

-- 3. APPLY BUSINESS CONSTRAINTS
ALTER TABLE orders ADD CONSTRAINT check_status 
CHECK (status IN ('pendiente', 'confirmado', 'preparando', 'listo', 'entregado', 'cancelado', 'pending', 'confirmed', 'completed', 'delivered'));

ALTER TABLE orders ADD CONSTRAINT check_order_type 
CHECK (order_type IN ('dine-in', 'takeout', 'delivery', 'para_llevar', 'domicilio', 'mesa'));

-- 4. CREATE CLEAN RLS POLICIES
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- SELECT policy
CREATE POLICY "order_select_policy" ON orders FOR SELECT TO authenticated
USING (
  auth.uid() = user_id 
  OR 
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role IN ('administrador', 'cajero', 'cocina')
  )
);

-- INSERT policy
CREATE POLICY "order_insert_policy" ON orders FOR INSERT TO authenticated
WITH CHECK (true);

-- UPDATE policy
CREATE POLICY "order_update_policy" ON orders FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role IN ('administrador', 'cajero', 'cocina')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role IN ('administrador', 'cajero', 'cocina')
  )
);

-- 5. PERMISSIONS FOR ORDER ITEMS
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "order_items_select" ON order_items;
DROP POLICY IF EXISTS "order_items_insert" ON order_items;

CREATE POLICY "order_items_select" ON order_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "order_items_insert" ON order_items FOR INSERT TO authenticated WITH CHECK (true);

-- 6. ENSURE DATA CONSISTENCY
UPDATE orders SET status = 'pendiente' WHERE status IS NULL;
ALTER TABLE orders ALTER COLUMN status SET DEFAULT 'pendiente';

-- 7. GRANT PERMISSIONS
GRANT ALL ON orders TO authenticated;
GRANT ALL ON orders TO service_role;
GRANT ALL ON order_items TO authenticated;
GRANT ALL ON order_items TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

COMMIT;
