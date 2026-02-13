'use client';

import { useEffect, useState } from 'react';

interface PointsEarnedProps {
    points: number;
    newLevel?: string;
    show: boolean;
    onClose: () => void;
}

export default function PointsEarnedModal({ points, newLevel, show, onClose }: PointsEarnedProps) {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        if (show) {
            setIsVisible(true);
            const timer = setTimeout(() => {
                setIsVisible(false);
                setTimeout(onClose, 300);
            }, 4000);
            return () => clearTimeout(timer);
        }
    }, [show, onClose]);

    if (!show && !isVisible) return null;

    const getLevelEmoji = (level?: string) => {
        switch (level) {
            case 'platino': return '💎';
            case 'oro': return '👑';
            case 'plata': return '⭐';
            case 'bronce': return '🥉';
            default: return '🎉';
        }
    };

    return (
        <div className={`fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
            <div className={`bg-gradient-to-br from-orange-400 via-pink-500 to-purple-600 rounded-3xl p-8 max-w-md w-full shadow-2xl transform transition-all duration-300 ${isVisible ? 'scale-100' : 'scale-95'}`}>
                <div className="text-center text-white">
                    {/* Animación de confetti */}
                    <div className="relative mb-6">
                        <div className="text-8xl animate-bounce">{newLevel ? getLevelEmoji(newLevel) : '🎁'}</div>
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-32 h-32 bg-white/20 rounded-full animate-ping"></div>
                        </div>
                    </div>

                    {newLevel ? (
                        <>
                            <h2 className="text-4xl font-black mb-3 animate-pulse">¡NIVEL SUBIDO!</h2>
                            <p className="text-2xl font-bold mb-4">Ahora eres <span className="uppercase bg-white/20 px-4 py-2 rounded-full">{newLevel}</span></p>
                        </>
                    ) : (
                        <h2 className="text-4xl font-black mb-3">¡Puntos Ganados!</h2>
                    )}

                    <div className="bg-white/20 backdrop-blur rounded-2xl p-6 mb-6">
                        <p className="text-7xl font-black mb-2">+{points}</p>
                        <p className="text-xl font-bold opacity-90">Puntos</p>
                    </div>

                    <p className="text-lg opacity-90 mb-6">
                        ¡Sigue comprando para desbloquear más recompensas increíbles!
                    </p>

                    <button
                        onClick={() => {
                            setIsVisible(false);
                            setTimeout(onClose, 300);
                        }}
                        className="bg-white text-purple-600 px-8 py-3 rounded-full font-black uppercase text-sm hover:bg-opacity-90 transition-all active:scale-95 shadow-lg"
                    >
                        ¡Genial!
                    </button>
                </div>
            </div>
        </div>
    );
}
