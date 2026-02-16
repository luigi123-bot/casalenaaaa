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
        /* 
           @page must be global and top-level. 
           'size' property controls the target paper size.
        */
        @page {
          size: 56mm auto;
          margin: 0mm;
        }

        @media print {
          /* Enforce the width on the root elements */
          html, body {
            width: 56mm !important;
            min-width: 56mm !important;
            max-width: 56mm !important;
            margin: 0 !important;
            padding: 0 !important;
            background-color: white !important;
            overflow: visible !important;
          }

          /* Reset visibility strategy */
          body * {
            visibility: hidden;
          }

          /* The Print Area: Absolute centering on the 56mm page */
          #print-area {
            position: absolute !important; 
            left: 0 !important;
            top: 0 !important;
            width: 56mm !important;
            max-width: 56mm !important;
            visibility: visible !important;
            display: block !important;
            background-color: white !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          /* Make contents visible */
          #print-area * {
            visibility: visible !important;
          }
          
          /* Adjust colors */
          #print-area {
             color: black !important;
             -webkit-print-color-adjust: exact;
             print-color-adjust: exact;
          }

          /* Hide UI elements */
          .no-print, header, nav, footer {
            display: none !important;
          }
        }
      `}</style>
    </>
  );
};

export default TicketPrintModal;
