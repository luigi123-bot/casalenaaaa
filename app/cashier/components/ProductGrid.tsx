"use client";
import { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase/client';

export default function ProductGrid({ onAddToCart, searchTerm, activeCategory }: { onAddToCart: (product: any) => void, searchTerm: string, activeCategory: string }) {
    // const [activeCategory, setActiveCategory] = useState('Pizzas'); // Managed by parent
    const [products, setProducts] = useState<any[]>([]);
    // const [searchTerm, setSearchTerm] = useState(''); // Managed by parent
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const controller = new AbortController();
        const signal = controller.signal;

        const fetchProducts = async () => {
            setLoading(true);
            try {
                // Fetch products from Supabase
                const { data, error } = await supabase
                    .from('products')
                    .select('*')
                    .abortSignal(signal);

                if (error) {
                    console.error('Error loading products:', error);
                } else {
                    setProducts(data || []);
                }
            } catch (err: any) {
                if (err.name === 'AbortError') {
                    // Ignore abort errors
                } else {
                    console.error('Unexpected error:', err);
                }
            } finally {
                if (!signal.aborted) {
                    setLoading(false);
                }
            }
        };

        fetchProducts();

        return () => {
            controller.abort();
        };
    }, []);

    // Filter logic
    const filteredProducts = products.filter(product => {
        const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase());
        // Simple category filter for demo. In real app, check category_id or name
        // Assuming we have a category logic or just mock it for now if data is missing.
        // If product has category_id, we'd match it.
        // For now, let's just match search.
        // IF we want to match category strictly:
        // const matchesCategory = product.category === activeCategory;
        // But the data might not have category names.
        return matchesSearch;
    });

    return (
        <section className="flex-1 overflow-y-auto p-8 bg-[#f8f7f5]">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
                {loading ? (
                    <div className="col-span-full h-96 flex flex-col items-center justify-center text-text-sub">
                        <span className="material-symbols-outlined text-4xl mb-4 animate-spin text-primary">progress_activity</span>
                        <p className="font-medium">Cargando productos...</p>
                    </div>
                ) : (
                    filteredProducts.map((product) => (
                        <div
                            key={product.id}
                            onClick={() => onAddToCart(product)}
                            className="group bg-white dark:bg-gray-800 rounded-3xl p-4 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border border-black/5 dark:border-white/5 flex flex-col h-[340px] cursor-pointer relative overflow-hidden"
                        >
                            <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden mb-4 bg-gray-100 dark:bg-gray-700">
                                <div
                                    className="absolute inset-0 bg-center bg-cover transition-transform duration-500 group-hover:scale-110"
                                    style={{ backgroundImage: `url("${product.imagen_url || 'https://via.placeholder.com/400'}")` }}
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                                {product.is_spicy && (
                                    <div className="absolute top-3 right-3 bg-red-500/90 backdrop-blur-md text-white text-[10px] font-bold px-3 py-1.5 rounded-full uppercase tracking-wider shadow-lg flex items-center gap-1">
                                        <span className="material-symbols-outlined text-[12px]">local_fire_department</span>
                                        Spicy
                                    </div>
                                )}
                                {product.is_signature && (
                                    <div className="absolute top-3 left-3 bg-primary/90 backdrop-blur-md text-white text-[10px] font-bold px-3 py-1.5 rounded-full uppercase tracking-wider shadow-lg flex items-center gap-1">
                                        <span className="material-symbols-outlined text-[12px]">star</span>
                                        Top
                                    </div>
                                )}
                            </div>

                            <div className="flex flex-col flex-1 gap-2">
                                <div className="flex justify-between items-start gap-2">
                                    <h3 className="text-text-main dark:text-white font-bold text-lg leading-tight group-hover:text-primary transition-colors line-clamp-2">
                                        {product.name}
                                    </h3>
                                    <span className="text-lg font-extrabold text-primary whitespace-nowrap bg-primary/10 px-2 py-0.5 rounded-lg">
                                        ${product.price ? product.price.toFixed(2) : '0.00'}
                                    </span>
                                </div>
                                <p className="text-text-sub dark:text-gray-400 text-sm leading-relaxed line-clamp-2">
                                    {product.description}
                                </p>
                            </div>

                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onAddToCart(product);
                                }}
                                className="mt-auto w-full bg-black/5 dark:bg-white/10 hover:bg-primary active:bg-primary/90 text-text-main dark:text-white hover:text-white py-3 rounded-xl flex items-center justify-center gap-2 transition-all font-bold group-hover:shadow-lg"
                            >
                                <span className="material-symbols-outlined text-[20px] transition-transform group-active:scale-90">add_shopping_cart</span>
                                <span className="text-sm">Agregar</span>
                            </button>
                        </div>
                    ))
                )}
            </div>
        </section>
    );
}
