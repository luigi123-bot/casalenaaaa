# 📘 Manual de Usuario - CasaleñaPOS

Bienvenido al manual de uso del sistema **CasaleñaPOS**. Este documento detalla las funciones disponibles para cada rol dentro del sistema.

---

## 👥 Roles del Sistema

El sistema cuenta con 3 roles principales:
1. **Administrador** (Dueño/Gerente)
2. **Cajero** (Personal de venta)
3. **Cliente** (Usuario final)

---

## 🛡️ 1. Rol de Administrador

El administrador tiene control total sobre la plataforma.

### 🔑 Iniciar Sesión de Admin
1. Diríjase a `/login`.
2. Ingrese sus credenciales de administrador.
3. Al ingresar, será redirigido automáticamente al **Panel Administrativo**.

### 📊 Funcionalidades Principales
- **Gestión de Usuarios**:
  - Crear, editar o eliminar cuentas de cajeros.
  - Asignar roles y permisos.
- **Reportes y Métricas**:
  - Ver ventas totales diarias, semanales o mensuales.
  - Analizar productos más vendidos.
  - Exportar reportes en formatos CSV/Excel.
- **Configuración del Sistema**:
  - Actualizar productos, precios y stock.
  - Editar información del negocio (horarios, dirección).

---

## 🏪 2. Rol de Cajero

El cajero es el operador principal del punto de venta en el local.

### 💵 Terminal de Venta (POS)
1. Ingrese al **Dashboard de Cajero**.
2. Seleccione **"Terminal de Caja"** en el menú.
3. **Crear una orden**:
   - Busque productos o selecciónelos del catálogo visual.
   - Personalice los ítems (tamaño, extras).
   - El sistema calcula automáticamente el total.
4. **Finalizar Venta**:
   - Seleccione tipo de pedido: *Comedor*, *Para Llevar* o *Domicilio*.
   - Elija método de pago (*Efectivo, Tarjeta, Transferencia*).
   - Si es efectivo, el sistema calcula el cambio exacto.
   - Confirme e imprima el ticket.

### 🔔 Gestión de Pedidos y Notificaciones
- **Panel de Notificaciones**: Reciba alertas en tiempo real de nuevos pedidos online (WhatsApp).
- **Rastreo de Pedidos**:
  - Vea el estado de todas las órdenes en curso (*Pendiente, Preparando, Listo*).
  - Cambie el estado de las órdenes simplemente haciendo clic.
- **Soporte**: Use el chat integrado para reportar problemas técnicos inmediatos.

---

## 🛒 3. Rol de Cliente (Tienda Online)

Los clientes pueden realizar pedidos sin necesidad de instalar aplicaciones.

### 🛍️ Realizar un Pedido
1. Ingrese a la tienda en línea (`/tienda`).
2. Explore el menú y añada productos al carrito.
3. Al finalizar, haga clic en **"Confirmar Pedido"**.
4. **Integración con WhatsApp**:
   - El sistema abrirá automáticamente WhatsApp con el detalle de su pedido.
   - Envíe el mensaje al número del restaurante para confirmar.
   - Recibirá confirmación de recepción por parte del cajero.

---

## 🆘 Soporte y Ayuda

Si tiene problemas con el sistema:
1. **Cajeros**: Utilicen el botón de "Chat de Soporte" en su dashboard.
2. **Administradores**: Contacten al desarrollador directamente vía email o teléfono de soporte técnico.

---
*CasaleñaPOS v2.0 - Documentación Generada Automáticamente*
