-- ============================================
-- TABLA DE NOTIFICACIONES DEL CAJERO
-- ============================================

-- Tabla para almacenar notificaciones del sistema de cajero
CREATE TABLE IF NOT EXISTS cashier_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL CHECK (type IN ('order', 'alert', 'payment', 'info')),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    metadata JSONB,
    read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    read_at TIMESTAMPTZ
);

-- Índices para mejor rendimiento
CREATE INDEX IF NOT EXISTS idx_cashier_notifications_created_at ON cashier_notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cashier_notifications_read ON cashier_notifications(read);
CREATE INDEX IF NOT EXISTS idx_cashier_notifications_type ON cashier_notifications(type);

-- ============================================
-- POLÍTICAS DE SEGURIDAD (RLS)
-- ============================================

-- Habilitar RLS
ALTER TABLE cashier_notifications ENABLE ROW LEVEL SECURITY;

-- Política: Los cajeros pueden ver todas las notificaciones
CREATE POLICY "Cashiers can view all notifications"
    ON cashier_notifications FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('cajero', 'administrador')
        )
    );

-- Política: Solo el sistema puede crear notificaciones (vía service role)
CREATE POLICY "System can create notifications"
    ON cashier_notifications FOR INSERT
    WITH CHECK (true); -- Service role will bypass this anyway

-- Política: Los cajeros pueden actualizar notificaciones (marcar como leído)
CREATE POLICY "Cashiers can update notifications"
    ON cashier_notifications FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('cajero', 'administrador')
        )
    );

-- Política: Los administradores pueden eliminar notificaciones antiguas
CREATE POLICY "Admins can delete notifications"
    ON cashier_notifications FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'administrador'
        )
    );

-- ============================================
-- FUNCIONES AUXILIARES
-- ============================================

-- Función para limpiar notificaciones antiguas (>30 días)
CREATE OR REPLACE FUNCTION cleanup_old_notifications()
RETURNS void AS $$
BEGIN
    DELETE FROM cashier_notifications
    WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para marcar todas las notificaciones como leídas
CREATE OR REPLACE FUNCTION mark_all_notifications_read()
RETURNS void AS $$
BEGIN
    UPDATE cashier_notifications
    SET read = true, read_at = NOW()
    WHERE read = false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para obtener conteo de notificaciones no leídas
CREATE OR REPLACE FUNCTION get_unread_notifications_count()
RETURNS BIGINT AS $$
BEGIN
    RETURN (SELECT COUNT(*) FROM cashier_notifications WHERE read = false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- TRIGGER PARA AUTO-LIMPIAR NOTIFICACIONES
-- ============================================

-- Ejecutar limpieza automática cada vez que se inserta una nueva notificación
CREATE OR REPLACE FUNCTION auto_cleanup_notifications()
RETURNS TRIGGER AS $$
BEGIN
    -- Cada 100 inserciones, limpia notificaciones antiguas
    IF (SELECT COUNT(*) FROM cashier_notifications) % 100 = 0 THEN
        PERFORM cleanup_old_notifications();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS auto_cleanup_trigger ON cashier_notifications;
CREATE TRIGGER auto_cleanup_trigger
    AFTER INSERT ON cashier_notifications
    FOR EACH STATEMENT
    EXECUTE FUNCTION auto_cleanup_notifications();

-- ============================================
-- DATOS DE EJEMPLO (OPCIONAL - COMENTADO)
-- ============================================

/*
-- Insertar notificaciones de ejemplo
INSERT INTO cashier_notifications (type, title, message, metadata)
VALUES 
    ('order', '🔔 Nueva Orden', 'Orden #1234 - delivery\nJuan Pérez - $125.50', 
     '{"orderId": 1234, "customerName": "Juan Pérez", "total": 125.50}'::jsonb),
    ('alert', '⚠️ Stock Bajo', 'Pepperoni Grande - Quedan 5 unidades', 
     '{"productId": 42, "stock": 5}'::jsonb),
    ('payment', '💳 Pago Recibido', 'Orden #1234 - Tarjeta de Crédito', 
     '{"orderId": 1234, "method": "credit_card"}'::jsonb);
*/

-- ============================================
-- NOTAS IMPORTANTES
-- ============================================

-- 1. Las notificaciones se crean automáticamente desde la API cuando:
--    - Un cliente realiza un pedido por WhatsApp
--    - Hay cambios importantes en órdenes
--    - Stock bajo
--    - Otros eventos importantes

-- 2. Las notificaciones antiguas (>30 días) se limpian automáticamente

-- 3. Para habilitar realtime en esta tabla desde el dashboard de Supabase:
--    - Ir a Database > Replication
--    - Agregar la tabla: cashier_notifications
--    - Habilitar INSERT, UPDATE según necesidad

-- 4. Los cajeros verán notificaciones en tiempo real en el NotificationPanel
