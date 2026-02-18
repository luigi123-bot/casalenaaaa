'use client';

import { useEffect, useState } from 'react';

export default function InstallPWA() {
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [showInstallBtn, setShowInstallBtn] = useState(false);
    const [isIOS, setIsIOS] = useState(false);
    const [isStandalone, setIsStandalone] = useState(false);
    const [isWindows, setIsWindows] = useState(false);

    useEffect(() => {
        // Check if already in standalone mode
        if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone) {
            setIsStandalone(true);
        }

        // Check if it is iOS
        const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
        setIsIOS(ios);

        // Check if Windows/Desktop
        const userAgent = navigator.userAgent.toLowerCase();
        const isWin = userAgent.includes('win');
        const isDesktop = !/android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);

        setIsWindows(isWin || isDesktop);

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
        if (isWindows) {
            // Priority: Download Desktop App on Windows with a real download trigger
            const link = document.createElement('a');
            link.href = '/CasalenaPOS.exe';
            link.download = 'CasalenaPOS.exe';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            return;
        }

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

    // Force display in development or for desktop
    // we remove the if (isStandalone) return null; and others
    return (
        <>
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
