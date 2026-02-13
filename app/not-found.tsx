'use client';

import Link from 'next/link';

export default function NotFound() {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-[#FAFAFA] dark:bg-[#1D1D1F] text-center px-4">
            <div className="relative mb-8">
                <h1 className="text-[120px] font-black text-gray-200 dark:text-gray-800 leading-none select-none">
                    404
                </h1>
                <div className="absolute inset-0 flex items-center justify-center">
                    <span className="material-icons-round text-6xl text-[#F7941D] animate-bounce">
                        sentiment_dissatisfied
                    </span>
                </div>
            </div>

            <h2 className="text-3xl font-black text-[#1D1D1F] dark:text-white mb-4">
                Página no encontrada
            </h2>
            <p className="text-gray-500 font-medium mb-8 max-w-md">
                Lo sentimos, la página que estás buscando no existe o ha sido movida.
            </p>

            <Link
                href="/"
                className="px-8 py-4 bg-[#F7941D] hover:bg-[#e68a1b] text-white font-bold rounded-2xl shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300 flex items-center gap-2"
            >
                <span className="material-icons-round">home</span>
                Volver al Inicio
            </Link>
        </div>
    );
}
