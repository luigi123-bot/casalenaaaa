import { useState } from 'react';
import { supabase } from '@/utils/supabase/client';

interface AperturaCajaModalProps {
    cashierName: string;
    onOpen: (fondoInfo: { fondo: number, notas: string }) => void;
    onLogout?: () => void;
}

export default function AperturaCajaModal({ cashierName, onOpen, onLogout }: AperturaCajaModalProps) {
    const [fondo, setFondo] = useState('');
    const [notas, setNotas] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isLoggingOut, setIsLoggingOut] = useState(false);

    const handleLogout = async () => {
        setIsLoggingOut(true);
        try {
            if (onLogout) {
                onLogout();
            } else {
                await supabase.auth.signOut();
                window.location.href = '/login';
            }
        } catch (err) {
            console.error('Error logging out:', err);
            window.location.href = '/login';
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const fondoNum = parseFloat(fondo);
        if (isNaN(fondoNum) || fondoNum < 0) {
            alert('Por favor ingresa un fondo inicial válido (0 o mayor).');
            return;
        }
        setIsLoading(true);
        try {
            await onOpen({ fondo: fondoNum, notas });
        } catch (err) {
            console.error(err);
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
            <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                <div className="bg-[#181511] px-6 py-5 text-center relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <span className="material-symbols-outlined text-6xl">store</span>
                    </div>

                    {/* Botón de Cerrar Sesión en la esquina superior derecha */}
                    <button
                        type="button"
                        onClick={handleLogout}
                        disabled={isLoggingOut}
                        className="absolute top-4 right-4 z-20 flex items-center gap-1 bg-white/10 hover:bg-red-600/80 text-white text-[10px] font-black uppercase px-3 py-1.5 rounded-xl border border-white/10 transition-all active:scale-95"
                        title="Cerrar sesión"
                    >
                        <span className="material-symbols-outlined text-sm">logout</span>
                        <span>{isLoggingOut ? 'Saliendo...' : 'Salir'}</span>
                    </button>

                    <p className="text-[10px] font-black text-orange-400 uppercase tracking-widest relative z-10">¡Hora de abrir!</p>
                    <h2 className="text-2xl font-black text-white relative z-10">Apertura de Caja</h2>
                    <p className="text-gray-400 text-xs mt-1 relative z-10">Cajero: {cashierName || 'Cargando...'}</p>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 flex gap-3 text-sm">
                        <span className="material-symbols-outlined text-[#F27405] shrink-0 mt-0.5">info</span>
                        <p className="text-[#8c785f] font-bold">
                            Para iniciar tu turno y empezar a tomar pedidos, necesitas registrar el dinero con el que estás empezando en la caja (Fondo Inicial).
                        </p>
                    </div>

                    <div>
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">
                            Fondo inicial en caja ($)
                        </label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-[#8c785f] text-lg">$</span>
                            <input
                                type="number"
                                value={fondo}
                                onChange={e => setFondo(e.target.value)}
                                placeholder="0.00"
                                className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl pl-8 pr-5 py-4 font-black text-[#181511] text-2xl placeholder-gray-200 focus:border-[#F27405] focus:bg-white outline-none transition-all"
                                step="any"
                                min="0"
                                autoFocus
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">
                            Notas u observaciones (Opcional)
                        </label>
                        <textarea
                            value={notas}
                            onChange={e => setNotas(e.target.value)}
                            placeholder="Ej: Faltan monedas de 5, el fondo está en billetes grandes..."
                            className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl px-5 py-3 font-bold text-sm text-[#181511] placeholder-gray-300 focus:border-[#F27405] focus:bg-white outline-none transition-all resize-none"
                            rows={2}
                        />
                    </div>

                    <div className="space-y-3">
                        <button
                            type="submit"
                            disabled={!fondo || isLoading || isLoggingOut}
                            className="w-full py-4 bg-[#F27405] hover:bg-orange-600 text-white rounded-2xl font-black text-lg transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-orange-200"
                        >
                            {isLoading ? (
                                <>
                                    <span className="material-symbols-outlined animate-spin">progress_activity</span>
                                    Abriendo...
                                </>
                            ) : (
                                <>
                                    <span className="material-symbols-outlined">lock_open</span>
                                    Abrir Caja
                                </>
                            )}
                        </button>

                        <button
                            type="button"
                            onClick={handleLogout}
                            disabled={isLoggingOut || isLoading}
                            className="w-full py-3 bg-gray-100 hover:bg-red-50 hover:text-red-600 text-gray-500 rounded-2xl font-bold text-xs transition-all flex items-center justify-center gap-2 border border-gray-200 active:scale-95"
                        >
                            <span className="material-symbols-outlined text-base">logout</span>
                            {isLoggingOut ? 'Cerrando sesión...' : 'Cerrar Sesión (No abrir caja ahora)'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
