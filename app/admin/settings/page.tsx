'use client';

import { useState, useEffect } from 'react';

export default function SettingsPage() {
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [settings, setSettings] = useState({
        restaurantName: '',
        address: '',
        phone: '',
        currency: 'MXN',
        isOpen: true,
        emailNotifications: true,
        autoPrintReceipts: false,
        automaticSchedule: false,
        openTime: '14:00',
        closeTime: '22:30'
    });

    useEffect(() => {
        const fetchSettings = async () => {
            setIsLoading(true);
            try {
                const res = await fetch('/api/settings');
                const data = await res.json();

                if (data && !data.error) {
                    setSettings({
                        restaurantName: data.restaurant_name || '',
                        address: data.address || '',
                        phone: data.phone || '',
                        currency: data.currency || 'MXN',
                        isOpen: data.is_open ?? true,
                        emailNotifications: data.email_notifications ?? true,
                        autoPrintReceipts: data.auto_print_receipts ?? false,
                        automaticSchedule: data.automatic_schedule ?? false,
                        openTime: data.open_time ? data.open_time.slice(0, 5) : '14:00',
                        closeTime: data.close_time ? data.close_time.slice(0, 5) : '22:30',
                    });
                }
            } catch (error) {
                console.error('Error loading settings:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchSettings();
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        const checked = (e.target as HTMLInputElement).checked;

        setSettings(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const res = await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings)
            });

            if (res.ok) {
                alert('Configuración guardada exitosamente');
            } else {
                alert('Error al guardar la configuración');
            }
        } catch (error) {
            console.error('Error saving settings:', error);
            alert('Error al guardar la configuración');
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <span className="material-symbols-outlined animate-spin text-4xl text-[#f7951d]">progress_activity</span>
            </div>
        );
    }

    return (
        <main className="flex-1 overflow-y-auto bg-[#f8f7f5] p-8">
            <div className="max-w-[800px] mx-auto flex flex-col gap-8">
                {/* Header */}
                <div>
                    <h1 className="text-2xl font-bold text-[#181511]">Configuración</h1>
                    <p className="text-[#8c785f] text-sm">Gestiona la información y preferencias de tu restaurante.</p>
                </div>

                {/* Restaurant Profile Card */}
                <div className="bg-white rounded-xl border border-[#e6e1db] shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-[#e6e1db]">
                        <h2 className="text-lg font-bold text-[#181511]">Perfil del Restaurante</h2>
                        <p className="text-xs text-[#8c785f]">Información visible en tickets y sitio web.</p>
                    </div>
                    <div className="p-6 flex flex-col gap-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="flex flex-col gap-2">
                                <label className="text-sm font-bold text-[#181511]">Nombre del Restaurante</label>
                                <input
                                    type="text"
                                    name="restaurantName"
                                    value={settings.restaurantName}
                                    onChange={handleChange}
                                    className="px-4 py-2 rounded-lg border border-[#e6e1db] focus:outline-none focus:ring-2 focus:ring-[#f7951d]/50 bg-[#fcfbf9] text-[#181511]"
                                />
                            </div>
                            <div className="flex flex-col gap-2">
                                <label className="text-sm font-bold text-[#181511]">Teléfono</label>
                                <input
                                    type="text"
                                    name="phone"
                                    value={settings.phone}
                                    onChange={handleChange}
                                    className="px-4 py-2 rounded-lg border border-[#e6e1db] focus:outline-none focus:ring-2 focus:ring-[#f7951d]/50 bg-[#fcfbf9] text-[#181511]"
                                />
                            </div>
                        </div>
                        <div className="flex flex-col gap-2">
                            <label className="text-sm font-bold text-[#181511]">Dirección</label>
                            <input
                                type="text"
                                name="address"
                                value={settings.address}
                                onChange={handleChange}
                                className="px-4 py-2 rounded-lg border border-[#e6e1db] focus:outline-none focus:ring-2 focus:ring-[#f7951d]/50 bg-[#fcfbf9] text-[#181511]"
                            />
                        </div>
                    </div>
                </div>

                {/* Operations Settings */}
                <div className="bg-white rounded-xl border border-[#e6e1db] shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-[#e6e1db]">
                        <h2 className="text-lg font-bold text-[#181511]">Operaciones</h2>
                        <p className="text-xs text-[#8c785f]">Configuración de ventas y estado de tienda.</p>
                    </div>
                    <div className="p-6 flex flex-col gap-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-sm font-bold text-[#181511]">Estado de la Tienda</h3>
                                <p className="text-xs text-[#8c785f]">Controla si se reciben pedidos en línea.</p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    name="isOpen"
                                    checked={settings.isOpen}
                                    onChange={handleChange}
                                    className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-[#f7951d]/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#f7951d]"></div>
                                <span className="ml-3 text-sm font-medium text-[#181511]">{settings.isOpen ? 'Abierto' : 'Cerrado'}</span>
                            </label>
                        </div>

                        <div className="h-px bg-[#e6e1db]"></div>

                        {/* Automatic Schedule Toggle */}
                        <div className="flex flex-col gap-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-sm font-bold text-[#181511]">Horario Automático</h3>
                                    <p className="text-xs text-[#8c785f]">Abrir y cerrar la tienda automáticamente.</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        name="automaticSchedule"
                                        checked={settings.automaticSchedule}
                                        onChange={handleChange}
                                        className="sr-only peer"
                                    />
                                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-[#f7951d]/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#f7951d]"></div>
                                </label>
                            </div>

                            {/* Time Inputs */}
                            {settings.automaticSchedule && (
                                <div className="grid grid-cols-2 gap-4 pl-4 border-l-2 border-[#f7951d]/20 animate-in fade-in slide-in-from-top-2">
                                    <div className="flex flex-col gap-2">
                                        <label className="text-sm font-bold text-[#181511]">Hora de Apertura</label>
                                        <input
                                            type="time"
                                            name="openTime"
                                            value={settings.openTime}
                                            onChange={handleChange}
                                            className="px-4 py-2 rounded-lg border border-[#e6e1db] focus:outline-none focus:ring-2 focus:ring-[#f7951d]/50 bg-[#fcfbf9] text-[#181511]"
                                        />
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <label className="text-sm font-bold text-[#181511]">Hora de Cierre</label>
                                        <input
                                            type="time"
                                            name="closeTime"
                                            value={settings.closeTime}
                                            onChange={handleChange}
                                            className="px-4 py-2 rounded-lg border border-[#e6e1db] focus:outline-none focus:ring-2 focus:ring-[#f7951d]/50 bg-[#fcfbf9] text-[#181511]"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="h-px bg-[#e6e1db]"></div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="flex flex-col gap-2">
                                <label className="text-sm font-bold text-[#181511]">Moneda</label>
                                <select
                                    name="currency"
                                    value={settings.currency}
                                    onChange={handleChange}
                                    className="px-4 py-2 rounded-lg border border-[#e6e1db] focus:outline-none focus:ring-2 focus:ring-[#f7951d]/50 bg-[#fcfbf9] text-[#181511]"
                                >
                                    <option value="MXN">Peso Mexicano (MXN)</option>
                                    <option value="USD">Dólar Estadounidense (USD)</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>

                {/* System Preferences */}
                <div className="bg-white rounded-xl border border-[#e6e1db] shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-[#e6e1db]">
                        <h2 className="text-lg font-bold text-[#181511]">Preferencias del Sistema</h2>
                        <p className="text-xs text-[#8c785f]">Personaliza la experiencia de administración.</p>
                    </div>
                    <div className="p-6 flex flex-col gap-4">
                        <div className="flex items-center justify-between p-3 rounded-lg hover:bg-[#fcfbf9] transition-colors">
                            <div className="flex items-center gap-3">
                                <div className="size-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                                    <span className="material-symbols-outlined">notifications</span>
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-[#181511]">Notificaciones por Email</h3>
                                    <p className="text-xs text-[#8c785f]">Recibe alertas de nuevos pedidos y reportes diarios.</p>
                                </div>
                            </div>
                            <input
                                type="checkbox"
                                name="emailNotifications"
                                checked={settings.emailNotifications}
                                onChange={handleChange}
                                className="w-5 h-5 text-[#f7951d] rounded border-[#e6e1db] focus:ring-[#f7951d]"
                            />
                        </div>

                        <div className="flex items-center justify-between p-3 rounded-lg hover:bg-[#fcfbf9] transition-colors">
                            <div className="flex items-center gap-3">
                                <div className="size-10 rounded-full bg-purple-50 flex items-center justify-center text-purple-600">
                                    <span className="material-symbols-outlined">print</span>
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-[#181511]">Impresión Automática</h3>
                                    <p className="text-xs text-[#8c785f]">Imprimir tickets automáticamente al confirmar orden.</p>
                                </div>
                            </div>
                            <input
                                type="checkbox"
                                name="autoPrintReceipts"
                                checked={settings.autoPrintReceipts}
                                onChange={handleChange}
                                className="w-5 h-5 text-[#f7951d] rounded border-[#e6e1db] focus:ring-[#f7951d]"
                            />
                        </div>
                    </div>
                </div>

                {/* Danger Zone */}
                <div className="bg-white rounded-xl border border-red-200 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-red-100 bg-red-50">
                        <h2 className="text-lg font-bold text-red-800">Zona de Peligro</h2>
                        <p className="text-xs text-red-600">Acciones irreversibles o críticas para el sistema.</p>
                    </div>
                    <div className="p-6 flex flex-col gap-4">
                        <div className="flex items-center justify-between p-3 rounded-lg border border-red-100 hover:bg-red-50 transition-colors">
                            <div className="flex items-center gap-3">
                                <div className="size-10 rounded-full bg-red-100 flex items-center justify-center text-red-600">
                                    <span className="material-symbols-outlined">delete_sweep</span>
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-[#181511]">Limpiar Caché del Sistema</h3>
                                    <p className="text-xs text-[#8c785f]">Puede resolver problemas de visualización. No borra datos.</p>
                                </div>
                            </div>
                            <button
                                onClick={() => confirm('¿Estás seguro de limpiar la caché?') && alert('Caché limpiada')}
                                className="px-4 py-2 bg-white border border-red-200 text-red-600 rounded-lg hover:bg-red-50 font-medium text-sm transition-colors"
                            >
                                Limpiar Caché
                            </button>
                        </div>
                    </div>
                </div>

                {/* Save Button */}
                <div className="flex justify-end pt-4 pb-20">
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="flex items-center gap-2 px-6 py-3 bg-[#f7951d] text-white rounded-xl font-bold hover:bg-[#e0820f] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg active:scale-95"
                    >
                        {isSaving ? (
                            <span className="material-symbols-outlined animate-spin text-xl">progress_activity</span>
                        ) : (
                            <span className="material-symbols-outlined text-xl">save</span>
                        )}
                        <span>Guardar Cambios</span>
                    </button>
                </div>
            </div>
        </main>
    );
}
