'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/utils/supabase/client';

interface Banner {
    id: number;
    title: string;
    description: string | null;
    image_url: string;
    is_active: boolean;
    background_color: string | null;
    action_text: string | null;
    product_id: number | null;
    created_at: string;
}

interface Product {
    id: number;
    name: string;
}

export default function AnunciosPage() {
    const [banners, setBanners] = useState<Banner[]>([]);
    const [loading, setLoading] = useState(true);
    const [products, setProducts] = useState<Product[]>([]);
    const [showModal, setShowModal] = useState(false);
    const [editingBanner, setEditingBanner] = useState<Banner | null>(null);
    const [uploading, setUploading] = useState(false);

    // Form State
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string>('');
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        image_url: '',
        is_active: false,
        background_color: '#1D1D1F',
        action_text: 'Ver más',
        product_id: ''
    });

    useEffect(() => {
        fetchBanners();
        fetchProducts();
    }, []);

    const fetchProducts = async () => {
        const { data } = await supabase.from('products').select('id, name').order('name');
        if (data) setProducts(data);
    };

    const fetchBanners = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('banners')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setBanners(data || []);
        } catch (error) {
            console.error('Error fetching banners:', error);
            // alert('Error al cargar anuncios. Asegúrate de haber creado la tabla "banners".');
        } finally {
            setLoading(false);
        }
    };

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setImageFile(file);
            const reader = new FileReader();
            reader.onloadend = () => setImagePreview(reader.result as string);
            reader.readAsDataURL(file);
        }
    };

    const uploadImage = async (): Promise<string | null> => {
        if (!imageFile) return formData.image_url || null;

        try {
            setUploading(true);
            const formDataUpload = new FormData();
            formDataUpload.append('file', imageFile);

            const response = await fetch('/api/upload-image', {
                method: 'POST',
                body: formDataUpload,
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error);

            return data.url;
        } catch (error: any) {
            console.error('Error uploading image:', error);
            alert('Error al subir imagen: ' + error.message);
            return null;
        } finally {
            setUploading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // 1. Upload Image
        let finalImageUrl = formData.image_url;
        if (imageFile) {
            const uploadedUrl = await uploadImage();
            if (!uploadedUrl && !formData.image_url) return;
            finalImageUrl = uploadedUrl || finalImageUrl;
        }

        if (!finalImageUrl) {
            alert('Por favor selecciona una imagen para el banner.');
            return;
        }

        const bannerData = {
            title: formData.title,
            description: formData.description || null,
            image_url: finalImageUrl,
            is_active: formData.is_active,
            background_color: formData.background_color,
            action_text: formData.action_text || 'Ver más',
            product_id: formData.product_id ? parseInt(formData.product_id) : null
        };

        try {
            if (formData.is_active) {
                // Deactivate others if this one is active (Single banner policy)
                await supabase.from('banners').update({ is_active: false }).neq('id', 0);
                // The above might fail if RLS prevents massive updates, but we'll see. 
                // Ideally this should be handled in a transaction or API, but Supabase client works too.
            }

            if (editingBanner) {
                const { error } = await supabase
                    .from('banners')
                    .update(bannerData)
                    .eq('id', editingBanner.id);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('banners')
                    .insert([bannerData]);
                if (error) throw error;
            }

            closeModal();
            fetchBanners();
        } catch (error: any) {
            console.error('Error saving banner:', error);
            alert('Error al guardar el anuncio: ' + error.message);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('¿Eliminar este anuncio?')) return;
        try {
            const { error } = await supabase.from('banners').delete().eq('id', id);
            if (error) throw error;
            fetchBanners();
        } catch (error: any) {
            alert('Error: ' + error.message);
        }
    };

    const toggleActive = async (banner: Banner) => {
        try {
            // If activating, deactivate all others first in UI optimism
            if (!banner.is_active) {
                await supabase.from('banners').update({ is_active: false }).neq('id', banner.id);
            }

            const { error } = await supabase
                .from('banners')
                .update({ is_active: !banner.is_active })
                .eq('id', banner.id);

            if (error) throw error;
            fetchBanners();
        } catch (error) {
            console.error(error);
        }
    };

    const openModal = (banner?: Banner) => {
        if (banner) {
            setEditingBanner(banner);
            setFormData({
                title: banner.title,
                description: banner.description || '',
                image_url: banner.image_url,
                is_active: banner.is_active,
                background_color: banner.background_color || '#1D1D1F',
                action_text: banner.action_text || 'Ver más',
                product_id: banner.product_id ? banner.product_id.toString() : ''
            });
            setImagePreview(banner.image_url);
        } else {
            setEditingBanner(null);
            setFormData({
                title: '',
                description: '',
                image_url: '',
                is_active: true, // Default active for new ones usually
                background_color: '#1D1D1F',
                action_text: 'Ver más',
                product_id: ''
            });
            setImagePreview('');
        }
        setImageFile(null);
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        setEditingBanner(null);
    };

    return (
        <main className="flex-1 overflow-y-auto p-8 bg-[#f8f7f5]">
            <div className="max-w-6xl mx-auto flex flex-col gap-8">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-[#181511]">Anuncios & Banners</h1>
                        <p className="text-[#8c785f] mt-1">Configura el banner principal de la tienda</p>
                    </div>
                    <button
                        onClick={() => openModal()}
                        className="flex items-center gap-2 bg-[#f7951d] hover:bg-[#e08518] text-white px-6 py-3 rounded-xl font-bold transition-colors shadow-lg shadow-orange-500/20"
                    >
                        <span className="material-symbols-outlined">add_photo_alternate</span>
                        Nuevo Anuncio
                    </button>
                </div>

                {/* List */}
                {loading ? (
                    <div className="flex justify-center p-12"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-500"></div></div>
                ) : banners.length === 0 ? (
                    <div className="bg-white rounded-3xl p-12 text-center border border-gray-100 shadow-sm">
                        <span className="material-symbols-outlined text-6xl text-gray-200 mb-4">campaign</span>
                        <h3 className="text-xl font-bold text-gray-800">No hay anuncios creados</h3>
                        <p className="text-gray-400">Crea el primero para destacar productos en la tienda.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-6">
                        {banners.map((banner) => (
                            <div key={banner.id} className={`bg-white rounded-2xl overflow-hidden border-2 transition-all flex flex-col md:flex-row ${banner.is_active ? 'border-[#f7951d] shadow-xl ring-4 ring-[#f7951d]/10' : 'border-gray-100 grayscale-[0.5] hover:grayscale-0'}`}>
                                {/* Image Preview */}
                                <div className="md:w-1/3 aspect-video bg-gray-100 relative group overflow-hidden">
                                    <img src={banner.image_url} alt={banner.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                                    <div className="absolute inset-0 bg-black/10"></div>
                                    <div className={`absolute top-2 right-2 px-3 py-1 rounded-full text-xs font-black uppercase ${banner.is_active ? 'bg-green-500 text-white shadow-lg' : 'bg-gray-500 text-white'}`}>
                                        {banner.is_active ? 'ACTIVO' : 'INACTIVO'}
                                    </div>
                                </div>

                                {/* Content */}
                                <div className="flex-1 p-6 flex flex-col justify-center">
                                    <h3 className="text-2xl font-black text-[#181511] mb-2">{banner.title}</h3>
                                    <p className="text-[#8c785f] mb-4 line-clamp-2">{banner.description}</p>

                                    <div className="flex items-center gap-4 mt-auto">
                                        <button
                                            onClick={() => toggleActive(banner)}
                                            className={`px-4 py-2 rounded-lg text-sm font-bold border-2 transition-all ${banner.is_active ? 'border-red-100 text-red-500 hover:bg-red-50' : 'border-green-100 text-green-600 hover:bg-green-50'}`}
                                        >
                                            {banner.is_active ? 'Desactivar' : 'Activar Banner'}
                                        </button>
                                        <div className="flex-1"></div>
                                        <button onClick={() => openModal(banner)} className="p-2 text-gray-400 hover:text-blue-500"><span className="material-symbols-outlined">edit</span></button>
                                        <button onClick={() => handleDelete(banner.id)} className="p-2 text-gray-400 hover:text-red-500"><span className="material-symbols-outlined">delete</span></button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <form onSubmit={handleSubmit} className="bg-white rounded-3xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b flex justify-between items-center bg-gray-50">
                            <h3 className="font-bold text-lg">{editingBanner ? 'Editar Anuncio' : 'Nuevo Anuncio'}</h3>
                            <button type="button" onClick={closeModal}><span className="material-symbols-outlined">close</span></button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            {/* Image Upload Area */}
                            <div>
                                <label className="block text-xs font-bold uppercase text-gray-400 mb-2">Imagen del Banner</label>
                                <label className="relative block w-full aspect-video rounded-xl border-2 border-dashed border-gray-300 hover:border-[#f7951d] bg-gray-50 cursor-pointer overflow-hidden group transition-colors">
                                    {imagePreview || formData.image_url ? (
                                        <img src={imagePreview || formData.image_url} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
                                            <span className="material-symbols-outlined text-4xl mb-2">add_photo_alternate</span>
                                            <span className="text-sm font-bold">Subir Imagen</span>
                                        </div>
                                    )}
                                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <span className="bg-white px-4 py-2 rounded-full font-bold text-sm shadow-lg">Cambiar Imagen</span>
                                    </div>
                                    <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                                </label>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold uppercase text-gray-400 mb-1">Título Principal</label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.title}
                                        onChange={e => setFormData({ ...formData, title: e.target.value })}
                                        className="w-full px-4 py-3 rounded-xl bg-gray-50 border-none font-bold text-lg focus:ring-2 focus:ring-[#f7951d] outline-none"
                                        placeholder="Ej: ¡Pizza Suprema 2x1!"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold uppercase text-gray-400 mb-1">Descripción corta</label>
                                    <textarea
                                        rows={3}
                                        value={formData.description}
                                        onChange={e => setFormData({ ...formData, description: e.target.value })}
                                        className="w-full px-4 py-3 rounded-xl bg-gray-50 border-none font-medium text-sm focus:ring-2 focus:ring-[#f7951d] outline-none resize-none"
                                        placeholder="Ej: Solo por tiempo limitado en todas nuestras sucursales..."
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold uppercase text-gray-400 mb-1">Color de Fondo</label>
                                        <div className="flex items-center gap-2 h-12 bg-gray-50 rounded-xl px-2">
                                            <input
                                                type="color"
                                                value={formData.background_color}
                                                onChange={e => setFormData({ ...formData, background_color: e.target.value })}
                                                className="w-8 h-8 rounded-full border-none cursor-pointer"
                                            />
                                            <span className="text-xs font-mono text-gray-500">{formData.background_color}</span>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold uppercase text-gray-400 mb-1">Texto Botón</label>
                                        <input
                                            type="text"
                                            value={formData.action_text}
                                            onChange={e => setFormData({ ...formData, action_text: e.target.value })}
                                            className="w-full px-4 py-3 rounded-xl bg-gray-50 border-none font-bold text-sm focus:ring-2 focus:ring-[#f7951d] outline-none"
                                            placeholder="Ver más"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold uppercase text-gray-400 mb-1">Vincular a Producto (Opcional)</label>
                                    <div className="relative">
                                        <select
                                            value={formData.product_id}
                                            onChange={e => setFormData({ ...formData, product_id: e.target.value })}
                                            className="w-full px-4 py-3 rounded-xl bg-gray-50 border-none font-medium text-sm focus:ring-2 focus:ring-[#f7951d] outline-none appearance-none cursor-pointer"
                                        >
                                            <option value="">-- Ningún producto seleccionado --</option>
                                            {products.map(p => (
                                                <option key={p.id} value={p.id}>{p.name}</option>
                                            ))}
                                        </select>
                                        <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">expand_more</span>
                                    </div>
                                    <p className="text-[10px] text-gray-400 mt-1">Si seleccionas un producto, al hacer clic en el banner en la Caja, se abrirá ese producto.</p>
                                </div>

                                <div className="flex items-center gap-3 p-4 rounded-xl bg-orange-50 border border-orange-100">
                                    <input
                                        type="checkbox"
                                        id="activeCheck"
                                        checked={formData.is_active}
                                        onChange={e => setFormData({ ...formData, is_active: e.target.checked })}
                                        className="w-5 h-5 text-[#f7951d] rounded focus:ring-[#f7951d]"
                                    />
                                    <label htmlFor="activeCheck" className="text-sm font-bold text-[#f7951d] cursor-pointer selection:bg-none">Activar este anuncio inmediatamente</label>
                                </div>
                            </div>
                        </div>

                        <div className="p-6 border-t bg-gray-50 flex justify-end gap-3">
                            <button type="button" onClick={closeModal} className="px-6 py-3 rounded-xl font-bold text-gray-500 hover:bg-gray-200">Cancelar</button>
                            <button
                                type="submit"
                                disabled={uploading}
                                className="px-8 py-3 rounded-xl font-bold text-white bg-[#f7951d] hover:bg-[#d98219] shadow-lg disabled:opacity-50"
                            >
                                {uploading ? 'Subiendo...' : 'Guardar Anuncio'}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </main>
    );
}
