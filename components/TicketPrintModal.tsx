'use client';

import React from 'react';
import Ticket58mm, { TicketData } from './Ticket58mm';

interface TicketPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: TicketData | null;
}

const TicketPrintModal: React.FC<TicketPrintModalProps> = ({ isOpen, onClose, data }) => {

  // Auto-print disabled to allow user interaction
  // useEffect removed

  if (!isOpen || !data) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 print:p-0 print:bg-white animate-in fade-in duration-300">
      <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-sm overflow-hidden flex flex-col max-h-[90vh] print:max-h-none print:shadow-none print:rounded-none animate-in zoom-in-95 duration-300">
        
        {/* Header - Screen Only */}
        <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-white print:hidden">
          <div className="flex flex-col">
            <h3 className="text-xl font-black text-[#1D1D1F] tracking-tight">Ticket Generado</h3>
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-[0.2em] mt-1 italic">#{data.pedido.id.toString().slice(-6).padStart(6, '0')}</span>
          </div>
          <button 
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-all hover:rotate-90 duration-300"
          >
            <span className="material-icons-round text-lg">close</span>
          </button>
        </div>

        {/* Ticket Content Area */}
        <div className="flex-1 overflow-y-auto p-8 bg-gray-50/50 print:p-0 print:bg-white scrollbar-hide">
          <div id="print-area" className="bg-white shadow-2xl mx-auto print:shadow-none print:w-full rounded-2xl print:rounded-none overflow-hidden ring-1 ring-black/5 print:ring-0">
            <Ticket58mm data={data} />
          </div>
        </div>

        {/* Footer Actions - Screen Only */}
        <div className="p-6 bg-white border-t border-gray-100 flex flex-col gap-3 print:hidden">
          <button
            onClick={() => window.print()}
            className="w-full py-4 bg-[#1D1D1F] text-white rounded-[20px] font-black text-xs uppercase tracking-[0.2em] shadow-xl flex items-center justify-center gap-3 hover:bg-black active:scale-[0.98] transition-all duration-300 group"
          >
            <span className="material-icons-round text-lg group-hover:scale-110 transition-transform">print</span>
            Imprimir Ticket
          </button>
          
          <div className="grid grid-cols-2 gap-3">
             <button
              onClick={onClose}
              className="py-3.5 bg-gray-50 text-gray-400 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-gray-100 transition-colors"
            >
              Cerrar
            </button>
            <button
               onClick={() => {
                const text = `🧾 TICKET CASALEÑA - #${data.pedido.id.toString().slice(-6)}\nTotal: $${data.pedido.total.toFixed(2)}`;
                const win = window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
                if (win) win.focus();
              }}
              className="py-3.5 bg-[#25D366] text-white rounded-xl font-black text-[9px] uppercase tracking-widest shadow-lg shadow-green-200/50 flex items-center justify-center gap-2 hover:bg-[#20bd5a] transition-all"
            >
              <img src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg" className="w-4 h-4 brightness-0 invert" alt=""/>
              WhatsApp
            </button>
          </div>
        </div>
      </div>

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

          #print-area {
            visibility: visible !important;
            display: block !important;
            width: 58mm !important; 
            max-width: 58mm !important;
            margin: 0 !important;
            padding: 0 !important;
            background-color: white !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            border: none !important;
            box-shadow: none !important;
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
    </div>
  );
};

export default TicketPrintModal;
