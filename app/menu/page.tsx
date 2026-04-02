'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/utils/supabase/client';

// ─── Types ─────────────────────────────────────────────────────────────────

interface Category { id: number; name: string; }
interface Product {
    id: number; name: string; description: string | null;
    price: number; imagen_url: string | null; category_id: number | null;
    available: boolean; is_spicy?: boolean;
    categories?: { name: string } | { name: string }[];
}
interface CartItem {
    product: Product;
    quantity: number;
    selectedSize: string;
    unitPrice: number;
}

const SIZES = [
    { label: 'Chica', multiplier: 0.75 },
    { label: 'Grande', multiplier: 1.0 },
    { label: 'Familiar', multiplier: 1.30 },
];

const PIZZA_CATEGORY_KEYWORDS = ['pizza', 'tradicional', 'especialidad', 'gourmet', 'orilla', 'snack'];
function isPizzaCategory(catName: string) {
    return PIZZA_CATEGORY_KEYWORDS.some(k => catName?.toLowerCase().includes(k));
}

// ─── Cart Badge ─────────────────────────────────────────────────────────────
function CartButton({ count, total, onClick }: { count: number; total: number; onClick: () => void }) {
    if (count === 0) return null;
    return (
        <button
            onClick={onClick}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-4 bg-[#181511] text-white px-6 py-4 rounded-2xl shadow-2xl shadow-black/30 hover:bg-black transition-all active:scale-95 min-w-[280px]"
        >
            <span className="bg-[#F27405] text-white size-8 rounded-xl flex items-center justify-center font-black text-sm">{count}</span>
            <span className="font-black text-sm flex-1 text-left">Ver carrito</span>
            <span className="font-black text-[#F27405]">${total.toFixed(2)}</span>
        </button>
    );
}

// ─── Product Detail + Add to Cart Modal ────────────────────────────────────
function ProductModal({ product, catName, onClose, onAdd }: {
    product: Product; catName: string;
    onClose: () => void;
    onAdd: (item: CartItem) => void;
}) {
    const isPizza = isPizzaCategory(catName);
    const [size, setSize] = useState(SIZES[1].label); // Default: Grande
    const [qty, setQty] = useState(1);

    const sizeMultiplier = SIZES.find(s => s.label === size)?.multiplier ?? 1;
    const unitPrice = product.price * sizeMultiplier;

    const handleAdd = () => {
        onAdd({ product, quantity: qty, selectedSize: isPizza ? size : '', unitPrice });
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
            <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-300" onClick={e => e.stopPropagation()}>
                {/* Hero image */}
                <div className="relative h-56 bg-gray-100">
                    {product.imagen_url
                        ? <img src={product.imagen_url} alt={product.name} className="w-full h-full object-cover" />
                        : <div className="w-full h-full flex items-center justify-center"><span className="material-symbols-outlined text-6xl text-gray-200">local_pizza</span></div>
                    }
                    <button onClick={onClose} className="absolute top-4 right-4 bg-white/90 backdrop-blur size-10 rounded-full flex items-center justify-center shadow-lg hover:bg-white transition-colors">
                        <span className="material-symbols-outlined text-xl text-[#181511]">close</span>
                    </button>
                    {product.is_spicy && (
                        <div className="absolute top-4 left-4 bg-red-500 text-white px-3 py-1 rounded-full text-xs font-black flex items-center gap-1">
                            <span className="material-symbols-outlined text-sm">whatshot</span> Picante
                        </div>
                    )}
                </div>

                <div className="p-6 space-y-5">
                    <div className="flex justify-between items-start gap-4">
                        <div>
                            <p className="text-[10px] font-black text-[#F27405] uppercase tracking-widest mb-1">{catName}</p>
                            <h2 className="text-2xl font-black text-[#181511]">{product.name}</h2>
                        </div>
                        <div className="text-right shrink-0">
                            <p className="text-2xl font-black text-[#F27405]">${unitPrice.toFixed(2)}</p>
                            {isPizza && size !== 'Grande' && <p className="text-[10px] text-gray-400">Base: ${product.price}</p>}
                        </div>
                    </div>

                    {product.description && (
                        <p className="text-[#8c785f] text-sm leading-relaxed">{product.description}</p>
                    )}

                    {/* Size selector — only for pizzas */}
                    {isPizza && (
                        <div>
                            <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">Elige el tamaño</p>
                            <div className="grid grid-cols-3 gap-2">
                                {SIZES.map(s => (
                                    <button
                                        key={s.label}
                                        onClick={() => setSize(s.label)}
                                        className={`py-3 rounded-2xl text-sm font-black border-2 transition-all ${size === s.label
                                            ? 'border-[#F27405] bg-orange-50 text-[#F27405]'
                                            : 'border-gray-100 bg-gray-50 text-[#8c785f] hover:border-gray-200'
                                            }`}
                                    >
                                        {s.label}
                                        <span className="block text-[9px] mt-0.5 font-bold opacity-60">${(product.price * s.multiplier).toFixed(2)}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Quantity */}
                    <div className="flex items-center justify-between bg-gray-50 rounded-2xl p-2">
                        <button onClick={() => setQty(Math.max(1, qty - 1))} className="size-10 rounded-xl bg-white shadow-sm flex items-center justify-center font-black text-xl text-[#181511] hover:bg-gray-100 transition-colors active:scale-95">−</button>
                        <span className="font-black text-2xl text-[#181511] tabular-nums">{qty}</span>
                        <button onClick={() => setQty(qty + 1)} className="size-10 rounded-xl bg-white shadow-sm flex items-center justify-center font-black text-xl text-[#181511] hover:bg-gray-100 transition-colors active:scale-95">+</button>
                    </div>

                    <button
                        onClick={handleAdd}
                        className="w-full bg-[#F27405] text-white py-4 rounded-2xl font-black text-base shadow-lg shadow-orange-200 hover:bg-orange-600 transition-all active:scale-95 flex items-center justify-center gap-2"
                    >
                        <span className="material-symbols-outlined">add_shopping_cart</span>
                        Agregar — ${(unitPrice * qty).toFixed(2)}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Cart + Checkout Modal ──────────────────────────────────────────────────
function CartModal({ cart, onClose, onRemove, onUpdateQty }: {
    cart: CartItem[];
    onClose: () => void;
    onRemove: (index: number) => void;
    onUpdateQty: (index: number, qty: number) => void;
}) {
    const [step, setStep] = useState<'cart' | 'checkout' | 'success'>('cart');
    const [orderType, setOrderType] = useState<'pickup' | 'delivery'>('pickup');
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [address, setAddress] = useState('');
    const [notes, setNotes] = useState('');
    const [loading, setLoading] = useState(false);
    const [orderId, setOrderId] = useState<number | null>(null);
    const [waUrl, setWaUrl] = useState('');

    const total = cart.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
    const itemCount = cart.reduce((s, i) => s + i.quantity, 0);

    const handleOrder = async () => {
        if (!name.trim() || !phone.trim()) return;
        if (orderType === 'delivery' && !address.trim()) return;

        setLoading(true);
        try {
            const res = await fetch('/api/orders/online', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    customerName: name.trim(),
                    customerPhone: phone.trim(),
                    orderType,
                    deliveryAddress: address.trim(),
                    notes: notes.trim(),
                    items: cart.map(ci => ({
                        product_id: ci.product.id,
                        product_name: ci.product.name,
                        quantity: ci.quantity,
                        unit_price: ci.unitPrice,
                        selected_size: ci.selectedSize,
                    })),
                }),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Error al enviar');

            setOrderId(data.orderId);
            setWaUrl(data.whatsappRestaurantUrl);
            setStep('success');

            // Auto-open WhatsApp for restaurant alert after 500ms
            setTimeout(() => {
                window.open(data.whatsappRestaurantUrl, '_blank');
            }, 600);

        } catch (err: any) {
            alert('Error: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl max-h-[90vh] flex flex-col animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-300">

                {/* Header */}
                <div className="px-6 py-5 border-b border-[#f0ede9] flex items-center justify-between shrink-0">
                    {step !== 'success' && (
                        <button onClick={step === 'checkout' ? () => setStep('cart') : onClose} className="text-[#8c785f] hover:text-[#181511]">
                            <span className="material-symbols-outlined">{step === 'checkout' ? 'arrow_back' : 'close'}</span>
                        </button>
                    )}
                    <h2 className="font-black text-[#181511] text-lg mx-auto">
                        {step === 'cart' ? `Tu Carrito (${itemCount})` : step === 'checkout' ? 'Datos del Pedido' : '¡Pedido Enviado! 🎉'}
                    </h2>
                    {step !== 'success' && step !== 'checkout' && <div className="w-6" />}
                </div>

                {/* Cart Step */}
                {step === 'cart' && (
                    <>
                        <div className="flex-1 overflow-y-auto p-6 space-y-4">
                            {cart.map((ci, idx) => (
                                <div key={idx} className="flex gap-4 items-start bg-gray-50 rounded-2xl p-4">
                                    <div className="size-14 rounded-xl bg-gray-100 overflow-hidden shrink-0">
                                        {ci.product.imagen_url
                                            ? <img src={ci.product.imagen_url} alt={ci.product.name} className="w-full h-full object-cover" />
                                            : <div className="w-full h-full flex items-center justify-center"><span className="material-symbols-outlined text-xl text-gray-300">local_pizza</span></div>}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-black text-[#181511] text-sm">{ci.product.name}</p>
                                        {ci.selectedSize && <p className="text-[10px] text-[#F27405] font-bold uppercase">{ci.selectedSize}</p>}
                                        <div className="flex items-center gap-2 mt-2">
                                            <button onClick={() => onUpdateQty(idx, ci.quantity - 1)} className="size-7 rounded-lg bg-white border border-gray-200 flex items-center justify-center font-black text-sm">−</button>
                                            <span className="font-black text-sm w-4 text-center">{ci.quantity}</span>
                                            <button onClick={() => onUpdateQty(idx, ci.quantity + 1)} className="size-7 rounded-lg bg-white border border-gray-200 flex items-center justify-center font-black text-sm">+</button>
                                        </div>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <p className="font-black text-[#181511]">${(ci.unitPrice * ci.quantity).toFixed(2)}</p>
                                        <button onClick={() => onRemove(idx)} className="text-red-400 hover:text-red-600 mt-1">
                                            <span className="material-symbols-outlined text-base">delete</span>
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="p-6 border-t border-[#f0ede9] space-y-4 shrink-0">
                            <div className="flex justify-between font-black text-xl text-[#181511]">
                                <span>Total</span><span className="text-[#F27405]">${total.toFixed(2)}</span>
                            </div>
                            <button onClick={() => setStep('checkout')} className="w-full bg-[#F27405] text-white py-4 rounded-2xl font-black shadow-lg shadow-orange-200 hover:bg-orange-600 transition-all active:scale-95">
                                Continuar →
                            </button>
                        </div>
                    </>
                )}

                {/* Checkout Step */}
                {step === 'checkout' && (
                    <>
                        <div className="flex-1 overflow-y-auto p-6 space-y-5">
                            {/* Order Type */}
                            <div>
                                <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">¿Cómo lo recibes?</p>
                                <div className="grid grid-cols-2 gap-3">
                                    {[
                                        { val: 'pickup', icon: 'store', label: 'Pick Up', sub: 'Recoges en sucursal' },
                                        { val: 'delivery', icon: 'delivery_dining', label: 'A Domicilio', sub: 'Te lo llevamos' },
                                    ].map(opt => (
                                        <button
                                            key={opt.val}
                                            onClick={() => setOrderType(opt.val as any)}
                                            className={`p-4 rounded-2xl border-2 text-left transition-all ${orderType === opt.val ? 'border-[#F27405] bg-orange-50' : 'border-gray-100 bg-gray-50'}`}
                                        >
                                            <span className={`material-symbols-outlined text-2xl mb-1 block ${orderType === opt.val ? 'text-[#F27405]' : 'text-gray-400'}`}>{opt.icon}</span>
                                            <p className={`font-black text-sm ${orderType === opt.val ? 'text-[#181511]' : 'text-[#8c785f]'}`}>{opt.label}</p>
                                            <p className="text-[10px] text-gray-400 font-bold">{opt.sub}</p>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Fields */}
                            {[
                                { label: 'Nombre completo *', val: name, set: setName, type: 'text', placeholder: 'Tu nombre' },
                                { label: 'WhatsApp / Teléfono *', val: phone, set: setPhone, type: 'tel', placeholder: '741-000-0000' },
                            ].map(f => (
                                <div key={f.label}>
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">{f.label}</label>
                                    <input
                                        type={f.type} value={f.val}
                                        onChange={e => f.set(e.target.value)}
                                        placeholder={f.placeholder}
                                        className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl px-5 py-3.5 font-bold text-[#181511] placeholder-gray-300 focus:border-[#F27405] focus:bg-white outline-none transition-all"
                                    />
                                </div>
                            ))}

                            {orderType === 'delivery' && (
                                <div>
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Dirección de entrega *</label>
                                    <textarea
                                        rows={3} value={address} onChange={e => setAddress(e.target.value)}
                                        placeholder="Calle, número, colonia..."
                                        className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl px-5 py-3.5 font-bold text-[#181511] placeholder-gray-300 focus:border-[#F27405] focus:bg-white outline-none transition-all resize-none"
                                    />
                                </div>
                            )}

                            <div>
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Notas o instrucciones (opcional)</label>
                                <textarea
                                    rows={2} value={notes} onChange={e => setNotes(e.target.value)}
                                    placeholder="Ej: sin cebolla, extra picante..."
                                    className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl px-5 py-3.5 font-bold text-[#181511] placeholder-gray-300 focus:border-[#F27405] focus:bg-white outline-none transition-all resize-none"
                                />
                            </div>
                        </div>

                        {/* Summary + Submit */}
                        <div className="p-6 border-t border-[#f0ede9] space-y-4 shrink-0">
                            <div className="flex justify-between text-sm text-[#8c785f] font-bold">
                                <span>{itemCount} productos</span>
                                <span className="font-black text-[#181511] text-base">${total.toFixed(2)}</span>
                            </div>
                            <button
                                onClick={handleOrder}
                                disabled={loading || !name.trim() || !phone.trim() || (orderType === 'delivery' && !address.trim())}
                                className="w-full bg-[#181511] text-white py-4 rounded-2xl font-black shadow-lg flex items-center justify-center gap-2 hover:bg-black transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                {loading ? (
                                    <><div className="size-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Enviando...</>
                                ) : (
                                    <><span className="material-symbols-outlined">send</span> Enviar Pedido por WhatsApp</>
                                )}
                            </button>
                            <p className="text-center text-[10px] text-gray-400 font-bold">Al confirmar, recibirás una notificación de tu pedido 🔔</p>
                        </div>
                    </>
                )}

                {/* Success Step */}
                {step === 'success' && (
                    <div className="flex-1 flex flex-col items-center justify-center p-10 gap-6 text-center">
                        <div className="size-20 rounded-3xl bg-green-100 flex items-center justify-center animate-bounce">
                            <span className="material-symbols-outlined text-4xl text-green-600">check_circle</span>
                        </div>
                        <div>
                            <h3 className="text-2xl font-black text-[#181511] mb-2">¡Pedido Enviado! 🎉</h3>
                            <p className="text-[#8c785f] text-sm font-bold">Orden <span className="text-[#F27405]">#{orderId}</span> recibida.</p>
                            <p className="text-[#8c785f] text-sm mt-2">En unos minutos nuestro equipo te contactará para confirmar tu pedido.</p>
                        </div>
                        <div className="flex flex-col gap-3 w-full">
                            <a href={waUrl} target="_blank" rel="noopener" className="flex items-center justify-center gap-2 bg-green-500 text-white py-4 rounded-2xl font-black hover:bg-green-600 transition-all active:scale-95">
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
                                Abrir WhatsApp de confirmación
                            </a>
                            <button onClick={onClose} className="py-3 rounded-2xl font-bold text-[#8c785f] hover:text-[#181511] transition-colors text-sm">
                                Seguir explorando el menú
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Main Page ──────────────────────────────────────────────────────────────
export default function PublicMenuPage() {
    const [categories, setCategories] = useState<Category[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeCategory, setActiveCategory] = useState<string>('all');
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [cart, setCart] = useState<CartItem[]>([]);
    const [showCart, setShowCart] = useState(false);

    useEffect(() => {
        (async () => {
            const [catsRes, prodsRes] = await Promise.all([
                supabase.from('categories').select('*').order('name'),
                supabase.from('products').select('*, categories(name)').eq('available', true).order('name'),
            ]);
            setCategories(catsRes.data || []);
            setProducts(prodsRes.data || []);
            setLoading(false);
        })();
    }, []);

    const getCategoryName = (p: Product) => {
        if (!p.categories) return '';
        return Array.isArray(p.categories) ? p.categories[0]?.name ?? '' : (p.categories as any).name ?? '';
    };

    const filteredProducts = activeCategory === 'all'
        ? products
        : products.filter(p => p.category_id?.toString() === activeCategory);

    const addToCart = useCallback((item: CartItem) => {
        setCart(prev => {
            const exists = prev.findIndex(
                ci => ci.product.id === item.product.id && ci.selectedSize === item.selectedSize
            );
            if (exists >= 0) {
                const updated = [...prev];
                updated[exists] = { ...updated[exists], quantity: updated[exists].quantity + item.quantity };
                return updated;
            }
            return [...prev, item];
        });
    }, []);

    const removeFromCart = useCallback((idx: number) => {
        setCart(prev => prev.filter((_, i) => i !== idx));
    }, []);

    const updateQty = useCallback((idx: number, qty: number) => {
        if (qty <= 0) { setCart(prev => prev.filter((_, i) => i !== idx)); return; }
        setCart(prev => prev.map((ci, i) => i === idx ? { ...ci, quantity: qty } : ci));
    }, []);

    const cartTotal = cart.reduce((s, ci) => s + ci.unitPrice * ci.quantity, 0);
    const cartCount = cart.reduce((s, ci) => s + ci.quantity, 0);

    const clearCart = useCallback(() => setCart([]), []);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="flex flex-col items-center gap-4">
                    <div className="size-14 border-4 border-orange-100 border-t-[#F27405] rounded-full animate-spin" />
                    <p className="text-[#8c785f] font-bold animate-pulse">Cargando menú...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto lg:max-w-5xl px-4">
            {/* Hero */}
            <div className="relative h-52 md:h-72 rounded-3xl overflow-hidden mb-8 shadow-xl">
                <img src="https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=1200&q=80" alt="Casaleña Pizza" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-7">
                    <h2 className="text-white text-3xl font-black leading-tight">Pizza a Leña<br /><span className="text-[#F27405]">Auténtica</span></h2>
                    <p className="text-white/70 text-sm mt-1 font-medium">Hecha con amor y los mejores ingredientes</p>
                </div>
            </div>

            {/* Category Tabs */}
            <div className="sticky top-[73px] z-30 bg-[#f8f7f5]/95 backdrop-blur-md -mx-4 px-4 py-3 mb-6 overflow-x-auto scrollbar-hide shadow-sm">
                <div className="flex gap-2 min-w-max">
                    <button
                        onClick={() => setActiveCategory('all')}
                        className={`px-5 py-2 rounded-xl text-sm font-black transition-all ${activeCategory === 'all' ? 'bg-[#181511] text-white shadow-md' : 'bg-white text-[#8c785f] border border-[#e6e1db] hover:bg-gray-50'}`}
                    >Todos</button>
                    {categories.map(cat => (
                        <button key={cat.id}
                            onClick={() => setActiveCategory(cat.id.toString())}
                            className={`px-5 py-2 rounded-xl text-sm font-black transition-all whitespace-nowrap ${activeCategory === cat.id.toString() ? 'bg-[#181511] text-white shadow-md' : 'bg-white text-[#8c785f] border border-[#e6e1db] hover:bg-gray-50'}`}
                        >{cat.name}</button>
                    ))}
                </div>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 pb-32">
                {filteredProducts.map(product => (
                    <div
                        key={product.id}
                        onClick={() => setSelectedProduct(product)}
                        className="bg-white rounded-2xl overflow-hidden shadow-sm border border-[#e6e1db] cursor-pointer hover:shadow-md hover:border-orange-200 hover:-translate-y-0.5 transition-all duration-200 group"
                    >
                        <div className="h-40 bg-gray-100 overflow-hidden relative">
                            {product.imagen_url
                                ? <img src={product.imagen_url} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                : <div className="w-full h-full flex items-center justify-center"><span className="material-symbols-outlined text-4xl text-gray-200">local_pizza</span></div>
                            }
                            {product.is_spicy && (
                                <div className="absolute top-2 left-2 bg-red-500 text-white px-2 py-0.5 rounded-full text-[9px] font-black uppercase">🌶 Picante</div>
                            )}
                        </div>
                        <div className="p-4">
                            <div className="flex justify-between items-start gap-2 mb-1">
                                <h3 className="font-black text-[#181511] text-sm leading-tight">{product.name}</h3>
                                <span className="font-black text-[#F27405] text-base shrink-0">${product.price}</span>
                            </div>
                            {product.description && (
                                <p className="text-xs text-[#8c785f] line-clamp-2 leading-relaxed">{product.description}</p>
                            )}
                            <div className="mt-3 flex justify-end">
                                <div className="size-8 rounded-xl bg-orange-50 flex items-center justify-center text-[#F27405] group-hover:bg-[#F27405] group-hover:text-white transition-all">
                                    <span className="material-symbols-outlined text-lg">add</span>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Floating Cart */}
            <CartButton count={cartCount} total={cartTotal} onClick={() => setShowCart(true)} />

            {/* Product Modal */}
            {selectedProduct && (
                <ProductModal
                    product={selectedProduct}
                    catName={getCategoryName(selectedProduct)}
                    onClose={() => setSelectedProduct(null)}
                    onAdd={item => { addToCart(item); setSelectedProduct(null); }}
                />
            )}

            {/* Cart Modal */}
            {showCart && (
                <CartModal
                    cart={cart}
                    onClose={() => { setShowCart(false); clearCart(); }}
                    onRemove={removeFromCart}
                    onUpdateQty={updateQty}
                />
            )}
        </div>
    );
}
