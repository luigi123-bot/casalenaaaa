'use client';

import React, { useEffect } from 'react';
import Ticket58mm, { TicketData } from './Ticket58mm';

interface TicketPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: TicketData | null;
}

const TicketPrintModal: React.FC<TicketPrintModalProps> = ({ isOpen, onClose, data }) => {

  // Auto-print effect
  useEffect(() => {
    if (isOpen && data) {
      const doPrint = async () => {
        // Check if running in Electron
        if ((window as any).electron) {
          console.log("🖨️ [TicketModal] Detectado entorno Electron. Imprimiendo silenciosamente...");
          try {
            const result = await (window as any).electron.printSilent();
            if (result.success) {
              console.log("✅ Impresión silenciosa completada");
            } else {
              console.error("❌ Error en impresión silenciosa:", result.error);
            }
          } catch (e) {
            console.error("❌ Excepción al imprimir:", e);
          } finally {
            // Close modal state regardless of success
            onClose();
          }
        } else {
          // Browser fallback
          console.log("🌐 [TicketModal] Entorno Navegador. Usando window.print()");
          const timer = setTimeout(() => {
            window.print();
          }, 500);

          const handleAfterPrint = () => {
            onClose();
          };

          window.addEventListener('afterprint', handleAfterPrint);

          return () => {
            clearTimeout(timer);
            window.removeEventListener('afterprint', handleAfterPrint);
          };
        }
      };

      doPrint();
    }
  }, [isOpen, data, onClose]);

  if (!isOpen || !data) return null;

  return (
    <>
      {/* 
        SCREEN: Hidden
      */}

      {/* PRINT: Content Visible */}
      <div id="print-area" className="hidden">
        <Ticket58mm data={data} />
      </div>

      {/* Global Style for Printing */}
      <style jsx global>{`
        @page {
          size: 58mm auto;
          margin: 0mm;
        }

        @media print {
          html, body {
            width: 58mm !important;
            margin: 0 !important;
            padding: 0 !important;
            background-color: white !important;
          }

          body * {
            visibility: hidden;
          }

          /* The Print Area: Center the 48mm content on the 58mm paper */
          #print-area {
            position: absolute !important; 
            left: 50% !important;
            transform: translateX(-50%) !important;
            top: 0 !important;
            width: 48mm !important; /* Safety width for 58mm rollers */
            max-width: 48mm !important;
            visibility: visible !important;
            display: block !important;
            background-color: white !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          #print-area * {
            visibility: visible !important;
          }
          
          #print-area {
             color: black !important;
             -webkit-print-color-adjust: exact;
             print-color-adjust: exact;
          }

          .no-print, header, nav, footer {
            display: none !important;
          }
        }
      `}</style>
    </>
  );
};

export default TicketPrintModal;
