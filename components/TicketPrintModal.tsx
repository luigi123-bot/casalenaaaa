'use client';

import React, { useEffect } from 'react';
import Ticket58mm, { TicketData } from './Ticket58mm';

interface TicketPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: TicketData | null;
}

const TicketPrintModal: React.FC<TicketPrintModalProps> = ({ isOpen, onClose, data }) => {

  const handlePrint = async () => {
    const printContent = document.getElementById('print-area');
    if (!printContent) return;

    // Si estamos en Electron, usamos la impresión silenciosa nativa
    if (typeof window !== 'undefined' && (window as any).electron?.isElectron) {
      try {
        const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
          .map(node => node.outerHTML)
          .join('\n');

        const fullHtml = `
          <html>
            <head>
              <title>Imprimir Ticket</title>
              ${styles}
              <style>
                @page {
                  size: 58mm auto;
                  margin: 0;
                }
                body {
                  width: 58mm;
                  margin: 0;
                  padding: 0;
                  background-color: white;
                }
              </style>
            </head>
            <body>
              <div style="width: 58mm; max-width: 58mm; margin: 0; padding: 0;">
                ${printContent.outerHTML}
              </div>
            </body>
          </html>
        `;

        await (window as any).electron.printSilent({ html: fullHtml });
        onClose(); // Cerrar automáticamente después de enviar a imprimir
        return;
      } catch (err) {
        console.error('Error en impresión silenciosa de Electron:', err);
      }
    }

    // Fallback: Método tradicional de iframe para navegador (PWA)
    const oldIframe = document.getElementById('ticket-print-iframe');
    if (oldIframe) {
      oldIframe.remove();
    }

    const iframe = document.createElement('iframe');
    iframe.id = 'ticket-print-iframe';
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    
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
          <title>Imprimir Ticket</title>
          ${styles}
          <style>
            @page {
              size: 58mm auto;
              margin: 0;
            }
            body {
              width: 58mm;
              margin: 0;
              padding: 0;
              background-color: white;
            }
          </style>
        </head>
        <body onload="setTimeout(function() { window.focus(); window.print(); }, 200)">
          <div style="width: 58mm; max-width: 58mm; margin: 0; padding: 0;">
            ${printContent.outerHTML}
          </div>
        </body>
      </html>
    `);
    doc.close();
  };

  // Auto-print when modal opens
  useEffect(() => {
    if (isOpen && data) {
      const timer = setTimeout(() => {
        handlePrint();
        // Si no es electron, cerramos el modal después de un tiempo para permitir que el diálogo del navegador abra
        if (!(window as any).electron?.isElectron) {
          // Un delay un poco más largo para el PWA asegura que el navegador capture el comando de impresión
          setTimeout(onClose, 1000);
        }
      }, 300); 
      return () => clearTimeout(timer);
    }
  }, [isOpen, data]);

  if (!isOpen || !data) return null;

  // Renderizado oculto: Usamos visibilidad escondida pero mantenemos dimensiones mínimas 
  // para que el navegador no ignore el renderizado del contenido.
  return (
    <div className="fixed top-0 left-0 z-[-1] opacity-0 pointer-events-none overflow-hidden" style={{ width: '1px', height: '1px' }}>
      <div id="print-area">
        <Ticket58mm data={data} />
      </div>
    </div>
  );
};

export default TicketPrintModal;
