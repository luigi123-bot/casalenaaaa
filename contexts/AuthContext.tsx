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
    // ✅ FIX: Siempre iniciar en null/true — nunca mostrar un perfil cacheado de otro
    // usuario antes de verificar la sesión activa. El caché se usa en handleUserData
    // DESPUÉS de confirmar que cachedProfile.id === userId (sesión válida).
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let isInstanceMounted = true;

        const handleUserData = async (session: any) => {
            if (!session?.user) {
                if (isInstanceMounted) {
                    setUser(null);
                    localStorage.removeItem('casalena-user-role');
                    localStorage.removeItem('casalena-user-profile');
                    setLoading(false);
                }
                return;
            }

            const metadata = session.user.user_metadata || {};
            const userId = session.user.id;

            // 1. Optimistic recovery from local storage cache to disable loading state instantly (0ms delay)
            let cachedProfile: User | null = null;
            try {
                const raw = localStorage.getItem('casalena-user-profile');
                if (raw) {
                    cachedProfile = JSON.parse(raw);
                }
            } catch (e) {
                console.warn('Failed to parse cached profile:', e);
            }

            if (cachedProfile && cachedProfile.id === userId) {
                if (isInstanceMounted) {
                    setUser(cachedProfile);
                    setLoading(false);
                }
                
                // Fetch in background to ensure profile is up-to-date
                const fetchBackground = async () => {
                    try {
                        const { data: profile } = await supabase
                            .from('profiles')
                            .select('id, email, full_name, role, avatar_url')
                            .eq('id', userId)
                            .single();
                        
                        if (profile && isInstanceMounted) {
                            let role = (profile.role || metadata.role || 'cliente').toLowerCase();
                            if (metadata.role?.toLowerCase() === 'repartidor') {
                                role = 'repartidor';
                            }
                            const updatedUser: User = {
                                id: profile.id,
                                email: profile.email || session.user.email || '',
                                full_name: profile.full_name || metadata.full_name || 'Usuario',
                                role: role as any,
                                avatar_url: profile.avatar_url,
                            };
                            setUser(updatedUser);
                            localStorage.setItem('casalena-user-role', role);
                            localStorage.setItem('casalena-user-profile', JSON.stringify(updatedUser));
                        }
                    } catch (err) {
                        console.warn('Background profile update failed:', err);
                    }
                };
                fetchBackground();
                return;
            }

            // 2. Fetch role from database profiles table (initial fetch if cache is empty)
            try {
                const profilePromise = supabase
                    .from('profiles')
                    .select('id, email, full_name, role, avatar_url')
                    .eq('id', userId)
                    .single();

                const timeoutPromise = new Promise<null>(resolve =>
                    setTimeout(() => resolve(null), 2000)
                );

                const result = await Promise.race([profilePromise, timeoutPromise]);

                if (!isInstanceMounted) return;

                if (result && 'data' in result && result.data) {
                    const profile = result.data;
                    let role = (profile.role || metadata.role || 'cliente').toLowerCase();
                    if (metadata.role?.toLowerCase() === 'repartidor') {
                        role = 'repartidor';
                    }
                    const resolvedUser: User = {
                        id: profile.id,
                        email: profile.email || session.user.email || '',
                        full_name: profile.full_name || metadata.full_name || 'Usuario',
                        role: role as any,
                        avatar_url: profile.avatar_url,
                    };
                    setUser(resolvedUser);
                    localStorage.setItem('casalena-user-role', role);
                    localStorage.setItem('casalena-user-profile', JSON.stringify(resolvedUser));
                } else {
                    let role = (metadata.role || 'cliente').toLowerCase();
                    if (metadata.role?.toLowerCase() === 'repartidor') {
                        role = 'repartidor';
                    }
                    const fallbackUser: User = {
                        id: userId,
                        email: session.user.email || '',
                        full_name: metadata.full_name || 'Usuario',
                        role: role as any,
                        avatar_url: metadata.avatar_url || '',
                    };
                    setUser(fallbackUser);
                    localStorage.setItem('casalena-user-role', role);
                    localStorage.setItem('casalena-user-profile', JSON.stringify(fallbackUser));

                    const fetchFallbackBackground = async () => {
                        try {
                            const { data: profile } = await profilePromise;
                            if (profile && isInstanceMounted) {
                                let dbRole = (profile.role || metadata.role || 'cliente').toLowerCase();
                                if (metadata.role?.toLowerCase() === 'repartidor') {
                                    dbRole = 'repartidor';
                                }
                                const updatedUser: User = {
                                    id: profile.id,
                                    email: profile.email || session.user.email || '',
                                    full_name: profile.full_name || metadata.full_name || 'Usuario',
                                    role: dbRole as any,
                                    avatar_url: profile.avatar_url,
                                };
                                setUser(updatedUser);
                                localStorage.setItem('casalena-user-role', dbRole);
                                localStorage.setItem('casalena-user-profile', JSON.stringify(updatedUser));
                            }
                        } catch (err) {
                            // Silencioso
                        }
                    };
                    fetchFallbackBackground();
                }
            } catch (err) {
                if (isInstanceMounted) {
                    console.warn('[Auth] Profile fetch failed, using metadata fallback:', err);
                    let role = (metadata.role || 'cliente').toLowerCase();
                    if (metadata.role?.toLowerCase() === 'repartidor') {
                        role = 'repartidor';
                    }
                    const fallbackUser: User = {
                        id: userId,
                        email: session.user.email || '',
                        full_name: metadata.full_name || 'Usuario',
                        role: role as any,
                        avatar_url: metadata.avatar_url || '',
                    };
                    setUser(fallbackUser);
                    localStorage.setItem('casalena-user-role', role);
                    localStorage.setItem('casalena-user-profile', JSON.stringify(fallbackUser));
                }
            } finally {
                if (isInstanceMounted) setLoading(false);
            }
        };

        let isHandling = false;

        const checkInitial = async () => {
            if (isHandling) return;
            isHandling = true;
            try {
                // ✅ FIX: Añadir timeout a getSession() para que el AuthContext no se quede
                // colgado indefinidamente. Antes podía tardar hasta 4s (safety timeout).
                // Ahora resuelve en máximo 3s y libera el estado de carga.
                const result = await Promise.race([
                    supabase.auth.getSession(),
                    new Promise<{ data: { session: null } }>(resolve =>
                        setTimeout(() => {
                            console.warn('[Auth] getSession() timeout — continuando sin sesión.');
                            resolve({ data: { session: null } });
                        }, 3000)
                    )
                ]);
                const session = result.data.session;
                if (session) await handleUserData(session);
                else if (isInstanceMounted) setLoading(false);
            } catch (err) {
                console.warn('[Auth] Error en checkInitial:', err);
                if (isInstanceMounted) setLoading(false);
            } finally {
                isHandling = false;
            }
        };

        checkInitial();

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (event === 'INITIAL_SESSION') return;

            if (event === 'SIGNED_OUT') {
                if (isInstanceMounted) {
                    setUser(null);
                    localStorage.removeItem('casalena-user-role');
                    localStorage.removeItem('casalena-user-profile');
                    setLoading(false);
                }
            } else if (session) {
                await handleUserData(session);
            }
        });

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
            localStorage.removeItem('casalena-user-role');
            localStorage.removeItem('casalena-user-profile');
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
