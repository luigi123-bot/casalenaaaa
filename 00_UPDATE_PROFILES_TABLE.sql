-- ALERTA: Ejecuta este script en el Editor SQL de Supabase para añadir las columnas faltantes
-- Esto permitirá que el teléfono, dirección y correo se guarden correctamente en la tabla 'profiles'.

-- 1. Añadir columna 'email' si no existe
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'email') THEN
        ALTER TABLE profiles ADD COLUMN email TEXT;
    END IF;
END $$;

-- 2. Añadir columna 'phone_number' si no existe
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'phone_number') THEN
        ALTER TABLE profiles ADD COLUMN phone_number TEXT;
    END IF;
END $$;

-- 3. Añadir columna 'address' si no existe
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'address') THEN
        ALTER TABLE profiles ADD COLUMN address TEXT;
    END IF;
END $$;

-- 4. Actualizar perfiles existentes desde auth.users (Opcional, para poblar datos faltantes)
UPDATE profiles
SET email = auth.users.email
FROM auth.users
WHERE profiles.id = auth.users.id
AND profiles.email IS NULL;
