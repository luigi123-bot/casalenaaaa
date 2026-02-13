-- SQL para solucionar el error "violates foreign key constraint orders_user_id_fkey"
-- Ejecuta este script en el Editor SQL de tu panel de Supabase.

-- 1. Eliminar la restricción de clave foránea actual (que posiblemente esté apuntando a una tabla incorrecta o vacía)
ALTER TABLE "public"."orders" DROP CONSTRAINT IF EXISTS "orders_user_id_fkey";

-- 2. Recrear la restricción apuntando directamente a la tabla de autenticación (auth.users)
-- Esto es más seguro porque el usuario SIEMPRE existe en auth.users si ha iniciado sesión.
ALTER TABLE "public"."orders" 
    ADD CONSTRAINT "orders_user_id_fkey" 
    FOREIGN KEY ("user_id") 
    REFERENCES "auth"."users" ("id") 
    ON DELETE SET NULL;

-- 3. (Opcional) Asegurar que la columna user_id en orders permita nulos si se borra el usuario
ALTER TABLE "public"."orders" ALTER COLUMN "user_id" DROP NOT NULL;

-- 4. Verificar permisos (por si acaso)
GRANT ALL ON TABLE "public"."orders" TO "authenticated";
GRANT ALL ON TABLE "public"."orders" TO "service_role";
