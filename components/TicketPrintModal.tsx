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
            height: auto !important;
            overflow: visible !important;
          }

          body * {
            visibility: hidden;
          }

          /* The Print Area: Using margins instead of absolute positioning for better break handling */
          #print-area {
            visibility: visible !important;
            display: block !important;
            width: 48mm !important; 
            max-width: 48mm !important;
            margin: 0 auto !important; /* Centering */
            margin-left: 2mm !important; /* Move slightly left from the right edge */
            padding: 0 !important;
            background-color: white !important;
            position: relative !important;
            break-inside: avoid !important;
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

          /* Avoid page breaks inside items */
          div, p, span {
            break-inside: avoid !important;
          }
        }
      `}</style>
    </>
  );
};

export default TicketPrintModal;
