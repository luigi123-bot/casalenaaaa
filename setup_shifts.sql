-- TABLA PARA REGISTRAR CERRADOS Y APERTURAS DE CAJA (SESIONES)
-- Esto permite rastrear el fondo inicial y el cierre de cada turno de forma robusta.

CREATE TABLE IF NOT EXISTS public.cashier_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cashier_name TEXT NOT NULL,
    opened_at TIMESTAMPTZ DEFAULT now(),
    closed_at TIMESTAMPTZ,
    initial_fund DECIMAL(12, 2) DEFAULT 0,
    final_cash DECIMAL(12, 2), -- Efectivo contado por el cajero al cerrar
    expected_cash DECIMAL(12, 2), -- Lo que el sistema dice que debería haber
    difference DECIMAL(12, 2), -- (Final - Esperado)
    total_sales DECIMAL(12, 2) DEFAULT 0,
    total_orders INTEGER DEFAULT 0,
    notes TEXT,
    status TEXT DEFAULT 'open', -- 'open' o 'closed'
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS (Seguridad de Fila)
ALTER TABLE public.cashier_sessions ENABLE ROW LEVEL SECURITY;

-- Políticas de Seguridad
-- 1. Los cajeros pueden ver y actualizar sus propias sesiones
-- 2. Los admins pueden ver todo

CREATE POLICY "Allow authenticated users to manage sessions" 
ON public.cashier_sessions
FOR ALL 
TO authenticated 
USING (true); -- En un entorno real se restringiría por ID de usuario si estuviera disponible, por ahora permitimos a todos los autenticados (cajeros/admin)

-- ACTUALIZACIÓN DE LA TABLA SETTINGS (SI NO SE HIZO)
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS auto_cashier_schedule BOOLEAN DEFAULT false;
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS cashier_open_time TIME DEFAULT '13:00:00';
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS cashier_close_time TIME DEFAULT '21:30:00';
