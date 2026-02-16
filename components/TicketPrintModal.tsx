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
      {/* Global Style for Printing */}
      <style jsx global>{`
        /* 
           @page must be global and top-level. 
           'size' property controls the target paper size.
           'auto' height allows continuous printing for thermal rolls.
        */
        @page {
          size: 58mm auto;
          margin: 0mm;
        }

        @media print {
          /* Enforce the width on the root elements */
          html, body {
            width: 58mm !important;
            min-width: 58mm !important;
            max-width: 58mm !important;
            margin: 0 !important;
            padding: 0 !important;
            background-color: white !important;
            overflow: visible !important; /* Ensure content is not clipped */
          }

          /* Hide everything else */
          body > *:not(#next-route-announcer) { 
             /* We can't use display:none on body direct children because TicketPrintModal 
                might be deeply nested. We rely on visibility. */
             visibility: hidden; 
             height: 0; 
             overflow: hidden;
          }

          /* But wait, TicketPrintModal is likely inside one of those children. 
             If we set height:0 overflow:hidden on parents, the absolute child might be clipped 
             if position is not 'fixed'. 'fixed' is relative to viewport/page. */
             
          /* RESET visibility strategy */
          body * {
            visibility: hidden;
          }

          /* The Print Area: Fixed positioning places it relative to the page box */
          #print-area {
            position: fixed !important; 
            left: 0 !important;
            top: 0 !important;
            width: 58mm !important;
            visibility: visible !important;
            display: block !important;
            z-index: 2147483647; /* Max z-index */
            background-color: white;
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
        }
      `}</style>
    </>
  );
};

export default TicketPrintModal;
