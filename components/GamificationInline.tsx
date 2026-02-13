'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/utils/supabase/client';

interface GamificationInlineProps {
    userId: string;
}

export default function GamificationInline({ userId }: GamificationInlineProps) {
    const [loading, setLoading] = useState(true);
    const [userPoints, setUserPoints] = useState<any>(null);
    const [availableRewards, setAvailableRewards] = useState<any[]>([]);
    const [userCoupons, setUserCoupons] = useState<any[]>([]);
    const [userAchievements, setUserAchievements] = useState<any[]>([]);
    const [activeTab, setActiveTab] = useState<'rewards' | 'coupons' | 'achievements'>('rewards');
    const [redeeming, setRedeeming] = useState<string | null>(null);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    useEffect(() => {
        fetchGamificationData();
    }, [userId]);

    const fetchGamificationData = async () => {
        try {
            const response = await fetch(`/api/gamification?userId=${userId}`);
            const data = await response.json();

            setUserPoints(data.points);
            setAvailableRewards(data.availableRewards);
            setUserCoupons(data.coupons);
            setUserAchievements(data.achievements);
        } catch (error) {
            console.error('Error fetching gamification data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleRedeemReward = async (rewardId: string) => {
        try {
            setRedeeming(rewardId);

            const response = await fetch('/api/gamification', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'redeem_reward',
                    userId,
                    rewardId
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Error al canjear recompensa');
            }

            showToast('¡Recompensa canjeada exitosamente! 🎉', 'success');
            fetchGamificationData();
        } catch (error: any) {
            showToast(error.message, 'error');
        } finally {
            setRedeeming(null);
        }
    };

    const showToast = (message: string, type: 'success' | 'error') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 4000);
    };

    const getLevelColor = (level: string) => {
        switch (level) {
            case 'platino': return 'from-purple-500 to-pink-500';
            case 'oro': return 'from-yellow-500 to-orange-500';
            case 'plata': return 'from-gray-400 to-gray-600';
            default: return 'from-orange-700 to-orange-900';
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
            <div className="flex items-center justify-center py-20">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-16 h-16 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin"></div>
                    <p className="text-gray-600 font-bold animate-pulse">Cargando tu progreso...</p>
                </div>
            </div>
        );
    }

    const progressPercentage = userPoints ? ((userPoints.total_points / (userPoints.total_points + userPoints.points_to_next_level)) * 100) : 0;

    return (
        <div className="space-y-6">
            {/* Header con Puntos y Nivel */}
            <div className={`bg-gradient-to-r ${getLevelColor(userPoints?.current_level || 'bronce')} rounded-3xl p-8 text-white shadow-2xl relative overflow-hidden`}>
                <div className="absolute inset-0 bg-black/10 backdrop-blur-sm"></div>
                <div className="relative z-10">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h1 className="text-4xl font-black mb-2">¡Hola, Campeón! {getLevelIcon(userPoints?.current_level || 'bronce')}</h1>
                            <p className="text-white/90 text-lg">Nivel: <span className="font-black uppercase">{userPoints?.current_level}</span></p>
                        </div>
                        <div className="text-right">
                            <p className="text-6xl font-black">{userPoints?.total_points}</p>
                            <p className="text-white/90 text-sm font-bold">Puntos Totales</p>
                        </div>
                    </div>

                    {/* Barra de Progreso */}
                    {userPoints && userPoints.points_to_next_level > 0 && (
                        <div>
                            <div className="flex justify-between text-sm font-bold mb-2">
                                <span>Progreso al siguiente nivel</span>
                                <span>{userPoints.points_to_next_level} puntos restantes</span>
                            </div>
                            <div className="w-full bg-white/20 rounded-full h-4 overflow-hidden">
                                <div
                                    className="bg-white h-full rounded-full transition-all duration-500 shadow-lg"
                                    style={{ width: `${progressPercentage}%` }}
                                ></div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-4 border-b-2 border-gray-200 pb-2">
                {['rewards', 'coupons', 'achievements'].map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab as any)}
                        className={`px-6 py-3 rounded-t-xl font-black uppercase tracking-wider transition-all ${activeTab === tab
                                ? 'bg-gradient-to-r from-orange-500 to-pink-500 text-white shadow-lg'
                                : 'bg-white text-gray-600 hover:bg-gray-100'
                            }`}
                    >
                        {tab === 'rewards' ? '🎁 Recompensas' : tab === 'coupons' ? '🎫 Mis Cupones' : '🏆 Logros'}
                    </button>
                ))}
            </div>

            {/* Contenido de Tabs */}
            {activeTab === 'rewards' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {availableRewards.map((reward) => {
                        const canAfford = (userPoints?.total_points || 0) >= reward.points_cost;
                        return (
                            <div key={reward.id} className={`bg-white rounded-2xl p-6 shadow-lg border-2 ${canAfford ? 'border-green-200' : 'border-gray-200'} hover:shadow-2xl transition-all`}>
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex-1">
                                        <h3 className="text-xl font-black text-gray-900 mb-1">{reward.name}</h3>
                                        <p className="text-sm text-gray-600">{reward.description}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-3xl font-black text-orange-500">{reward.points_cost}</p>
                                        <p className="text-xs text-gray-500 font-bold">puntos</p>
                                    </div>
                                </div>

                                <div className="bg-gradient-to-r from-orange-50 to-pink-50 rounded-xl p-4 mb-4">
                                    <p className="text-2xl font-black text-center text-orange-600">
                                        {reward.discount_type === 'percentage' ? `${reward.discount_value}% OFF` : `$${reward.discount_value} OFF`}
                                    </p>
                                    {reward.min_purchase > 0 && (
                                        <p className="text-xs text-center text-gray-600 mt-1">Compra mínima: ${reward.min_purchase}</p>
                                    )}
                                </div>

                                <button
                                    onClick={() => handleRedeemReward(reward.id)}
                                    disabled={!canAfford || redeeming === reward.id}
                                    className={`w-full py-3 rounded-xl font-black uppercase text-sm transition-all ${canAfford
                                            ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white hover:shadow-lg active:scale-95'
                                            : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                        }`}
                                >
                                    {redeeming === reward.id ? 'Canjeando...' : canAfford ? 'Canjear Ahora' : 'Puntos Insuficientes'}
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}

            {activeTab === 'coupons' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {userCoupons.length === 0 ? (
                        <div className="col-span-full text-center py-16">
                            <p className="text-6xl mb-4">🎫</p>
                            <p className="text-2xl font-black text-gray-400">No tienes cupones aún</p>
                            <p className="text-gray-500 mt-2">¡Canjea recompensas para obtener cupones!</p>
                        </div>
                    ) : (
                        userCoupons.map((coupon) => (
                            <div key={coupon.id} className="bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl p-6 text-white shadow-2xl relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
                                <div className="relative z-10">
                                    <h3 className="text-2xl font-black mb-2">{coupon.rewards.name}</h3>
                                    <div className="bg-white/20 backdrop-blur rounded-xl p-4 mb-4">
                                        <p className="text-4xl font-black text-center">{coupon.code}</p>
                                    </div>
                                    <p className="text-sm opacity-90 mb-2">
                                        Descuento: <span className="font-black">
                                            {coupon.discount_type === 'percentage' ? `${coupon.discount_value}%` : `$${coupon.discount_value}`}
                                        </span>
                                    </p>
                                    <p className="text-xs opacity-75">
                                        Válido hasta: {new Date(coupon.expires_at).toLocaleDateString()}
                                    </p>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

            {activeTab === 'achievements' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {userAchievements.map((achievement: any) => (
                        <div key={achievement.id} className="bg-gradient-to-br from-yellow-100 to-orange-100 rounded-2xl p-6 shadow-lg border-2 border-yellow-300">
                            <div className="text-center">
                                <p className="text-6xl mb-3">{achievement.achievements.icon}</p>
                                <h3 className="text-xl font-black text-gray-900 mb-2">{achievement.achievements.name}</h3>
                                <p className="text-sm text-gray-600 mb-3">{achievement.achievements.description}</p>
                                <p className="text-xs text-gray-500">
                                    Desbloqueado: {new Date(achievement.unlocked_at).toLocaleDateString()}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Toast Notification */}
            {toast && (
                <div className="fixed top-8 right-8 z-50 animate-in slide-in-from-top-2 duration-300">
                    <div className={`px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 min-w-[300px] ${toast.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
                        }`}>
                        <span className="text-2xl">{toast.type === 'success' ? '✅' : '❌'}</span>
                        <p className="font-bold flex-1">{toast.message}</p>
                    </div>
                </div>
            )}
        </div>
    );
}
