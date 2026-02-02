-- ============================================
-- SCRIPT PARA CREAR USUARIOS EN SUPABASE
-- ============================================
-- Este script crea usuarios de prueba con diferentes roles
-- IMPORTANTE: Ejecuta este script en el SQL Editor de Supabase

-- Nota: Supabase Auth maneja el hash de contraseñas automáticamente
-- No podemos insertar directamente en auth.users desde SQL de forma segura
-- La forma correcta es usar la API de Supabase o el Dashboard

-- ============================================
-- OPCIÓN 1: Crear usuarios desde Dashboard
-- ============================================
-- 1. Ve a Authentication → Users → "Add user"
-- 2. Crea estos usuarios manualmente:

-- Usuario Administrador:
--   Email: admin@casalena.com
--   Password: Admin123!
--   ✓ Auto Confirm User

-- Usuario Cajero:
--   Email: cajero@casalena.com
--   Password: Cajero123!
--   ✓ Auto Confirm User

-- Usuario Cocina:
--   Email: cocina@casalena.com
--   Password: Cocina123!
--   ✓ Auto Confirm User


-- ============================================
-- OPCIÓN 2: Actualizar roles después de crear
-- ============================================
-- Después de crear los usuarios desde el Dashboard,
-- ejecuta estos comandos para asignar roles:

-- Asignar rol de ADMINISTRADOR
UPDATE public.profiles 
SET role = 'administrador', 
    full_name = 'Usuario Administrador'
WHERE email = 'admin@casalena.com';

-- Asignar rol de CAJERO (ya es el default, pero lo hacemos explícito)
UPDATE public.profiles 
SET role = 'cajero',
    full_name = 'Usuario Cajero'
WHERE email = 'cajero@casalena.com';

-- Asignar rol de COCINA
UPDATE public.profiles 
SET role = 'cocina',
    full_name = 'Usuario Cocina'
WHERE email = 'cocina@casalena.com';


-- ============================================
-- VERIFICAR USUARIOS Y ROLES
-- ============================================
-- Ver todos los usuarios y sus roles
SELECT 
    id,
    email,
    full_name,
    role,
    created_at
FROM public.profiles
ORDER BY created_at DESC;


-- ============================================
-- CAMBIAR ROL DE UN USUARIO EXISTENTE
-- ============================================
-- Plantilla para cambiar el rol de cualquier usuario:
-- UPDATE public.profiles 
-- SET role = 'NUEVO_ROL'  -- 'administrador', 'cajero', o 'cocina'
-- WHERE email = 'EMAIL_DEL_USUARIO';


-- ============================================
-- EJEMPLO: Promover un cajero a administrador
-- ============================================
-- UPDATE public.profiles 
-- SET role = 'administrador'
-- WHERE email = 'cajero@casalena.com';
