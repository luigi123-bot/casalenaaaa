'use client';

import { useState, useEffect, useMemo } from 'react';

export default function SettingsPage() {
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [settings, setSettings] = useState({
        restaurantName: 'CASALEÑA',
        address: 'BOULEVARD JUAN N ALVAREZ, COL. SENTIMIENTOS DE LA NACIÓN, OMETEPEC GUERRERO CP 41706',
        phone: '741-101-1595',
        currency: 'MXN',
        isOpen: true,
        emailNotifications: true,
        autoPrintReceipts: false,
        automaticSchedule: true,
        openTime: '13:00',
        closeTime: '21:30',
        // Branding
        logoUrl: '/icon.png',
        whatsapp: '741-107-5056',
        instagram: 'casalenapizza',
        facebook: 'casalenapizza',
        taxPercentage: 16,
        // NUEVO: Gestión de Caja
        autoCashierSchedule: false,
        cashierOpenTime: '13:00',
        cashierCloseTime: '21:30'
    });

    useEffect(() => {
        const fetchSettings = async () => {
            setIsLoading(true);
            try {
                const res = await fetch('/api/settings');
                const data = await res.json();

                if (data && !data.error) {
                    setSettings({
                        restaurantName: data.restaurant_name || 'CASALEÑA',
                        address: data.address || 'BOULEVARD JUAN N ALVAREZ, COL. SENTIMIENTOS DE LA NACIÓN, OMETEPEC GUERRERO CP 41706',
                        phone: data.phone || '741-101-1595',
                        currency: data.currency || 'MXN',
                        isOpen: data.is_open ?? true,
                        emailNotifications: data.email_notifications ?? true,
                        autoPrintReceipts: data.auto_print_receipts ?? false,
                        automaticSchedule: data.automatic_schedule ?? true,
                        openTime: data.open_time ? data.open_time.slice(0, 5) : '13:00',
                        closeTime: data.close_time ? data.close_time.slice(0, 5) : '21:30',
                        logoUrl: data.logo_url || '/icon.png',
                        whatsapp: data.whatsapp || '741-107-5056',
                        instagram: data.instagram || 'casalenapizza',
                        facebook: data.facebook || 'casalenapizza',
                        taxPercentage: data.tax_percentage ?? 16,
                        autoCashierSchedule: data.auto_cashier_schedule ?? false,
                        cashierOpenTime: data.cashier_open_time ? data.cashier_open_time.slice(0, 5) : '13:00',
                        cashierCloseTime: data.cashier_close_time ? data.cashier_close_time.slice(0, 5) : '21:30'
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

        const newSettings = {
            ...settings,
            [name]: type === 'checkbox' ? checked : (name === 'taxPercentage' ? Number(value) : value)
        };

        setSettings(newSettings);

        // AUTO-SAVE para Gestión de Caja: Si cambia el interruptor o las horas, guardamos automáticamente
        if (name === 'autoCashierSchedule' || name === 'cashierOpenTime' || name === 'cashierCloseTime' || name === 'isOpen') {
             autoSaveSettings(newSettings);
        }
    };

    const autoSaveSettings = async (updatedData: typeof settings) => {
        try {
            await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedData)
            });
            console.log('📝 [AutoSave] Configuración de caja actualizada en tiempo real.');
        } catch (error) {
            console.error('Error in auto-save:', error);
        }
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
                // Flash success (vibrant feedback)
                const successMsg = document.getElementById('success-toast');
                if (successMsg) {
                    successMsg.classList.remove('opacity-0', 'translate-y-4');
                    setTimeout(() => successMsg.classList.add('opacity-0', 'translate-y-4'), 3000);
                }
            } else {
                alert('Error al guardar: Asegúrate de ejecutar el SQL para añadir nuevas columnas.');
            }
        } catch (error) {
            console.error('Error saving settings:', error);
            alert('Error al guardar la configuración');
        } finally {
            setIsSaving(false);
        }
    };

    // Componente de Vista Previa del Ticket (Funcionalidad Visual)
    const TicketPreview = useMemo(() => (
        <div className="sticky top-8 bg-white border-2 border-dashed border-gray-200 rounded-[32px] p-8 shadow-inner flex flex-col items-center gap-4 select-none">
            <div className="w-full bg-[#f8f7f5] rounded-2xl p-6 relative overflow-hidden flex flex-col items-center text-center font-mono text-[10px] text-gray-600 shadow-sm">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-gray-200 to-transparent"></div>
                
                {settings.logoUrl ? (
                    <img src={settings.logoUrl} alt="Logo" className="size-12 rounded-full object-cover mb-2 grayscale opacity-80 border-2 border-gray-200" />
                ) : (
                    <div className="size-12 rounded-full bg-gray-200 flex items-center justify-center mb-2">
                        <span className="material-symbols-outlined text-gray-400">restaurant</span>
                    </div>
                )}
                
                <h3 className="text-sm font-bold text-black uppercase mb-1">{settings.restaurantName || 'MI RESTAURANTE'}</h3>
                <p className="max-w-[180px] leading-tight mb-2 text-[8px]">{settings.address || 'Calle 123, Ciudad'}</p>
                <p>Tel: {settings.phone || '000-0000'}</p>
                {settings.whatsapp && <p>WA: {settings.whatsapp}</p>}
                
                <div className="w-full border-t border-dashed border-gray-300 my-4"></div>
                
                <div className="w-full space-y-1">
                    <div className="flex justify-between">
                        <span>PIZZA MARGHERITA</span>
                        <span>$180.00</span>
                    </div>
                    <div className="flex justify-between">
                        <span>REFRESCO 600ML</span>
                        <span>$35.00</span>
                    </div>
                </div>
                
                <div className="w-full border-t border-dashed border-gray-300 my-4 text-black font-bold">
                    <div className="flex justify-between mt-2">
                        <span>SUBTOTAL</span>
                        <span>$215.00</span>
                    </div>
                    <div className="flex justify-between">
                        <span>{settings.currency} {settings.taxPercentage}%</span>
                        <span>${(215 * (settings.taxPercentage/100)).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-lg mt-1 pt-1 border-t border-gray-100">
                        <span>TOTAL</span>
                        <span>${(215 * (1 + settings.taxPercentage/100)).toFixed(2)}</span>
                    </div>
                </div>
                
                <p className="mt-6 italic opacity-60 text-[8px]">¡Gracias por tu preferencia!</p>
                <div className="flex gap-2 mt-2 opacity-40">
                    {settings.facebook && <span className="material-symbols-outlined text-xs">public</span>}
                    {settings.instagram && <span className="material-symbols-outlined text-xs">photo_camera</span>}
                </div>
            </div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest text-center mt-2">Vista Previa Impresión</p>
        </div>
    ), [settings]);

    return (
        <main className="flex-1 overflow-y-auto bg-[#fdfdfd] p-4 lg:p-10 relative">
            {/* SUCCESS TOAST */}
            <div id="success-toast" className="fixed top-8 left-1/2 -translate-x-1/2 z-[200] opacity-0 translate-y-4 transition-all duration-500 pointer-events-none">
                <div className="bg-green-500 text-white px-6 py-3 rounded-full font-black shadow-2xl flex items-center gap-3">
                    <span className="material-symbols-outlined">check_circle</span>
                    DISEÑO GUARDADO
                </div>
            </div>

            <div className="max-w-6xl mx-auto flex flex-col lg:flex-row gap-10">
                
                {/* CONFIGURATION COLUMN */}
                <div className="flex-1 flex flex-col gap-10">
                    {/* Header */}
                    <div className="flex justify-between items-end">
                        <div>
                            <h1 className="text-4xl font-black text-[#181511] tracking-tight shrink-0 flex items-center gap-3">
                                <span className="material-symbols-outlined text-4xl text-orange-500">store</span>
                                Casa Leña
                            </h1>
                            <p className="text-[#8c785f] font-medium text-lg">Panel de control de operaciones y marca.</p>
                        </div>
                    </div>

                    {/* NUEVO: GESTIÓN DE CAJA */}
                    <section className="bg-white rounded-[40px] border border-gray-100 shadow-xl shadow-gray-100/20 overflow-hidden p-8 flex flex-col gap-8 transition-all hover:shadow-2xl">
                        <div className="flex items-center gap-4">
                            <div className="size-14 rounded-[20px] bg-green-50 flex items-center justify-center text-green-600">
                                <span className="material-symbols-outlined text-4xl">lock_open</span>
                            </div>
                            <div>
                                <h2 className="text-2xl font-black text-[#181511] uppercase tracking-tight">Cierre y Apertura de Caja</h2>
                                <p className="text-[#8c785f] font-bold">Configura el horario operativo del cajero.</p>
                            </div>
                        </div>

                        <div className="flex flex-col gap-6 bg-green-50/30 p-6 rounded-[32px] border border-green-100/50">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className={`size-10 rounded-full flex items-center justify-center transition-all ${settings.autoCashierSchedule ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
                                        <span className="material-symbols-outlined">schedule</span>
                                    </div>
                                    <div>
                                        <h3 className="font-black text-[#181511] uppercase text-sm">Control Automático de Caja</h3>
                                        <p className="text-xs text-[#8c785f] font-bold tracking-tight">Abre y cierra el turno conforme al horario.</p>
                                    </div>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer scale-125 mr-2">
                                    <input type="checkbox" name="autoCashierSchedule" checked={settings.autoCashierSchedule} onChange={handleChange} className="sr-only peer" />
                                    <div className="w-14 h-7 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-green-600"></div>
                                </label>
                            </div>

                            {settings.autoCashierSchedule && (
                                <div className="grid grid-cols-2 gap-6 animate-in fade-in zoom-in-95 duration-300 bg-white p-6 rounded-3xl border border-green-100 shadow-sm mt-2">
                                    <InputField label="Apertura General" icon="login">
                                        <input
                                            type="time"
                                            name="cashierOpenTime"
                                            value={settings.cashierOpenTime}
                                            onChange={handleChange}
                                            className="w-full bg-gray-50/50 px-4 py-3 rounded-2xl border-transparent border-2 focus:border-green-500 focus:bg-white outline-none transition-all font-black text-[#181511]"
                                        />
                                    </InputField>
                                    <InputField label="Cierre General" icon="logout">
                                        <input
                                            type="time"
                                            name="cashierCloseTime"
                                            value={settings.cashierCloseTime}
                                            onChange={handleChange}
                                            className="w-full bg-gray-50/50 px-4 py-3 rounded-2xl border-transparent border-2 focus:border-green-500 focus:bg-white outline-none transition-all font-black text-[#181511]"
                                        />
                                    </InputField>
                                </div>
                            )}
                        </div>
                    </section>

                    {/* Restaurant Profile Card */}
                    <section className="bg-white rounded-[32px] border border-gray-100 shadow-sm overflow-hidden p-8 flex flex-col gap-8 transition-all hover:shadow-xl hover:shadow-orange-900/5">
                        <div className="flex items-center gap-4">
                            <div className="size-12 rounded-2xl bg-orange-50 flex items-center justify-center text-orange-500">
                                <span className="material-symbols-outlined text-3xl">storefront</span>
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-[#181511]">Perfil Público</h2>
                                <p className="text-sm text-[#8c785f]">Cómo te ven tus clientes en tickets y web.</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <InputField label="Nombre del Restaurante" icon="badge">
                                <input
                                    type="text"
                                    name="restaurantName"
                                    placeholder="Ej. Casa Leña"
                                    value={settings.restaurantName}
                                    onChange={handleChange}
                                    className="w-full bg-gray-50/50 px-4 py-3 rounded-2xl border-transparent border-2 focus:border-orange-500 focus:bg-white outline-none transition-all font-bold text-[#181511]"
                                />
                            </InputField>

                            <InputField label="URL del Logo (Opcional)" icon="image">
                                <input
                                    type="text"
                                    name="logoUrl"
                                    placeholder="https://imgur.com/tu-logo.png"
                                    value={settings.logoUrl}
                                    onChange={handleChange}
                                    className="w-full bg-gray-50/50 px-4 py-3 rounded-2xl border-transparent border-2 focus:border-orange-500 focus:bg-white outline-none transition-all font-bold text-[#181511]"
                                />
                            </InputField>

                            <InputField label="Teléfono Público" icon="call">
                                <input
                                    type="text"
                                    name="phone"
                                    placeholder="741-000-0000"
                                    value={settings.phone}
                                    onChange={handleChange}
                                    className="w-full bg-gray-50/50 px-4 py-3 rounded-2xl border-transparent border-2 focus:border-orange-500 focus:bg-white outline-none transition-all font-bold text-[#181511]"
                                />
                            </InputField>

                            <InputField label="WhatsApp (Pedidos)" icon="chat">
                                <input
                                    type="text"
                                    name="whatsapp"
                                    placeholder="52741107XXXX"
                                    value={settings.whatsapp}
                                    onChange={handleChange}
                                    className="w-full bg-gray-50/50 px-4 py-3 rounded-2xl border-transparent border-2 focus:border-orange-500 focus:bg-white outline-none transition-all font-bold text-[#181511]"
                                />
                            </InputField>

                            <div className="md:col-span-2">
                                <InputField label="Dirección Física" icon="location_on">
                                    <input
                                        type="text"
                                        name="address"
                                        placeholder="Calle Juarez #1..."
                                        value={settings.address}
                                        onChange={handleChange}
                                        className="w-full bg-gray-50/50 px-4 py-3 rounded-2xl border-transparent border-2 focus:border-orange-500 focus:bg-white outline-none transition-all font-bold text-[#181511]"
                                    />
                                </InputField>
                            </div>
                        </div>

                        <div className="h-px bg-gray-100 my-2"></div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <InputField label="Instagram" icon="photo_camera">
                                <input
                                    type="text"
                                    name="instagram"
                                    placeholder="@casalena"
                                    value={settings.instagram}
                                    onChange={handleChange}
                                    className="w-full bg-gray-50/50 px-4 py-3 rounded-2xl border-transparent border-2 focus:border-pink-500 focus:bg-white outline-none transition-all font-bold text-[#181511]"
                                />
                            </InputField>
                            <InputField label="Facebook" icon="public">
                                <input
                                    type="text"
                                    name="facebook"
                                    placeholder="casalenapizza"
                                    value={settings.facebook}
                                    onChange={handleChange}
                                    className="w-full bg-gray-50/50 px-4 py-3 rounded-2xl border-transparent border-2 focus:border-blue-600 focus:bg-white outline-none transition-all font-bold text-[#181511]"
                                />
                            </InputField>
                        </div>
                    </section>

                    {/* Operations Settings */}
                    <section className="bg-white rounded-[32px] border border-gray-100 shadow-sm p-8 flex flex-col gap-6">
                        <div className="flex items-center gap-4">
                            <div className="size-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-500">
                                <span className="material-symbols-outlined text-3xl">settings_account_box</span>
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-[#181511]">Ventas y Finanzas</h2>
                                <p className="text-sm text-[#8c785f]">Manejo de impuestos y moneda.</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
                            <InputField label="Impuesto (IVA %)" icon="percent">
                                <input
                                    type="number"
                                    name="taxPercentage"
                                    value={settings.taxPercentage}
                                    onChange={handleChange}
                                    className="w-full bg-gray-50/50 px-4 py-3 rounded-2xl border-transparent border-2 focus:border-orange-500 focus:bg-white outline-none transition-all font-bold text-[#181511]"
                                />
                            </InputField>
                            <InputField label="Moneda de Operación" icon="payments">
                                <select
                                    name="currency"
                                    value={settings.currency}
                                    onChange={handleChange}
                                    className="w-full bg-gray-50/50 px-4 py-3 rounded-2xl border-transparent border-2 focus:border-orange-500 focus:bg-white outline-none transition-all font-bold text-[#181511] appearance-none"
                                >
                                    <option value="MXN">Peso Mexicano (MXN)</option>
                                    <option value="USD">Dólar (USD)</option>
                                    <option value="EUR">Euro (EUR)</option>
                                </select>
                            </InputField>
                        </div>

                        <div className="h-px bg-gray-100"></div>

                        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl">
                            <div className="flex items-center gap-4">
                                <div className={`size-10 rounded-full flex items-center justify-center ${settings.isOpen ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'} transition-all`}>
                                    <span className="material-symbols-outlined">{settings.isOpen ? 'door_open' : 'door_front'}</span>
                                </div>
                                <div>
                                    <h3 className="font-bold text-[#181511]">Estatus de Recepción</h3>
                                    <p className="text-xs text-[#8c785f]">Si está apagado, no se reciben pedidos online.</p>
                                </div>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer group">
                                <input type="checkbox" name="isOpen" checked={settings.isOpen} onChange={handleChange} className="sr-only peer" />
                                <div className="w-14 h-7 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-green-500"></div>
                            </label>
                        </div>
                    </section>
                </div>

                {/* VISUAL PREVIEW COLUMN */}
                <div className="w-full lg:w-[320px] shrink-0">
                    <div className="sticky top-10 flex flex-col gap-6">
                        {TicketPreview}
                        
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="w-full flex items-center justify-center gap-3 px-8 py-5 bg-[#181511] text-white rounded-[24px] font-black hover:bg-black transition-all disabled:opacity-50 shadow-xl shadow-black/10 active:scale-95 group overflow-hidden relative"
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:animate-shimmer"></div>
                            {isSaving ? (
                                <span className="material-symbols-outlined animate-spin text-2xl">progress_activity</span>
                            ) : (
                                <span className="material-symbols-outlined text-2xl">rocket_launch</span>
                            )}
                            <span className="text-lg">PUBLICAR CAMBIOS</span>
                        </button>

                        <div className="bg-blue-50 p-6 rounded-[24px] border border-blue-100 flex flex-col gap-2">
                             <span className="material-symbols-outlined text-blue-500">info</span>
                             <p className="text-xs font-bold text-blue-900 leading-relaxed uppercase tracking-tighter">
                                Los cambios aplicados se reflejarán instantáneamente en el cajero y el sitio de clientes después de guardar.
                             </p>
                        </div>
                    </div>
                </div>
            </div>
            
            {/* FOOTER SECTION FOR EXTRA CLEANUP */}
            <div className="max-w-6xl mx-auto mt-20 pb-40">
                <div className="bg-red-50/50 p-10 rounded-[40px] border-2 border-dashed border-red-100 flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="flex items-center gap-6 text-center md:text-left">
                        <div className="size-16 rounded-3xl bg-red-100 flex items-center justify-center text-red-500">
                            <span className="material-symbols-outlined text-4xl">dangerous</span>
                        </div>
                        <div>
                             <h3 className="text-xl font-bold text-red-900">Mantenimiento Crítico</h3>
                             <p className="text-red-700/60 max-w-sm">Si experimentas problemas con la caché o sincronización, usa la herramienta de purga.</p>
                        </div>
                    </div>
                    <button
                        onClick={() => confirm('¿Purgar caché de visualización?') && alert('Caché purgada.')}
                        className="px-10 py-5 bg-white text-red-600 border-2 border-red-100 rounded-3xl font-black hover:bg-red-600 hover:text-white transition-all shadow-sm active:scale-95"
                    >
                        LIMPIAR TODO
                    </button>
                </div>
            </div>
        </main>
    );
}

function InputField({ label, icon, children }: { label: string, icon: string, children: React.ReactNode }) {
    return (
        <div className="flex flex-col gap-2 group">
            <label className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 group-focus-within:text-orange-500 transition-colors">
                <span className="material-symbols-outlined text-[14px]">{icon}</span>
                {label}
            </label>
            {children}
        </div>
    );
}

