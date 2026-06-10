'use client';

import { useEffect } from 'react';
import { supabase } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';

/**
 * Lee la sesión de Supabase del localStorage de forma síncrona.
 * Esto evita una llamada de red innecesaria cuando la sesión ya existe localmente.
 */
function getSessionFromStorage(): { userId: string; role: string } | null {
    try {
        // Supabase guarda la sesión con una clave que empieza con "sb-"
        const key = Object.keys(localStorage).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'));
        if (!key) return null;
        const raw = localStorage.getItem(key);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        const user = parsed?.user;
        if (!user?.id) return null;
        const role = (user?.user_metadata?.role || 'cliente').toLowerCase();
        return { userId: user.id, role };
    } catch {
        return null;
    }
}

export default function Home() {
    const router = useRouter();

    useEffect(() => {
        const checkAuthAndRedirect = async () => {
            // PASO 1: Leer sesión del localStorage (instantáneo, sin red)
            const cached = getSessionFromStorage();

            if (!cached) {
                // Sin sesión local → redirigir a tienda inmediatamente
                router.push('/tienda');
                return;
            }

            // PASO 2: Con sesión local, intentar obtener el rol real del perfil
            // con un timeout agresivo para no bloquear si la red es lenta
            let finalRole = cached.role;

            try {
                const profileFetch = supabase
                    .from('profiles')
                    .select('role')
                    .eq('id', cached.userId)
                    .single();

                const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 2000));

                const result = await Promise.race([profileFetch, timeout]);

                // Si obtuvo respuesta de la DB a tiempo
                if (result && 'data' in result && result.data?.role) {
                    finalRole = result.data.role.toLowerCase();
                }

                // Si metadata dice repartidor, respetar ese rol
                if (cached.role === 'repartidor') {
                    finalRole = 'repartidor';
                }
            } catch {
                // En caso de error, usar el rol del localStorage como fallback
                console.warn('Profile fetch failed, using cached role:', finalRole);
            }

            // PASO 3: Verificar que la sesión de Supabase siga siendo válida
            // (solo si el localStorage dice que hay sesión, para confirmar el token)
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (!session) {
                    router.push('/tienda');
                    return;
                }
            } catch {
                // Si falla la verificación, igual redirigir con el rol cacheado
            }

            // PASO 4: Redirigir según rol
            if (finalRole === 'administrador') {
                router.push('/admin/users');
            } else if (finalRole === 'cajero') {
                router.push('/cashier');
            } else if (finalRole === 'cocina') {
                router.push('/cocina');
            } else if (finalRole === 'repartidor') {
                router.push('/repartidor');
            } else {
                router.push('/tienda');
            }
        };

        checkAuthAndRedirect();
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

