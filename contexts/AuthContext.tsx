'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';

const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface User {
    id: string;
    email: string;
    full_name: string;
    role: 'administrador' | 'cajero' | 'cocina';
    avatar_url?: string;
}

interface AuthContextType {
    user: User | null;
    loading: boolean;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    loading: true,
    signOut: async () => { },
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let isInstanceMounted = true;

        const handleUserData = async (session: any) => {
            if (!session?.user) {
                if (isInstanceMounted) {
                    setUser(null);
                    setLoading(false);
                }
                return;
            }

            // 1. Initial Quick Sync from Metadata (Avoids stuck loading)
            const metadata = session.user.user_metadata || {};
            if (isInstanceMounted) {
                setUser({
                    id: session.user.id,
                    email: session.user.email || '',
                    full_name: metadata.full_name || 'Usuario',
                    role: (metadata.role || 'cliente').toLowerCase() as any,
                    avatar_url: metadata.avatar_url || '',
                });
                // We can set loading to false here to unblock UI if we have enough metadata
                setLoading(false);
            }

            // 2. Background Sync from Database (Profiles/Usuarios)
            try {
                const { data: profile, error } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', session.user.id)
                    .single();

                if (profile && isInstanceMounted) {
                    setUser({
                        id: profile.id,
                        email: profile.email,
                        full_name: profile.full_name || metadata.full_name || 'Usuario',
                        role: (profile.role || metadata.role || 'cliente').toLowerCase() as any,
                        avatar_url: profile.avatar_url,
                    });
                }
            } catch (err) {
                console.warn('Profile sync failed, kept metadata version:', err);
            }
        };

        // Suppress redundant getUser call on mount, let onAuthStateChange handle INITIAL_SESSION
        // which triggers automatically in newer Supabase versions. 
        // If not, we manually trigger one check.
        const checkInitial = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) await handleUserData(session);
            else if (isInstanceMounted) setLoading(false);
        };

        checkInitial();

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            console.log(`🔑 [Auth] Event: ${event} | User: ${session?.user?.email}`);

            if (event === 'SIGNED_OUT') {
                if (isInstanceMounted) {
                    setUser(null);
                    setLoading(false);
                }
            } else if (session) {
                await handleUserData(session);
            }
        });

        // Safety timeout to prevent infinite loading in case of network freeze
        const safetyTimeout = setTimeout(() => {
            setLoading(prev => {
                if (prev) {
                    console.warn('⚠️ Force-disabling loading state due to timeout');
                    return false;
                }
                return prev;
            });
        }, 8000);

        return () => {
            isInstanceMounted = false;
            subscription.unsubscribe();
            clearTimeout(safetyTimeout);
        };
    }, []);

    const signOut = async () => {
        try {
            await supabase.auth.signOut();
        } catch (error) {
            console.error('Error signing out:', error);
        } finally {
            setUser(null);
            window.location.href = '/login';
        }
    };

    return (
        <AuthContext.Provider value={{ user, loading, signOut }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
