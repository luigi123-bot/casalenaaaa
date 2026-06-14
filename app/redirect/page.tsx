'use client';

import { useEffect } from 'react';
import { supabase } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';

export default function RedirectPage() {
    const router = useRouter();

    useEffect(() => {
        const checkSessionAndRedirect = async () => {
            try {
                // 1. Optimistic cached role check for instant redirect (0ms)
                const cachedRole = typeof window !== 'undefined' ? localStorage.getItem('casalena-user-role') : null;
                if (cachedRole) {
                    const role = cachedRole.toLowerCase();
                    let target = '/tienda';
                    if (role === 'administrador') target = '/admin';
                    else if (role === 'cajero') target = '/cashier';
                    else if (role === 'cocina') target = '/cocina';
                    else if (role === 'repartidor') target = '/repartidor';
                    
                    console.log('⚡ [Redirect] Optimistic redirect based on cached role:', role);
                    router.replace(target);

                    // Perform background session/profile check to keep the cache accurate
                    supabase.auth.getSession().then(({ data: { session } }) => {
                        if (!session) {
                            localStorage.removeItem('casalena-user-role');
                            localStorage.removeItem('casalena-user-profile');
                            router.replace('/tienda');
                        } else {
                            supabase.from('profiles').select('role').eq('id', session.user.id).single().then(({ data: profile }) => {
                                let realRole = (profile?.role || session.user.user_metadata?.role || 'cliente').toLowerCase();
                                if (session.user.user_metadata?.role?.toLowerCase() === 'repartidor') {
                                    realRole = 'repartidor';
                                }
                                if (realRole !== role) {
                                    localStorage.setItem('casalena-user-role', realRole);
                                    let newTarget = '/tienda';
                                    if (realRole === 'administrador') newTarget = '/admin';
                                    else if (realRole === 'cajero') newTarget = '/cashier';
                                    else if (realRole === 'cocina') newTarget = '/cocina';
                                    else if (realRole === 'repartidor') newTarget = '/repartidor';
                                    
                                    console.log('🔄 [Redirect] Role mismatch in background, updating target:', newTarget);
                                    router.replace(newTarget);
                                }
                            });
                        }
                    }).catch(() => {});
                    return;
                }

                // 2. Full check if cache is empty — con timeout para evitar colgarse
                let session = null;
                let error = null;
                try {
                    const result = await Promise.race([
                        supabase.auth.getSession(),
                        new Promise<never>((_, rej) =>
                            setTimeout(() => rej(new Error('session-timeout')), 5000)
                        )
                    ]);
                    session = result.data.session;
                    error = result.error;
                } catch (timeoutErr: any) {
                    console.warn('[Redirect] getSession() tardó demasiado, redirigiendo a tienda.');
                    router.replace('/tienda');
                    return;
                }

                if (!session || error) {
                    console.log('No active session found, redirecting to storefront.');
                    router.replace('/tienda');
                    return;
                }

                const userId = session.user.id;
                let role = (session.user.user_metadata?.role || 'cliente').toLowerCase();

                try {
                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('role')
                        .eq('id', userId)
                        .single();

                    if (profile?.role) {
                        role = profile.role.toLowerCase();
                    }
                } catch (dbError) {
                    console.warn('Error fetching role from DB profiles:', dbError);
                }

                if (session.user.user_metadata?.role?.toLowerCase() === 'repartidor') {
                    role = 'repartidor';
                }

                console.log('👤 [Redirect] User role resolved:', role);
                localStorage.setItem('casalena-user-role', role);

                if (role === 'administrador') {
                    router.replace('/admin');
                } else if (role === 'cajero') {
                    router.replace('/cashier');
                } else if (role === 'cocina') {
                    router.replace('/cocina');
                } else if (role === 'repartidor') {
                    router.replace('/repartidor');
                } else {
                    router.replace('/tienda');
                }
            } catch (err) {
                console.error('❌ [Redirect] Auth redirect error:', err);
                router.replace('/tienda');
            }
        };

        checkSessionAndRedirect();
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
