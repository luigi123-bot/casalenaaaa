'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
    const router = useRouter();

    useEffect(() => {
        const cachedRole = typeof window !== 'undefined' ? localStorage.getItem('casalena-user-role') : null;
        if (cachedRole) {
            const role = cachedRole.toLowerCase();
            let target = '/tienda';
            if (role === 'administrador') target = '/admin';
            else if (role === 'cajero') target = '/cashier';
            else if (role === 'cocina') target = '/cocina';
            else if (role === 'repartidor') target = '/repartidor';
            
            router.replace(target);
            return;
        }
        router.replace('/redirect');
    }, [router]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#f8f7f5]">
            <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 border-4 border-[#F7941D] border-t-transparent rounded-full animate-spin"></div>
                <p className="font-black text-gray-400 uppercase tracking-widest text-xs">Cargando experiencia...</p>
            </div>
        </div>
    );
}
