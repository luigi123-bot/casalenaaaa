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
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [userRole, setUserRole] = useState<string | null>(null);

    useEffect(() => {
        const checkAuth = async () => {
            try {
                // Check if user is authenticated
                const { data: { session } } = await supabase.auth.getSession();

                if (session) {
                    setIsAuthenticated(true);

                    // Check user role
                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('role')
                        .eq('id', session.user.id)
                        .single();

                    setUserRole(profile?.role || null);
                } else {
                    // No session, but allow access to tienda
                    setIsAuthenticated(false);
                    setUserRole(null);
                }
            } catch (error) {
                console.error('Error checking auth:', error);
                setIsAuthenticated(false);
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

    return (
        <AuthProvider>
            <div className="flex h-screen w-full bg-[#f8f7f5] overflow-hidden">
                {/* Show Sidebar only if authenticated and is a cliente */}
                {isAuthenticated && userRole === 'cliente' && <Sidebar />}

                <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                    {children}
                </div>

                {/* Show support chat only if authenticated */}
                {isAuthenticated && <CustomerSupportChat />}
            </div>
        </AuthProvider>
    );
}
