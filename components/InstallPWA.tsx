'use client';

import { useEffect, useState } from 'react';

export default function InstallPWA() {
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [showInstallBtn, setShowInstallBtn] = useState(false);
    const [isIOS, setIsIOS] = useState(false);
    const [isStandalone, setIsStandalone] = useState(false);

    useEffect(() => {
        // Check if already in standalone mode
        if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone) {
            setIsStandalone(true);
        }

        // Check if it is iOS
        const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
        setIsIOS(ios);

        const handleBeforeInstallPrompt = (e: Event) => {
            // Prevent the mini-infobar from appearing on mobile
            e.preventDefault();
            // Stash the event so it can be triggered later.
            setDeferredPrompt(e);
            // Update UI notify the user they can install the PWA
            setShowInstallBtn(true);
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        };
    }, []);

    const handleInstallClick = async () => {
        if (!deferredPrompt) return;
        // Show the install prompt
        deferredPrompt.prompt();
        // Wait for the user to respond to the prompt
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`User response to the install prompt: ${outcome}`);
        // We've used the prompt, and can't use it again, throw it away
        setDeferredPrompt(null);
        setShowInstallBtn(false);
    };

    if (isStandalone) return null;

    // Don't show anything if not installable (unless it's iOS where we might want to show instructions)
    if (!showInstallBtn && !isIOS) return null;

    return (
        <>
            {showInstallBtn && (
                <div className="fixed bottom-6 left-6 z-[100] animate-bounce">
                    <button
                        onClick={handleInstallClick}
                        className="flex items-center gap-3 bg-[#F7941D] hover:bg-[#e68a1b] text-white px-6 py-4 rounded-full shadow-2xl hover:shadow-orange-500/50 transition-all font-bold text-base border-2 border-white ring-2 ring-orange-200"
                    >
                        <span className="material-icons-round">download</span>
                        Instalar App
                    </button>
                </div>
            )}

            {isIOS && !isStandalone && (
                <div className="fixed bottom-4 left-4 right-4 z-[9999] bg-[#FAFAFA] dark:bg-[#1D1D1F] p-4 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-800 flex items-start gap-4">
                    <span className="material-icons-round text-[#F7941D] text-3xl">ios_share</span>
                    <div>
                        <h4 className="font-bold text-[#1D1D1F] dark:text-white text-sm mb-1">Instalar en iPhone/iPad</h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                            Para instalar esta app, pulsa en <span className="font-bold">Compartir</span> y luego en <span className="font-bold">"Agregar a Inicio"</span>.
                        </p>
                        <button
                            onClick={() => setIsIOS(false)}
                            className="mt-2 text-xs text-[#F7941D] font-bold"
                        >
                            Entendido
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}
