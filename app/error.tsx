'use client'; // Error boundaries must be Client Components

import { useEffect } from 'react';

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error(error);
    }, [error]);

    return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center bg-[#FAFAFA] dark:bg-[#1D1D1F]">
            <div className="bg-red-50 dark:bg-red-900/20 p-6 rounded-full mb-6 animate-pulse">
                <span className="material-icons-round text-6xl text-red-500">error_outline</span>
            </div>
            <h2 className="text-2xl font-black text-[#1D1D1F] dark:text-white mb-2">
                ¡Ups! Algo salió mal.
            </h2>
            <p className="text-gray-500 mb-8 max-w-md">
                No pudimos cargar esta sección correctamente. Por favor intenta recargar la página.
            </p>
            <button
                onClick={
                    // Attempt to recover by trying to re-render the segment
                    () => reset()
                }
                className="px-6 py-3 bg-[#F7941D] text-white font-bold rounded-xl shadow-lg hover:shadow-xl hover:scale-105 transition-all flex items-center gap-2"
            >
                <span className="material-icons-round">refresh</span>
                Intentar de nuevo
            </button>
        </div>
    );
}
