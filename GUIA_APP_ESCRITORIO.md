# GUÍA DE APLICACIÓN DE ESCRITORIO CASALENA POS

Esta guía explica cómo ejecutar la aplicación en modo escritorio (Electron) para impresión silenciosa y cómo generar el instalador (.exe).

## 1. Ejecutar en Modo Desarrollo (Pruebas)

Para probar la aplicación de escritorio mientras desarrollas, usa el siguiente comando. Esto abrirá tanto el servidor de Next.js como la ventana de Electron.

```bash
npm run electron:dev
```

*Nota: La primera vez puede tardar un poco mientras se descargan los binarios de Electron.*

---

## 2. Generar Instalador para Windows (.exe)

Para crear un instalador que puedas llevar a la computadora de la caja:

1. Asegúrate de que el proyecto funciona correctamente.
2. Ejecuta el comando de construcción:

```bash
npm run electron:build
```

3. Al finalizar, encontrarás el instalador en la carpeta `dist/`.
   - El archivo se llamará algo como `Casalena POS Setup 0.1.0.exe`.

---

## 3. Instalación y Uso

1. Copia el archivo `.exe` generado a la computadora de la caja.
2. Ejecútalo para instalar el sistema "Casalena POS".
3. Se creará un acceso directo en el escritorio.
4. Al abrirlo, el sistema cargará y la impresión funcionará **automáticamente** y en **silencio** (sin cuadro de diálogo) gracias a la integración nativa.

## Notas Importantes

- **Impresora Predeterminada**: La aplicación imprimirá automáticamente en la impresora que esté configurada como "Predeterminada" en Windows. Asegúrate de que sea la térmica de 58mm.
- **Configuración de Papel**: Asegúrate de que en las propiedades de la impresora en Windows, el papel esté configurado correctamente a 58mm, y los márgenes al mínimo.
