'use client';

import React, { useEffect, useRef } from 'react';
import Ticket58mm, { TicketData } from './Ticket58mm';
import DOMPurify from 'dompurify';

interface TicketPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: TicketData | null;
}

const TicketPrintModal: React.FC<TicketPrintModalProps> = ({ isOpen, onClose, data }) => {
  // ✅ FIX: Guard para evitar doble impresión cuando isOpen y data cambian
  // casi simultáneamente (e.g. setTicketData + setShowTicketModal en secuencia).
  const isPrintingRef = useRef(false);

  const handlePrint = async () => {
    console.log('[TicketPrintModal] 🖨️ handlePrint() iniciado.');
    if (isPrintingRef.current) {
      console.warn('[TicketPrintModal] ⚠️ handlePrint() cancelado: isPrintingRef.current ya es true.');
      return;
    }
    isPrintingRef.current = true;
    console.log('[TicketPrintModal] 🔒 isPrintingRef establecido en true.');

    const printContent = document.getElementById('print-area');
    if (!printContent) {
      console.error('[TicketPrintModal] 🛑 Error: Elemento #print-area no encontrado en el DOM.');
      isPrintingRef.current = false;
      return;
    }
    console.log('[TicketPrintModal] 📂 print-area encontrado. Tamaño del contenido HTML:', printContent.outerHTML.length);

    // Sanitizar outerHTML para evitar ataques XSS durante la impresión
    const cleanOuterHtml = DOMPurify.sanitize(printContent.outerHTML, {
      ADD_TAGS: ['style', 'svg', 'path', 'circle', 'rect'],
      ADD_ATTR: ['style', 'class', 'id', 'd', 'fill', 'stroke', 'width', 'height']
    });
    console.log('[TicketPrintModal] 🧼 HTML sanitizado con éxito.');

    // Detectar si estamos en el entorno de escritorio (Electron)
    const isElectron = typeof window !== 'undefined' &&
                      (window as any).electron !== undefined &&
                      ((window as any).electron?.isElectron || navigator.userAgent.toLowerCase().includes('electron'));
    
    console.log('[TicketPrintModal] 🖥️ Detección de entorno:', {
      typeofWindow: typeof window,
      hasElectronProp: typeof window !== 'undefined' && (window as any).electron !== undefined,
      isElectronProp: typeof window !== 'undefined' && (window as any).electron?.isElectron,
      userAgentHasElectron: typeof navigator !== 'undefined' && navigator.userAgent.toLowerCase().includes('electron'),
      isElectronCalculated: isElectron,
      hasPrintSilent: typeof window !== 'undefined' && typeof (window as any).electron?.printSilent === 'function'
    });

    if (isElectron && (window as any).electron?.printSilent) {
      try {
        console.log('[TicketPrintModal] 🚀 Intentando impresión silenciosa nativa en Electron...');
        // ✅ FIX: En Electron, solo incluir estilos inline (<style>).
        // Los <link rel="stylesheet"> apuntan a localhost y no se pueden resolver
        // dentro de una ventana data: URL usada para impresión silenciosa.
        const styles = Array.from(document.querySelectorAll('style'))
          .map(node => node.outerHTML)
          .join('\n');

        const fullHtml = `
          <html>
            <head>
              <title>Ticket</title>
              ${styles}
              <style>
                @page { size: 58mm auto; margin: 0; }
                body { width: 58mm; margin: 0; padding: 0; background: white; -webkit-print-color-adjust: exact; }
              </style>
            </head>
            <body>
              <div style="width: 58mm;">
                ${cleanOuterHtml}
              </div>
            </body>
          </html>
        `;

        await (window as any).electron.printSilent({ html: fullHtml });
        console.log('[TicketPrintModal] ✅ Impresión silenciosa completada sin excepciones.');
        isPrintingRef.current = false;
        onClose();
        return;
      } catch (err) {
        // Safe console output, no client personal information exposed
        console.error('[TicketPrintModal] 🛑 Error en proceso de impresión silenciosa de Electron:', err);
        isPrintingRef.current = false;
        onClose(); // ✅ FIX: Always call onClose even on error to reset state
        return;
      }
    }

    console.log('[TicketPrintModal] 🌐 Entorno de Navegador/PWA detectado. Usando fallback con iframe...');
    // Fallback: Navegador / PWA (Mostrará cuadro de diálogo por seguridad del navegador)
    const oldIframe = document.getElementById('ticket-print-iframe');
    if (oldIframe) {
      console.log('[TicketPrintModal] 🗑️ Eliminando iframe de impresión viejo.');
      oldIframe.remove();
    }

    const iframe = document.createElement('iframe');
    iframe.id = 'ticket-print-iframe';
    iframe.style.display = 'none';
    document.body.appendChild(iframe);
    console.log('[TicketPrintModal] ➕ Nuevo iframe de impresión creado y agregado al DOM.');

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      console.error('[TicketPrintModal] 🛑 Error: No se pudo obtener el document del iframe.');
      isPrintingRef.current = false;
      onClose(); // ✅ FIX: Always call onClose even on error to reset state
      return;
    }

    // En el iframe de navegador, los links sí funcionan porque heredan el contexto de la página
    const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
      .map(node => node.outerHTML)
      .join('\n');

    doc.open();
    doc.write(`
      <html>
        <head>
          ${styles}
          <style>
            @page { size: 58mm auto; margin: 0; }
            body { width: 58mm; margin: 0; padding: 0; }
          </style>
        </head>
        <body onload="window.print();">
          ${cleanOuterHtml}
        </body>
      </html>
    `);
    doc.close();
    console.log('[TicketPrintModal] ✍️ Contenido escrito en el iframe y ejecutado window.print().');

    // Reset printing guard after a delay to ensure print dialog closes
    setTimeout(() => {
      console.log('[TicketPrintModal] 🔓 Reseteando guard isPrintingRef.current de vuelta a false.');
      isPrintingRef.current = false;
    }, 1500);
  };

  useEffect(() => {
    console.log('[TicketPrintModal] 🔄 useEffect disparado. isOpen:', isOpen, ' | data_pedido_id:', data?.pedido?.id);
    if (!isOpen || !data) return;

    // Reset guard on each new print session
    isPrintingRef.current = false;
    console.log('[TicketPrintModal] 🔓 useEffect reseteó isPrintingRef.current a false.');

    // ✅ FIX: 600ms — Ticket58mm tiene un useEffect que setea mounted=true.
    // Hasta que mounted=true el componente devuelve null (nada que imprimir).
    // 600ms garantiza que el componente ya renderizó su contenido.
    console.log('[TicketPrintModal] ⏱️ Iniciando temporizador de 600ms para renderizar el ticket...');
    const timer = setTimeout(() => {
      console.log('[TicketPrintModal] 🔔 Temporizador de 600ms completado.');
      const printArea = document.getElementById('print-area');
      if (!printArea) {
        console.warn('[TicketPrintModal] ⚠️ #print-area no encontrado — el ticket aún no montó.');
        onClose(); // ✅ FIX: Call onClose if print area not found to reset state
        return;
      }
      console.log('[TicketPrintModal] ➡️ #print-area encontrado. Ejecutando handlePrint()...');
      handlePrint();
      const isElectronEnv = typeof window !== 'undefined' && (window as any).electron?.isElectron;
      if (!isElectronEnv) {
        console.log('[TicketPrintModal] 🕒 Programando onClose en 500ms para entorno no Electron...');
        setTimeout(onClose, 500);
      }
    }, 600);

    return () => {
      console.log('[TicketPrintModal] 🧹 Limpiando temporizador de 600ms.');
      clearTimeout(timer);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, data]);

  if (!isOpen || !data) return null;

  return (
    // ✅ FIX: width: 58mm para que Electron capture el ticket con dimensiones correctas.
    // Posición fija fuera de pantalla para que no sea visible al usuario.
    <div
      className="fixed top-0 z-[-1] opacity-0 pointer-events-none"
      style={{ left: '-9999px', width: '58mm' }}
      aria-hidden="true"
    >
      <div id="print-area">
        <Ticket58mm data={data} />
      </div>
    </div>
  );
};

export default TicketPrintModal;
