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

                    // If profiles doesn't exist, try 'usuarios' table
                    if (error && error.code === 'PGRST116') {
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
                            role: profile.role,
                            avatar_url: profile.avatar_url,
                        });
                    } else {
                        console.warn('Profile not found for session user');
                        setUser(null);
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
            if (session?.user) {
                // Try fetching from 'profiles' table first
                let { data: profile, error } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', session.user.id)
                    .single();

                // If profiles doesn't exist, try 'usuarios' table
                if (error && error.code === 'PGRST116') {
                    console.log('Table "profiles" not found, trying "usuarios"...');
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
                        role: profile.role,
                        avatar_url: profile.avatar_url,
                    });
                }
            } else {
                setUser(null);
            }
            setLoading(false);
        });

        return () => {
            subscription.unsubscribe();
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
