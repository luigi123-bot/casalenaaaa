-- ============================================
-- SISTEMA DE CHAT DE SOPORTE PARA CAJEROS
-- ============================================

-- Tabla de sesiones de chat
CREATE TABLE IF NOT EXISTS chat_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cashier_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    cashier_name TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'closed', 'archived')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    closed_at TIMESTAMPTZ
);

-- Tabla de mensajes de chat
CREATE TABLE IF NOT EXISTS chat_messages (
    id BIGSERIAL PRIMARY KEY,
    session_id UUID REFERENCES chat_sessions(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    sender_type TEXT NOT NULL CHECK (sender_type IN ('cashier', 'support')),
    sender_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    read_at TIMESTAMPTZ
);

-- Índices para mejor rendimiento
CREATE INDEX IF NOT EXISTS idx_chat_sessions_cashier_id ON chat_sessions(cashier_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_status ON chat_sessions(status);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at DESC);

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_chat_session_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para updated_at
DROP TRIGGER IF EXISTS update_chat_session_timestamp_trigger ON chat_sessions;
CREATE TRIGGER update_chat_session_timestamp_trigger
    BEFORE UPDATE ON chat_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_chat_session_timestamp();

-- ============================================
-- POLÍTICAS DE SEGURIDAD (RLS)
-- ============================================

-- Habilitar RLS
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Políticas para chat_sessions
-- Los cajeros pueden ver sus propias sesiones
CREATE POLICY "Cashiers can view their own sessions"
    ON chat_sessions FOR SELECT
    USING (auth.uid() = cashier_id);

-- Los cajeros pueden crear sus propias sesiones
CREATE POLICY "Cashiers can create their own sessions"
    ON chat_sessions FOR INSERT
    WITH CHECK (auth.uid() = cashier_id);

-- Los cajeros pueden actualizar sus propias sesiones
CREATE POLICY "Cashiers can update their own sessions"
    ON chat_sessions FOR UPDATE
    USING (auth.uid() = cashier_id);

-- Los administradores pueden ver todas las sesiones
CREATE POLICY "Admins can view all sessions"
    ON chat_sessions FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'administrador'
        )
    );

-- Los administradores pueden actualizar cualquier sesión
CREATE POLICY "Admins can update all sessions"
    ON chat_sessions FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'administrador'
        )
    );

-- Políticas para chat_messages
-- Los usuarios pueden ver mensajes de sus sesiones
CREATE POLICY "Users can view messages from their sessions"
    ON chat_messages FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM chat_sessions
            WHERE chat_sessions.id = chat_messages.session_id
            AND (
                chat_sessions.cashier_id = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM profiles
                    WHERE profiles.id = auth.uid()
                    AND profiles.role = 'administrador'
                )
            )
        )
    );

-- Los cajeros pueden insertar mensajes en sus sesiones
CREATE POLICY "Cashiers can insert messages in their sessions"
    ON chat_messages FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM chat_sessions
            WHERE chat_sessions.id = chat_messages.session_id
            AND chat_sessions.cashier_id = auth.uid()
        )
    );

-- Los administradores pueden insertar mensajes en cualquier sesión
CREATE POLICY "Admins can insert messages in any session"
    ON chat_messages FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'administrador'
        )
    );

-- ============================================
-- FUNCIONES AUXILIARES
-- ============================================

-- Función para obtener sesiones activas con conteo de mensajes no leídos
CREATE OR REPLACE FUNCTION get_active_chat_sessions()
RETURNS TABLE (
    session_id UUID,
    cashier_id UUID,
    cashier_name TEXT,
    last_message_at TIMESTAMPTZ,
    unread_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        cs.id,
        cs.cashier_id,
        cs.cashier_name,
        MAX(cm.created_at) as last_message_at,
        COUNT(cm.id) FILTER (WHERE cm.sender_type = 'cashier' AND cm.read_at IS NULL) as unread_count
    FROM chat_sessions cs
    LEFT JOIN chat_messages cm ON cs.id = cm.session_id
    WHERE cs.status = 'active'
    GROUP BY cs.id, cs.cashier_id, cs.cashier_name
    ORDER BY last_message_at DESC NULLS LAST;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para marcar mensajes como leídos
CREATE OR REPLACE FUNCTION mark_messages_as_read(p_session_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE chat_messages
    SET read_at = NOW()
    WHERE session_id = p_session_id
    AND read_at IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- DATOS DE EJEMPLO (OPCIONAL - COMENTADO)
-- ============================================

/*
-- Insertar una sesión de ejemplo
INSERT INTO chat_sessions (cashier_id, cashier_name, status)
VALUES (
    (SELECT id FROM auth.users WHERE email = 'cajero@casalena.com' LIMIT 1),
    'María González',
    'active'
);

-- Insertar mensajes de ejemplo
INSERT INTO chat_messages (session_id, content, sender_type, sender_name)
VALUES 
    (
        (SELECT id FROM chat_sessions ORDER BY created_at DESC LIMIT 1),
        '¿Cómo puedo cancelar una orden?',
        'cashier',
        'María González'
    ),
    (
        (SELECT id FROM chat_sessions ORDER BY created_at DESC LIMIT 1),
        'Hola María, para cancelar una orden ve a la sección de Órdenes...',
        'support',
        'Equipo Soporte'
    );
*/

-- ============================================
-- NOTAS IMPORTANTES
-- ============================================

-- 1. Las sesiones se crean automáticamente cuando un cajero inicia un chat
-- 2. Los mensajes se sincronizan en tiempo real vía Supabase Realtime
-- 3. Los administradores pueden ver y responder todos los chats
-- 4. Los cajeros solo pueden ver sus propios chats
-- 5. El sistema mantiene historial completo de conversaciones

-- Para habilitar realtime en estas tablas desde el dashboard de Supabase:
-- 1. Ir a Database > Replication
-- 2. Agregar las tablas: chat_sessions, chat_messages
-- 3. Habilitar INSERT, UPDATE, DELETE según necesidad
