'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import GamificationInline from '@/components/GamificationInline';

export default function GamificationPage() {
    const router = useRouter();
    const [userId, setUserId] = useState<string | null>(null);
    const [userName, setUserName] = useState('');
    const [userLevel, setUserLevel] = useState<string>('bronce');
    const [ranking, setRanking] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchUserData();
        fetchRanking();
    }, []);

    const fetchRanking = async () => {
        try {
            const res = await fetch('/api/gamification?mode=ranking');
            if (res.ok) {
                const data = await res.json();
                setRanking(data || []);
            }
        } catch (error) {
            console.error('Error fetching ranking:', error);
        }
    };

    const fetchUserData = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                router.push('/login?redirect=/tienda/gamification');
                return;
            }

            setUserId(user.id);
            setUserName(user.user_metadata?.full_name || user.email || 'Usuario');

            // Obtener nivel del usuario
            const response = await fetch(`/api/gamification?userId=${user.id}`);
            const data = await response.json();
            if (data.points) {
                setUserLevel(data.points.current_level || 'bronce');
            }
        } catch (error) {
            console.error('Error fetching user:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push('/login');
    };

    const getLevelBadgeColor = (level: string) => {
        switch (level) {
            case 'platino': return 'text-purple-600';
            case 'oro': return 'text-yellow-600';
            case 'plata': return 'text-gray-600';
            default: return 'text-orange-600';
        }
    };

    const getLevelIcon = (level: string) => {
        switch (level) {
            case 'platino': return '💎';
            case 'oro': return '👑';
            case 'plata': return '⭐';
            default: return '🥉';
        }
    };

    if (loading) {
        return (
            <div className="fixed inset-0 bg-[#FAFAFA] z-[9999] flex flex-col items-center justify-center">
                <div className="relative w-24 h-24 mb-8">
                    <div className="absolute inset-0 border-4 border-[#F7941D]/20 rounded-full"></div>
                    <div className="absolute inset-0 border-4 border-[#F7941D] border-t-transparent rounded-full animate-spin"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                        <span className="material-icons-round text-[#F7941D] text-3xl animate-pulse">stars</span>
                    </div>
                </div>
                <h2 className="text-2xl font-black text-[#1D1D1F] mb-2 animate-pulse">Gamificación</h2>
                <p className="text-gray-400 font-medium text-sm">Cargando tus recompensas...</p>
            </div>
        );
    }

    if (!userId) {
        return null;
    }

    return (
        <div className="flex h-full bg-[#FAFAFA] text-[#1D1D1F] font-sans overflow-hidden">
            {/* MAIN CONTENT */}
            <main className="flex-1 flex flex-col min-w-0 bg-[#FAFAFA] relative overflow-hidden">
                {/* Responsive Header */}
                <header className="min-h-[80px] sm:min-h-[90px] px-3 sm:px-4 md:px-6 lg:px-8 flex flex-col sm:flex-row items-stretch sm:items-center justify-between sticky top-0 z-20 bg-[#FAFAFA]/95 backdrop-blur-xl border-b border-gray-100 py-3 sm:py-4 gap-2 sm:gap-4">
                    {/* User Greeting */}
                    <div className="flex flex-col justify-center min-w-0">
                        <div className="flex items-center gap-2">
                            <h1 className="text-lg sm:text-xl md:text-2xl font-black text-[#1D1D1F] tracking-tight truncate">
                                Tus Recompensas 🎁
                            </h1>
                        </div>
                        <p className="text-xs sm:text-sm text-gray-400 font-medium truncate">Canjea puntos por descuentos increíbles</p>
                    </div>

                    {/* Navigation Buttons */}
                    <div className="flex items-center gap-2 md:gap-3 pl-2 sm:pl-3 md:pl-4 border-l border-gray-200 shrink-0">
                        <button
                            onClick={() => router.push('/tienda')}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-orange-50 text-[#F7941D] font-bold text-xs hover:bg-orange-100 transition-colors whitespace-nowrap"
                        >
                            <span className="material-icons-round text-sm">store</span>
                            <span className="hidden sm:inline">Volver a Tienda</span>
                        </button>
                        <button
                            onClick={() => router.push('/tienda/mis-pedidos')}
                            className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gray-50 text-gray-600 font-bold text-xs hover:bg-gray-100 transition-colors whitespace-nowrap"
                        >
                            <span className="material-icons-round text-sm">receipt_long</span>
                            Pedidos
                        </button>
                        <button
                            onClick={() => router.push('/update-password')}
                            className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gray-50 text-gray-600 font-bold text-xs hover:bg-gray-100 transition-colors whitespace-nowrap"
                            title="Cambiar Contraseña"
                        >
                            <span className="material-icons-round text-sm">lock</span>
                            <span className="hidden xl:inline">Contraseña</span>
                        </button>
                        <div className="text-right hidden xl:block">
                            <p className="text-xs font-bold text-gray-900 truncate max-w-[100px]">{userName}</p>
                            <p className={`text-[10px] font-bold tracking-wide uppercase ${getLevelBadgeColor(userLevel)}`}>
                                {getLevelIcon(userLevel)} {userLevel}
                            </p>
                        </div>
                        <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full p-[2px] bg-gradient-to-tr from-[#F7941D] to-[#FFC107] shadow-md flex-shrink-0">
                            <img src={`https://ui-avatars.com/api/?name=${userName}&background=fff&color=F7941D`} className="w-full h-full rounded-full border-2 border-white object-cover" alt="User" />
                        </div>
                        <button
                            onClick={handleLogout}
                            className="flex items-center justify-center w-9 h-9 rounded-xl bg-gray-100 hover:bg-red-50 text-gray-500 hover:text-red-500 transition-all"
                            title="Cerrar Sesión"
                        >
                            <span className="material-icons-round text-xl">logout</span>
                        </button>
                    </div>
                </header>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto px-3 sm:px-4 md:px-6 lg:px-8 pb-20 custom-scrollbar scroll-smooth">
                    <div className="mt-6 mb-8">
                        <GamificationInline userId={userId} />
                    </div>

                    {/* LEADERBOARD SECTION */}
                    <div className="bg-white rounded-[32px] p-6 sm:p-8 shadow-xl shadow-gray-100 border border-gray-100 mb-8">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-12 h-12 rounded-2xl bg-yellow-100 flex items-center justify-center text-yellow-600 shadow-sm rotate-3">
                                <span className="material-icons-round text-2xl">emoji_events</span>
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-[#1D1D1F]">Tabla de Clasificación</h3>
                                <p className="text-sm text-gray-400 font-medium">Top usuarios con más puntos</p>
                            </div>
                        </div>

                        <div className="overflow-hidden rounded-2xl border border-gray-100">
                            <table className="w-full text-left">
                                <thead className="bg-gray-50 text-[10px] font-black uppercase tracking-widest text-gray-400">
                                    <tr>
                                        <th className="px-6 py-4 text-center w-16">#</th>
                                        <th className="px-6 py-4">Usuario</th>
                                        <th className="px-6 py-4 hidden sm:table-cell">Nivel</th>
                                        <th className="px-6 py-4 text-right">Puntos</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {ranking.map((user, index) => (
                                        <tr
                                            key={user.user_id}
                                            className={`transition-colors ${user.user_id === userId ? 'bg-yellow-50/50' : 'hover:bg-gray-50/50'}`}
                                        >
                                            <td className="px-6 py-4 text-center font-bold text-gray-500">
                                                {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-sm
                                                        ${index === 0 ? 'bg-yellow-400' : index === 1 ? 'bg-gray-400' : index === 2 ? 'bg-orange-400' : 'bg-gray-200 text-gray-500'}`}>
                                                        {user.full_name?.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className={`font-bold text-sm ${user.user_id === userId ? 'text-[#F7941D]' : 'text-[#1D1D1F]'}`}>
                                                            {user.full_name} {user.user_id === userId && '(Tú)'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 hidden sm:table-cell">
                                                <span className={`px-2 py-1 rounded-md text-[10px] font-black uppercase
                                                    ${user.level === 'platino' ? 'bg-purple-100 text-purple-700' :
                                                        user.level === 'oro' ? 'bg-yellow-100 text-yellow-700' :
                                                            user.level === 'plata' ? 'bg-gray-100 text-gray-700' :
                                                                'bg-orange-50 text-orange-700'}`}>
                                                    {user.level}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right font-black text-[#1D1D1F]">
                                                {user.points.toLocaleString()}
                                            </td>
                                        </tr>
                                    ))}
                                    {ranking.length === 0 && (
                                        <tr>
                                            <td colSpan={4} className="p-8 text-center text-gray-400">
                                                Cargando ranking...
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </main>

            {/* SIDEBAR - Cart */}
            <aside className="hidden xl:flex flex-col w-[380px] bg-white border-l border-gray-100 shadow-2xl">
                <div className="p-6 border-b border-gray-100">
                    <h2 className="text-2xl font-black text-[#1D1D1F] flex items-center gap-2">
                        <span className="material-icons-round text-purple-500">stars</span>
                        Gamificación
                    </h2>
                    <p className="text-sm text-gray-500 mt-1 font-medium">Sistema de recompensas</p>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {/* Info Cards */}
                    <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-4 border-2 border-purple-200">
                        <div className="flex items-center gap-3 mb-2">
                            <span className="material-icons-round text-purple-500">emoji_events</span>
                            <h3 className="font-black text-gray-900">¿Cómo funciona?</h3>
                        </div>
                        <ul className="space-y-2 text-xs text-gray-600">
                            <li className="flex items-start gap-2">
                                <span className="text-purple-500 mt-0.5">•</span>
                                <span>Gana <strong>1 punto</strong> por cada <strong>$10</strong> gastados</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-purple-500 mt-0.5">•</span>
                                <span>Canjea puntos por <strong>descuentos</strong> y <strong>recompensas</strong></span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-purple-500 mt-0.5">•</span>
                                <span>Sube de nivel para <strong>mejores beneficios</strong></span>
                            </li>
                        </ul>
                    </div>

                    <div className="bg-gradient-to-br from-orange-50 to-yellow-50 rounded-2xl p-4 border-2 border-orange-200">
                        <div className="flex items-center gap-3 mb-2">
                            <span className="material-icons-round text-orange-500">workspace_premium</span>
                            <h3 className="font-black text-gray-900">Niveles</h3>
                        </div>
                        <div className="space-y-2 text-xs">
                            <div className="flex items-center justify-between">
                                <span className="flex items-center gap-2">
                                    <span>🥉</span>
                                    <span className="font-bold">Bronce</span>
                                </span>
                                <span className="text-gray-500">0-199 pts</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="flex items-center gap-2">
                                    <span>⭐</span>
                                    <span className="font-bold">Plata</span>
                                </span>
                                <span className="text-gray-500">200-499 pts</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="flex items-center gap-2">
                                    <span>👑</span>
                                    <span className="font-bold">Oro</span>
                                </span>
                                <span className="text-gray-500">500-999 pts</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="flex items-center gap-2">
                                    <span>💎</span>
                                    <span className="font-bold">Platino</span>
                                </span>
                                <span className="text-gray-500">1000+ pts</span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-4 border-2 border-green-200">
                        <div className="flex items-center gap-3 mb-2">
                            <span className="material-icons-round text-green-500">card_giftcard</span>
                            <h3 className="font-black text-gray-900">Beneficios</h3>
                        </div>
                        <ul className="space-y-2 text-xs text-gray-600">
                            <li className="flex items-start gap-2">
                                <span className="text-green-500 mt-0.5">✓</span>
                                <span>Descuentos exclusivos</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-green-500 mt-0.5">✓</span>
                                <span>Productos gratis</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-green-500 mt-0.5">✓</span>
                                <span>Cupones especiales</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-green-500 mt-0.5">✓</span>
                                <span>Logros desbloqueables</span>
                            </li>
                        </ul>
                    </div>
                </div>
            </aside>
        </div>
    );
}
