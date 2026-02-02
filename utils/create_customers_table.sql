-- TABLA DE CLIENTES (Versión simplificada para evitar errores de ya existente)
-- Eliminar tabla si existe para asegurar una creación limpia con los nuevos nombres de columna
DROP TABLE IF EXISTS public.customers CASCADE;

CREATE TABLE public.customers (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    full_name text NOT NULL,
    phone text UNIQUE NOT NULL,
    address text,
    created_at timestamptz DEFAULT now(),
    last_order_at timestamptz DEFAULT now(),
    auth_user_id uuid REFERENCES auth.users(id)
);

-- Habilitar RLS
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- Políticas de Seguridad
CREATE POLICY "Staff can manage customers" ON public.customers
FOR ALL TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.role IN ('administrador', 'cajero', 'cocina')
    )
);

CREATE POLICY "Users can view their own customer record" ON public.customers
FOR SELECT TO authenticated
USING (auth.uid() = auth_user_id);

-- Índices para búsqueda rápida
CREATE INDEX idx_customers_phone ON public.customers(phone);
CREATE INDEX idx_customers_full_name ON public.customers(full_name);

-- Vincular con pedidos
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'orders' AND COLUMN_NAME = 'db_customer_id') THEN
        ALTER TABLE orders ADD COLUMN db_customer_id uuid REFERENCES public.customers(id);
    END IF;
END $$;
