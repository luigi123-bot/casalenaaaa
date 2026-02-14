-- SOLUCIÓN DEFINITIVA: ACCESO PÚBLICO A TODO EL CATÁLOGO
-- Esto desbloquea productos Y categorías para que se vean en la caja.

-- 1. CATEGORÍAS (CRÍTICO: Si no se ven, los productos tampoco)
ALTER TABLE "public"."categories" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "categories_read_all" ON "public"."categories";
CREATE POLICY "categories_read_all" ON "public"."categories"
FOR SELECT 
USING (true); -- Visible para todos

GRANT SELECT ON "public"."categories" TO anon;
GRANT SELECT ON "public"."categories" TO authenticated;
GRANT SELECT ON "public"."categories" TO service_role;

-- 2. PRODUCTOS
ALTER TABLE "public"."products" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "products_read_all" ON "public"."products";
CREATE POLICY "products_read_all" ON "public"."products"
FOR SELECT 
USING (true); -- Visible para todos

GRANT SELECT ON "public"."products" TO anon;
GRANT SELECT ON "public"."products" TO authenticated;
GRANT SELECT ON "public"."products" TO service_role;

-- 3. EXTRAS / OPCIONES (Si existen tablas relacionadas)
-- Por si acaso tienes tablas de extras u opciones
DO $$ 
BEGIN 
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'extras') THEN
        ALTER TABLE "public"."extras" ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "extras_read_all" ON "public"."extras";
        CREATE POLICY "extras_read_all" ON "public"."extras" FOR SELECT USING (true);
        GRANT SELECT ON "public"."extras" TO authenticated;
    END IF;
END $$;
