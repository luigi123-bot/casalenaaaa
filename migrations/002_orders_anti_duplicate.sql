-- ============================================================
--  CASALEÑA POS — Migración 002: Anti-duplicado de Pedidos
--  Ejecutar en: Supabase Dashboard > SQL Editor
--  Ejecutar DESPUÉS de 001_cashier_sessions_fix.sql
-- ============================================================

-- Índices para la detección rápida de duplicados en el servidor
CREATE INDEX IF NOT EXISTS idx_orders_user_total_created
    ON orders(user_id, total_amount, created_at DESC);

-- Función para detectar pedidos duplicados recientes (doble clic, red lenta, etc.)
-- Esta función es usada por el API de save-order como segunda línea de defensa.
-- La primera línea es el check en el código TypeScript (3 segundos).
-- Esta función aplica una ventana más corta (1 segundo) a nivel BD.
CREATE OR REPLACE FUNCTION check_duplicate_order(
    p_user_id    UUID,
    p_total      NUMERIC,
    p_seconds    INT DEFAULT 3
)
RETURNS TABLE(id BIGINT, created_at TIMESTAMPTZ) AS $$
BEGIN
    RETURN QUERY
    SELECT o.id, o.created_at
    FROM orders o
    WHERE o.user_id = p_user_id
      AND o.total_amount = p_total
      AND o.created_at > (now() - make_interval(secs => p_seconds))
    ORDER BY o.created_at DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Verificación: ver si hay pedidos duplicados activos
-- (mismo total, mismo usuario, misma fecha — diferente ID)
-- ============================================================
SELECT
    user_id,
    total_amount,
    DATE_TRUNC('minute', created_at) AS minuto,
    COUNT(*) AS cantidad,
    ARRAY_AGG(id ORDER BY created_at) AS ids_duplicados
FROM orders
WHERE created_at > now() - INTERVAL '7 days'
GROUP BY user_id, total_amount, DATE_TRUNC('minute', created_at)
HAVING COUNT(*) > 1
ORDER BY cantidad DESC
LIMIT 20;
