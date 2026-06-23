'use client';

import React, { useEffect, useState } from 'react';
import { motion, useMotionValue, useTransform } from 'framer-motion';
import { 
  Package, 
  MapPin, 
  DollarSign, 
  ChevronRight
} from 'lucide-react';

interface IncomingOrderProps {
  order: any;
  onAccept: () => void;
  onReject: () => void;
}

export default function IncomingOrder({ order, onAccept, onReject }: IncomingOrderProps) {
  const [timeLeft, setTimeLeft] = useState(30);
  const x = useMotionValue(0);
  const bgWidth = useTransform(x, [0, 250], ["0%", "100%"]);

  useEffect(() => {
    if (timeLeft <= 0) {
        onReject();
        return;
    }
    const timer = setInterval(() => setTimeLeft(t => t - 1), 1000);
    
    if ('vibrate' in navigator) {
        navigator.vibrate([400, 150, 400]);
    }

    return () => clearInterval(timer);
  }, [timeLeft, onReject]);

  const handleDragEnd = (event: any, info: any) => {
    if (info.offset.x > 200) {
      onAccept();
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-white/95 backdrop-blur-2xl flex flex-col p-6 overflow-hidden"
    >
      {/* Animated Background Pulse */}
      <div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none">
        <motion.div 
          animate={{ scale: [1, 2.5], opacity: [0.5, 0] }}
          transition={{ repeat: Infinity, duration: 2.5 }}
          className="w-[40rem] h-[40rem] rounded-full border-[15px] border-[#F7951D]"
        />
      </div>

      <div className="flex-1 flex flex-col justify-center max-w-sm mx-auto w-full relative z-10">
        <div className="text-center mb-6">
            <motion.div 
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="inline-flex items-center gap-1.5 bg-[#F7951D]/10 px-3 py-1.5 rounded-full border border-[#F7951D]/20 mb-4"
            >
                <span className="w-1.5 h-1.5 rounded-full bg-[#F7951D] animate-ping" />
                <span className="text-[8px] font-black text-[#F7951D] uppercase tracking-[0.2em]">NUEVO VIAJE</span>
            </motion.div>
            <h1 className="text-3xl font-black text-black uppercase tracking-tight leading-none">
                ¡NUEVO PEDIDO!
            </h1>
        </div>

        <div className="bg-white rounded-3xl p-6 border border-black/5 shadow-xl relative overflow-hidden mb-10">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <p className="text-[8px] font-black text-black/30 uppercase tracking-widest mb-1">Ganancia</p>
                    <p className="text-4xl font-black text-black leading-none">${(order.total_amount * 0.15).toFixed(2)}</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-[#F7951D] flex items-center justify-center text-white shadow-md">
                    <DollarSign size={24} />
                </div>
            </div>

            <div className="space-y-4">
                <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-500 shrink-0 border border-blue-100">
                        <Package size={16} />
                    </div>
                    <div>
                        <p className="text-[8px] font-black text-black/30 uppercase tracking-widest mb-0.5">Recojo</p>
                        <p className="font-bold text-base text-black">Casa Leña</p>
                    </div>
                </div>

                <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#F7951D]/10 flex items-center justify-center text-[#F7951D] shrink-0 border border-[#F7951D]/10">
                        <MapPin size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-[8px] font-black text-black/30 uppercase tracking-widest mb-0.5">Entrega</p>
                        <p className="font-bold text-base text-black truncate">{order.delivery_address}</p>
                    </div>
                </div>
            </div>

            <div className="absolute bottom-0 left-0 h-1.5 bg-[#F7951D]" style={{ width: `${(timeLeft / 30) * 100}%`, transition: 'width 1s linear' }} />
        </div>

        {/* Swipe to Accept Button */}
        <div className="relative h-20 bg-black/5 rounded-2xl border border-black/5 overflow-hidden p-1.5 flex items-center group">
            <motion.div 
                style={{ width: bgWidth }}
                className="absolute left-0 top-0 bottom-0 bg-[#F7951D]/10"
            />
            
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <p className="text-black/30 font-black text-[10px] uppercase tracking-[0.2em]">DESLIZA PARA ACEPTAR</p>
            </div>

            <motion.div
                drag="x"
                dragConstraints={{ left: 0, right: 260 }}
                style={{ x }}
                onDragEnd={handleDragEnd}
                className="w-16 h-16 bg-[#F7951D] rounded-xl flex items-center justify-center text-white shadow-lg cursor-grab active:cursor-grabbing z-10"
            >
                <ChevronRight size={28} />
            </motion.div>
        </div>

        <button
            onClick={onReject}
            className="w-full mt-8 py-2 text-[10px] font-black text-black/20 uppercase tracking-[0.2em]"
        >
            RECHAZAR
        </button>
      </div>
    </motion.div>
  );
}
