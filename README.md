# 🪵 CasaleñaPOS - Sistema Integral de Gestión para Restaurantes

CasaleñaPOS es una solución industrial-grade diseñada para la gestión total de restaurantes, taquerías y negocios gastronómicos. Desarrollado con tecnologías modernas como **Next.js**, **Supabase** y **Electron**, permite un control preciso desde la toma del pedido hasta el cierre financiero del día.

## 🚀 Módulos Principales

### 1. Panel de Administración (Admin Dashboard)
- **Insights & Analítica**: Visualización en tiempo real de ventas, platos más vendidos y rendimiento por turno.
- **Gestión de Personal**: Sistema CRUD completo para administrar empleados, roles y permisos.
- **Control de Inventario**: Administración de productos, categorías, precios y stock.
- **Monitoreo Oculto**: Herramientas de diagnóstico avanzada para administradores.

### 2. Terminal de Caja (POS Cashier)
- **Gestión de Cuentas Abiertas**: Control visual de pedidos pendientes en mesas o para llevar.
- **Flujo de Pago Optimizado**: Procesamiento rápido de pagos con múltiples métodos.
- **Cierres de Caja (Cash Closure)**: Generación automática de reportes financieros al final del turno para auditoría.
- **Soporte en Vivo**: Chat integrado para asistencia técnica directa al cajero.

### 3. Sistema de Cocina (KDS)
- **Pantallas en Tiempo Real**: Recepción inmediata de pedidos con indicadores de tiempo de espera.
- **Gestión de Estados**: Actualización del progreso de los platos para sincronización con el servicio.

### 4. Experiencia del Cliente (Tienda & Menú)
- **Menú Digital Interactivo**: Interfaz táctil para que los clientes exploren el catálogo.
- **Seguimiento de Pedidos**: Los clientes pueden ver el estado de su orden en tiempo real.
- **Tickets Digitales**: Opción de compartir tickets de venta vía WhatsApp.

## 🛠 Funciones Especializadas

- **Impresión de Tickets**: Soporte nativo para impresoras térmicas de 58mm.
- **Desktop & PWA**: Ejecución optimizada mediante Electron para escritorio o como Aplicación Web Progresiva para tablets.
- **Auto-Mantenimiento**: Botón de "Limpiar Caché" integrado en el login para resolver problemas de carga de imágenes o iconos de forma instantánea.
- **Seguridad**: Autenticación persistente y gestión de sesiones mediante Supabase Auth.

## 💻 Stack Tecnológico

- **Frontend**: [Next.js 15+](https://nextjs.org/) con [Tailwind CSS](https://tailwindcss.com/)
- **Backend & DB**: [Supabase](https://supabase.com/) (PostgreSQL, Realtime, Auth)
- **Desktop**: [Electron](https://www.electronjs.org/)
- **Estándares**: Diseño responsivo, Animaciones premium, SEO Friendly.

## 🏁 Inicio Rápido

1. Instalación de dependencias:
```bash
npm install
```

2. Configuración de variables de entorno:
Crea un archivo `.env.local` con tus credenciales de Supabase.

3. Ejecución en desarrollo:
```bash
npm run dev
```

4. Compilación para producción:
```bash
npm run build
```

---
© 2025 Casa Leña. Desarrollado para operaciones de alto rendimiento.
