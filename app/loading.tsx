'use client';

export default function Loading() {
    return (
        <div className="fixed inset-0 bg-[#FAFAFA] dark:bg-[#1D1D1F] z-[9999] flex flex-col items-center justify-center">
            <div className="relative w-24 h-24 mb-8">
                <div className="absolute inset-0 border-4 border-[#F7941D]/20 rounded-full"></div>
                <div className="absolute inset-0 border-4 border-[#F7941D] border-t-transparent rounded-full animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                    <span className="material-icons-round text-[#F7941D] text-3xl animate-pulse">restaurant</span>
                </div>
            </div>
            <h2 className="text-2xl font-black text-[#1D1D1F] dark:text-white mb-2 animate-pulse">Casa Leña</h2>
            <p className="text-gray-400 font-medium text-sm">Cargando...</p>
        </div>
    );
}
