'use client';

import React from 'react';

interface CustomerInfo {
    name: string;
    phone: string;
    address: string;
    street: string;
    neighborhood: string;
    reference: string;
}

interface CustomerInsights {
    totalOrders: number;
    totalSpent: number;
    lastOrderDate: string | null;
    firstOrderDate: string | null;
    favoriteProducts: string[];
    isFrequent: boolean;
    lastOrderAmount: number;
}

interface Client {
    id: string | number;
    name: string;
    phone: string;
    address: string;
    origin: string;
}

interface CustomerDeliveryModalProps {
    isOpen: boolean;
    onClose: () => void;
    orderType: 'dine-in' | 'takeout' | 'delivery';
    customerInfo: CustomerInfo;
    setCustomerInfo: (info: CustomerInfo) => void;
    customerInsights: CustomerInsights | null;
    availableClients: Client[];
    loadingClients: boolean;
    isSearchingCustomer: boolean;
    handleClientSelect: (e: React.ChangeEvent<HTMLSelectElement>) => void;
    onAccept: () => void;
    onClear: () => void;
    onSaveCustomer?: (info: CustomerInfo) => Promise<void>;
}

const CustomerDeliveryModal: React.FC<CustomerDeliveryModalProps> = ({
    isOpen,
    onClose,
    orderType,
    customerInfo,
    setCustomerInfo,
    customerInsights,
    availableClients,
    loadingClients,
    isSearchingCustomer,
    handleClientSelect,
    onAccept,
    onClear,
    onSaveCustomer
}) => {
    const [showHistory, setShowHistory] = React.useState(true);
    const [isSaving, setIsSaving] = React.useState(false);

    if (!isOpen) return null;

    const handleSave = async () => {
        if (!onSaveCustomer) return;
        setIsSaving(true);
        try {
            await onSaveCustomer(customerInfo);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-2 sm:p-4 bg-[#181511]/60 backdrop-blur-sm">
            <div className={`bg-white rounded-[28px] w-full ${showHistory ? 'max-w-2xl' : 'max-w-md'} overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col md:flex-row border border-white/20 transition-all`}>

                {/* LEFT SIDE: DATA ENTRY */}
                <div className="flex-1 p-4 sm:p-6 z-10 bg-white overflow-y-auto max-h-[90vh]">
                    <div className="flex justify-between items-center mb-5">
                        <div className="flex items-center gap-2.5">
                            <div className="size-9 bg-gradient-to-br from-[#f7941d] to-[#ffb800] rounded-xl flex items-center justify-center shadow-md text-white">
                                <span className="material-icons-round text-xl">
                                    {orderType === 'delivery' ? 'local_shipping' : 'shopping_bag'}
                                </span>
                            </div>
                            <div>
                                <h3 className="text-lg font-black text-[#181511]">
                                    {orderType === 'delivery' ? 'Datos' : 'Pick Up'}
                                </h3>
                                <div className="flex items-center gap-1.5">
                                    <div className={`size-1.5 rounded-full ${customerInsights ? 'bg-green-500' : 'bg-blue-500'}`}></div>
                                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">
                                        {customerInsights ? 'Registrado' : 'Nuevo'}
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button 
                                onClick={() => setShowHistory(!showHistory)}
                                className={`size-8 flex items-center justify-center rounded-lg transition-all ${showHistory ? 'bg-orange-50 text-[#f7941d]' : 'bg-gray-50 text-gray-400'}`}
                                title={showHistory ? "Ocultar Historial" : "Ver Historial"}
                            >
                                <span className="material-icons-round text-lg">analytics</span>
                            </button>
                            <button onClick={onClose} className="size-8 flex items-center justify-center bg-gray-50 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all">
                                <span className="material-icons-round text-lg">close</span>
                            </button>
                        </div>
                    </div>

                    {/* PHONE FIELD - COMPACT */}
                    <div className="mb-4 bg-[#f8f7f5] rounded-xl p-3 border border-transparent focus-within:border-[#f7941d]/30 focus-within:bg-white focus-within:shadow-md transition-all">
                        <div className="flex justify-between items-center mb-1">
                            <span className="text-[9px] font-black text-[#f7941d] uppercase tracking-widest">Teléfono</span>
                            {isSearchingCustomer && <span className="material-icons-round animate-spin text-[#f7951d] text-xs">sync</span>}
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="material-icons-round text-gray-300 text-lg">phone</span>
                            <input
                                type="tel"
                                value={customerInfo.phone || ''}
                                onChange={(e) => setCustomerInfo({ ...customerInfo, phone: e.target.value })}
                                className="bg-transparent border-none p-0 text-xl font-black text-[#181511] focus:ring-0 outline-none w-full placeholder:text-gray-200"
                                placeholder="741 000 0000"
                            />
                        </div>
                    </div>

                    <div className="space-y-4">
                        {/* SELECTOR COMPACTO */}
                        <div>
                            <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Autocompletar</label>
                            <div className="relative">
                                <select
                                    onChange={handleClientSelect}
                                    className="w-full bg-[#f8f7f5] border border-transparent rounded-xl px-3 py-2.5 text-xs font-bold focus:bg-white focus:border-[#f7951d] outline-none transition-all appearance-none text-[#181511] cursor-pointer"
                                    value={availableClients.find(c => c.phone === customerInfo.phone)?.id || ""}
                                >
                                    <option value="" disabled>-- {loadingClients ? 'Buscando...' : 'Selecciona un perfil'} --</option>
                                    {availableClients.map((client) => (
                                        <option key={`${client.origin}-${client.id}`} value={client.id}>
                                            {client.name} {client.phone ? `(${client.phone})` : ''}
                                        </option>
                                    ))}
                                </select>
                                <span className="material-icons-round absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 text-sm">unfold_more</span>
                            </div>
                        </div>

                        {/* NOMBRE */}
                        <div>
                            <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Nombre Completo</label>
                            <input
                                type="text"
                                value={customerInfo.name || ''}
                                onChange={(e) => setCustomerInfo({ ...customerInfo, name: e.target.value })}
                                className="w-full bg-[#f8f7f5] border border-transparent rounded-xl px-3 py-2.5 text-xs font-bold focus:bg-white focus:border-[#f7951d] outline-none transition-all"
                                placeholder="Juan Pérez"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Calle y N°</label>
                                <input
                                    type="text"
                                    value={customerInfo.street || ''}
                                    onChange={(e) => {
                                        const street = e.target.value;
                                        setCustomerInfo({ ...customerInfo, street, address: `${street}, ${customerInfo.neighborhood || ''}, ${customerInfo.reference || ''}` });
                                    }}
                                    className="w-full bg-[#f8f7f5] border border-transparent rounded-xl px-3 py-2.5 text-xs font-bold focus:bg-white focus:border-[#f7951d] outline-none transition-all"
                                    placeholder="Calle #123"
                                />
                            </div>
                            <div>
                                <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Colonia</label>
                                <input
                                    type="text"
                                    value={customerInfo.neighborhood || ''}
                                    onChange={(e) => {
                                        const neighborhood = e.target.value;
                                        setCustomerInfo({ ...customerInfo, neighborhood, address: `${customerInfo.street || ''}, ${neighborhood}, ${customerInfo.reference || ''}` });
                                    }}
                                    className="w-full bg-[#f8f7f5] border border-transparent rounded-xl px-3 py-2.5 text-xs font-bold focus:bg-white focus:border-[#f7951d] outline-none transition-all"
                                    placeholder="Colonia"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Referencia / Comentarios</label>
                            <textarea
                                rows={2}
                                value={customerInfo.reference || ''}
                                onChange={(e) => {
                                    const reference = e.target.value;
                                    setCustomerInfo({ ...customerInfo, reference, address: `${customerInfo.street || ''}, ${customerInfo.neighborhood || ''}, ${reference}` });
                                }}
                                className="w-full bg-[#f8f7f5] border border-transparent rounded-xl px-3 py-2.5 text-xs font-bold focus:bg-white focus:border-[#f7951d] outline-none transition-all resize-none"
                                placeholder="Ej. Casa azul, frente al parque..."
                            />
                        </div>
                    </div>

                    <div className="mt-6 flex flex-col gap-3">
                        <div className="grid grid-cols-2 gap-3">
                             <button
                                onClick={onClear}
                                className="bg-red-50 text-red-600 py-3 rounded-xl font-black text-[10px] uppercase hover:bg-red-100 active:scale-95 transition-all flex items-center justify-center gap-2 border border-red-100"
                            >
                                <span className="material-icons-round text-lg">delete_sweep</span>
                                Limpiar
                            </button>
                            <button
                                onClick={onAccept}
                                className="bg-[#181511] text-white py-3 rounded-xl font-black text-[10px] uppercase shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
                            >
                                <span className="material-icons-round text-green-400 text-lg">check_circle</span>
                                Aceptar
                            </button>
                        </div>
                        
                        {onSaveCustomer && (
                            <button
                                onClick={handleSave}
                                disabled={isSaving || !customerInfo.phone || !customerInfo.name}
                                className="w-full bg-blue-50 text-blue-600 py-3 rounded-xl font-black text-[10px] uppercase hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 border border-blue-200"
                            >
                                <span className={`material-icons-round text-lg ${isSaving ? 'animate-spin' : ''}`}>
                                    {isSaving ? 'sync' : 'auto_awesome'}
                                </span>
                                {isSaving ? 'Guardando...' : 'Guardar Perfil de Cliente'}
                            </button>
                        )}
                    </div>
                </div>

                {/* RIGHT SIDE: HISTORY (COMPACT & MODERN) */}
                {showHistory && (
                    <div className="w-full md:w-[260px] bg-gray-50/50 border-l border-gray-100 flex flex-col p-5 custom-scrollbar overflow-y-auto max-h-[90vh] animate-in slide-in-from-right-4 duration-300">
                        <div className="flex items-center justify-between mb-6">
                            <h4 className="text-[9px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                <span className="material-icons-round text-xs">insights</span>
                                Resumen
                            </h4>
                            {customerInsights?.isFrequent && (
                                <span className="bg-orange-100 text-[#f7941d] text-[8px] font-black px-2 py-0.5 rounded-full uppercase">VIP</span>
                            )}
                        </div>

                        {customerInsights ? (
                            <div className="space-y-4">
                                <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 group cursor-default">
                                    <div className="bg-blue-50 size-8 rounded-lg mb-3 flex items-center justify-center text-blue-500 group-hover:bg-blue-500 group-hover:text-white transition-all">
                                        <span className="material-icons-round text-lg">calendar_today</span>
                                    </div>
                                    <p className="text-[8px] font-black text-gray-400 uppercase mb-0.5">Antigüedad</p>
                                    <p className="text-xs font-black text-[#181511]">
                                        Desde {customerInsights.firstOrderDate ? new Date(customerInsights.firstOrderDate).toLocaleDateString('es-MX', { month: 'short', year: 'numeric' }) : 'Hoy'}
                                    </p>
                                </div>

                                <div className="bg-[#181511] p-5 rounded-2xl shadow-xl text-white relative overflow-hidden">
                                    <div className="absolute top-0 right-0 p-2 opacity-10">
                                        <span className="material-icons-round text-6xl">shopping_bag</span>
                                    </div>
                                    <p className="text-[8px] font-black uppercase text-gray-500 tracking-widest mb-1">Inversión Total</p>
                                    <p className="text-3xl font-black tracking-tighter">${customerInsights.totalSpent.toFixed(2)}</p>
                                    <div className="flex items-center gap-1.5 mt-2">
                                        <div className="size-1.5 rounded-full bg-[#f7941d] animate-pulse"></div>
                                        <p className="text-[9px] font-bold text-gray-400 uppercase">{customerInsights.totalOrders} Pedidos realizados</p>
                                    </div>
                                </div>

                                <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="bg-orange-50 size-8 rounded-lg flex items-center justify-center text-[#f7941d]">
                                            <span className="material-icons-round text-lg">history</span>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[8px] font-black text-gray-400 uppercase">Último Ticket</p>
                                            <p className="text-sm font-black text-[#181511]">${customerInsights.lastOrderAmount.toFixed(2)}</p>
                                        </div>
                                    </div>
                                    <p className="text-[9px] font-bold text-gray-400">
                                        {customerInsights.lastOrderDate ? new Date(customerInsights.lastOrderDate).toLocaleDateString() : '---'}
                                    </p>
                                </div>

                                {customerInsights.favoriteProducts && customerInsights.favoriteProducts.length > 0 && (
                                    <div className="space-y-2">
                                        <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest ml-1">Más Pedidos</p>
                                        <div className="flex flex-col gap-1.5">
                                            {customerInsights.favoriteProducts.slice(0, 3).map((p, i) => (
                                                <div key={i} className="flex items-center gap-2 bg-white/50 p-2 rounded-xl border border-gray-100/50">
                                                    <div className="size-5 shrink-0 rounded-md bg-orange-50 flex items-center justify-center text-[9px] font-bold text-[#f7941d]">
                                                        {i + 1}
                                                    </div>
                                                    <span className="text-[10px] font-bold text-gray-600 truncate uppercase">{p}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-center py-10 px-4">
                                <div className="size-16 bg-white rounded-2xl shadow-sm flex items-center justify-center mb-4 text-gray-200 border border-gray-100">
                                    <span className="material-icons-round text-3xl">contact_support</span>
                                </div>
                                <p className="text-[10px] font-black text-[#181511] uppercase mb-1">Sin historial</p>
                                <p className="text-[9px] font-medium text-gray-400 leading-relaxed">
                                    Ingresa el teléfono para descubrir las preferencias de este cliente.
                                </p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default CustomerDeliveryModal;
