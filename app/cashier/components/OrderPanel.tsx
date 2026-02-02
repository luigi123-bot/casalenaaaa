'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase/client';
import CustomerSelector from '@/components/CustomerSelector';

interface CartItem {
    id: number;
    name: string;
    description: string;
    price: number;
    quantity: number;
    imagen_url: string;
}

interface OrderPanelProps {
    cartItems: CartItem[];
    onUpdateQuantity: (id: number, delta: number) => void;
    onClearCart: () => void;
}

export default function OrderPanel({ cartItems, onUpdateQuantity, onClearCart }: OrderPanelProps) {
    const [loading, setLoading] = useState(false);
    const [diningOption, setDiningOption] = useState('Mesa');
    const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);

    // Payment State
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [amountPaid, setAmountPaid] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('efectivo');
    const [change, setChange] = useState(0);

    const subtotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const tax = subtotal * 0.08;
    const total = subtotal + tax;

    useEffect(() => {
        const paid = parseFloat(amountPaid) || 0;
        setChange(Math.max(0, paid - total));
    }, [amountPaid, total]);

    const handleInitiateOrder = () => {
        if (cartItems.length === 0) return;
        setAmountPaid('');
        setChange(0);
        setShowPaymentModal(true);
    };

    const handlePlaceOrder = async () => {
        setLoading(true);
        try {
            // 1. Get current user (cashier)
            const { data: { user } } = await supabase.auth.getUser();

            if (!user) {
                alert('Debe iniciar sesión para procesar órdenes.');
                setLoading(false);
                return;
            }

            // 2. Insert Order
            const { data: orderData, error: orderError } = await supabase
                .from('orders')
                .insert({
                    user_id: user.id,
                    customer_id: selectedCustomer?.id || null,
                    status: 'pendiente',
                    total_amount: total,
                    tax_amount: tax,
                    // Store specific payment info if your schema supports it, otherwise basic fields
                    order_type: diningOption.toLowerCase(),
                    payment_method: paymentMethod,
                    // If you have columns for amount_paid / change, add them here:
                    // amount_paid: parseFloat(amountPaid) || total,
                    // change_amount: change
                })
                .select()
                .single();

            if (orderError) throw orderError;

            // 3. Insert Order Items
            const orderItems = cartItems.map(item => ({
                order_id: orderData.id,
                product_id: item.id,
                quantity: item.quantity,
                unit_price: item.price
            }));

            const { error: itemsError } = await supabase
                .from('order_items')
                .insert(orderItems);

            if (itemsError) throw itemsError;

            // Success
            // alert('Orden creada exitosamente!'); // Optional: removed to be less intrusive or relying on the detail panel auto-print
            onClearCart();
            setSelectedCustomer(null);
            setShowPaymentModal(false);

        } catch (error) {
            console.error('Error placing order:', error);
            alert('Error al crear la orden. Por favor intente de nuevo.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <aside className="w-[420px] bg-white dark:bg-gray-900 border-l border-gray-100 dark:border-gray-800 flex flex-col h-screen shrink-0 relative z-30 shadow-2xl">
            {/* SectionHeader */}
            <div className="p-8 border-b border-dashed border-gray-200 dark:border-gray-800 bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm z-10">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-text-main dark:text-white text-3xl font-extrabold tracking-tight">Comanda</h2>
                    {/* Placeholder for table selection if needed later */}
                    <div className="bg-primary/10 px-3 py-1 rounded-full text-primary text-xs font-bold uppercase tracking-widest hidden">
                        Mesa #4
                    </div>
                </div>

                {/* Customer Selector */}
                <div className="mb-6">
                    <CustomerSelector
                        onSelect={setSelectedCustomer}
                        selectedCustomer={selectedCustomer}
                    />
                </div>

                {/* SegmentedButtons */}
                <div className="flex bg-gray-100 dark:bg-gray-800 p-1.5 rounded-2xl">
                    {['Mesa', 'Para Llevar', 'Domicilio'].map((option) => (
                        <label key={option} className={`relative flex cursor-pointer h-11 grow items-center justify-center rounded-xl px-2 text-sm font-bold transition-all duration-200 ${diningOption === option ? 'bg-white dark:bg-gray-700 shadow-md text-primary scale-[1.02]' : 'text-text-sub dark:text-gray-400 hover:text-text-main dark:hover:text-white'}`}>
                            <span className="truncate z-10">{option}</span>
                            <input
                                className="hidden"
                                type="radio"
                                name="dining-option"
                                value={option}
                                checked={diningOption === option}
                                onChange={() => setDiningOption(option)}
                            />
                        </label>
                    ))}
                </div>
            </div>

            {/* Order List Content */}
            <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
                {cartItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-text-sub/40 select-none">
                        <div className="w-24 h-24 bg-gray-50 dark:bg-gray-800 rounded-full flex items-center justify-center mb-6 text-gray-200 dark:text-gray-700">
                            <span className="material-symbols-outlined text-5xl">shopping_cart</span>
                        </div>
                        <p className="font-bold text-lg text-text-sub/60">Tu orden está vacía</p>
                        <p className="text-sm mt-2 max-w-[200px] text-center">Selecciona productos del menú para comenzar</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {cartItems.map((item) => (
                            <div key={item.id} className="group relative bg-white dark:bg-gray-800 rounded-2xl p-3 border border-transparent hover:border-gray-100 dark:hover:border-gray-700 transition-all hover:shadow-lg dark:hover:shadow-black/20 flex gap-4 animate-in slide-in-from-right-4 duration-300">
                                <div
                                    className="size-16 bg-gray-100 dark:bg-gray-700 rounded-xl bg-center bg-cover shrink-0"
                                    style={{ backgroundImage: `url("${item.imagen_url || 'https://via.placeholder.com/100'}")` }}
                                />

                                <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                                    <div className="flex justify-between items-start gap-2">
                                        <p className="font-bold text-text-main dark:text-white leading-tight truncate">{item.name}</p>
                                        <p className="font-bold text-primary">${(item.price * item.quantity).toFixed(2)}</p>
                                    </div>

                                    <div className="flex items-center justify-between mt-2">
                                        <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-900 rounded-lg p-1">
                                            <button
                                                onClick={() => onUpdateQuantity(item.id, -1)}
                                                className="size-6 flex items-center justify-center bg-white dark:bg-gray-800 rounded-md shadow-sm text-text-sub hover:text-red-500 transition-colors"
                                            >
                                                <span className="material-symbols-outlined text-[14px]">remove</span>
                                            </button>
                                            <span className="text-sm font-bold min-w-[12px] text-center text-text-main dark:text-white">{item.quantity}</span>
                                            <button
                                                onClick={() => onUpdateQuantity(item.id, 1)}
                                                className="size-6 flex items-center justify-center bg-white dark:bg-gray-800 rounded-md shadow-sm text-text-sub hover:text-green-500 transition-colors"
                                            >
                                                <span className="material-symbols-outlined text-[14px]">add</span>
                                            </button>
                                        </div>
                                        <button
                                            onClick={() => onUpdateQuantity(item.id, -item.quantity)}
                                            className="text-gray-300 hover:text-red-500 transition-colors p-1"
                                        >
                                            <span className="material-symbols-outlined text-[18px]">delete</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Order Summary Footer */}
            <div className="p-8 bg-surface dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] z-20">
                <div className="space-y-3 mb-6">
                    <div className="flex justify-between items-center text-sm">
                        <span className="text-text-sub dark:text-gray-400 font-medium">Subtotal</span>
                        <span className="font-bold text-text-main dark:text-white text-base">${subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                        <span className="text-text-sub dark:text-gray-400 font-medium">Tax (8%)</span>
                        <span className="font-bold text-text-main dark:text-white text-base">${tax.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-end pt-4 border-t border-dashed border-gray-200 dark:border-gray-700 mt-4">
                        <span className="text-base font-bold text-text-sub dark:text-gray-400 mb-1">Total a Pagar</span>
                        <span className="text-4xl font-black text-text-main dark:text-white tracking-tight">${total.toFixed(2)}</span>
                    </div>
                </div>
                <button
                    onClick={handleInitiateOrder}
                    disabled={loading || cartItems.length === 0}
                    className="group w-full bg-primary hover:bg-primary/90 text-white font-bold py-5 rounded-2xl shadow-lg shadow-primary/25 flex items-center justify-center gap-3 transition-all transform active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none relative overflow-hidden"
                >
                    <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 pointer-events-none" />
                    {loading ? (
                        <>
                            <span className="material-symbols-outlined animate-spin">progress_activity</span>
                            <span>Procesando...</span>
                        </>
                    ) : (
                        <>
                            <span>Confirmar Pedido</span>
                            <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform">arrow_forward</span>
                        </>
                    )}
                </button>
            </div>

            {/* Payment Modal */}
            {showPaymentModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white dark:bg-gray-800 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="bg-[#181511] p-6 text-white text-center relative">
                            <h3 className="text-xl font-bold">Resumen de Pago</h3>
                            <p className="text-white/60 text-sm">{diningOption}</p>
                            <button
                                onClick={() => setShowPaymentModal(false)}
                                className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-full transition-colors"
                            >
                                <span className="material-symbols-outlined text-lg">close</span>
                            </button>
                        </div>

                        <div className="p-8">
                            {/* Total Display */}
                            <div className="text-center mb-8">
                                <p className="text-gray-400 text-sm font-medium mb-1">Total a Pagar</p>
                                <p className="text-5xl font-black text-[#181511] dark:text-white tracking-tight">${total.toFixed(2)}</p>
                            </div>

                            {/* Payment Method Tabs */}
                            <div className="grid grid-cols-3 gap-2 p-1 bg-gray-100 dark:bg-gray-700 rounded-xl mb-6">
                                <button
                                    onClick={() => setPaymentMethod('efectivo')}
                                    className={`py-2 px-2 rounded-lg text-xs sm:text-sm font-bold transition-all ${paymentMethod === 'efectivo' ? 'bg-white shadow-sm text-black' : 'text-gray-500 hover:text-gray-700'}`}
                                >
                                    Efectivo
                                </button>
                                <button
                                    onClick={() => setPaymentMethod('tarjeta')}
                                    className={`py-2 px-2 rounded-lg text-xs sm:text-sm font-bold transition-all ${paymentMethod === 'tarjeta' ? 'bg-white shadow-sm text-black' : 'text-gray-500 hover:text-gray-700'}`}
                                >
                                    Tarjeta
                                </button>
                                <button
                                    onClick={() => setPaymentMethod('transferencia')}
                                    className={`py-2 px-2 rounded-lg text-xs sm:text-sm font-bold transition-all ${paymentMethod === 'transferencia' ? 'bg-white shadow-sm text-black' : 'text-gray-500 hover:text-gray-700'}`}
                                >
                                    Transferencia
                                </button>
                            </div>

                            {/* Payment Content */}
                            {paymentMethod === 'efectivo' ? (
                                <div className="space-y-6">
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Monto Recibido</label>
                                        <div className="relative">
                                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-lg">$</span>
                                            <input
                                                type="number"
                                                value={amountPaid}
                                                onChange={(e) => setAmountPaid(e.target.value)}
                                                autoFocus
                                                placeholder="0.00"
                                                className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl pl-10 pr-4 py-4 text-2xl font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all placeholder:text-gray-300"
                                            />
                                        </div>
                                    </div>

                                    <div className="bg-green-50 border border-green-100 rounded-xl p-4 flex justify-between items-center">
                                        <span className="text-green-800 font-bold">Su Cambio:</span>
                                        <span className="text-2xl font-black text-green-700">${change.toFixed(2)}</span>
                                    </div>
                                </div>
                            ) : paymentMethod === 'tarjeta' ? (
                                <div className="text-center py-6 text-gray-500">
                                    <span className="material-symbols-outlined text-4xl mb-2">credit_card</span>
                                    <p>Procese el pago en la terminal bancaria.</p>
                                </div>
                            ) : (
                                <div className="text-center py-6 text-gray-500">
                                    <span className="material-symbols-outlined text-4xl mb-2">account_balance</span>
                                    <p>Verifique la transferencia en la app del banco.</p>
                                </div>
                            )}

                        </div>

                        {/* Footer Actions */}
                        <div className="p-6 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-100 dark:border-gray-800">
                            <button
                                onClick={handlePlaceOrder}
                                disabled={paymentMethod === 'efectivo' && (parseFloat(amountPaid) || 0) < total}
                                className="w-full bg-[#181511] hover:bg-black text-white font-bold py-4 rounded-xl shadow-lg flex items-center justify-center gap-2 transform active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <span className="material-symbols-outlined">check_circle</span>
                                {loading ? 'Procesando...' : 'Cobrar e Imprimir Ticket'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </aside>
    );
}
