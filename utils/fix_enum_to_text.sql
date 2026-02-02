-- Fix Enum Issues by converting to TEXT with constraints
-- This resolves "invalid input value" errors permanently

-- 1. Remove defaults temporarily
ALTER TABLE orders ALTER COLUMN status DROP DEFAULT;
ALTER TABLE orders ALTER COLUMN order_type DROP DEFAULT;

-- 2. Convert to TEXT
ALTER TABLE orders ALTER COLUMN status TYPE text USING status::text;
ALTER TABLE orders ALTER COLUMN order_type TYPE text USING order_type::text;

-- 3. Drop the problematic types
DROP TYPE IF EXISTS order_status;
DROP TYPE IF EXISTS order_type;

-- 3b. Fix existing bad data before adding constraints (Normalize to Spanish)
UPDATE orders SET status = 'pendiente';

-- 4. Re-add strict checks with Spanish values
ALTER TABLE orders DROP CONSTRAINT IF EXISTS check_status;
ALTER TABLE orders ADD CONSTRAINT check_status CHECK (status IN ('pendiente', 'confirmado', 'preparando', 'listo', 'entregado', 'cancelado'));

ALTER TABLE orders DROP CONSTRAINT IF EXISTS check_order_type;
ALTER TABLE orders ADD CONSTRAINT check_order_type CHECK (order_type IN ('dine-in', 'takeout', 'delivery', 'para_llevar', 'domicilio', 'mesa'));

-- 5. Restore Defaults
ALTER TABLE orders ALTER COLUMN status SET DEFAULT 'pendiente';
ALTER TABLE orders ALTER COLUMN order_type SET DEFAULT 'dine-in';
