# 🚀 Guía de Despliegue - CasaleñaPOS

## 📋 Pre-requisitos

Antes de desplegar, asegúrate de tener:

1. ✅ Cuenta en [Vercel](https://vercel.com) o su alternativa preferida
2. ✅ Cuenta en [Supabase](https://supabase.com)
3. ✅ Variables de entorno configuradas

## 🔧 Configuración de Variables de Entorno

### Variables Requeridas

```env
NEXT_PUBLIC_SUPABASE_URL=tu_url_de_supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key_de_supabase
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key (para funciones admin)
```

## 🌐 Despliegue en Vercel

1. **Conecta tu repositorio:**
   - Importa tu repositorio desde el dashboard de Vercel.
2. **Configura las variables de entorno:**
   - Agrega las variables mencionadas arriba en la sección "Environment Variables".
3. **Deploy:**
   - Vercel detectará automáticamente Next.js y realizará el build.

## 🖨️ Generación de Tickets

La generación de tickets PDF se realiza de forma nativa en el servidor usando `pdfkit`. No requiere de Python ni entornos adicionales.

Los tickets se guardan temporalmente en la carpeta `public/tickets/` y se sirven a través de la API.

## 🗄️ Base de Datos (Supabase)

Asegúrate de haber ejecutado el script `supabase_schema.sql` en el SQL Editor de Supabase para tener todas las tablas y triggers necesarios.

---
**Casaleña POS** - Sistema de Punto de Venta optimizado para restaurantes.
