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
        // Get initial session
        const getUser = async () => {
            try {
                const { data: { session }, error: sessionError } = await supabase.auth.getSession();

                if (sessionError) {
                    console.error('Session error:', sessionError);
                    setLoading(false);
                    return;
                }

                if (session?.user) {
                    // Try fetching from 'profiles' table first
                    let { data: profile, error } = await supabase
                        .from('profiles')
                        .select('*')
                        .eq('id', session.user.id)
                        .single();

                    if (error) {
                        console.warn('Error fetching from profiles, trying usuarios fallback:', error.message);
                        const result = await supabase
                            .from('usuarios')
                            .select('*')
                            .eq('id', session.user.id)
                            .single();
                        profile = result.data;
                    }

                    if (profile) {
                        setUser({
                            id: profile.id,
                            email: profile.email,
                            full_name: profile.full_name || 'Usuario',
                            role: profile.role ? profile.role.toLowerCase() : 'cliente', // Normalize role
                            avatar_url: profile.avatar_url,
                        });
                    } else {
                        // Fallback using session data if DB fetch completely fails
                        console.warn('Profile not found in DB, using session fallback');
                        setUser({
                            id: session.user.id,
                            email: session.user.email || '',
                            full_name: session.user.user_metadata?.full_name || 'Usuario',
                            role: (session.user.user_metadata?.role || 'cliente').toLowerCase(),
                            avatar_url: '',
                        });
                    }
                } else {
                    setUser(null);
                }
            } catch (error) {
                console.error('Error in getUser:', error);
                setUser(null);
            } finally {
                setLoading(false);
            }
        };

        getUser();

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            try {
                if (session?.user) {
                    // Try fetching from 'profiles' table first
                    let { data: profile, error } = await supabase
                        .from('profiles')
                        .select('*')
                        .eq('id', session.user.id)
                        .single();

                    if (error) {
                        const result = await supabase
                            .from('usuarios')
                            .select('*')
                            .eq('id', session.user.id)
                            .single();
                        profile = result.data;
                    }

                    if (profile) {
                        setUser({
                            id: profile.id,
                            email: profile.email,
                            full_name: profile.full_name || 'Usuario',
                            role: profile.role ? profile.role.toLowerCase() : 'cliente',
                            avatar_url: profile.avatar_url,
                        });
                    } else {
                        setUser({
                            id: session.user.id,
                            email: session.user.email || '',
                            full_name: session.user.user_metadata?.full_name || 'Usuario',
                            role: (session.user.user_metadata?.role || 'cliente').toLowerCase(),
                            avatar_url: '',
                        });
                    }
                } else {
                    setUser(null);
                }
            } catch (error) {
                console.error('Error in onAuthStateChange:', error);
            } finally {
                setLoading(false);
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
