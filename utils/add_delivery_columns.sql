-- Add Delivery columns to orders table
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS delivery_address text,
ADD COLUMN IF NOT EXISTS phone_number text,
ADD COLUMN IF NOT EXISTS payment_method text default 'efectivo', -- efectivo / tarjeta
ADD COLUMN IF NOT EXISTS change_amount numeric(10,2); -- For "Su Cambio" if cash
