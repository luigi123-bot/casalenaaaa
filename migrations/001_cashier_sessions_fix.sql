-- ============================================================
--  CASALEÑA POS — Migración: Apertura/Cierre de Caja
--  Ejecutar en: Supabase Dashboard > SQL Editor
-- ============================================================

-- 1. Crear tabla cashier_sessions (si no existe)
CREATE TABLE IF NOT EXISTS cashier_sessions (
    id                     UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id                UUID         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    cashier_name           TEXT         NOT NULL,

    -- ─── APERTURA (INMUTABLES después de INSERT) ────────────
    initial_fund           NUMERIC(10,2) NOT NULL DEFAULT 0,
    notes                  TEXT          DEFAULT 'EMPTY',
    opened_at              TIMESTAMPTZ   NOT NULL DEFAULT now(),

    -- ─── ESTADO ─────────────────────────────────────────────
    status                 TEXT          NOT NULL DEFAULT 'open'
                               CHECK (status IN ('open', 'closed')),

    -- ─── CIERRE ─────────────────────────────────────────────
    closed_at              TIMESTAMPTZ,
    initial_fund_snapshot  NUMERIC(10,2),   -- copia inmutable tomada al cerrar
    total_sales            NUMERIC(10,2)  DEFAULT 0,
    total_orders           INTEGER        DEFAULT 0,
    total_products         INTEGER        DEFAULT 0,
    ventas_efectivo        NUMERIC(10,2)  DEFAULT 0,
    ventas_tarjeta         NUMERIC(10,2)  DEFAULT 0,
    ventas_otro            NUMERIC(10,2)  DEFAULT 0,
    expected_cash          NUMERIC(10,2),
    final_cash             NUMERIC(10,2),
    difference             NUMERIC(10,2),
    gastos_combustible     NUMERIC(10,2)  DEFAULT 0,
    gastos_insumo_cocina   NUMERIC(10,2)  DEFAULT 0,
    gastos_insumo_limpieza NUMERIC(10,2)  DEFAULT 0,
    total_gastos           NUMERIC(10,2)  DEFAULT 0,
    top_products           JSONB          DEFAULT '[]',

    created_at             TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- 2. Agregar columnas que podrían faltar en tablas existentes
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'cashier_sessions' AND column_name = 'initial_fund_snapshot'
    ) THEN
        ALTER TABLE cashier_sessions ADD COLUMN initial_fund_snapshot NUMERIC(10,2);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'cashier_sessions' AND column_name = 'total_products'
    ) THEN
        ALTER TABLE cashier_sessions ADD COLUMN total_products INTEGER DEFAULT 0;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'cashier_sessions' AND column_name = 'ventas_efectivo'
    ) THEN
        ALTER TABLE cashier_sessions ADD COLUMN ventas_efectivo NUMERIC(10,2) DEFAULT 0;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'cashier_sessions' AND column_name = 'ventas_tarjeta'
    ) THEN
        ALTER TABLE cashier_sessions ADD COLUMN ventas_tarjeta NUMERIC(10,2) DEFAULT 0;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'cashier_sessions' AND column_name = 'ventas_otro'
    ) THEN
        ALTER TABLE cashier_sessions ADD COLUMN ventas_otro NUMERIC(10,2) DEFAULT 0;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'cashier_sessions' AND column_name = 'gastos_combustible'
    ) THEN
        ALTER TABLE cashier_sessions ADD COLUMN gastos_combustible NUMERIC(10,2) DEFAULT 0;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'cashier_sessions' AND column_name = 'gastos_insumo_cocina'
    ) THEN
        ALTER TABLE cashier_sessions ADD COLUMN gastos_insumo_cocina NUMERIC(10,2) DEFAULT 0;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'cashier_sessions' AND column_name = 'gastos_insumo_limpieza'
    ) THEN
        ALTER TABLE cashier_sessions ADD COLUMN gastos_insumo_limpieza NUMERIC(10,2) DEFAULT 0;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'cashier_sessions' AND column_name = 'total_gastos'
    ) THEN
        ALTER TABLE cashier_sessions ADD COLUMN total_gastos NUMERIC(10,2) DEFAULT 0;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'cashier_sessions' AND column_name = 'top_products'
    ) THEN
        ALTER TABLE cashier_sessions ADD COLUMN top_products JSONB DEFAULT '[]';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'cashier_sessions' AND column_name = 'expected_cash'
    ) THEN
        ALTER TABLE cashier_sessions ADD COLUMN expected_cash NUMERIC(10,2);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'cashier_sessions' AND column_name = 'final_cash'
    ) THEN
        ALTER TABLE cashier_sessions ADD COLUMN final_cash NUMERIC(10,2);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'cashier_sessions' AND column_name = 'difference'
    ) THEN
        ALTER TABLE cashier_sessions ADD COLUMN difference NUMERIC(10,2);
    END IF;
END $$;

-- ============================================================
-- 3. TRIGGER: Proteger initial_fund y opened_at de mutaciones
-- ============================================================
CREATE OR REPLACE FUNCTION protect_cashier_opening()
RETURNS TRIGGER AS $$
BEGIN
    -- No permitir cambiar el fondo inicial registrado en apertura
    IF OLD.initial_fund IS DISTINCT FROM NEW.initial_fund THEN
        RAISE NOTICE '[cashier_sessions] Intento de mutar initial_fund bloqueado. Valor conservado: %', OLD.initial_fund;
        NEW.initial_fund := OLD.initial_fund;
    END IF;

    -- No permitir cambiar la hora de apertura
    IF OLD.opened_at IS DISTINCT FROM NEW.opened_at THEN
        NEW.opened_at := OLD.opened_at;
    END IF;

    -- Al hacer cierre (open -> closed): guardar snapshot inmutable
    IF NEW.status = 'closed' AND OLD.status = 'open' THEN
        NEW.initial_fund_snapshot := OLD.initial_fund;  -- desde BD, nunca del frontend
        NEW.closed_at := COALESCE(NEW.closed_at, now());
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recrear trigger
DROP TRIGGER IF EXISTS trg_protect_cashier_opening ON cashier_sessions;
CREATE TRIGGER trg_protect_cashier_opening
    BEFORE UPDATE ON cashier_sessions
    FOR EACH ROW
    EXECUTE FUNCTION protect_cashier_opening();

-- ============================================================
-- 4. Tabla legacy cash_closures (si no existe)
-- ============================================================
CREATE TABLE IF NOT EXISTS cash_closures (
    id                     BIGSERIAL    PRIMARY KEY,
    fecha_turno            TEXT,
    cajero                 TEXT,
    total_ordenes          INTEGER       DEFAULT 0,
    total_productos        INTEGER       DEFAULT 0,
    total_ventas           NUMERIC(10,2) DEFAULT 0,
    ventas_efectivo        NUMERIC(10,2) DEFAULT 0,
    ventas_tarjeta         NUMERIC(10,2) DEFAULT 0,
    ventas_otro            NUMERIC(10,2) DEFAULT 0,
    ticket_promedio        NUMERIC(10,2) DEFAULT 0,
    fondo_inicial          NUMERIC(10,2) DEFAULT 0,
    efectivo_esperado      NUMERIC(10,2),
    efectivo_contado       NUMERIC(10,2) DEFAULT 0,
    diferencia             NUMERIC(10,2) DEFAULT 0,
    top_productos          JSONB         DEFAULT '[]',
    gastos_combustible     NUMERIC(10,2) DEFAULT 0,
    gastos_insumo_cocina   NUMERIC(10,2) DEFAULT 0,
    gastos_insumo_limpieza NUMERIC(10,2) DEFAULT 0,
    total_gastos           NUMERIC(10,2) DEFAULT 0,
    created_at             TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- ============================================================
-- 5. Índices de rendimiento
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_cashier_sessions_user_status
    ON cashier_sessions(user_id, status);

CREATE INDEX IF NOT EXISTS idx_cashier_sessions_status_opened
    ON cashier_sessions(status, opened_at DESC);

CREATE INDEX IF NOT EXISTS idx_cash_closures_created
    ON cash_closures(created_at DESC);

-- ============================================================
-- 6. Row Level Security
-- ============================================================
ALTER TABLE cashier_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_closures    ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 7. Verificación final — deberías ver las 2 tablas con sus conteos
-- ============================================================
SELECT
    'cashier_sessions' AS tabla,
    COUNT(*) AS registros_totales,
    COUNT(*) FILTER (WHERE status = 'open')   AS abiertas,
    COUNT(*) FILTER (WHERE status = 'closed') AS cerradas
FROM cashier_sessions

UNION ALL

SELECT
    'cash_closures' AS tabla,
    COUNT(*) AS registros_totales,
    0 AS abiertas,
    0 AS cerradas
FROM cash_closures;
