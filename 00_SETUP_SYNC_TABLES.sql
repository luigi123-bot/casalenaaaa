-- SCRIPT DE UNIFICACIÓN DE TABLAS PROFILES Y USUARIOS
-- Ejecutar en Supabase SQL Editor

-- 1. Estandarizar Tabla PROFILES
DO $$
BEGIN
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email TEXT;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone_number TEXT;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS address TEXT;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 2. Estandarizar Tabla USUARIOS (Legacy)
-- Aseguramos que tenga las mismas columnas que profiles para facilitar la sincronización
CREATE TABLE IF NOT EXISTS usuarios (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

DO $$
BEGIN
    ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS full_name TEXT;
    ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS email TEXT;
    ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS role TEXT;
    ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS phone_number TEXT;
    ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS address TEXT;
    
    -- Mapeo de columnas antiguas si existen (para no perder datos)
    -- Si existe 'telefono' y no 'phone_number', podrías querer migrar datos, 
    -- pero aquí solo aseguramos que las nuevas columnas existan para el código nuevo.
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 3. Trigger para mantener sincronizados (Opcional pero recomendado)
-- Si insertas en profiles, se copia a usuarios automáticamente
CREATE OR REPLACE FUNCTION sync_profiles_to_usuarios()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.usuarios (id, full_name, email, role, phone_number, address)
    VALUES (NEW.id, NEW.full_name, NEW.email, NEW.role, NEW.phone_number, NEW.address)
    ON CONFLICT (id) DO UPDATE
    SET full_name = EXCLUDED.full_name,
        email = EXCLUDED.email,
        role = EXCLUDED.role,
        phone_number = EXCLUDED.phone_number,
        address = EXCLUDED.address;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_profile_update ON profiles;
CREATE TRIGGER on_profile_update
AFTER INSERT OR UPDATE ON profiles
FOR EACH ROW EXECUTE FUNCTION sync_profiles_to_usuarios();
