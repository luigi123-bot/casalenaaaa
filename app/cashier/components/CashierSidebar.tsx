import React, { useRef, useEffect, useCallback } from 'react';

// Si no tienes estos tipos exportados, usamos any o tipos básicos para simplificar
export interface CashierSidebarProps {
    cashierName?: string;
    isCartDrawerOpen: boolean;
    setIsCartDrawerOpen: (v: boolean) => void;
    cart: any[];
    setCart: (cart: any[]) => void;
    isSyncing: boolean;
    isOnline: boolean;
    pendingCount: number;
    orderType: string;
    setOrderType: (v: any) => void;
    recentOrders: any[];
    activeOrderId: string | null;
    setActiveOrderId: (id: string | null) => void;
    tableNumber: string;
    setTableNumber: (v: string) => void;
    setPaymentMethod: (v: string) => void;
    customerInfo: any;
    setCustomerInfo: React.Dispatch<React.SetStateAction<any>>;
    customerInsights: any;
    handleSaveCustomer: (info: any) => void;
    setLoadingClients: (v: boolean) => void;
    setShowCustomerModal: (v: boolean) => void;
    setAvailableClients: (v: any[]) => void;
    setFoundCustomers: (v: any[]) => void;
    foundCustomers?: any[];
    updateQuantity: (cartItemId: string, delta: number) => void;
    groupedProducts: any[];
    openProductCustomizer: (group: any, item: any) => void;
    setShowOpenTabsModal: (v: boolean) => void;
    cartTotals: { subtotal: number; tax: number; total: number };
    clearCart: () => void;
    isProcessingOrder: React.MutableRefObject<boolean>;
    orderLoading: boolean;
    setOrderLoading: (v: boolean) => void;
    setShowPaymentModal: (v: boolean) => void;
    handlePlaceOrder: (isFinalPayment?: boolean, overridePaymentMethod?: string, skipPrinting?: boolean) => void;
    searchCustomerByTerm?: (term?: string) => Promise<void>;
}

export default function CashierSidebar({
    cashierName,
    isCartDrawerOpen, setIsCartDrawerOpen, cart, setCart, isSyncing, isOnline, pendingCount,
    orderType, setOrderType, recentOrders, activeOrderId, setActiveOrderId,
    tableNumber, setTableNumber, setPaymentMethod, customerInfo, setCustomerInfo,
    customerInsights, handleSaveCustomer, setLoadingClients, setShowCustomerModal,
    setAvailableClients, setFoundCustomers, foundCustomers = [], updateQuantity, groupedProducts,
    openProductCustomizer, setShowOpenTabsModal, cartTotals, clearCart,
    isProcessingOrder, orderLoading, setOrderLoading, setShowPaymentModal, handlePlaceOrder,
    searchCustomerByTerm
}: CashierSidebarProps) {
    // ── Auto-search phone with 2s debounce ──────────────────────────────
    const phoneDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastSearchedPhone = useRef('');
    const [isAutoSearching, setIsAutoSearching] = React.useState(false);
    const [showDropdown, setShowDropdown] = React.useState(false);
    const dropdownRef = useRef<HTMLDivElement | null>(null);

    // Dismiss dropdown on click outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setShowDropdown(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const handlePhoneAutoSearch = useCallback((phone: string) => {
        // Clear any previous debounce
        if (phoneDebounceRef.current) clearTimeout(phoneDebounceRef.current);

        // Only search if 3+ characters and we haven't already searched this exact number
        if (phone.trim().length >= 3 && phone.trim() !== lastSearchedPhone.current) {
            console.log(`📞 [CashierSidebar] Teléfono detectado (${phone.trim().length} caracteres): ${phone}. Buscando en 2 segundos...`);
            setShowDropdown(true);

            phoneDebounceRef.current = setTimeout(async () => {
                console.log(`🔍 [CashierSidebar] Iniciando búsqueda automática para: ${phone}`);
                lastSearchedPhone.current = phone.trim();
                setIsAutoSearching(true);
                try {
                    if (searchCustomerByTerm) {
                        await searchCustomerByTerm(phone.trim());
                        console.log(`✅ [CashierSidebar] Búsqueda completada para: ${phone}`);
                    }
                } catch (err) {
                    console.error('❌ [CashierSidebar] Error en búsqueda automática:', err);
                } finally {
                    setIsAutoSearching(false);
                }
            }, 2000);
        } else if (phone.trim().length < 3) {
            setShowDropdown(false);
            if (setFoundCustomers) {
                setFoundCustomers([]);
            }
        }
    }, [searchCustomerByTerm, setFoundCustomers]);

    // Cleanup debounce on unmount
    useEffect(() => {
        return () => {
            if (phoneDebounceRef.current) clearTimeout(phoneDebounceRef.current);
        };
    }, []);
    return (
        <aside className={`fixed lg:static inset-y-0 right-0 z-[80] lg:z-auto transition-transform duration-300 ease-out lg:translate-x-0 ${isCartDrawerOpen ? 'translate-x-0' : 'translate-x-full'} w-[340px] sm:w-[380px] xl:w-[400px] bg-white border-l border-[#e8e5e1] flex flex-col h-screen shrink-0 shadow-2xl lg:shadow-none overflow-hidden`}>
            <div className="p-3 border-b border-[#e8e5e1] relative bg-white">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex flex-col">
                        <h2 className="text-[#181511] text-lg font-black tracking-tight leading-none">Comanda Actual</h2>
                        {cashierName && (
                            <p className="text-[10px] text-[#f7951d] font-black uppercase tracking-wider mt-1.5">
                                Cajero: {cashierName}
                            </p>
                        )}
                        <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mt-1">{cart.length} ITEMS</p>
                    </div>

                    <button 
                        onClick={() => setIsCartDrawerOpen(false)}
                        className="lg:hidden size-8 flex items-center justify-center rounded-lg bg-gray-50 text-gray-400"
                    >
                        <span className="material-icons-round text-sm">close</span>
                    </button>

                    <div className="flex items-center gap-1.5">
                        {isSyncing && <span className="material-icons-round text-blue-500 text-sm animate-spin">sync</span>}
                        {!isOnline && <span className="material-icons-round text-red-500 text-sm">cloud_off</span>}
                        {pendingCount > 0 && !isSyncing && (
                            <span className="bg-orange-50 text-[#f7951d] text-[8px] font-black px-1.5 py-0.5 rounded-full border border-orange-100">
                                {pendingCount} PEND.
                            </span>
                        )}
                    </div>
                </div>

                <div className="mb-2">
                    <div className="flex bg-[#f8f7f5] p-1 rounded-xl border border-gray-100 shadow-inner">
                        {(['dine-in', 'takeout', 'delivery'] as const).map((type) => (
                            <button 
                                key={type} 
                                onClick={() => setOrderType(type)} 
                                className={`flex-1 flex items-center justify-center py-1.5 rounded-lg text-[9px] font-black uppercase tracking-tight transition-all gap-1.5 ${orderType === type ? 'bg-white shadow-sm text-[#f7951d] ring-1 ring-orange-100' : 'text-[#8c785f] hover:bg-white/30'}`}
                            >
                                <span className="material-icons-round text-xs">
                                    {type === 'dine-in' ? 'restaurant' : type === 'takeout' ? 'shopping_bag' : 'delivery_dining'}
                                </span>
                                {type === 'dine-in' ? 'Mesa' : type === 'takeout' ? 'Llevar' : 'Domi'}
                            </button>
                        ))}
                    </div>
                </div>

                {recentOrders.filter(o => ['pendiente', 'preparando', 'listo'].includes(o.status)).length > 0 && (
                    <div className="mb-2 animate-in fade-in slide-in-from-top-2">
                        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
                            {recentOrders.filter(o => ['pendiente', 'preparando', 'listo', 'confirmado'].includes(o.status)).map(order => {
                                const isSelected = activeOrderId === order.id || (order.table_number && tableNumber === order.table_number);
                                return (
                                    <button 
                                        key={order.id}
                                        onClick={() => {
                                            setOrderType(order.order_type || 'dine-in');
                                            setTableNumber(order.table_number || '');
                                            setActiveOrderId(order.id);
                                            setPaymentMethod(order.payment_method || 'efectivo');
                                            
                                            if (order.order_type !== 'dine-in') {
                                                setCustomerInfo({
                                                    name: order.customer_name || '',
                                                    phone: order.phone_number || '',
                                                    address: order.delivery_address || '',
                                                    street: (order.delivery_address || '').split(',')[0] || '',
                                                    neighborhood: (order.delivery_address || '').split(',')[1] || '',
                                                    reference: ''
                                                });
                                            }

                                            const loadedCart = (order.order_items || []).map((item: any) => ({
                                                id: item.product_id ?? 0,
                                                name: item.product_name,
                                                price: item.unit_price,
                                                quantity: item.quantity,
                                                selectedSize: item.selected_size,
                                                extras: (function() {
                                                    if (!item.extras) return [];
                                                    if (typeof item.extras === 'string') {
                                                        try { return JSON.parse(item.extras); } catch(e) { return []; }
                                                    }
                                                    if (Array.isArray(item.extras)) return item.extras;
                                                    return [];
                                                })(),
                                                note: item.notes || '',
                                                cartItemId: Math.random().toString(36).substr(2, 9),
                                                _originalProductId: item.product_id
                                            }));
                                            setCart(loadedCart);
                                        }}
                                        className={`px-2 py-1 rounded-lg border text-[9px] font-black shrink-0 transition-all flex items-center gap-1 ${
                                            isSelected
                                            ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                                            : 'bg-purple-50 text-purple-600 border-purple-100'
                                        }`}
                                    >
                                        <span className="material-icons-round text-[12px]">
                                            {order.order_type === 'takeout' ? 'shopping_bag' : 'table_restaurant'}
                                        </span>
                                        {order.table_number ? `Mesa ${order.table_number}` : (order.customer_name?.split(' ')[0] || `LLEVAR #${order.ticket_number}`)}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {orderType === 'dine-in' && (
                    <div className="bg-blue-50 rounded-xl p-4 border border-blue-100 animate-in fade-in slide-in-from-top-2 flex items-center justify-between mb-4">
                        <span className="text-[10px] font-black text-blue-500 uppercase">Configuración de Mesa</span>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-blue-400">#</span>
                            <input
                                type="text"
                                placeholder="00"
                                value={tableNumber}
                                onChange={(e) => setTableNumber(e.target.value)}
                                className="w-12 bg-white border border-blue-200 rounded-lg px-2 py-1 text-sm font-black text-center focus:border-blue-500 outline-none"
                            />
                        </div>
                    </div>
                )}

                {(orderType === 'takeout' || orderType === 'delivery') && (
                    <div ref={dropdownRef} className="bg-gray-50/50 rounded-xl px-2 py-2 border border-gray-100 animate-in fade-in slide-in-from-top-2 mb-2 relative">
                        <div className="flex items-center gap-2 mb-1.5">
                            <div className="flex-1 flex items-center gap-1.5 bg-white rounded-lg px-2 py-1.5 border border-gray-100">
                                <span className="material-icons-round text-xs text-gray-400">person</span>
                                <input
                                    type="text"
                                    placeholder="Cliente"
                                    value={customerInfo.name || ''}
                                    onChange={(e) => setCustomerInfo({ ...customerInfo, name: e.target.value })}
                                    className="w-full text-[10px] font-bold text-[#181511] outline-none placeholder:text-gray-300 bg-transparent"
                                />
                            </div>
                            <div className={`flex-1 flex items-center gap-1.5 bg-white rounded-lg px-2 py-1.5 border transition-all duration-300 ${isAutoSearching ? 'border-[#f7951d] shadow-sm' : 'border-gray-100'}`}>
                                <span className={`material-icons-round text-xs transition-colors ${isAutoSearching ? 'text-[#f7951d] animate-pulse' : 'text-gray-400'}`}>phone</span>
                                <input
                                    type="tel"
                                    placeholder="Teléfono"
                                    value={customerInfo.phone || ''}
                                    onFocus={() => {
                                        if (customerInfo.phone && customerInfo.phone.trim().length >= 3) {
                                            setShowDropdown(true);
                                        }
                                    }}
                                    onChange={(e) => {
                                        const newPhone = e.target.value;
                                        setCustomerInfo({ ...customerInfo, phone: newPhone });
                                        handlePhoneAutoSearch(newPhone);
                                    }}
                                    className="w-full text-[10px] font-bold text-[#181511] outline-none placeholder:text-gray-300 bg-transparent"
                                />
                                {isAutoSearching && (
                                    <span className="material-icons-round text-[#f7951d] text-xs animate-spin shrink-0">progress_activity</span>
                                )}
                            </div>
                            <button
                                type="button"
                                onClick={async () => {
                                    setLoadingClients(true);
                                    setShowCustomerModal(true);
                                    try {
                                        const res = await fetch('/api/cashier/customers/search');
                                        if (res.ok) {
                                            const data = await res.json();
                                            const mapped = (data.customers || []).map((c: any) => ({
                                                id: c.id,
                                                name: c.full_name || 'Sin Nombre',
                                                phone: c.phone || '',
                                                address: c.address || '',
                                                origin: c.is_app_user ? 'profile' : 'customer',
                                            }));
                                            setAvailableClients(mapped);
                                            setFoundCustomers(mapped);
                                        }
                                    } catch { /* ignore */ } finally {
                                        setLoadingClients(false);
                                    }
                                }}
                                className="size-8 bg-[#181511] text-white rounded-lg flex items-center justify-center shrink-0 shadow-sm"
                            >
                                <span className="material-icons-round text-sm">search</span>
                            </button>
                        </div>
                        {orderType === 'delivery' && (
                            <div className="flex items-center gap-1.5 bg-white rounded-lg px-2 py-1.5 border border-gray-100">
                                <span className="material-icons-round text-xs text-gray-400">room</span>
                                <input
                                    type="text"
                                    placeholder="Dirección completa..."
                                    value={customerInfo.address || ''}
                                    onChange={(e) => setCustomerInfo({ ...customerInfo, address: e.target.value })}
                                    className="w-full text-[10px] font-bold text-[#181511] outline-none placeholder:text-gray-300 bg-transparent"
                                />
                            </div>
                        )}

                        {/* Dropdown de coincidencia de clientes por número parcial */}
                        {showDropdown && foundCustomers.length > 0 && (
                            <div className="absolute left-0 right-0 mt-1.5 bg-white border border-gray-100 rounded-xl shadow-xl z-[100] max-h-48 overflow-y-auto divide-y divide-gray-50 animate-in fade-in slide-in-from-top-1 duration-150">
                                {foundCustomers.map((customer) => (
                                    <button
                                        key={customer.id || customer.phone}
                                        type="button"
                                        onClick={async () => {
                                            if (searchCustomerByTerm) {
                                                await searchCustomerByTerm(customer.phone);
                                            }
                                            setShowDropdown(false);
                                        }}
                                        className="w-full text-left px-3 py-2.5 hover:bg-orange-50/40 active:bg-orange-50/70 flex flex-col transition-colors cursor-pointer"
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] font-black text-[#181511]">
                                                {customer.name || customer.full_name || 'Sin Nombre'}
                                            </span>
                                            {customer.phone && (
                                                <span className="text-[9px] font-bold text-[#f7951d] bg-orange-50 border border-orange-100/50 px-1.5 py-0.5 rounded-full">
                                                    📞 {customer.phone}
                                                </span>
                                            )}
                                        </div>
                                        {customer.address && (
                                            <span className="text-[8px] text-gray-400 mt-0.5 truncate flex items-center gap-0.5">
                                                <span className="material-icons-round text-[9px] text-gray-400">room</span>
                                                {customer.address}
                                            </span>
                                        )}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar bg-gray-50/30">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-[2px] block mb-2 px-1">Paso 2: Resumen de Pedido</span>
                {cart.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center opacity-20">
                        <span className="material-icons-round text-6xl mb-2">shopping_basket</span>
                        <p className="font-bold">Orden vacía</p>
                    </div>
                ) : (
                    cart.map((item) => (
                        <div key={item.cartItemId} className="flex gap-2 animate-in slide-in-from-right-2 duration-200 items-start py-1 border-b border-gray-100/50 pb-2">
                            <div className="size-9 bg-orange-50 text-[#f7951d] rounded-lg flex items-center justify-center font-black shrink-0 text-sm">{item.quantity}x</div>
                            <div className="flex-1 min-w-0">
                                <p className="font-black text-sm text-[#181511] truncate leading-snug">{item.name}</p>
                                <p className="text-[11px] text-[#8c785f] font-bold uppercase tracking-tight mt-0.5">
                                    {item.selectedSize} {item.extras && item.extras.length > 0 ? `+ ${item.extras.length} extras` : ''}
                                </p>
                                {item.note && (
                                    <p className="text-[11px] text-amber-600 font-black italic mt-0.5 truncate leading-tight" title={item.note}>
                                        📝 {item.note}
                                    </p>
                                )}
                                <div className="flex gap-3 mt-1.5">
                                    <button onClick={() => updateQuantity(item.cartItemId, -1)} className="text-[11px] font-black text-red-500 hover:underline">QUITAR</button>
                                    <button onClick={() => updateQuantity(item.cartItemId, 1)} className="text-[11px] font-black text-green-600 hover:underline">AÑADIR</button>
                                    <button
                                        onClick={() => {
                                            const group = groupedProducts.find(g => g.name === item.name || item.name.includes(g.name));
                                            if (group) openProductCustomizer(group, item);
                                        }}
                                        className="text-[11px] font-black text-blue-500 hover:underline"
                                    >
                                        EDITAR
                                    </button>
                                </div>
                            </div>
                            <p className="font-black text-sm shrink-0 text-[#181511]">${(item.price * item.quantity).toFixed(2)}</p>
                        </div>
                    ))
                )}
            </div>

            <div className="p-2 bg-[#f8f7f5] border-t border-[#e8e5e1] space-y-1.5">
                <button
                    onClick={() => setShowOpenTabsModal(true)}
                    className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg bg-purple-50 border border-purple-200 text-purple-700"
                >
                    <div className="flex items-center gap-2">
                        <span className="material-icons-round text-sm">receipt_long</span>
                        <span className="text-[9px] font-black uppercase">Cuentas Abiertas</span>
                    </div>
                    {recentOrders.filter(o => ['pendiente', 'preparando', 'listo'].includes(o.status) && o.payment_status !== 'paid').length > 0 && (
                        <span className="bg-purple-600 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full">
                            {recentOrders.filter(o => ['pendiente', 'preparando', 'listo'].includes(o.status) && o.payment_status !== 'paid').length}
                        </span>
                    )}
                </button>

                <div className="flex justify-between items-center px-1">
                    <span className="text-[#8c785f] font-black text-[10px] uppercase">TOTAL:</span>
                    <span className="text-2xl font-black text-[#f7951d] tracking-tighter">${cartTotals.total.toFixed(2)}</span>
                </div>

                {orderType === 'dine-in' ? (
                    <div className="flex gap-1.5">
                        <button onClick={clearCart} className="size-10 bg-white border border-gray-200 text-gray-300 rounded-lg flex items-center justify-center shrink-0"><span className="material-icons-round">delete</span></button>
                        <button 
                            onClick={() => {
                                isProcessingOrder.current = false;
                                setOrderLoading(false);
                                setShowPaymentModal(true);
                            }} 
                            disabled={cart.length === 0} 
                            className="flex-1 bg-green-500 text-white font-black py-2 rounded-lg shadow-sm active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-xs"
                        >
                            <span className="material-icons-round text-lg">payments</span>
                            COBRAR AHORA
                        </button>
                    </div>
                ) : (
                    <div className="flex flex-col gap-1.5">
                        <div className="flex gap-1.5">
                            <button onClick={clearCart} className="size-10 bg-white border border-gray-200 text-gray-300 rounded-lg flex items-center justify-center shrink-0"><span className="material-icons-round">delete</span></button>
                            <button 
                                onClick={() => handlePlaceOrder(false, 'efectivo')} 
                                disabled={cart.length === 0 || orderLoading || (orderType === 'delivery' && !customerInfo.name)} 
                                className="flex-1 bg-[#181511] text-white font-black py-2 rounded-lg shadow-md active:scale-95 transition-all disabled:opacity-50 text-[10px] uppercase flex items-center justify-center gap-2"
                            >
                                <span className="material-icons-round text-sm">print</span>
                                {orderLoading ? '...' : 'Imprimir Ticket'}
                            </button>
                        </div>
                        <button 
                            onClick={() => handlePlaceOrder(true, 'transferencia')} 
                            disabled={cart.length === 0 || orderLoading || (orderType === 'delivery' && !customerInfo.name)} 
                            className="w-full bg-blue-600 text-white font-black py-2 rounded-lg shadow-md active:scale-95 transition-all disabled:opacity-50 text-[10px] uppercase flex items-center justify-center gap-2"
                        >
                            <span className="material-icons-round text-sm">account_balance</span>
                            {orderLoading ? '...' : 'Pago con Transferencia'}
                        </button>
                    </div>
                )}
            </div>
        </aside>
    );
}
