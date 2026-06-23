'use client';

import React, { useEffect } from 'react';
import Ticket58mm, { TicketData } from './Ticket58mm';
import DOMPurify from 'dompurify';

interface TicketPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: TicketData | null;
}

const TicketPrintModal: React.FC<TicketPrintModalProps> = ({ isOpen, onClose, data }) => {

  const handlePrint = async () => {
    const printContent = document.getElementById('print-area');
    if (!printContent) return;

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
        const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
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
              <div style="width: 58mm; overflow: hidden;">
                ${cleanOuterHtml}
              </div>
            </body>
          </html>
        `;

        await (window as any).electron.printSilent({ html: fullHtml });
        onClose(); 
        return;
      } catch (err) {
        // Safe console output, no client personal information exposed
        console.error('[Print] Error in Electron printing process');
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
    if (!doc) return;

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
  };

  useEffect(() => {
    if (isOpen && data) {
      // ✅ FIX: Aumentado de 100ms a 400ms.
      // Ticket58mm tiene un useEffect que setea mounted=true y devuelve null hasta entonces.
      // Con 100ms no había tiempo suficiente para que el componente renderizara su contenido,
      // causando tickets en blanco o impresiones fallidas.
      const timer = setTimeout(() => {
        const printArea = document.getElementById('print-area');
        if (!printArea) {
          console.warn('[TicketPrintModal] #print-area no encontrado — el ticket aún no montó. Reintentando...');
          return;
        }
        handlePrint();
        const isElectron = (window as any).electron?.isElectron;
        if (!isElectron) {
          setTimeout(onClose, 500);
        }
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [isOpen, data]);

  if (!isOpen || !data) return null;

  return (
    <div className="fixed top-0 left-0 z-[-1] opacity-0 pointer-events-none" style={{ width: '1px', height: '1px' }}>
      <div id="print-area">
        <Ticket58mm data={data} />
      </div>
    </div>
  );
};

export default TicketPrintModal;

