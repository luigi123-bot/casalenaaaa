'use client';

import { useEffect } from 'react';
import { supabase } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';

export default function Home() {
    const router = useRouter();

    useEffect(() => {
        const checkAuthAndRedirect = async () => {
            const { data: { session } } = await supabase.auth.getSession();

            if (!session) {
                // If not logged in, go to store
                router.push('/tienda');
                return;
            }

            // If logged in, resolve role and redirect
            try {
                let role = '';
                
                // 1. Try from profiles table
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('role')
                    .eq('id', session.user.id)
                    .single();

                if (profile?.role) {
                    role = profile.role.toLowerCase();
                } else {
                    // 2. Fallback to auth metadata
                    role = (session.user.user_metadata?.role || 'cliente').toLowerCase();
                }

                // Redirect based on role
                if (role === 'administrador') {
                    router.push('/admin/users');
                } else if (role === 'cajero') {
                    router.push('/cashier');
                } else if (role === 'cocina') {
                    router.push('/cocina');
                } else {
                    // Default for clients and others
                    router.push('/tienda');
                }
            } catch (error) {
                console.error('Error redirecting authenticated user:', error);
                router.push('/tienda'); // Safety fallback
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
