-- Verificar estructura de la tabla products
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'products'
ORDER BY ordinal_position;

-- Ver si existe la columna imagen_url específicamente
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'products' 
            AND column_name = 'imagen_url'
        ) 
        THEN 'imagen_url existe ✓' 
        ELSE 'imagen_url NO existe ✗' 
    END as columna_imagen_url;

-- Si no existe, agregar la columna
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS imagen_url text;

-- Verificar de nuevo
SELECT column_name 
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'products';
