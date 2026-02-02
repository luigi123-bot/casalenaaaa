-- Script para verificar qué tablas de usuarios existen en Supabase
-- Ejecuta esto en el SQL Editor de Supabase

-- 1. Ver todas las tablas en el schema public
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- 2. Ver específicamente si existe 'profiles' o 'usuarios'
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') 
        THEN 'profiles existe ✓' 
        ELSE 'profiles NO existe ✗' 
    END as tabla_profiles,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'usuarios') 
        THEN 'usuarios existe ✓' 
        ELSE 'usuarios NO existe ✗' 
    END as tabla_usuarios;

-- 3. Si existe 'profiles', ver su estructura
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'profiles'
ORDER BY ordinal_position;

-- 4. Si existe 'usuarios', ver su estructura
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'usuarios'
ORDER BY ordinal_position;

-- 5. Contar registros en cada tabla (si existen)
DO $$
DECLARE
    profiles_count INTEGER;
    usuarios_count INTEGER;
BEGIN
    -- Count profiles
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
        EXECUTE 'SELECT COUNT(*) FROM profiles' INTO profiles_count;
        RAISE NOTICE 'profiles: % registros', profiles_count;
    ELSE
        RAISE NOTICE 'profiles: tabla no existe';
    END IF;
    
    -- Count usuarios
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'usuarios') THEN
        EXECUTE 'SELECT COUNT(*) FROM usuarios' INTO usuarios_count;
        RAISE NOTICE 'usuarios: % registros', usuarios_count;
    ELSE
        RAISE NOTICE 'usuarios: tabla no existe';
    END IF;
END $$;
