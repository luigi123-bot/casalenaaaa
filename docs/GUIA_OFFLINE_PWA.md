# Guía de Implementación PWA y Modo Offline Limitado

Este documento detalla cómo se ha configurado la aplicación **Casaleña POS** para funcionar como una **Progressive Web App (PWA)**, permitiendo su instalación y uso sin conexión a internet.

## 1. ¿Qué se ha implementado?

Se ha transformado la aplicación web en una PWA. Esto permite:
1.  **Instalación**: Los usuarios pueden "instalar" la web en su celular (Android/iOS) o PC como si fuera una app nativa.
2.  **Modo Offline**: La aplicación guarda (cachea) las páginas visitadas para que funcionen sin internet.

### Archivos Clave
- **`next.config.ts`**: Configuración del plugin `@ducanh2912/next-pwa` para generar el "Service Worker" (el script que maneja el modo offline).
- **`public/manifest.json`**: Archivo de identidad de la app (nombre, iconos, colores).
- **`app/layout.tsx`**: Inclusión de metadatos para dispositivos móviles.

---

## 2. Configuración para "Uso Offline durante un tiempo"

Por defecto, una PWA guarda los archivos hasta que sale una nueva versión. Sin embargo, para cumplir con el requisito de "utilizar sin internet pero durante un tiempo" (es decir, que los datos expiren o no se guarden para siempre), se utiliza la configuración de **Cache Expiration**.

### Estrategia de Caché
Actualmente, la configuración utiliza estrategias estándar. Si deseas limitar el tiempo que los datos viven en el dispositivo sin conexión (ej. 7 días), se debe modificar `next.config.ts` para incluir reglas de expiración.

**Ejemplo de configuración para limitar el tiempo offline:**

```typescript
// En next.config.ts
const withPWA = require("@ducanh2912/next-pwa").default({
  // ... otras configuraciones
  workboxOptions: {
    runtimeCaching: [
      {
        // Guardar imágenes, fuentes y scripts
        urlPattern: /^.*\.(png|jpg|jpeg|svg|gif|webp|js|css|woff|woff2)$/i,
        handler: 'CacheFirst',
        options: {
          cacheName: 'static-assets',
          expiration: {
            maxEntries: 200,          // Máximo 200 archivos
            maxAgeSeconds: 7 * 24 * 60 * 60, // Expiran en 7 días
          },
        },
      },
      {
        // Guardar páginas visitadas (HTML/JSON)
        urlPattern: /^https?.*/,
        handler: 'NetworkFirst', // Intenta internet primero, luego usa caché
        options: {
          cacheName: 'pages-cache',
          expiration: {
            maxEntries: 50,
            maxAgeSeconds: 24 * 60 * 60, // Expiran en 24 horas (ejemplo)
          },
        },
      },
    ],
  },
});
```

> **Nota**: Con la configuración actual (`NetworkFirst` o `StaleWhileRevalidate` implícito), la app intentará actualizarse cada vez que tenga internet. Si no tiene internet, usará la versión guardada hasta que el navegador limpie la caché por falta de espacio o el usuario la borre manualmente.

---

## 3. Cómo Probar el Modo Offline

El modo PWA **solo funciona en producción** (no en `npm run dev`) para evitar problemas mientras desarrollas.

### Pasos para probar:

1.  **Construir la aplicación**:
    Debes usar el flag `--webpack` porque el plugin de PWA aún no es 100% compatible con Turbopack.
    ```bash
    npm run build
    ```

2.  **Iniciar el servidor de producción**:
    ```bash
    npm start
    ```

3.  **Verificar en el Navegador**:
    - Abre `http://localhost:3000`.
    - Busca el icono de **"Instalar App"** en la barra de dirección (escritorio) o en el menú "Agregar a inicio" (móvil).
    - Navega por algunas páginas para que se guarden en caché.
    - **Desconecta el internet** (o usa la pestaña "Network" -> "Offline" en las DevTools F12).
    - Recarga la página. ¡Debería seguir funcionando!

## 4. Personalización del Icono

Para que la app se vea profesional al instalarse, debes reemplazar los iconos genéricos.
1. Coloca tu logo en `public/`.
2. Se recomiendan dos tamaños:
   - `icon-192x192.png`
   - `icon-512x512.png`
3. Actualiza el archivo `public/manifest.json` con las rutas correctas de tus nuevos iconos.
