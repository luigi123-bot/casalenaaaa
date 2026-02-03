# Configuración del Entorno Python para Generación de Tickets

Este proyecto utiliza Python para generar tickets PDF térmicos de 58mm usando ReportLab.

## Instalación

### 1. Crear el entorno virtual (solo la primera vez)

```bash
python3 -m venv venv
```

### 2. Activar el entorno virtual

**Linux/Mac:**
```bash
source venv/bin/activate
```

**Windows:**
```bash
venv\Scripts\activate
```

### 3. Instalar dependencias

```bash
pip install -r requirements.txt
```

## Uso

El sistema automáticamente detecta y usa el entorno virtual cuando genera tickets desde la aplicación web.

### Probar manualmente el generador de tickets

```bash
./venv/bin/python utils/generar_ticket.py
```

Esto generará un ticket de ejemplo llamado `ticket_ejemplo_58mm.pdf`.

## Dependencias

- **reportlab**: Librería para generar PDFs
- **pillow**: Procesamiento de imágenes (requerido por reportlab)

## Notas

- El entorno virtual (`venv/`) está excluido del control de versiones
- La aplicación Next.js automáticamente usa el Python del entorno virtual si existe
- Si el entorno virtual no existe, usará el Python del sistema
