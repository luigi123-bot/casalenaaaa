'use client';

import React, { useState } from 'react';
import { motion, PanInfo, AnimatePresence } from 'framer-motion';
import { 
  MapPin, 
  Phone, 
  MessageCircle, 
  CheckCircle, 
  Navigation, 
  ChevronUp, 
  ChevronDown,
  Package,
  DollarSign,
  Clock
} from 'lucide-react';

interface Order {
  id: string;
  customer_name: string;
  delivery_address: string;
  total_amount: number;
  phone_number: string;
  order_items: any[];
  delivery_status: 'assigned' | 'picked_up' | 'en_camino';
}

interface DriverBottomSheetProps {
  order: Order | null;
  isOnline: boolean;
  onAcceptOrder?: () => void;
  onMarkDelivered?: () => void;
  onOpenNavigation?: () => void;
  onCallCustomer?: () => void;
  onWhatsAppCustomer?: () => void;
  onShowTransfer?: () => void;
}

export default function DriverBottomSheet({
  order,
  isOnline,
  onMarkDelivered,
  onOpenNavigation,
  onCallCustomer,
  onWhatsAppCustomer,
  onShowTransfer
}: DriverBottomSheetProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showItems, setShowItems] = useState(false);

  const handleDragEnd = (event: any, info: PanInfo) => {
    if (info.offset.y < -50) setIsExpanded(true);
    if (info.offset.y > 50) setIsExpanded(false);
  };

  if (!isOnline) return null;

  return (
    <motion.div
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="fixed bottom-0 left-0 right-0 z-[60] flex justify-center px-4 pb-4"
    >
      <motion.div
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        onDragEnd={handleDragEnd}
        animate={{ height: isExpanded ? '85vh' : 'auto' }}
        className="w-full max-w-[440px] bg-white rounded-[2rem] shadow-[0_-15px_50px_rgba(0,0,0,0.08)] overflow-hidden border border-black/5"
      >
        {/* Drag Handle */}
        <div className="w-full py-3 flex flex-col items-center gap-1 touch-none" onClick={() => setIsExpanded(!isExpanded)}>
          <div className="w-10 h-1 bg-black/5 rounded-full" />
        </div>

        {order ? (
          <div className="px-5 pb-8 overflow-y-auto max-h-full scrollbar-hide">
            {/* Header / Status */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-1.5 bg-[#F7951D]/5 px-2.5 py-1 rounded-full border border-[#F7951D]/10">
                <span className="w-1.5 h-1.5 rounded-full bg-[#F7951D]" />
                <span className="text-[9px] font-black text-[#F7951D] uppercase tracking-wider">En Curso</span>
              </div>
              <span className="text-[9px] font-bold text-black/20 tracking-widest uppercase">#{String(order.id).slice(-4)}</span>
            </div>

            {/* Customer Info */}
            <div className="mb-5">
              <h2 className="text-xl font-black text-black uppercase tracking-tight mb-1 leading-tight">
                {order.customer_name || 'Cliente'}
              </h2>
              <div className="flex items-start gap-2 text-black/40">
                <MapPin size={14} className="text-[#F7951D] shrink-0 mt-0.5" />
                <p className="font-bold text-sm leading-tight">{order.delivery_address}</p>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-2 gap-2.5 mb-5">
              <button
                onClick={onOpenNavigation}
                className="h-16 rounded-xl bg-blue-50 text-blue-600 flex flex-col items-center justify-center gap-1 active:scale-95 transition-all border border-blue-100"
              >
                <Navigation size={18} />
                <span className="text-[9px] font-black uppercase tracking-widest">Navegar</span>
              </button>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  onClick={onCallCustomer}
                  className="h-16 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center active:scale-95 transition-all border border-emerald-100"
                >
                  <Phone size={18} />
                </button>
                <button
                  onClick={onWhatsAppCustomer}
                  className="h-16 rounded-xl bg-[#25D366]/5 text-[#075E54] flex items-center justify-center active:scale-95 transition-all border border-[#25D366]/10"
                >
                  <MessageCircle size={18} />
                </button>
              </div>
            </div>

            {/* Price Card */}
            <div className="bg-black/[0.02] rounded-2xl p-5 mb-5 border border-black/5">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-[9px] font-black text-black/30 uppercase tracking-widest mb-0.5">Total</p>
                        <p className="text-3xl font-black text-black leading-none">${order.total_amount.toFixed(2)}</p>
                    </div>
                    <div className="w-11 h-11 rounded-xl bg-[#F7951D] flex items-center justify-center text-white shadow-md">
                        <DollarSign size={22} />
                    </div>
                </div>
            </div>

            {/* Order Items Collapsible */}
            <div className="mb-8">
                <button 
                    onClick={() => setShowItems(!showItems)}
                    className="w-full flex items-center justify-between py-4 border-t border-black/5"
                >
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-black/5 flex items-center justify-center text-black/30">
                            <Package size={18} />
                        </div>
                        <span className="text-sm font-black text-black/60 uppercase tracking-widest">Productos ({order.order_items?.length || 0})</span>
                    </div>
                    {showItems ? <ChevronDown size={18} className="text-black/20" /> : <ChevronUp size={18} className="text-black/20" />}
                </button>
                
                <AnimatePresence>
                    {showItems && (
                        <motion.div 
                            key="items-list"
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="space-y-5 pt-2 pb-6 overflow-hidden"
                        >
                            {order.order_items?.map((item, idx) => (
                                <div key={idx} className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="w-9 h-9 rounded-xl bg-[#F7951D]/10 flex items-center justify-center text-[#F7951D] font-black text-sm">
                                            {item.quantity}x
                                        </div>
                                        <span className="font-bold text-black/80 text-lg">{item.product_name}</span>
                                    </div>
                                </div>
                            ))}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Main Action */}
            <button
              onClick={onMarkDelivered}
              className="w-full h-16 rounded-xl bg-[#F7951D] text-white font-black text-base uppercase tracking-widest shadow-lg active:scale-95 transition-all flex items-center justify-center gap-3"
            >
              <CheckCircle size={22} />
              FINALIZAR ENTREGA
            </button>

            <button 
                onClick={onShowTransfer}
                className="w-full mt-8 py-2 text-[11px] font-black text-black/20 uppercase tracking-widest hover:text-red-500 transition-colors"
            >
                ¿PROBLEMAS? TRANSFERIR PEDIDO
            </button>
          </div>
        ) : (
          /* Empty State */
          <div className="px-8 pb-16 pt-6 flex flex-col items-center text-center">
            <div className="relative mb-6">
                <motion.div 
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ repeat: Infinity, duration: 5 }}
                    className="w-24 h-24 rounded-full bg-black/[0.02] border border-black/5 flex items-center justify-center"
                >
                    <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center shadow-lg">
                        <Clock size={32} className="text-[#F7951D]" />
                    </div>
                </motion.div>
            </div>
            
            <h3 className="text-xl font-black mb-1.5 uppercase tracking-tight text-black leading-none">Buscando Pedidos</h3>
            <p className="text-black/30 font-bold max-w-[200px] text-sm leading-snug">
              Mantente en zonas concurridas para recibir pedidos más rápido.
            </p>
            
            <div className="mt-8 flex gap-2">
                {[0, 1, 2].map(i => (
                    <motion.div 
                        key={i}
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{ repeat: Infinity, duration: 1.5, delay: i * 0.2 }}
                        className="w-1.5 h-1.5 rounded-full bg-[#F7951D]"
                    />
                ))}
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
