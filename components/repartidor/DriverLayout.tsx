'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LogOut, 
  Wifi, 
  WifiOff
} from 'lucide-react';

interface DriverLayoutProps {
  children: React.ReactNode;
  driverName: string;
  isOnline: boolean;
  onToggleOnline: () => void;
  onLogout: () => void;
  statusText: string;
}

export default function DriverLayout({
  children,
  driverName,
  isOnline,
  onToggleOnline,
  onLogout,
  statusText
}: DriverLayoutProps) {
  return (
    <div className="flex flex-col h-screen bg-[#F3F4F6] overflow-hidden text-[#111111] font-['Outfit'] select-none">
      {/* --- Floating Header --- */}
      <header className="fixed top-0 left-0 right-0 z-50 p-4 pointer-events-none flex justify-center">
        <div className="w-full max-w-[440px] flex items-center justify-between pointer-events-auto">
          {/* Profile & Status */}
          <div className="flex items-center gap-2.5 bg-white/90 backdrop-blur-xl p-1 pr-4 rounded-xl border border-black/5 shadow-sm">
            <button 
              onClick={onLogout}
              className="w-9 h-9 rounded-lg bg-red-50 flex items-center justify-center text-red-500 active:scale-90 transition-all border border-red-100"
            >
              <LogOut size={16} />
            </button>
            <div>
              <p className="text-[9px] font-black text-black/30 uppercase tracking-[0.1em] leading-none mb-0.5">Repartidor</p>
              <p className="text-xs font-black uppercase tracking-tight leading-none text-black">{driverName}</p>
            </div>
          </div>

          {/* Connection Toggle */}
          <button
            onClick={onToggleOnline}
            className={`flex items-center gap-2 px-4 h-10 rounded-xl font-black text-[10px] uppercase tracking-[0.1em] transition-all active:scale-95 shadow-md ${
              isOnline 
                ? 'bg-[#10B981] border border-emerald-400 text-white shadow-emerald-500/10' 
                : 'bg-white/90 backdrop-blur-xl border border-black/5 text-black/40'
            }`}
          >
            {isOnline ? (
              <><Wifi size={14} className="animate-pulse" /> ONLINE</>
            ) : (
              <><WifiOff size={14} /> OFFLINE</>
            )}
          </button>
        </div>
      </header>

      {/* --- Main Content (Map) --- */}
      <main className="flex-1 relative">
        {children}
        
        {/* Connection Overlay when Offline */}
        <AnimatePresence>
          {!isOnline && (
            <motion.div 
              key="offline-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-40 bg-white/80 backdrop-blur-md flex flex-col items-center justify-center p-10 text-center max-w-[440px] mx-auto rounded-[2rem] my-auto h-fit shadow-2xl border border-black/5"
            >
              <motion.div 
                animate={{ y: [0, -10, 0] }}
                transition={{ repeat: Infinity, duration: 4 }}
                className="w-28 h-28 rounded-full bg-black/5 flex items-center justify-center mb-8 border border-black/5"
              >
                <WifiOff size={48} className="text-black/10" />
              </motion.div>
              <h2 className="text-4xl font-black mb-3 uppercase tracking-tighter text-black">Desconectado</h2>
              <p className="text-black/40 font-bold mb-10 max-w-xs text-lg">Conéctate para empezar a recibir pedidos en tu zona.</p>
              <button
                onClick={onToggleOnline}
                className="w-full max-w-xs h-20 rounded-[2rem] bg-[#F7951D] text-white font-black text-xl uppercase tracking-widest shadow-[0_15px_40px_rgba(247,149,29,0.3)] active:scale-95 transition-all flex items-center justify-center gap-3"
              >
                INICIAR SESIÓN
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
