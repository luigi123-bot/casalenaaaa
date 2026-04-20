-- Ejecuta este script en el editor SQL de Supabase (SQL Editor > New Query)

-- 0. Permitir que el sistema acepte el rol "repartidor"
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'repartidor';

-- 1. Crear tabla de flotilla / repartidores
CREATE TABLE IF NOT EXISTS public.delivery_drivers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name TEXT NOT NULL,
    vehicle_type TEXT DEFAULT 'moto',
    is_active BOOLEAN DEFAULT true,
    status TEXT DEFAULT 'disponible',
    current_lat DOUBLE PRECISION,
    current_lng DOUBLE PRECISION,
    last_location_update TIMESTAMP WITH TIME ZONE
);

-- Habilitar RLS básico para repartidores
ALTER TABLE public.delivery_drivers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir lectura publica de repartidores" ON public.delivery_drivers FOR SELECT USING (true);
CREATE POLICY "Permitir actualizaciones publicas de repartidores" ON public.delivery_drivers FOR UPDATE USING (true);
CREATE POLICY "Permitir insercion publica de repartidores" ON public.delivery_drivers FOR INSERT WITH CHECK (true);

-- 2. Actualizar la tabla orders para conectar con repartidores
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS driver_id UUID;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_status TEXT DEFAULT 'pending';

-- 3. (Opcional) Insertar un repartidor de prueba
INSERT INTO public.delivery_drivers (id, full_name, vehicle_type)
VALUES 
    (gen_random_uuid(), 'Carlos Mendoza', 'Moto'),
    (gen_random_uuid(), 'Luis F.', 'Bicicleta')
ON CONFLICT DO NOTHING;
