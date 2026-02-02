'use client';

import { useEffect, useState } from 'react';
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
    created_at: string;
    categories?: {
        name: string;
    } | { name: string }[];
}

export default function ProductsPage() {
    const [products, setProducts] = useState<Product[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [uploading, setUploading] = useState(false);
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string>('');
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        price: '',
        category_id: '',
        imagen_url: '',
        available: true,
    });

    useEffect(() => {
        fetchProducts();
        fetchCategories();
    }, []);

    const [error, setError] = useState<string | null>(null);

    const fetchProducts = async () => {
        try {
            setError(null);
            const response = await fetch('/api/products');
            const data = await response.json();

            if (!response.ok) throw new Error(data.error);
            setProducts(data.products || []);
        } catch (error: any) {
            console.error('Error fetching products:', error);
            setError('No se pudieron cargar los productos. Asegúrate de ejecutar el script SQL para crear las tablas.');
        } finally {
            setLoading(false);
        }
    };

    const fetchCategories = async () => {
        try {
            console.log('🔄 [FRONTEND] Fetching categories...');
            const { data, error } = await supabase
                .from('categories')
                .select('*')
                .order('name');

            if (error) {
                console.error('❌ [FRONTEND] Error fetching categories:', error);
                throw error;
            }

            console.log('✅ [FRONTEND] Categories fetched:', data);
            setCategories(data || []);
        } catch (error) {
            console.error('Error fetching categories:', error);
        }
    };

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setImageFile(file);
            // Create preview
            const reader = new FileReader();
            reader.onloadend = () => {
                setImagePreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const uploadImage = async (): Promise<string | null> => {
        if (!imageFile) {
            console.log('⚠️ [FRONTEND] No image file selected');
            return formData.imagen_url || null;
        }

        try {
            setUploading(true);
            console.log('🚀 [FRONTEND] Starting upload process...');
            console.log('📁 [FRONTEND] File details:', {
                name: imageFile.name,
                type: imageFile.type,
                size: `${(imageFile.size / 1024).toFixed(2)} KB`
            });

            // Create FormData
            const formData = new FormData();
            formData.append('file', imageFile);

            console.log('📡 [FRONTEND] Sending request to /api/upload-image');

            // Call API
            const response = await fetch('/api/upload-image', {
                method: 'POST',
                body: formData,
            });

            const data = await response.json();

            if (!response.ok) {
                console.error('❌ [FRONTEND] Upload failed:', data.error);
                throw new Error(data.error || 'Upload failed');
            }

            console.log('✅ [FRONTEND] Upload successful!');
            console.log('🔗 [FRONTEND] Image URL:', data.url);

            return data.url;
        } catch (error) {
            console.error('💥 [FRONTEND] Upload error:', error);
            alert('Error al subir la imagen: ' + (error as Error).message);
            return null;
        } finally {
            setUploading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Upload image first if there's a new file
        let imageUrl = formData.imagen_url;
        if (imageFile) {
            const uploadedUrl = await uploadImage();
            if (!uploadedUrl && !formData.imagen_url) {
                return; // Stop if upload failed and no existing URL
            }
            imageUrl = uploadedUrl || imageUrl;
        }

        const productData = {
            name: formData.name,
            description: formData.description || null,
            price: parseFloat(formData.price),
            category_id: formData.category_id ? parseInt(formData.category_id) : null,
            imagen_url: imageUrl,
            available: formData.available,
        };

        try {
            if (editingProduct) {
                // Update existing product
                const response = await fetch('/api/products', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: editingProduct.id, ...productData }),
                });

                const data = await response.json();
                if (!response.ok) throw new Error(data.error);
            } else {
                // Create new product
                const response = await fetch('/api/products', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(productData),
                });

                const data = await response.json();
                if (!response.ok) throw new Error(data.error);
            }

            // Refresh products list
            fetchProducts();
            closeModal();
        } catch (error: any) {
            console.error('Error saving product:', error);
            const errorMessage = error.message || 'Error al guardar el producto';
            alert('Error al guardar el producto: ' + errorMessage);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('¿Estás seguro de eliminar este producto?')) return;

        try {
            const response = await fetch(`/api/products?id=${id}`, {
                method: 'DELETE',
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error);

            fetchProducts();
        } catch (error) {
            console.error('Error deleting product:', error);
            alert('Error al eliminar el producto');
        }
    };

    const toggleAvailability = async (product: Product) => {
        try {
            const response = await fetch('/api/products', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: product.id,
                    available: !product.available
                }),
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error);

            fetchProducts();
        } catch (error) {
            console.error('Error updating availability:', error);
        }
    };

    const openModal = (product?: Product) => {
        if (product) {
            setEditingProduct(product);
            setFormData({
                name: product.name,
                description: product.description || '',
                price: product.price.toString(),
                category_id: product.category_id?.toString() || '',
                imagen_url: product.imagen_url || '',
                available: product.available,
            });
            setImagePreview(product.imagen_url || '');
        } else {
            setEditingProduct(null);
            setFormData({
                name: '',
                description: '',
                price: '',
                category_id: '',
                imagen_url: '',
                available: true,
            });
            setImagePreview('');
        }
        setImageFile(null);
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        setEditingProduct(null);
        setImageFile(null);
        setImagePreview('');
        setFormData({
            name: '',
            description: '',
            price: '',
            category_id: '',
            imagen_url: '',
            available: true,
        });
    };

    const getCategoryName = (product: Product) => {
        if (!product.categories) return '';
        if (Array.isArray(product.categories)) {
            return product.categories[0]?.name || '';
        }
        return product.categories.name || '';
    };

    return (
        <>
            <main className="flex-1 overflow-y-auto p-8">
                <div className="max-w-[1400px] mx-auto flex flex-col gap-8">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-3xl font-bold text-[#181511]">Productos</h1>
                            <p className="text-[#8c785f] mt-1">Gestiona el menú de productos</p>
                        </div>
                        <button
                            onClick={() => openModal()}
                            className="flex items-center gap-2 bg-black hover:bg-gray-800 text-white px-6 py-3 rounded-xl font-semibold transition-colors shadow-lg"
                        >
                            <span className="material-symbols-outlined">add</span>
                            Nuevo Producto
                        </button>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="bg-white rounded-xl p-6 border border-[#e6e1db]">
                            <div className="flex items-center gap-3">
                                <div className="bg-blue-50 p-3 rounded-lg">
                                    <span className="material-symbols-outlined text-blue-600">inventory_2</span>
                                </div>
                                <div>
                                    <p className="text-sm text-[#8c785f]">Total Productos</p>
                                    <p className="text-2xl font-bold text-[#181511]">{products.length}</p>
                                </div>
                            </div>
                        </div>
                        <div className="bg-white rounded-xl p-6 border border-[#e6e1db]">
                            <div className="flex items-center gap-3">
                                <div className="bg-green-50 p-3 rounded-lg">
                                    <span className="material-symbols-outlined text-green-600">check_circle</span>
                                </div>
                                <div>
                                    <p className="text-sm text-[#8c785f]">Disponibles</p>
                                    <p className="text-2xl font-bold text-[#181511]">
                                        {products.filter(p => p.available).length}
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div className="bg-white rounded-xl p-6 border border-[#e6e1db]">
                            <div className="flex items-center gap-3">
                                <div className="bg-red-50 p-3 rounded-lg">
                                    <span className="material-symbols-outlined text-red-600">cancel</span>
                                </div>
                                <div>
                                    <p className="text-sm text-[#8c785f]">No Disponibles</p>
                                    <p className="text-2xl font-bold text-[#181511]">
                                        {products.filter(p => !p.available).length}
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div className="bg-white rounded-xl p-6 border border-[#e6e1db]">
                            <div className="flex items-center gap-3">
                                <div className="bg-purple-50 p-3 rounded-lg">
                                    <span className="material-symbols-outlined text-purple-600">category</span>
                                </div>
                                <div>
                                    <p className="text-sm text-[#8c785f]">Categorías</p>
                                    <p className="text-2xl font-bold text-[#181511]">{categories.length}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Products Grid */}
                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <span className="material-symbols-outlined animate-spin text-4xl text-primary">
                                progress_activity
                            </span>
                        </div>
                    ) : error ? (
                        <div className="bg-red-50 border border-red-200 rounded-xl p-12 text-center">
                            <span className="material-symbols-outlined text-6xl text-red-400 mb-4">
                                database
                            </span>
                            <h3 className="text-xl font-bold text-red-800 mb-2">Error de Configuración</h3>
                            <p className="text-red-600 mb-6 max-w-md mx-auto">{error}</p>
                            <div className="bg-white p-4 rounded-lg border border-red-100 max-w-lg mx-auto text-left">
                                <p className="text-xs font-bold text-gray-500 uppercase mb-2">Solución:</p>
                                <p className="text-sm text-gray-700 mb-2">Ejecuta el script de configuración en Supabase:</p>
                                <code className="block bg-gray-50 p-2 rounded text-xs overflow-x-auto">
                                    utils/create-menu-tables.sql
                                </code>
                            </div>
                        </div>
                    ) : products.length === 0 ? (
                        <div className="bg-white rounded-xl p-12 text-center">
                            <span className="material-symbols-outlined text-6xl text-[#8c785f] mb-4">
                                restaurant_menu
                            </span>
                            <h3 className="text-xl font-bold text-[#181511] mb-2">No hay productos</h3>
                            <p className="text-[#8c785f] mb-6">Comienza agregando tu primer producto</p>
                            <button
                                onClick={() => openModal()}
                                className="bg-primary hover:bg-primary-hover text-white px-6 py-3 rounded-lg font-semibold transition-colors"
                            >
                                Crear Producto
                            </button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                            {products.map((product) => (
                                <div
                                    key={product.id}
                                    className="bg-white rounded-2xl overflow-hidden border-2 border-gray-100 hover:border-primary hover:shadow-2xl transition-all duration-300 cursor-pointer group"
                                    onClick={() => {
                                        setSelectedProduct(product);
                                        setShowDetailModal(true);
                                    }}
                                >
                                    {/* Product Image */}
                                    <div className="relative h-56 bg-gradient-to-br from-orange-50 to-yellow-50 overflow-hidden">
                                        {product.imagen_url ? (
                                            <img
                                                src={product.imagen_url}
                                                alt={product.name}
                                                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center">
                                                <span className="material-symbols-outlined text-7xl text-primary/40">
                                                    restaurant
                                                </span>
                                            </div>
                                        )}
                                        {/* Availability badge */}
                                        <div
                                            className="absolute top-3 right-3"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                toggleAvailability(product);
                                            }}
                                        >
                                            <button
                                                className={`px-4 py-1.5 rounded-full text-xs font-bold shadow-lg ${product.available
                                                    ? 'bg-green-500 text-white'
                                                    : 'bg-red-500 text-white'
                                                    }`}
                                            >
                                                {product.available ? '✓ Disponible' : '✕ Agotado'}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Product Info */}
                                    <div className="p-5">
                                        <div className="mb-3">
                                            <h3 className="font-bold text-xl text-[#181511] mb-2 line-clamp-1 group-hover:text-primary transition-colors">
                                                {product.name}
                                            </h3>
                                            {product.categories && (
                                                <span className="inline-block px-3 py-1 bg-primary/10 text-primary text-xs font-semibold rounded-full">
                                                    {getCategoryName(product)}
                                                </span>
                                            )}
                                        </div>
                                        {product.description && (
                                            <p className="text-sm text-[#8c785f] mb-4 line-clamp-2 h-10">
                                                {product.description}
                                            </p>
                                        )}
                                        <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                                            <span className="text-3xl font-bold text-primary">
                                                ${parseFloat(product.price.toString()).toFixed(2)}
                                            </span>
                                            <span className="material-symbols-outlined text-gray-400 group-hover:text-primary transition-colors">
                                                arrow_forward
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </main>

            {/* Create/Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="w-full max-w-2xl bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-5 border-b border-primary/20 bg-primary">
                            <h2 className="text-xl font-bold text-white tracking-tight">
                                {editingProduct ? 'Editar Producto' : 'Agregar Nuevo Producto'}
                            </h2>
                            <button
                                onClick={closeModal}
                                type="button"
                                className="text-white/80 hover:text-white transition-colors rounded-lg p-1 hover:bg-white/10"
                            >
                                <span className="material-symbols-outlined text-[24px]">close</span>
                            </button>
                        </div>

                        {/* Content */}
                        <form onSubmit={handleSubmit} className="flex flex-col overflow-hidden h-full">
                            <div className="p-6 md:p-8 overflow-y-auto flex-1">
                                <div className="flex flex-col md:flex-row gap-8">
                                    {/* Left: Image Upload */}
                                    <div className="w-full md:w-5/12">
                                        <label className="block text-sm font-bold text-[#181511] mb-2.5">
                                            Imagen del Producto
                                        </label>
                                        {(imagePreview || formData.imagen_url) ? (
                                            <div className="relative w-full aspect-square md:aspect-[4/5] rounded-xl overflow-hidden group">
                                                <img
                                                    src={imagePreview || formData.imagen_url}
                                                    alt="Preview"
                                                    className="w-full h-full object-cover"
                                                    onError={(e) => {
                                                        (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect fill="%23f5f2f0"/><text x="50%" y="50%" fill="%238c785f" text-anchor="middle" dy=".3em" font-family="sans-serif">Sin imagen</text></svg>';
                                                    }}
                                                />
                                                {imageFile && (
                                                    <div className="absolute top-3 right-3 bg-primary text-white text-xs px-3 py-1 rounded-full font-semibold shadow-md">
                                                        Nueva
                                                    </div>
                                                )}
                                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                    <label className="cursor-pointer bg-white rounded-full p-3 shadow-lg hover:scale-110 transition-transform">
                                                        <span className="material-symbols-outlined text-primary">edit</span>
                                                        <input
                                                            type="file"
                                                            accept="image/*"
                                                            onChange={handleImageChange}
                                                            className="hidden"
                                                        />
                                                    </label>
                                                </div>
                                            </div>
                                        ) : (
                                            <label className="relative w-full aspect-square md:aspect-[4/5] rounded-xl border-2 border-dashed border-[#e6e1db] bg-[#f8f7f5] hover:bg-[#f0ece9] transition-all cursor-pointer flex flex-col items-center justify-center p-4 group text-center">
                                                <div className="size-12 rounded-full bg-white shadow-sm flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                                                    <span className="material-symbols-outlined text-primary text-[24px]">cloud_upload</span>
                                                </div>
                                                <p className="text-sm font-bold text-[#181511]">Click para subir</p>
                                                <p className="text-xs text-[#8c785f] mt-1">SVG, PNG, JPG (máx 2MB)</p>
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    onChange={handleImageChange}
                                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                                />
                                            </label>
                                        )}
                                    </div>

                                    {/* Right: Form Fields */}
                                    <div className="w-full md:w-7/12 flex flex-col gap-5">
                                        <div className="flex flex-col gap-1.5">
                                            <label className="text-sm font-bold text-[#181511]">
                                                Nombre del Producto
                                            </label>
                                            <input
                                                type="text"
                                                value={formData.name}
                                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                                className="h-11 w-full rounded-lg bg-transparent border border-[#e6e1db] px-4 text-sm font-medium text-[#181511] placeholder-[#8c785f]/60 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                                                placeholder="Ej: Pizza Suprema"
                                                required
                                            />
                                        </div>

                                        <div className="flex flex-col gap-1.5">
                                            <label className="text-sm font-bold text-[#181511]">Categoría</label>
                                            <div className="relative">
                                                <select
                                                    value={formData.category_id}
                                                    onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                                                    className="h-11 w-full appearance-none rounded-lg bg-transparent border border-[#e6e1db] px-4 text-sm font-medium text-[#181511] focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all cursor-pointer"
                                                >
                                                    <option value="">Seleccionar categoría</option>
                                                    {categories.map((category) => (
                                                        <option key={category.id} value={category.id}>
                                                            {category.name}
                                                        </option>
                                                    ))}
                                                </select>
                                                <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-[#8c785f] pointer-events-none text-[20px]">
                                                    expand_more
                                                </span>
                                            </div>
                                        </div>

                                        <div className="flex flex-col gap-1.5">
                                            <label className="text-sm font-bold text-[#181511]">Precio</label>
                                            <div className="relative">
                                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8c785f] font-bold text-sm">
                                                    $
                                                </span>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    value={formData.price}
                                                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                                                    className="h-11 w-full rounded-lg bg-transparent border border-[#e6e1db] pl-8 pr-4 text-sm font-medium text-[#181511] placeholder-[#8c785f]/60 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                                                    placeholder="0.00"
                                                    required
                                                />
                                            </div>
                                        </div>

                                        <div className="flex flex-col gap-1.5 grow">
                                            <label className="text-sm font-bold text-[#181511]">Descripción</label>
                                            <textarea
                                                value={formData.description}
                                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                                className="w-full rounded-lg bg-transparent border border-[#e6e1db] p-4 text-sm font-medium text-[#181511] placeholder-[#8c785f]/60 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all resize-none min-h-[100px]"
                                                placeholder="Ingresa ingredientes y detalles..."
                                            />
                                        </div>

                                        <div className="flex items-center gap-3 pt-2">
                                            <input
                                                type="checkbox"
                                                id="available"
                                                checked={formData.available}
                                                onChange={(e) => setFormData({ ...formData, available: e.target.checked })}
                                                className="w-5 h-5 text-primary border-[#e6e1db] rounded focus:ring-primary cursor-pointer"
                                            />
                                            <label htmlFor="available" className="text-sm font-medium text-[#181511] cursor-pointer">
                                                Producto disponible
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="px-6 py-5 border-t border-[#e6e1db] bg-[#fcfbf9] flex justify-end gap-3 mt-auto">
                                <button
                                    type="button"
                                    onClick={closeModal}
                                    disabled={uploading}
                                    className="h-11 px-6 rounded-lg border border-[#e6e1db] font-bold text-sm text-[#8c785f] hover:bg-white hover:text-[#181511] transition-all shadow-sm"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={uploading}
                                    className="h-11 px-6  bg-[#f7951d] rounded-lg bg-primary hover:bg-primary/90 text-white font-bold text-sm shadow-md transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {uploading ? (
                                        <>
                                            <span className=" bg-[#f7951d] material-symbols-outlined animate-spin text-[20px]">progress_activity</span>
                                            Subiendo...
                                        </>
                                    ) : (
                                        <>
                                            {editingProduct ? 'Guardar Producto' : 'Guardar Producto'}
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Product Detail Modal */}
            {showDetailModal && selectedProduct && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden animate-fadeIn">
                        {/* Close Button */}
                        <button
                            onClick={() => {
                                setShowDetailModal(false);
                                setSelectedProduct(null);
                            }}
                            className="absolute top-4 right-4 z-10 bg-white/90 hover:bg-white p-2 rounded-full shadow-lg transition-all"
                        >
                            <span className="material-symbols-outlined text-gray-600">close</span>
                        </button>

                        <div className="grid md:grid-cols-2 gap-0">
                            {/* Left: Image */}
                            <div className="relative h-96 md:h-full bg-gradient-to-br from-orange-50 to-yellow-50">
                                {selectedProduct.imagen_url ? (
                                    <img
                                        src={selectedProduct.imagen_url}
                                        alt={selectedProduct.name}
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                        <span className="material-symbols-outlined text-9xl text-primary/30">
                                            restaurant
                                        </span>
                                    </div>
                                )}
                                {/* Availability Badge */}
                                <div className="absolute top-4 left-4">
                                    <span
                                        className={`px-4 py-2 rounded-full text-sm font-bold shadow-lg ${selectedProduct.available
                                            ? 'bg-green-500 text-white'
                                            : 'bg-red-500 text-white'
                                            }`}
                                    >
                                        {selectedProduct.available ? '✓ Disponible' : '✕ Agotado'}
                                    </span>
                                </div>
                            </div>

                            {/* Right: Details */}
                            <div className="p-8 flex flex-col">
                                <div className="flex-1">
                                    {/* Category */}
                                    {selectedProduct.categories && (
                                        <span className="inline-block px-4 py-1.5 bg-primary/10 text-primary text-sm font-semibold rounded-full mb-4">
                                            {getCategoryName(selectedProduct)}
                                        </span>
                                    )}

                                    {/* Title */}
                                    <h2 className="text-4xl font-bold text-[#181511] mb-4">
                                        {selectedProduct.name}
                                    </h2>

                                    {/* Price */}
                                    <div className="text-5xl font-bold text-primary mb-6">
                                        ${parseFloat(selectedProduct.price.toString()).toFixed(2)}
                                    </div>

                                    {/* Description */}
                                    {selectedProduct.description && (
                                        <div className="mb-6">
                                            <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Descripción</h3>
                                            <p className="text-lg text-gray-700 leading-relaxed">
                                                {selectedProduct.description}
                                            </p>
                                        </div>
                                    )}

                                    {/* Additional Info */}
                                    <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-xl mb-6">
                                        <div>
                                            <p className="text-xs text-gray-500 mb-1">ID del Producto</p>
                                            <p className="font-semibold text-gray-700">#{selectedProduct.id}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-500 mb-1">Estado</p>
                                            <p className={`font-semibold ${selectedProduct.available ? 'text-green-600' : 'text-red-600'}`}>
                                                {selectedProduct.available ? 'En stock' : 'Sin stock'}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Action Buttons */}
                                <div className="flex gap-3 pt-6 border-t border-gray-200">
                                    <button
                                        onClick={() => {
                                            setShowDetailModal(false);
                                            openModal(selectedProduct);
                                        }}
                                        className="flex-1 flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-6 py-4 rounded-xl font-semibold transition-all shadow-lg hover:shadow-xl"
                                    >
                                        <span className="material-symbols-outlined">edit</span>
                                        Editar Producto
                                    </button>
                                    <button
                                        onClick={() => {
                                            if (confirm('¿Estás seguro de eliminar este producto?')) {
                                                handleDelete(selectedProduct.id);
                                                setShowDetailModal(false);
                                            }
                                        }}
                                        className="flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 text-white px-6 py-4 rounded-xl font-semibold transition-all shadow-lg hover:shadow-xl"
                                    >
                                        <span className="material-symbols-outlined">delete</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
