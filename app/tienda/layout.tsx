'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';

import { AuthProvider } from '@/contexts/AuthContext';
import Sidebar from '@/components/Sidebar';
import CustomerSupportChat from '@/components/CustomerSupportChat';

export default function TiendaLayout({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [authorized, setAuthorized] = useState(false);

    useEffect(() => {
        const checkAuth = async () => {
            try {
                // Check if user is authenticated
                const { data: { session } } = await supabase.auth.getSession();

                if (!session) {
                    router.push('/login');
                    return;
                }

                // Check if user has cliente role
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('role')
                    .eq('id', session.user.id)
                    .single();

                if (profile?.role === 'cliente') {
                    setAuthorized(true);
                } else {
                    // Redirect based on role
                    if (profile?.role === 'administrador' || profile?.role === 'cajero') {
                        router.push('/admin/users');
                    } else if (profile?.role === 'cocina') {
                        router.push('/cocina');
                    } else {
                        router.push('/login');
                    }
                }
            } catch (error) {
                console.error('Error checking auth:', error);
                router.push('/login');
            } finally {
                setLoading(false);
            }
        };

        checkAuth();
    }, [router]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#fcfbf9]">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-[#8c785f]">Cargando...</p>
                </div>
            </div>
        );
    }

    if (!authorized) {
        return null;
    }

    return (
        <AuthProvider>
            <div className="flex h-screen w-full bg-[#f8f7f5] overflow-hidden">
                <Sidebar />
                <div className="flex-1 flex flex-col min-w-0">
                    {children}
                </div>
                <CustomerSupportChat />
            </div>
        </AuthProvider>
    );
}
