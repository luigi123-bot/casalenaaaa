'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/utils/supabase/client';

interface Category {
    id: number;
    name: string;
    slug: string;
}

interface Product {
    id: number;
    name: string;
    description: string | null;
    price: number;
    imagen_url: string | null;
    category_id: number | null;
    available: boolean;
    is_spicy?: boolean;
    is_signature?: boolean;
    categories?: {
        name: string;
    } | { name: string }[];
}

export default function PublicMenuPage() {
    const [categories, setCategories] = useState<Category[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeCategory, setActiveCategory] = useState<string>('all');
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

    useEffect(() => {
        fetchMenuData();
    }, []);

    const fetchMenuData = async () => {
        try {
            const [catsRes, prodsRes] = await Promise.all([
                supabase.from('categories').select('*').order('name'),
                supabase.from('products').select('*, categories(name)').eq('available', true).order('name')
            ]);

            if (catsRes.error) throw catsRes.error;
            if (prodsRes.error) throw prodsRes.error;

            setCategories(catsRes.data || []);
            setProducts(prodsRes.data || []);
        } catch (error) {
            console.error('Error fetching menu:', error);
        } finally {
            setLoading(false);
        }
    };

    const getCategoryName = (product: Product) => {
        if (product.categories) {
            return Array.isArray(product.categories) ? product.categories[0]?.name : product.categories.name;
        }
        return '';
    };

    const filteredProducts = activeCategory === 'all'
        ? products
        : products.filter(p => p.category_id?.toString() === activeCategory);

    const scrollToCategory = (catId: string) => {
        setActiveCategory(catId);
        // In a real implementation with sections, we would scroll to the element here
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <div className="flex flex-col items-center gap-3">
                    <span className="material-symbols-outlined text-4xl text-primary animate-spin">
                        local_pizza
                    </span>
                    <p className="text-[#8c785f] font-medium">Horneando menú...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-md mx-auto md:max-w-3xl lg:max-w-5xl px-4">
            {/* Promo Banner */}
            <div className="relative h-48 md:h-64 rounded-2xl overflow-hidden mb-8 shadow-xl">
                <img
                    src="https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1200&q=80"
                    alt="Banner"
                    className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex items-end p-6">
                    <div>
                        <h2 className="text-white text-2xl font-bold mb-1">Authentic Wood Fired Pizza</h2>
                        <p className="text-white/80 text-sm">Hecha con amor y los mejores ingredientes.</p>
                    </div>
                </div>
            </div>

            {/* Sticky Category Nav */}
            <div className="sticky top-[73px] z-40 bg-[#f8f7f5]/95 backdrop-blur py-2 -mx-4 px-4 mb-6 overflow-x-auto scrollbar-hide">
                <div className="flex gap-2 min-w-max">
                    <button
                        onClick={() => scrollToCategory('all')}
                        className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${activeCategory === 'all'
                                ? 'bg-[#181511] text-white shadow-lg scale-105'
                                : 'bg-white text-[#8c785f] border border-[#e6e1db]'
                            }`}
                    >
                        Todos
                    </button>
                    {categories.map((cat) => (
                        <button
                            key={cat.id}
                            onClick={() => scrollToCategory(cat.id.toString())}
                            className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${activeCategory === cat.id.toString()
                                    ? 'bg-[#181511] text-white shadow-lg scale-105'
                                    : 'bg-white text-[#8c785f] border border-[#e6e1db]'
                                }`}
                        >
                            {cat.name}
                        </button>
                    ))}
                </div>
            </div>

            {/* Product Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-20">
                {filteredProducts.map((product) => (
                    <div
                        key={product.id}
                        onClick={() => setSelectedProduct(product)}
                        className="bg-white rounded-2xl p-4 shadow-sm border border-[#e6e1db] flex gap-4 cursor-pointer hover:border-primary transition-colors group"
                    >
                        {/* Image */}
                        <div className="size-28 flex-shrink-0 bg-gray-100 rounded-xl overflow-hidden">
                            {product.imagen_url ? (
                                <img
                                    src={product.imagen_url}
                                    alt={product.name}
                                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                    <span className="material-symbols-outlined text-3xl text-gray-300">
                                        restaurant
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Content */}
                        <div className="flex flex-col flex-1 min-w-0">
                            <div className="flex justify-between items-start gap-2">
                                <h3 className="font-bold text-[#181511] line-clamp-2 leading-tight">
                                    {product.name}
                                </h3>
                                <span className="text-primary font-black text-lg">
                                    ${product.price}
                                </span>
                            </div>
                            <p className="text-xs text-[#8c785f] mt-1 line-clamp-2 mb-auto">
                                {product.description}
                            </p>
                            <div className="flex items-center gap-2 mt-3">
                                {product.is_spicy && (
                                    <span className="material-symbols-outlined text-red-500 text-sm" title="Picante">whatshot</span>
                                )}
                                <div className="ml-auto size-8 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                                    <span className="material-symbols-outlined text-lg">add</span>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Product Detail Modal */}
            {selectedProduct && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div
                        className="bg-white w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="relative h-64 md:h-80">
                            {selectedProduct.imagen_url ? (
                                <img
                                    src={selectedProduct.imagen_url}
                                    alt={selectedProduct.name}
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                                    <span className="material-symbols-outlined text-6xl text-gray-300">
                                        restaurant
                                    </span>
                                </div>
                            )}
                            <button
                                onClick={() => setSelectedProduct(null)}
                                className="absolute top-4 right-4 bg-white/90 p-2 rounded-full shadow-lg hover:bg-white transition-colors text-[#181511]"
                            >
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>

                        <div className="p-6 md:p-8">
                            <div className="flex items-start justify-between mb-2">
                                <div>
                                    <span className="text-xs font-bold text-primary uppercase tracking-wide mb-1 block">
                                        {getCategoryName(selectedProduct)}
                                    </span>
                                    <h2 className="text-2xl font-black text-[#181511] leading-none">
                                        {selectedProduct.name}
                                    </h2>
                                </div>
                                <span className="text-2xl font-black text-primary">
                                    ${selectedProduct.price}
                                </span>
                            </div>

                            <p className="text-[#8c785f] leading-relaxed mb-8">
                                {selectedProduct.description || 'Sin descripción disponible.'}
                            </p>

                            <button
                                onClick={() => setSelectedProduct(null)}
                                className="w-full bg-[#181511] text-white py-4 rounded-xl font-bold text-lg shadow-lg hover:bg-black/90 transition-transform active:scale-95 flex items-center justify-center gap-2"
                            >
                                <span className="material-symbols-outlined">close</span>
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
