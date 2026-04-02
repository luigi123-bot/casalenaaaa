'use client';

import { useEffect, useState } from 'react';

// Typed event interface to avoid `any`
interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface NavigatorWithStandalone extends Navigator {
    standalone?: boolean;
}

export default function InstallPWA() {
    const [isIOS, setIsIOS] = useState(false);
    const [isStandalone, setIsStandalone] = useState(false);

    useEffect(() => {
        const ua = navigator.userAgent;
        const nav = navigator as NavigatorWithStandalone;

        // Check standalone mode
        if (window.matchMedia('(display-mode: standalone)').matches || nav.standalone) {
            setIsStandalone(true);
        }

        // Check iOS
        const ios = /iPad|iPhone|iPod/.test(ua) && !('MSStream' in window);
        setIsIOS(ios);
    }, []);

    if (!isIOS || isStandalone) return null;

    return (
        <div className="fixed bottom-4 left-4 right-4 z-[9999] bg-[#FAFAFA] dark:bg-[#1D1D1F] p-4 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-800 flex items-start gap-4">
            <span className="material-icons-round text-[#F7941D] text-3xl">ios_share</span>
            <div>
                <h4 className="font-bold text-[#1D1D1F] dark:text-white text-sm mb-1">Instalar en iPhone/iPad</h4>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                    Para instalar esta app, pulsa en <span className="font-bold">Compartir</span> y luego en{' '}
                    <span className="font-bold">&quot;Agregar a Inicio&quot;</span>.
                </p>
                <button
                    onClick={() => setIsIOS(false)}
                    className="mt-2 text-xs text-[#F7941D] font-bold"
                >
                    Entendido
                </button>
            </div>
        </div>
    );
}
