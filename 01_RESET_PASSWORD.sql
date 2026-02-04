-- SCRIPT PARA CAMBIAR CONTRASEÑA MANUALMENTE
-- Ejecutar en: Panel de Supabase -> SQL Editor

-- Requiere la extensión pgcrypto (normalmente activa por defecto en Supabase)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Actualizar la contraseña encriptada
UPDATE auth.users
SET encrypted_password = crypt('admin2025', gen_salt('bf'))
WHERE email = 'gotopoluis19@gmail.com';

-- Confirmar que se hizo el cambio (debería devolver el ID del usuario)
SELECT id, email, created_at FROM auth.users WHERE email = 'gotopoluis19@gmail.com';
