-- 1. Agregar columna para imágenes en chat_messages
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS image_url TEXT;

-- 2. Asegurar que chat_sessions tenga los campos necesarios para identificar al remitente
ALTER TABLE public.chat_sessions ADD COLUMN IF NOT EXISTS cashier_name TEXT;

-- 3. Crear el bucket de almacenamiento para imágenes de soporte si no existe
-- (Esto normalmente se hace desde el dashboard de Supabase, pero aquí dejo la referencia)
-- Nombre sugerido del bucket: 'support_attachments'
-- Política: Permitir lectura pública e inserción autenticada.
