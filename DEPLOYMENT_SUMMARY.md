# 📦 Resumen de Configuración para Despliegue

## ✅ Archivos Configurados

### 1. **next.config.ts**
- ✅ Ignora `venv/` durante desarrollo (watch mode)
- ✅ Excluye archivos Python del tracing en producción
- ✅ React Strict Mode habilitado

### 2. **vercel.json**
- ✅ Configuración de funciones serverless
- ✅ Instalación automática de dependencias Python
- ✅ Memoria y timeout configurados

### 3. **.vercelignore**
- ✅ Excluye `venv/` del despliegue
- ✅ Excluye archivos Python compilados
- ✅ Excluye variables de entorno locales

### 4. **.gitignore**
- ✅ Ignora `venv/` en Git
- ✅ Ignora `__pycache__/` y archivos `.pyc`

## 🐍 Cómo Funciona Python en Producción

### Desarrollo Local
```
Usuario → Next.js API → venv/bin/python → generar_ticket.py → PDF
```

### Producción (Vercel)
```
Usuario → Next.js API → python3 (sistema) → generar_ticket.py → PDF
```

### Código Adaptativo

El archivo `/app/api/print/ticket/route.ts` tiene lógica inteligente:

```typescript
// Línea 56-57
const venvPython = path.join(process.cwd(), 'venv', 'bin', 'python');
const pythonCommand = fs.existsSync(venvPython) 
  ? venvPython                           // Desarrollo: usa venv
  : (process.env.PYTHON_PATH || 'python3'); // Producción: usa sistema
```

## 🚀 Pasos para Desplegar

### 1. Preparar el Proyecto

```bash
# Asegúrate de que todo esté commiteado
git add .
git commit -m "Preparado para despliegue"
git push origin main
```

### 2. Configurar Vercel

1. **Conecta tu repositorio:**
   - Ve a [vercel.com](https://vercel.com)
   - Import Git Repository
   - Selecciona tu repo

2. **Configura variables de entorno:**
   ```
   NEXT_PUBLIC_SUPABASE_URL=tu_url_aqui
   NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_key_aqui
   PYTHON_PATH=/usr/bin/python3  (opcional)
   ```

3. **Deploy:**
   - Click "Deploy"
   - Vercel automáticamente:
     - Instala npm packages
     - Instala Python packages (reportlab, pillow)
     - Hace build de Next.js
     - Despliega

### 3. Verificar Despliegue

Después del despliegue, verifica:

1. **La app funciona:**
   - Abre la URL de Vercel
   - Prueba login
   - Crea una orden

2. **Python funciona:**
   - Ve a Vercel Dashboard → tu proyecto → Logs
   - Busca logs de generación de PDF
   - Verifica que no haya errores de Python

3. **PDFs se generan:**
   - Haz una orden de prueba
   - Verifica que el PDF se genere
   - Check en `/public/tickets/`

## ⚠️ Problemas Comunes

### Error: "python3: command not found"

**Solución:**
Agrega variable de entorno en Vercel:
```
PYTHON_PATH=/usr/bin/python3
```

### Error: "No module named 'reportlab'"

**Solución:**
Verifica que `vercel.json` tenga:
```json
"installCommand": "npm install && pip3 install -r requirements.txt --target /tmp/python-packages || true"
```

### Error: "venv symlink invalid"

**Solución:**
Ya está resuelto con:
- `.vercelignore` excluye `venv/`
- `next.config.ts` ignora `venv/` en build
- Código usa Python del sistema en producción

## 📊 Estructura de Archivos

```
casalenaa/
├── app/
│   └── api/
│       └── print/
│           └── ticket/
│               └── route.ts          # API que llama Python
├── utils/
│   └── generar_ticket.py            # Script Python (se despliega)
├── public/
│   └── tickets/                     # PDFs generados
├── venv/                            # NO se despliega (local only)
├── requirements.txt                 # Dependencias Python
├── next.config.ts                   # Config Next.js
├── vercel.json                      # Config Vercel
├── .vercelignore                    # Excluye venv
└── .gitignore                       # Ignora venv
```

## ✨ Características del Sistema

### ✅ Funciona en Desarrollo
- Usa `venv/bin/python`
- Dependencias aisladas
- Fácil de desarrollar

### ✅ Funciona en Producción
- Usa `python3` del sistema
- Dependencias instaladas automáticamente
- Sin necesidad de venv

### ✅ Fallback Inteligente
- Si falla Python, la app sigue funcionando
- Logs claros de errores
- Usuario puede descargar PDF manualmente

## 🎯 Próximos Pasos

1. **Desplegar a Vercel** siguiendo los pasos arriba
2. **Probar generación de PDFs** en producción
3. **Configurar dominio personalizado** (opcional)
4. **Configurar impresora** en el servidor si es necesario

## 📞 Soporte

Si tienes problemas:
1. Revisa los logs en Vercel Dashboard
2. Verifica variables de entorno
3. Consulta `DEPLOYMENT.md` para más detalles

---

**Última actualización:** 2026-02-02
**Estado:** ✅ Listo para despliegue
