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
    if (isPrintingRef.current) return;
    isPrintingRef.current = true;

    const printContent = document.getElementById('print-area');
    if (!printContent) {
      isPrintingRef.current = false;
      return;
    }

    // Sanitizar outerHTML para evitar ataques XSS durante la impresión
    const cleanOuterHtml = DOMPurify.sanitize(printContent.outerHTML, {
      ADD_TAGS: ['style', 'svg', 'path', 'circle', 'rect'],
      ADD_ATTR: ['style', 'class', 'id', 'd', 'fill', 'stroke', 'width', 'height']
    });

    // Detectar si estamos en el entorno de escritorio (Electron)
    const isElectron = typeof window !== 'undefined' &&
                      ((window as any).electron?.isElectron || navigator.userAgent.toLowerCase().includes('electron'));

    if (isElectron) {
      try {
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
        isPrintingRef.current = false;
        onClose();
        return;
      } catch (err) {
        // Safe console output, no client personal information exposed
        console.error('[Print] Error in Electron printing process');
        isPrintingRef.current = false;
      }
    }

    // Fallback: Navegador / PWA (Mostrará cuadro de diálogo por seguridad del navegador)
    const oldIframe = document.getElementById('ticket-print-iframe');
    if (oldIframe) oldIframe.remove();

    const iframe = document.createElement('iframe');
    iframe.id = 'ticket-print-iframe';
    iframe.style.display = 'none';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      isPrintingRef.current = false;
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

    // Reset printing guard after a delay to ensure print dialog closes
    setTimeout(() => {
      isPrintingRef.current = false;
    }, 1500);
  };

  useEffect(() => {
    if (!isOpen || !data) return;

    // Reset guard on each new print session
    isPrintingRef.current = false;

    // ✅ FIX: 600ms — Ticket58mm tiene un useEffect que setea mounted=true.
    // Hasta que mounted=true el componente devuelve null (nada que imprimir).
    // 600ms garantiza que el componente ya renderizó su contenido.
    const timer = setTimeout(() => {
      const printArea = document.getElementById('print-area');
      if (!printArea) {
        console.warn('[TicketPrintModal] #print-area no encontrado — el ticket aún no montó.');
        return;
      }
      handlePrint();
      const isElectronEnv = (window as any).electron?.isElectron;
      if (!isElectronEnv) {
        setTimeout(onClose, 500);
      }
    }, 600);

    return () => clearTimeout(timer);
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
