'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/utils/supabase/client';
import Link from 'next/link';

export default function PointsWidget() {
    const [points, setPoints] = useState<number>(0);
    const [level, setLevel] = useState<string>('bronce');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchPoints();
    }, []);

    const fetchPoints = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const response = await fetch(`/api/gamification?userId=${user.id}`);
            const data = await response.json();

            if (data.points) {
                setPoints(data.points.total_points);
                setLevel(data.points.current_level);
            }
        } catch (error) {
            console.error('Error fetching points:', error);
        } finally {
            setLoading(false);
        }
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
            <div className="bg-white rounded-2xl p-4 shadow-lg border-2 border-gray-100 animate-pulse">
                <div className="h-16 bg-gray-200 rounded"></div>
            </div>
        );
    }

    return (
        <Link href="/tienda/gamification">
            <div className={`bg-gradient-to-r ${getLevelColor(level)} rounded-2xl p-4 shadow-lg hover:shadow-2xl transition-all cursor-pointer group relative overflow-hidden`}>
                <div className="absolute inset-0 bg-white/10 group-hover:bg-white/20 transition-all"></div>
                <div className="relative z-10 flex items-center justify-between text-white">
                    <div>
                        <p className="text-xs font-bold opacity-90 uppercase tracking-wider">Tus Puntos</p>
                        <p className="text-3xl font-black">{points}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-4xl">{getLevelIcon(level)}</p>
                        <p className="text-[10px] font-black uppercase opacity-90">{level}</p>
                    </div>
                </div>
                <div className="mt-2 text-xs text-white/80 font-bold text-center">
                    Click para ver recompensas →
                </div>
            </div>
        </Link>
    );
}
