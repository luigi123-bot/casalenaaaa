# 📱 Sistema de Pedidos por WhatsApp

## 🎯 Descripción General

Se ha implementado un sistema completo para que los clientes puedan realizar pedidos directamente por WhatsApp, con notificaciones en tiempo real para el equipo de cajeros.

---

## 🔄 Flujo del Sistema

### 1. **Cliente Realiza un Pedido** (Tienda)

**Ubicación:** `/tienda`

Cuando un cliente finaliza su carrito y presiona "Confirmar Pedido":

1. ✅ **Valida autenticación** - Si no está logueado, lo redirige al login
2. ✅ **Valida datos** - Verifica que el carrito no esté vacío y que los datos de entrega estén completos (si es delivery)
3. 📝 **Formatea el pedido** - Crea un mensaje estructurado con:
   - Tipo de orden (Domicilio/Para Llevar/Comedor)
   - Nombre del cliente
   - Dirección y teléfono (si es delivery)
   - Lista de productos con:
     - Nombre
     - Tamaño seleccionado
     - Cantidad
     - Extras
     - Precio individual
   - Total del pedido
   
4. 📲 **Abre WhatsApp** - Redirige automáticamente a WhatsApp Web/App con el mensaje pre-formateado
   - Número de destino: **3012906861** (formato internacional: +573012906861)
   
5. 🔔 **Notifica al cajero** - Envía una notificación al sistema de cajeros mediante API

6. ✅ **Muestra confirmación** - Presenta un modal explicando que el pedido se envió por WhatsApp

---

### 2. **Notificación del Cajero**

**API:** `/api/cashier/notify`

La API procesa la notificación:

1. Recibe los datos del pedido
2. Formatea la información para notificación
3. Inserta el registro en la tabla `cashier_notifications`
4. Los cajeros reciben la notificación en tiempo real

---

### 3. **Cajero Recibe Notificación**

**Componente:** `NotificationPanel.tsx`

Los cajeros ven:

- 🔔 **Icono de notificación** con badge de contador
- **Panel de notificaciones** que muestra:
  - Tipo de orden
  - Nombre del cliente
  - Productos (primeros 2 + contador de más)
  - Total del pedido
  - Timestamp
  - Estado (leída/no leída)

**Características:**
- ✅ Sonido al recibir notificación
- ✅ Indicador visual (punto naranja parpadeante)
- ✅ Actualización en tiempo real
- ✅ Historial de notificaciones (últimas 20)
- ✅ Marcar como leída/no leída
- ✅ Limpiar todas las notificaciones

---

## 🛠️ Componentes Técnicos

### Archivos Modificados/Creados:

#### 1. **Cliente - Tienda** (`/app/tienda/page.tsx`)
```typescript
// Función principal modificada
const handleCheckout = async () => {
    // 1. Validaciones
    // 2. Formateo del mensaje de WhatsApp
    // 3. Generación de URL de WhatsApp
    // 4. Envío de notificación a cajeros
    // 5. Apertura de WhatsApp
    // 6. Limpieza del carrito
}
```

**Cambios clave:**
- ❌ Eliminado: Creación de orden en base de datos
- ✅ Agregado: Generación de mensaje de WhatsApp
- ✅ Agregado: Llamada a API de notificaciones
- ✅ Agregado: Apertura automática de WhatsApp

---

#### 2. **API de Notificaciones** (`/app/api/cashier/notify/route.ts`)

**Endpoint:** `POST /api/cashier/notify`

**Body esperado:**
```json
{
  "type": "new_order_whatsapp",
  "customerName": "Juan Pérez",
  "orderType": "delivery",
  "total": 125.50,
  "items": [
    {
      "name": "Pepperoni Grande",
      "quantity": 2,
      "size": "Grande"
    }
  ]
}
```

**Funcionalidad:**
- Recibe datos del pedido
- Crea registro en `cashier_notifications`
- Retorna confirmación

---

#### 3. **Panel de Notificaciones** (`/components/NotificationPanel.tsx`)

**Mejoras implementadas:**

```typescript
// Suscripciones a múltiples fuentes
useEffect(() => {
    // 1. Cargar notificaciones existentes
    loadExistingNotifications();
    
    // 2. Suscribirse a órdenes del sistema
    const ordersChannel = supabase.channel('orders');
    
    // 3. Suscribirse a notificaciones de WhatsApp
    const whatsappChannel = supabase.channel('cashier_notifications');
    
    return cleanup;
}, []);
```

**Características:**
- Escucha 2 canales simultáneamente
- Carga notificaciones históricas al abrir
- Reproduce sonido en nuevas notificaciones
- Maneja estados de lectura

---

## 🗄️ Base de Datos

### Tabla: `cashier_notifications`

**Archivo SQL:** `supabase_cashier_notifications_schema.sql`

```sql
CREATE TABLE cashier_notifications (
    id UUID PRIMARY KEY,
    type TEXT CHECK (type IN ('order', 'alert', 'payment', 'info')),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    metadata JSONB,
    read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    read_at TIMESTAMPTZ
);
```

**Funciones auxiliares:**
- `cleanup_old_notifications()` - Elimina notificaciones > 30 días
- `mark_all_notifications_read()` - Marca todas como leídas
- `get_unread_notifications_count()` - Obtiene contador de no leídas

**RLS (Row Level Security):**
- ✅ Cajeros pueden ver todas las notificaciones
- ✅ Sistema puede crear notificaciones
- ✅ Cajeros pueden actualizar (marcar leídas)
- ✅ Administradores pueden eliminar

---

## 📋 Ejemplo de Mensaje de WhatsApp

```
🍕 *NUEVO PEDIDO - DOMICILIO*

👤 *Cliente:* Juan Pérez
📍 *Dirección:* Calle 123 #45-67
📱 *Teléfono:* 3001234567

🛒 *PRODUCTOS:*
1. Pepperoni (Grande) x2
   +Extra Queso, Orilla Rellena
   💵 $180.00
2. Coca Cola (Mediana) x1
   💵 $25.00

💰 *TOTAL: $205.00*

_Pedido realizado desde CasaleñaPOS 🔥_
```

---

## 🎨 Interfaz de Usuario

### Modal de Éxito (Cliente)

Cuando el cliente confirma el pedido, ve:

```
✅ ¡Pedido Enviado!

Tu pedido ha sido enviado a nuestro WhatsApp.

ℹ️ Importante
Se ha abierto WhatsApp con tu pedido. 
Por favor, envía el mensaje para completar tu orden.

[Entendido] [Seguir Comprando]
```

### Notificación (Cajero)

```
🔔 📱 Nuevo Pedido por WhatsApp

Juan Pérez - Domicilio
2x Pepperoni (Grande), 1x Coca Cola +1 más
Total: $205.00

⏰ 14:35
```

---

## 🚀 Pasos de Implementación

### 1. Ejecutar SQL en Supabase

```bash
# Copia el contenido de:
supabase_cashier_notifications_schema.sql

# Pégalo en el SQL Editor de Supabase y ejecuta
```

### 2. Habilitar Realtime

En el Dashboard de Supabase:
1. Ve a **Database > Replication**
2. Agrega la tabla: `cashier_notifications`
3. Habilita eventos: `INSERT`, `UPDATE`

### 3. Probar el Flujo

1. **Como cliente:**
   - Ir a `/tienda`
   - Agregar productos al carrito
   - Confirmar pedido
   - Verificar que se abre WhatsApp

2. **Como cajero:**
   - Ir a cualquier vista de cajero
   - Hacer clic en el icono de notificaciones
   - Verificar que aparece la notificación del pedido

---

## ⚙️ Configuración

### Número de WhatsApp

El número está configurado en `/app/tienda/page.tsx`:

```typescript
const whatsappNumber = '573012906861'; // Formato: Código país + número
```

Para cambiar el número, modifica esta variable.

---

## 🔧 Variables de Entorno

Asegúrate de tener configuradas:

```env
NEXT_PUBLIC_SUPABASE_URL=tu_url_de_supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key (opcional)
```

---

## 📊 Flujo Visual

```
[CLIENTE] 
   ↓
Agrega productos al carrito
   ↓
Confirma pedido
   ↓
Sistema formatea mensaje
   ↓
   ├─→ Abre WhatsApp con mensaje
   └─→ Llama API de notificación
          ↓
       Supabase crea registro
          ↓
       Realtime broadcast
          ↓
[CAJERO] Recibe notificación 🔔
```

---

## ✨ Ventajas del Sistema

1. **Sin fricción:** Cliente solo envía un mensaje de WhatsApp
2. **Familiar:** Todo el mundo sabe usar WhatsApp
3. **Conversacional:** Permite aclarar dudas en tiempo real
4. **No requiere app:** Funciona desde el navegador
5. **Notificaciones:** Cajeros están informados instantáneamente
6. **Trazabilidad:** Todo queda registrado en el chat
7. **Simple:** Reducción de pasos del proceso de orden

---

## 🐛 Solución de Problemas

### WhatsApp no se abre
- Verificar que el navegador permite pop-ups
- Verificar que WhatsApp está instalado (móvil) o iniciado (desktop)

### Notificaciones no llegan
- Verificar que Realtime está habilitado en Supabase
- Revisar las políticas RLS de la tabla
- Verificar que el usuario tiene rol de cajero

### Error en la API
- Verificar las variables de entorno
- Revisar los logs en la consola del navegador
- Verificar permisos de la tabla en Supabase

---

## 🎯 Próximas Mejoras Sugeridas

1. **Confirmación automática:** Cuando el cajero recibe el mensaje de WhatsApp, marcarlo en el sistema
2. **Historial de pedidos:** Guardar los pedidos enviados por WhatsApp en una tabla separada
3. **Analytics:** Métricas de conversión de pedidos por WhatsApp
4. **Templates:** Diferentes formatos de mensaje según el tipo de negocio
5. **Multi-número:** Soporte para múltiples números según hora/zona

---

**Última actualización:** Febrero 2026
**Versión:** 1.0
**Desarrollado para:** CasaleñaPOS 🍕
