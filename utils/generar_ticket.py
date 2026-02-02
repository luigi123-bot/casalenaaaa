import os
from datetime import datetime
from reportlab.lib.pagesizes import mm
from reportlab.pdfgen import canvas
from reportlab.lib import colors

def generar_ticket_58mm(datos_comercio, pedido, productos, filename="ticket_58mm.pdf"):
    """
    Genera un PDF para impresora térmica de 58mm con altura dinámica.
    """
    
    # 1. Configuración de dimensiones (58mm de ancho)
    # 58mm es aproximadamente 164.4 puntos en ReportLab (1 point = 1/72 inch)
    width = 58 * mm
    margin = 2 * mm
    usable_width = width - (2 * margin)
    
    # Fuentes y tamaños
    font_name = "Courier"  # Fuente monoespaciada estándar en PDF
    font_size_normal = 8
    font_size_header = 10
    line_height = 10
    
    # 2. Calcular altura dinámica
    # Estimación de líneas:
    # Encabezado (4) + Info Pedido (4) + Separadores (2) + Productos (len * 1.5) + Totales (3) + Pie (2)
    estimated_lines = 15 + (len(productos) * 2)
    height = estimated_lines * line_height
    
    # 3. Crear el Canvas
    c = canvas.Canvas(filename, pagesize=(width, height))
    
    # Cursor de posición Y (empezamos desde arriba)
    y = height - margin - line_height

    def text_line(text, font=font_name, size=font_size_normal, align="left", bold=False):
        nonlocal y
        c.setFont(font + ("-Bold" if bold else ""), size)
        
        if align == "center":
            c.drawCentredString(width / 2, y, text)
        elif align == "right":
            c.drawRightString(width - margin, y, text)
        else:
            c.drawString(margin, y, text)
        
        y -= line_height

    def draw_separator():
        nonlocal y
        c.setDash(1, 1)  # Línea punteada
        c.line(margin, y + (line_height/2), width - margin, y + (line_height/2))
        c.setDash()
        y -= line_height

    # --- SECCIÓN: ENCABEZADO ---
    text_line(datos_comercio['nombre'].upper(), size=font_size_header, align="center", bold=True)
    text_line(f"Tel: {datos_comercio['telefono']}", align="center")
    text_line(datos_comercio['direccion'], align="center")
    
    draw_separator()
    
    # --- SECCIÓN: INFO PEDIDO ---
    text_line(f"FECHA: {datetime.now().strftime('%d/%m/%Y')}")
    text_line(f"HORA:  {datetime.now().strftime('%H:%M:%S')}")
    text_line(f"TICKET: {pedido['id']}", bold=True)
    
    if 'tipo' in pedido:
        text_line(f"MODO: {pedido['tipo'].upper()}", bold=True)
    if 'mesa' in pedido and pedido['mesa']:
        text_line(f"MESA: {pedido['mesa']}", bold=True)
    
    draw_separator()
    
    # --- SECCIÓN: PRODUCTOS ---
    # Encabezado de tabla
    c.setFont(f"{font_name}-Bold", font_size_normal)
    c.drawString(margin, y, "Cant")
    c.drawString(margin + 10*mm, y, "Producto")
    c.drawRightString(width - margin, y, "Total")
    y -= line_height
    
    c.setFont(font_name, font_size_normal)
    for p in productos:
        # Si el nombre es muy largo, lo truncamos o lo calculamos en varias líneas
        nombre = p['nombre'][:18] # Ajuste según ancho de 58mm
        
        c.drawString(margin, y, str(p['cantidad']))
        c.drawString(margin + 10*mm, y, nombre)
        c.drawRightString(width - margin, y, f"${p['precio']:,.2f}")
        y -= line_height
        
        # Si tiene variantes o extras, los listamos debajo
        if 'detalle' in p and p['detalle']:
            c.setFont(font_name, font_size_normal - 1)
            text_line(f"  *{p['detalle']}", size=font_size_normal - 1)
            c.setFont(font_name, font_size_normal)

    draw_separator()
    
    # --- SECCIÓN: TOTALES ---
    text_line(f"SUBTOTAL:", align="left")
    c.drawRightString(width - margin, y + line_height, f"${pedido['subtotal']:,.2f}")
    
    text_line(f"TOTAL:", align="left", bold=True)
    c.drawRightString(width - margin, y + line_height, f"${pedido['total']:,.2f}")
    
    text_line(f"PAGO: {pedido['metodo_pago'].upper()}", align="left")
    
    try:
        mp = pedido.get('metodo_pago', 'Efectivo')
        show_details = False
        # Show details if explicit payment amount exists OR if method is Cash
        if mp and str(mp).upper() == 'EFECTIVO':
            show_details = True
        if pedido.get('pago_con'):
            show_details = True
            
        if show_details:
            total = pedido.get('total', 0.0)
            # If pago_con is missing/zero but it's cash, assume exact amount (total)
            pago = pedido.get('pago_con') or total
            cambio = pedido.get('cambio') or 0.0
            
            text_line(f"RECIBIDO: ${float(pago):,.2f}")
            text_line(f"CAMBIO:   ${float(cambio):,.2f}", bold=True)
    except Exception as e:
        # Don't fail the whole ticket for this
        print(f"Warn: Payment details error {e}")
    
    draw_separator()
    
    # --- SECCIÓN: CLIENTE (SI ES DOMICILIO) ---
    if pedido.get('cliente'):
        text_line("CLIENTE:", bold=True)
        text_line(pedido['cliente']['nombre'])
        text_line(pedido['cliente']['telefono'])
        # La dirección puede ser larga, manejar multilínea si es necesario
        address = pedido['cliente']['direccion']
        chunk_size = 25
        for i in range(0, len(address), chunk_size):
            text_line(address[i:i+chunk_size])
        draw_separator()

    # --- SECCIÓN: PIE ---
    text_line("¡GRACIAS POR SU COMPRA!", align="center", bold=True)
    text_line("Vuelva pronto", align="center")
    
    # Finalizar
    c.showPage()
    c.save()
    print(f"Ticket generado exitosamente: {filename}")

# --- CLI INTEGRATION ---
if __name__ == "__main__":
    import argparse
    import json
    import sys

    parser = argparse.ArgumentParser(description="Generar ticket PDF 58mm")
    parser.add_argument("--json", help="Datos del ticket en formato JSON")
    parser.add_argument("--output", default="ticket_output.pdf", help="Nombre del archivo de salida")
    
    args = parser.parse_args()

    if args.json:
        try:
            data = json.loads(args.json)
            generar_ticket_58mm(
                data['comercio'], 
                data['pedido'], 
                data['productos'], 
                args.output
            )
            print(f"SUCCESS:{args.output}")
        except Exception as e:
            print(f"ERROR:{str(e)}", file=sys.stderr)
            sys.exit(1)
    else:
        # Ejemplo por defecto si no hay argumentos
        comercio = {
            "nombre": "Casalena Pizza & Grill",
            "telefono": "741-101-1595",
            "direccion": "Blvd. Juan N Alvarez, CP 41706"
        }
        datos_pedido = {
            "id": "00015423",
            "tipo": "Domicilio",
            "subtotal": 450.00,
            "total": 450.00,
            "metodo_pago": "Efectivo",
            "pago_con": 500.00,
            "cambio": 50.00,
            "cliente": {
                "nombre": "Luis Angel",
                "telefono": "7411234567",
                "direccion": "Calle Principal #123, Col. Centro, Ometepec"
            }
        }
        lista_productos = [
            {"cantidad": 1, "nombre": "Pizza Carnivora", "precio": 255.00, "detalle": "Grande + Extra Queso"},
            {"cantidad": 2, "nombre": "Refresco 600ml", "precio": 70.00, "detalle": "Coca-Cola"},
        ]
        generar_ticket_58mm(comercio, datos_pedido, lista_productos, "ticket_ejemplo_58mm.pdf")
