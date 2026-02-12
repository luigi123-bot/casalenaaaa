'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/utils/supabase/client';

export default function AdminUsersPage() {
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'users' | 'customers' | 'roles'>('users');
    const [editingUserId, setEditingUserId] = useState<string | null>(null);
    const [activeActionId, setActiveActionId] = useState<string | null>(null);

    // Customer State
    const [customers, setCustomers] = useState<any[]>([]);
    const [loadingCustomers, setLoadingCustomers] = useState(false);
    const [showCustomerModal, setShowCustomerModal] = useState(false);
    const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null);
    const [editingCustomerType, setEditingCustomerType] = useState<string | null>(null); // New state for type
    const [customerFormData, setCustomerFormData] = useState({
        full_name: '',
        phone: '',
        address: ''
    });

    const [showModal, setShowModal] = useState(false);
    const [creating, setCreating] = useState(false);
    const [formData, setFormData] = useState({
        fullName: '',
        email: '',
        password: '',
        role: 'cliente',
        isActive: true
    });

    // Toast notification state
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

    const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 4000);
    };

    const fetchUsers = async () => {
        setLoading(true);
        try {
            // Use the secure API route instead of direct Client DB call to bypass RLS issues
            const response = await fetch('/api/users');
            if (!response.ok) throw new Error('Failed to fetch users');

            const data = await response.json();
            setUsers(data || []);
        } catch (error: any) {
            console.error('Error fetching users:', error);
            // Fallback just in case api fails? No, better to show error or empty than partial RLS data
            setUsers([]);
        } finally {
            setLoading(false);
        }
    };

    const fetchCustomers = async () => {
        setLoadingCustomers(true);
        try {
            // 1. Customers Table (Ocasionales)
            const { data: customersData } = await supabase
                .from('customers')
                .select('*')
                .order('created_at', { ascending: false });

            // 2. Profiles Table (Clientes Registrados)
            let profilesData: any[] = [];
            try {
                const { data } = await supabase
                    .from('profiles')
                    .select('*')
                    .in('role', ['cliente', 'CLIENTE', 'Cliente']);
                if (data) profilesData = data;
            } catch (e) { console.warn(e); }

            // 3. Usuarios Table (Legacy)
            let usuariosData: any[] = [];
            try {
                const { data } = await supabase
                    .from('usuarios')
                    .select('*')
                    .in('role', ['cliente', 'CLIENTE', 'Cliente']);

                if (data) {
                    const existingIds = new Set(profilesData.map(p => p.id));
                    usuariosData = data.filter(u => !existingIds.has(u.id));
                }
            } catch (e) { console.warn(e); }

            // Combine
            const combined = [
                ...(customersData || []).map(c => ({
                    ...c,
                    type: 'customer',
                    phone: c.phone || c.phone_number || c.telefono || '',
                    address: c.address || c.direccion || ''
                })),
                ...profilesData.map(p => {
                    return {
                        id: p.id,
                        full_name: p.full_name || p.nombre || 'Usuario App',
                        phone: p.phone || p.phone_number || p.phoneNumber || p.telefono || p.celular || '',
                        address: p.address || p.direccion || p.location || '',
                        type: 'profile'
                    };
                }),
                ...usuariosData.map(u => ({
                    id: u.id,
                    full_name: u.full_name || u.email || 'Usuario Legado',
                    phone: u.phone || u.phone_number || u.telefono || '',
                    address: u.address || u.direccion || '',
                    type: 'legacy'
                }))
            ].sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''));

            setCustomers(combined);
        } catch (error: any) {
            console.error('Error fetching customers:', error);
        } finally {
            setLoadingCustomers(false);
        }
    };

    const [roles, setRoles] = useState<any[]>([]);
    const fetchRoles = async () => {
        try {
            const { data, error } = await supabase.from('roles').select('*').order('name');
            if (error) throw error;
            setRoles(data || []);
        } catch (error: any) {
            console.error('Error fetching roles:', error);
        }
    };

    useEffect(() => {
        fetchUsers();
        fetchRoles();
    }, []);

    useEffect(() => {
        if (activeTab === 'customers') fetchCustomers();
    }, [activeTab]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleCustomerSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setCreating(true);
        try {
            if (editingCustomerId) {
                if (editingCustomerType === 'customer') {
                    // Update 'customers' table (Occasional)
                    const { error } = await supabase.from('customers').update({
                        full_name: customerFormData.full_name,
                        phone: customerFormData.phone,
                        address: customerFormData.address
                    }).eq('id', editingCustomerId);
                    if (error) throw error;
                } else {
                    // Update 'profiles' table (App User)
                    const { error } = await supabase.from('profiles').update({
                        full_name: customerFormData.full_name,
                        phone_number: customerFormData.phone, // Map phone -> phone_number
                        address: customerFormData.address
                    }).eq('id', editingCustomerId);
                    if (error) throw error;
                }
                alert('Cliente actualizado');
            } else {
                // Create new (Default to 'customers' table for now)
                const { error } = await supabase.from('customers').insert([{
                    full_name: customerFormData.full_name,
                    phone: customerFormData.phone,
                    address: customerFormData.address
                }]);
                if (error) throw error;
                alert('Cliente guardado');
            }
            setShowCustomerModal(false);
            setEditingCustomerId(null);
            setEditingCustomerType(null); // Reset type
            setCustomerFormData({ full_name: '', phone: '', address: '' });
            fetchCustomers();
        } catch (error: any) {
            alert('Error: ' + error.message);
        } finally {
            setCreating(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setCreating(true);
        try {
            let response;
            if (editingUserId) {
                response = await fetch('/api/users', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        id: editingUserId,
                        fullName: formData.fullName,
                        email: formData.email,
                        password: formData.password || undefined,
                        role: formData.role
                    }),
                });
            } else {
                response = await fetch('/api/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(formData),
                });
            }
            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Error al procesar');
            }
            showToast(editingUserId ? '✅ Usuario actualizado correctamente' : '✅ Usuario creado exitosamente', 'success');
            setShowModal(false);
            setEditingUserId(null);
            setFormData({ fullName: '', email: '', password: '', role: 'cliente', isActive: true });
            fetchUsers();
        } catch (error: any) {
            showToast('❌ ' + error.message, 'error');
        } finally {
            setCreating(false);
        }
    };

    const handleDelete = async (userId: string) => {
        if (!confirm('¿Eliminar usuario permanentemente?')) return;
        try {
            const response = await fetch(`/api/users?id=${userId}`, { method: 'DELETE' });
            if (!response.ok) throw new Error('Error al eliminar');
            showToast('🗑️ Usuario eliminado correctamente', 'info');
            fetchUsers();
        } catch (error: any) {
            showToast('❌ ' + error.message, 'error');
        }
    };

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center h-full bg-[#fcfbf9]">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-orange-100 border-t-[#F7941D] rounded-full animate-spin"></div>
                    <p className="text-[#8c785f] font-bold text-sm animate-pulse">Cargando usuarios...</p>
                </div>
            </div>
        );
    }

    return (
        <main className="flex-1 overflow-y-auto p-8 bg-[#fcfbf9]">
            <div className="max-w-[1200px] mx-auto space-y-8">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-black text-[#181511]">Gestión de Comunidad</h1>
                        <p className="text-sm text-[#8c785f]">Administra el acceso al sistema y base de datos de clientes.</p>
                    </div>

                    {activeTab === 'users' && (
                        <button onClick={() => { setEditingUserId(null); setFormData({ fullName: '', email: '', password: '', role: 'cliente', isActive: true }); setShowModal(true); }} className="bg-[#F27405] text-white px-6 py-3 rounded-xl font-bold shadow-lg flex items-center gap-2">
                            <span className="material-symbols-outlined">person_add</span> Nuevo Usuario
                        </button>
                    )}

                    {activeTab === 'customers' && (
                        <button onClick={() => { setEditingCustomerId(null); setEditingCustomerType(null); setCustomerFormData({ full_name: '', phone: '', address: '' }); setShowCustomerModal(true); }} className="bg-[#181511] text-white px-6 py-3 rounded-xl font-bold shadow-lg flex items-center gap-2">
                            <span className="material-symbols-outlined">face</span> Nuevo Cliente
                        </button>
                    )}
                </div>

                <div className="flex gap-6 border-b border-[#e6e1db]">
                    {['users', 'customers', 'roles'].map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab as any)}
                            className={`pb-4 px-2 text-sm font-bold uppercase tracking-widest transition-all border-b-2 ${activeTab === tab ? 'border-[#F27405] text-[#F27405]' : 'border-transparent text-[#8c785f]'}`}
                        >
                            {tab === 'users' ? 'Usuarios' : tab === 'customers' ? 'Clientes' : 'Roles'}
                        </button>
                    ))}
                </div>

                {activeTab === 'users' ? (
                    <div className="bg-white rounded-2xl border border-[#e6e1db] overflow-hidden shadow-sm">
                        <table className="w-full text-left">
                            <thead className="bg-[#fcfbf9] text-[#8c785f] text-[10px] font-black uppercase tracking-widest border-b border-[#e6e1db]">
                                <tr>
                                    <th className="px-6 py-4">Usuario</th>
                                    <th className="px-6 py-4">Email</th>
                                    <th className="px-6 py-4">Rol</th>
                                    <th className="px-6 py-4">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#e6e1db]">
                                {users.map(u => (
                                    <tr key={u.id} className="hover:bg-[#fcfbf9] text-sm font-medium">
                                        <td className="px-6 py-4 font-bold">{u.full_name}</td>
                                        <td className="px-6 py-4 text-[#8c785f]">{u.email}</td>
                                        <td className="px-6 py-4">
                                            <span className="bg-orange-50 text-[#F27405] px-3 py-1 rounded-full text-[10px] font-black uppercase">{u.role}</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex gap-2">
                                                <button onClick={() => {
                                                    setEditingUserId(u.id);
                                                    setFormData({ fullName: u.full_name, email: u.email, password: '', role: u.role, isActive: true });
                                                    setShowModal(true);
                                                }} className="text-blue-500 hover:bg-blue-50 p-2 rounded-full transition-colors">
                                                    <span className="material-symbols-outlined text-[20px]">edit</span>
                                                </button>
                                                <button onClick={() => handleDelete(u.id)} className="text-red-500 hover:bg-red-50 p-2 rounded-full transition-colors">
                                                    <span className="material-symbols-outlined text-[20px]">delete</span>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : activeTab === 'customers' ? (
                    <div className="bg-white rounded-2xl border border-[#e6e1db] overflow-hidden shadow-sm">
                        <table className="w-full text-left">
                            <thead className="bg-[#fcfbf9] text-[#8c785f] text-[10px] font-black uppercase tracking-widest border-b border-[#e6e1db]">
                                <tr>
                                    <th className="px-6 py-4">Cliente</th>
                                    <th className="px-6 py-4">Teléfono</th>
                                    <th className="px-6 py-4">Dirección</th>
                                    <th className="px-6 py-4 text-center">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#e6e1db]">
                                {customers.map(c => (
                                    <tr key={c.id} className="hover:bg-[#fcfbf9] text-sm font-medium">
                                        <td className="px-6 py-4 font-bold">{c.full_name}</td>
                                        <td className="px-6 py-4">{c.phone}</td>
                                        <td className="px-6 py-4 text-[#8c785f] text-xs max-w-xs truncate">{c.address}</td>
                                        <td className="px-6 py-4 text-center">
                                            <div className="flex justify-center gap-2">
                                                <button onClick={() => {
                                                    setEditingCustomerId(c.id);
                                                    setEditingCustomerType(c.type); // Set Type Here!
                                                    setCustomerFormData({ full_name: c.full_name, phone: c.phone, address: c.address });
                                                    setShowCustomerModal(true);
                                                }} className="text-blue-500 p-2 rounded-full hover:bg-blue-50">
                                                    <span className="material-symbols-outlined text-[20px]">edit</span>
                                                </button>
                                                {c.type === 'customer' && (
                                                    <button onClick={async () => { if (confirm('¿Eliminar cliente ocasional?')) { await supabase.from('customers').delete().eq('id', c.id); fetchCustomers(); } }} className="text-red-500 p-2 rounded-full hover:bg-red-50">
                                                        <span className="material-symbols-outlined text-[20px]">delete</span>
                                                    </button>
                                                )}
                                                {c.type !== 'customer' && (
                                                    <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-1 rounded-full uppercase font-bold">App User</span>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {roles.map(r => (
                            <div key={r.id} className="bg-white p-6 rounded-2xl border border-[#e6e1db] shadow-sm">
                                <span className="text-[10px] font-black uppercase bg-[#181511] text-white px-3 py-1 rounded-full mb-4 inline-block">{r.name}</span>
                                <p className="text-sm text-[#8c785f]">{r.description}</p>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Modals */}
            {showCustomerModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#181511]/60 backdrop-blur-sm">
                    <div className="bg-white w-full max-w-md rounded-[32px] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="p-8 border-b border-gray-100 flex justify-between items-center bg-[#fcfbf9]">
                            <h2 className="text-xl font-black">{editingCustomerId ? 'Editar Cliente' : 'Nuevo Cliente'}</h2>
                            <button onClick={() => setShowCustomerModal(false)}><span className="material-symbols-outlined">close</span></button>
                        </div>
                        <form onSubmit={handleCustomerSubmit} className="p-8 space-y-6">
                            <div>
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Nombre Completo</label>
                                <input type="text" required value={customerFormData.full_name} onChange={e => setCustomerFormData({ ...customerFormData, full_name: e.target.value })} className="w-full bg-[#fcfbf9] border-2 border-gray-100 rounded-2xl px-5 py-3 font-bold" />
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Teléfono</label>
                                <input type="tel" required value={customerFormData.phone} onChange={e => setCustomerFormData({ ...customerFormData, phone: e.target.value })} className="w-full bg-[#fcfbf9] border-2 border-gray-100 rounded-2xl px-5 py-3 font-bold" />
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Dirección</label>
                                <textarea rows={3} value={customerFormData.address} onChange={e => setCustomerFormData({ ...customerFormData, address: e.target.value })} className="w-full bg-[#fcfbf9] border-2 border-gray-100 rounded-2xl px-5 py-3 font-bold resize-none" />
                            </div>
                            <button type="submit" className="w-full bg-[#F27405] text-white py-4 rounded-2xl font-black shadow-lg shadow-orange-100 uppercase tracking-widest text-sm">Guardar Cliente</button>
                        </form>
                    </div>
                </div>
            )}

            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#181511]/60 backdrop-blur-sm">
                    <div className="bg-white w-full max-w-md rounded-[32px] overflow-hidden shadow-2xl">
                        <div className="p-8 border-b border-gray-100 bg-[#fcfbf9] flex justify-between items-center">
                            <h2 className="text-xl font-black">{editingUserId ? 'Editar' : 'Nuevo'} Usuario</h2>
                            <button type="button" onClick={() => { setShowModal(false); setEditingUserId(null); setFormData({ fullName: '', email: '', password: '', role: 'cliente', isActive: true }); }} className="text-gray-400 hover:text-gray-600">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-8 space-y-5">
                            <div>
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Nombre Completo</label>
                                <input name="fullName" placeholder="Ej. Juan Pérez" value={formData.fullName} onChange={handleInputChange} className="w-full bg-[#fcfbf9] border-2 border-gray-100 rounded-2xl px-5 py-3 font-bold focus:border-[#F27405] outline-none transition-all" required />
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Correo Electrónico</label>
                                <input name="email" type="email" placeholder="correo@ejemplo.com" value={formData.email} onChange={handleInputChange} className="w-full bg-[#fcfbf9] border-2 border-gray-100 rounded-2xl px-5 py-3 font-bold focus:border-[#F27405] outline-none transition-all" required />
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">{editingUserId ? 'Nueva Contraseña (opcional)' : 'Contraseña'}</label>
                                <input name="password" type="password" placeholder={editingUserId ? 'Dejar vacío para mantener actual' : 'Mínimo 6 caracteres'} value={formData.password} onChange={handleInputChange} className="w-full bg-[#fcfbf9] border-2 border-gray-100 rounded-2xl px-5 py-3 font-bold focus:border-[#F27405] outline-none transition-all" required={!editingUserId} />
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Rol del Usuario</label>
                                <select name="role" value={formData.role} onChange={handleInputChange} className="w-full bg-[#fcfbf9] border-2 border-gray-100 rounded-2xl px-5 py-3 font-bold capitalize focus:border-[#F27405] outline-none transition-all">
                                    <option value="cliente">Cliente</option>
                                    <option value="administrador">Administrador</option>
                                    <option value="cajero">Cajero</option>
                                    <option value="cocina">Cocina</option>
                                </select>
                            </div>
                            <div className="flex gap-4 pt-6">
                                <button type="button" onClick={() => { setShowModal(false); setEditingUserId(null); setFormData({ fullName: '', email: '', password: '', role: 'cliente', isActive: true }); }} className="flex-1 font-bold text-gray-400 hover:text-gray-600 transition-colors">Cancelar</button>
                                <button type="submit" disabled={creating} className="flex-1 bg-[#F27405] hover:bg-[#e06804] text-white py-4 rounded-2xl font-black shadow-lg shadow-orange-100 uppercase tracking-widest text-sm transition-all disabled:opacity-50">
                                    {creating ? 'Guardando...' : (editingUserId ? 'Actualizar' : 'Crear Usuario')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Toast Notification */}
            {toast && (
                <div className="fixed top-8 right-8 z-[100] animate-in slide-in-from-top-2 duration-300">
                    <div className={`px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 min-w-[300px] border-2 ${toast.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' :
                            toast.type === 'error' ? 'bg-red-50 border-red-200 text-red-800' :
                                'bg-blue-50 border-blue-200 text-blue-800'
                        }`}>
                        <span className="material-symbols-outlined text-2xl">
                            {toast.type === 'success' ? 'check_circle' : toast.type === 'error' ? 'error' : 'info'}
                        </span>
                        <p className="font-bold text-sm flex-1">{toast.message}</p>
                        <button onClick={() => setToast(null)} className="text-gray-400 hover:text-gray-600">
                            <span className="material-symbols-outlined text-lg">close</span>
                        </button>
                    </div>
                </div>
            )}
        </main>
    );
}
