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

    // Detectar si estamos en el entorno de escritorio (Electron)
    const isElectron = typeof window !== 'undefined' && 
                      ((window as any).electron?.isElectron || navigator.userAgent.toLowerCase().includes('electron'));

    if (isElectron) {
      console.log('🖥️ [Print] Entorno Electron detectado. Iniciando impresión silenciosa...');
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
                ${printContent.outerHTML}
              </div>
            </body>
          </html>
        `;

        await (window as any).electron.printSilent({ html: fullHtml });
        console.log('✅ [Print] Orden enviada a la impresora.');
        onClose(); 
        return;
      } catch (err) {
        console.error('❌ [Print] Error en impresión de Electron:', err);
      }
    }

    // Fallback: Navegador / PWA (Mostrará cuadro de diálogo por seguridad del navegador)
    console.log('🌐 [Print] Entorno Web detectado. Usando diálogo de impresión del navegador.');
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
          ${printContent.outerHTML}
        </body>
      </html>
    `);
    doc.close();
  };

  useEffect(() => {
    if (isOpen && data) {
      const timer = setTimeout(() => {
        handlePrint();
        const isElectron = (window as any).electron?.isElectron;
        if (!isElectron) {
          // Reducimos el tiempo de cierre para que sea casi instantáneo en modo kiosko
          setTimeout(onClose, 500);
        }
      }, 100); 
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
