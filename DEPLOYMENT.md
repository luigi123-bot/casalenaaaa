# 🚀 Guía de Despliegue - CasaleñaPOS

## 📋 Pre-requisitos

Antes de desplegar, asegúrate de tener:

1. ✅ Cuenta en [Vercel](https://vercel.com)
2. ✅ Cuenta en [Supabase](https://supabase.com)
3. ✅ Variables de entorno configuradas

## 🔧 Configuración de Variables de Entorno

### Variables Requeridas en Vercel

```env
NEXT_PUBLIC_SUPABASE_URL=tu_url_de_supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key_de_supabase
```

### Cómo obtener las credenciales de Supabase:

1. Ve a tu proyecto en [Supabase Dashboard](https://app.supabase.com)
2. Click en **Settings** → **API**
3. Copia:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon/public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## 🌐 Despliegue en Vercel

### Opción 1: Desde la CLI de Vercel

```bash
# Instalar Vercel CLI
npm i -g vercel

# Login en Vercel
vercel login

# Desplegar
vercel

# Para producción
vercel --prod
```

### Opción 2: Desde GitHub

1. **Conecta tu repositorio a Vercel:**
   - Ve a [Vercel Dashboard](https://vercel.com/dashboard)
   - Click en **"Add New..."** → **"Project"**
   - Importa tu repositorio de GitHub

2. **Configura las variables de entorno:**
   - En la página de configuración del proyecto
   - Ve a **"Environment Variables"**
   - Agrega las variables mencionadas arriba

3. **Deploy:**
   - Click en **"Deploy"**
   - Vercel automáticamente detectará Next.js y lo configurará

## 📦 Build Local (Opcional)

Para probar el build antes de desplegar:

```bash
# Limpiar caché
rm -rf .next

# Build de producción
npm run build

# Ejecutar build localmente
npm start
```

## 🐍 Configuración de Python (Para Tickets PDF)

### ⚠️ IMPORTANTE: Python en Producción

El sistema de generación de tickets PDF usa Python con `reportlab`. Hay dos escenarios:

#### 🏠 **Desarrollo Local**

```bash
# 1. Crear entorno virtual
python3 -m venv venv

# 2. Activar entorno
source venv/bin/activate  # Linux/Mac
# o
venv\Scripts\activate  # Windows

# 3. Instalar dependencias
pip install -r requirements.txt
```

El código automáticamente usará `venv/bin/python` si existe.

#### ☁️ **Producción (Vercel/Cloud)**

**Opción A: Usar Python del Sistema (Recomendado para Vercel)**

Vercel incluye Python 3.9+ por defecto. El código está configurado para:

1. Buscar `venv/bin/python` primero (desarrollo)
2. Si no existe, usar `python3` del sistema (producción)
3. Fallback a variable de entorno `PYTHON_PATH`

**Configuración en Vercel:**

1. Las dependencias de Python se instalan automáticamente con:
   ```json
   // vercel.json ya configurado
   "installCommand": "npm install && pip3 install -r requirements.txt --target /tmp/python-packages || true"
   ```

2. Agregar variable de entorno en Vercel (opcional):
   ```
   PYTHON_PATH=/usr/bin/python3
   ```

**Opción B: Despliegue en VPS/Servidor Propio**

Si despliegas en un VPS (DigitalOcean, AWS EC2, etc.):

```bash
# 1. Instalar Python y dependencias del sistema
sudo apt-get update
sudo apt-get install python3 python3-pip python3-venv

# 2. Crear entorno virtual en producción
python3 -m venv venv
source venv/bin/activate

# 3. Instalar dependencias
pip install -r requirements.txt

# 4. Configurar PM2 o systemd para mantener la app corriendo
```

**Opción C: Alternativa sin Python (Futuro)**

Si prefieres evitar Python completamente, puedes:

1. **Usar PDFKit (Node.js):**
   ```bash
   npm install pdfkit
   ```

2. **Usar jsPDF:**
   ```bash
   npm install jspdf
   ```

3. **Servicio externo:**
   - [PDFShift](https://pdfshift.io/)
   - [DocRaptor](https://docraptor.com/)

### 📝 Dependencias de Python (requirements.txt)

```
reportlab==4.0.7
pillow==10.1.0
```

### 🔍 Verificar Python en Producción

Después del despliegue, verifica que Python funcione:

```bash
# En tu servidor/Vercel logs
python3 --version
pip3 list | grep reportlab
```

## 🗄️ Base de Datos (Supabase)

### Tablas Requeridas:

- `profiles` - Perfiles de usuarios
- `categories` - Categorías de productos
- `products` - Productos del menú
- `orders` - Órdenes de clientes
- `order_items` - Items de las órdenes
- `chat_messages` - Mensajes de soporte

### Migraciones:

Las tablas ya deben estar creadas en tu instancia de Supabase.
Si necesitas recrearlas, usa los scripts SQL en `/database/schema.sql`

## 🔒 Seguridad

### Row Level Security (RLS) en Supabase:

Asegúrate de tener las políticas RLS configuradas:

```sql
-- Ejemplo para la tabla orders
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own orders"
ON orders FOR SELECT
USING (auth.uid() = user_id);
```

## 📊 Monitoreo

### Logs en Vercel:
- Ve a tu proyecto en Vercel Dashboard
- Click en **"Logs"** para ver logs en tiempo real

### Analytics:
- Vercel incluye analytics automáticos
- Ve a **"Analytics"** en el dashboard

## 🚨 Troubleshooting

### Error: "Module not found"
```bash
# Limpiar node_modules y reinstalar
rm -rf node_modules package-lock.json
npm install
```

### Error: "Build failed"
```bash
# Verificar que todas las dependencias estén instaladas
npm install

# Verificar variables de entorno
cat .env.local
```

### Error: "Supabase connection failed"
- Verifica que las URLs y keys sean correctas
- Asegúrate de que las variables estén en Vercel
- Verifica que tu proyecto de Supabase esté activo

## 📝 Checklist de Despliegue

- [ ] Variables de entorno configuradas en Vercel
- [ ] Base de datos Supabase configurada
- [ ] Políticas RLS habilitadas
- [ ] Build local exitoso (`npm run build`)
- [ ] Repositorio conectado a Vercel
- [ ] Dominio personalizado configurado (opcional)
- [ ] SSL/HTTPS habilitado (automático en Vercel)

## 🎉 Post-Despliegue

1. **Verifica la aplicación:**
   - Prueba el login
   - Crea una orden de prueba
   - Verifica que el chat funcione

2. **Configura el dominio:**
   - En Vercel Dashboard → **"Domains"**
   - Agrega tu dominio personalizado

3. **Monitorea:**
   - Revisa los logs regularmente
   - Configura alertas en Vercel

## 🔗 Enlaces Útiles

- [Documentación de Next.js](https://nextjs.org/docs)
- [Documentación de Vercel](https://vercel.com/docs)
- [Documentación de Supabase](https://supabase.com/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)

---

**¿Necesitas ayuda?** Revisa los logs en Vercel o contacta al equipo de desarrollo.
