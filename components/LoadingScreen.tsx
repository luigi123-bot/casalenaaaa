import React from 'react';

const LoadingScreen = () => {
    return (
        <div className="fixed inset-0 bg-[#f8f7f5] z-[9999] flex flex-col items-center justify-center">
            <div className="relative mb-8">
                {/* Outer Ring */}
                <div className="w-24 h-24 rounded-full border-4 border-orange-100 animate-[spin_3s_linear_infinite]"></div>
                {/* Middle Ring */}
                <div className="absolute top-0 left-0 w-24 h-24 rounded-full border-4 border-t-[#F7941D] border-r-transparent border-b-transparent border-l-transparent animate-[spin_1.5s_ease-in-out_infinite]"></div>
                {/* Inner Icon */}
                <div className="absolute inset-0 flex items-center justify-center">
                    <span className="material-icons-round text-4xl text-[#181511] animate-pulse">local_pizza</span>
                </div>
            </div>

            <h2 className="text-2xl font-black text-[#181511] tracking-tight mb-2 animate-pulse">
                CASALEÑA
            </h2>
            <p className="text-[#8c785f] font-medium text-sm tracking-widest uppercase">
                Cargando sistema...
            </p>
        </div>
    );
};

export default LoadingScreen;
