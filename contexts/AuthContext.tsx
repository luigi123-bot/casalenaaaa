'use client';

import { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import { supabase } from '@/utils/supabase/client';


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

            const metadata = session.user.user_metadata || {};

            // Intentar obtener el rol real de la DB con timeout de 2s
            // Si la DB responde a tiempo → usar ese rol (fuente de verdad)
            // Si se demora o falla → fallback a metadata para no bloquear la UI
            try {
                const profilePromise = supabase
                    .from('profiles')
                    .select('id, email, full_name, role, avatar_url')
                    .eq('id', session.user.id)
                    .single();

                const timeoutPromise = new Promise<null>(resolve =>
                    setTimeout(() => resolve(null), 2000)
                );

                const result = await Promise.race([profilePromise, timeoutPromise]);

                if (!isInstanceMounted) return;

                if (result && 'data' in result && result.data) {
                    // ✅ DB respondió a tiempo — usar el rol real
                    const profile = result.data;
                    setUser({
                        id: profile.id,
                        email: profile.email || session.user.email || '',
                        full_name: profile.full_name || metadata.full_name || 'Usuario',
                        role: (profile.role || metadata.role || 'cliente').toLowerCase() as any,
                        avatar_url: profile.avatar_url,
                    });
                } else {
                    // ⚠️ Timeout — usar metadata como fallback temporal
                    // Se actualizará automáticamente si la DB responde después
                    setUser({
                        id: session.user.id,
                        email: session.user.email || '',
                        full_name: metadata.full_name || 'Usuario',
                        role: (metadata.role || 'cliente').toLowerCase() as any,
                        avatar_url: metadata.avatar_url || '',
                    });

                    // Intentar obtener de DB en segundo plano (sin bloquear UI)
                    profilePromise.then(({ data: profile }) => {
                        if (profile && isInstanceMounted) {
                            setUser(prev => prev ? {
                                ...prev,
                                full_name: profile.full_name || prev.full_name,
                                role: (profile.role || prev.role).toLowerCase() as any,
                                avatar_url: profile.avatar_url || prev.avatar_url,
                            } : null);
                        }
                    }).catch(() => { /* silencioso — metadata ya fue aplicada */ });
                }
            } catch (err) {
                // Error total → usar metadata como último recurso
                if (isInstanceMounted) {
                    console.warn('[Auth] Profile fetch failed, using metadata fallback:', err);
                    setUser({
                        id: session.user.id,
                        email: session.user.email || '',
                        full_name: metadata.full_name || 'Usuario',
                        role: (metadata.role || 'cliente').toLowerCase() as any,
                        avatar_url: metadata.avatar_url || '',
                    });
                }
            } finally {
                if (isInstanceMounted) setLoading(false);
            }
        };

        let isHandling = false; // Prevenir llamadas concurrentes a handleUserData

        const checkInitial = async () => {
            if (isHandling) return;
            isHandling = true;
            const { data: { session } } = await supabase.auth.getSession();
            if (session) await handleUserData(session);
            else if (isInstanceMounted) setLoading(false);
            isHandling = false;
        };

        checkInitial();

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            // Ignorar el INITIAL_SESSION que llega al mismo tiempo que checkInitial
            if (event === 'INITIAL_SESSION') return;

            if (event === 'SIGNED_OUT') {
                if (isInstanceMounted) {
                    setUser(null);
                    setLoading(false);
                }
            } else if (session) {
                await handleUserData(session);
            }
        });

        // Safety timeout: 4s (2s más que el timeout del profilePromise)
        // Evita que el loading quede bloqueado si Supabase no responde en absoluto
        const safetyTimeout = setTimeout(() => {
            setLoading(prev => {
                if (prev) {
                    console.warn('⚠️ [Auth] Force-disabling loading state due to timeout');
                    return false;
                }
                return prev;
            });
        }, 4000);

        return () => {
            isInstanceMounted = false;
            subscription.unsubscribe();
            clearTimeout(safetyTimeout);
        };
    }, []);

    // ✅ FIX: useCallback so signOut reference is stable across renders
    const signOut = useCallback(async () => {
        try {
            await supabase.auth.signOut({ scope: 'local' });
        } catch (error) {
            console.error('Error signing out:', error);
            try {
                Object.keys(window.localStorage).forEach(key => {
                    if (key.startsWith('sb-') && key.endsWith('-auth-token')) {
                        window.localStorage.removeItem(key);
                    }
                });
            } catch (e) {
                console.error('Could not clear local storage manually');
            }
        } finally {
            setUser(null);
            window.location.href = '/tienda';
        }
    }, []);

    // Memoize context value — prevents re-rendering all consumers when unrelated state changes
    const value = useMemo(() => ({ user, loading, signOut }), [user, loading]);

    return (
        <AuthContext.Provider value={value}>
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
