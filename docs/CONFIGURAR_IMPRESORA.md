# Guía de Configuración de Impresora Térmica en Linux (CUPS)

## Estado Actual
✅ CUPS está instalado y corriendo
❌ No hay impresora térmica conectada actualmente

## Pasos para Configurar tu Impresora Térmica

### 1. Conectar la Impresora
1. Conecta tu impresora térmica al puerto USB
2. Enciende la impresora
3. Espera unos segundos para que el sistema la detecte

### 2. Verificar que el Sistema Detectó la Impresora
Ejecuta este comando para ver si aparece:
```bash
lsusb
```
Deberías ver algo como: `Bus XXX Device XXX: ID XXXX:XXXX [Nombre de tu impresora]`

También puedes verificar con:
```bash
lpinfo -v
```
Busca una línea que diga algo como: `usb://...` o `direct usb://...`

### 3. Opción A: Configuración por Interfaz Web (MÁS FÁCIL)

1. Abre tu navegador web y ve a:
   ```
   http://localhost:631
   ```

2. Ve a la pestaña **"Administration"** (Administración)

3. Haz clic en **"Add Printer"** (Agregar Impresora)
   - Si te pide usuario/contraseña, usa tu usuario de Linux

4. Selecciona tu impresora de la lista (debería aparecer como USB o Local)

5. Haz clic en **"Continue"** (Continuar)

6. Configura los detalles:
   - **Name**: `ticket_printer` (sin espacios)
   - **Description**: `Impresora de Tickets Casaleña`
   - **Location**: `Cocina` (o donde esté ubicada)
   - ✅ Marca la casilla **"Share This Printer"** si quieres compartirla en red

7. Haz clic en **"Continue"**

8. Selecciona el driver/modelo:
   - **Para impresoras térmicas genéricas de 58mm o 80mm**:
     - Busca: `Generic` → `Generic ESC/POS Printer`
     - O busca: `Raw Queue` (imprime directamente sin procesar)
   
   - **Si conoces la marca de tu impresora**:
     - Busca el modelo exacto en la lista
     - Marcas comunes: Epson TM-T20, Star TSP100, Bixolon SRP-350

9. Haz clic en **"Add Printer"**

10. Configura las opciones de impresión:
    - **Media Size**: `Custom.58x297mm` (para 58mm) o `Custom.80x297mm` (para 80mm)
    - Haz clic en **"Set Default Options"**

11. ¡Listo! Imprime una página de prueba

### 4. Opción B: Configuración por Terminal (AVANZADO)

Si prefieres usar la terminal:

```bash
# 1. Ver impresoras disponibles
lpinfo -v

# 2. Ver drivers disponibles
lpinfo -m | grep -i "esc/pos\|raw"

# 3. Agregar la impresora (ajusta la URI según lo que viste en lpinfo -v)
# Ejemplo para impresora USB:
sudo lpadmin -p ticket_printer -E -v usb://EPSON/TM-T20 -m drv:///sample.drv/generpcl.ppd

# O para impresora genérica ESC/POS:
sudo lpadmin -p ticket_printer -E -v usb://Unknown/Printer -m drv:///sample.drv/generpcl.ppd

# 4. Establecerla como predeterminada
sudo lpoptions -d ticket_printer

# 5. Habilitar la impresora
sudo cupsenable ticket_printer
sudo cupsaccept ticket_printer
```

### 5. Probar la Impresora

Desde la terminal:
```bash
# Imprimir página de prueba
echo "Hola desde Casaleña" | lp -d ticket_printer

# Ver estado de la impresora
lpstat -p ticket_printer

# Ver todas las impresoras
lpstat -a
```

### 6. Solución de Problemas Comunes

#### La impresora no aparece en la lista
```bash
# Reiniciar el servicio CUPS
sudo systemctl restart cups

# Ver logs de CUPS
sudo tail -f /var/log/cups/error_log
```

#### Permisos de usuario
```bash
# Agregar tu usuario al grupo de impresoras
sudo usermod -a -G lp $USER
sudo usermod -a -G lpadmin $USER

# Cerrar sesión y volver a iniciar para que los cambios surtan efecto
```

#### La impresora imprime pero sale basura
- Esto significa que el driver no es correcto
- Prueba con `Raw Queue` o busca el driver específico de tu modelo

### 7. Configuración Específica para Impresoras Térmicas

Para impresoras térmicas de tickets (58mm o 80mm):

```bash
# Configurar tamaño de papel personalizado
lpoptions -p ticket_printer -o media=Custom.58x297mm
# O para 80mm:
lpoptions -p ticket_printer -o media=Custom.80x297mm

# Configurar orientación
lpoptions -p ticket_printer -o orientation-requested=3

# Ver opciones configuradas
lpoptions -p ticket_printer -l
```

### 8. Verificar que Todo Funciona

Una vez configurada, tu aplicación debería detectarla automáticamente.
Puedes probar con:

```bash
curl -X POST http://localhost:3000/api/print/ticket \
  -H "Content-Type: application/json" \
  -d '{"order":{"id":"TEST","order_type":"dine-in","table_number":"1","total_amount":100.0,"payment_method":"efectivo"},"items":[{"name":"Prueba","quantity":1,"price":100.0}]}'
```

## Marcas Comunes de Impresoras Térmicas y sus Drivers

- **Epson TM-T20, TM-T88**: Usar driver `Epson TM-T20` o `ESC/POS`
- **Star TSP100, TSP650**: Usar driver `Star TSP100` o `Star Line Mode`
- **Bixolon SRP-350**: Usar driver `Bixolon SRP-350` o `ESC/POS`
- **Genérica 58mm/80mm**: Usar `Raw Queue` o `Generic ESC/POS`

## Recursos Adicionales

- Interfaz web CUPS: http://localhost:631
- Documentación CUPS: https://www.cups.org/doc/
- Logs de errores: `/var/log/cups/error_log`

---

**Nota**: Una vez que conectes y configures tu impresora, el sistema de Casaleña
la detectará automáticamente y comenzará a imprimir los tickets sin necesidad
de guardar archivos PDF en tu computadora.
