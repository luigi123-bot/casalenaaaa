'use client';

import { useState } from 'react';
import { supabase } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) {
                setError(error.message);
                return;
            }

            if (data.user) {
                // Get user profile to determine role
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('role')
                    .eq('id', data.user.id)
                    .single();

                // If profiles doesn't exist, try usuarios
                const role = profile?.role || (await supabase
                    .from('usuarios')
                    .select('role')
                    .eq('id', data.user.id)
                    .single()).data?.role;

                // Redirect based on role
                // Redirect based on role
                switch (role) {
                    case 'administrador':
                        router.push('/admin/users');
                        break;
                    case 'cajero':
                        router.push('/cashier');
                        break;
                    case 'cocina':
                        router.push('/cocina');
                        break;
                    case 'cliente':
                        router.push('/tienda');
                        break;
                    default:
                        // Default fallback, maybe to a generic user profile or home
                        router.push('/');
                }
            }
        } catch (err) {
            setError('Error al iniciar sesión');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-[#F27405] via-[#ff8c1a] to-[#d66503] flex items-center justify-center p-4 relative overflow-hidden">
            {/* Decorative background elements */}
            <div className="absolute inset-0 overflow-hidden">
                <div className="absolute -top-40 -right-40 w-80 h-80 bg-white/10 rounded-full blur-3xl"></div>
                <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-black/10 rounded-full blur-3xl"></div>
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-white/5 rounded-full blur-3xl"></div>
            </div>
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-10 relative z-10 backdrop-blur-sm border border-white/20">
                {/* Logo */}
                <div className="flex flex-col items-center justify-center gap-4 mb-8">
                    <div className="w-32 h-32 rounded-full bg-white p-2 shadow-xl ring-4 ring-[#F27405]/20 overflow-hidden">
                        <img
                            src="/logo-main.jpg"
                            alt="Casa Leña Logo"
                            className="w-full h-full object-cover"
                        />
                    </div>
                    <h1 className="text-4xl font-bold tracking-tight text-[#181511]">
                        Casa<span className="text-[#F27405]">leña</span>
                    </h1>
                </div>

                <h2 className="text-2xl font-bold text-center text-[#181511] mb-2">Iniciar Sesión</h2>
                <p className="text-center text-[#8c785f] mb-8">Sistema de Punto de Venta</p>

                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-6 flex items-center gap-2">
                        <span className="material-symbols-outlined text-[20px]">error</span>
                        <p className="text-sm">{error}</p>
                    </div>
                )}

                <form onSubmit={handleLogin} className="space-y-6">
                    <div>
                        <label htmlFor="email" className="block text-sm font-bold text-[#181511] mb-2">
                            Correo Electrónico
                        </label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-[#8c785f] text-[20px]">
                                mail
                            </span>
                            <input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full pl-12 pr-4 py-3 border-2 border-[#e6e1db] rounded-xl focus:ring-2 focus:ring-[#F27405] focus:border-[#F27405] outline-none transition-all text-[#181511] bg-white"
                                placeholder="tu@email.com"
                                required
                                disabled={loading}
                            />
                        </div>
                    </div>

                    <div>
                        <label htmlFor="password" className="block text-sm font-bold text-[#181511] mb-2">
                            Contraseña
                        </label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-[#8c785f] text-[20px]">
                                lock
                            </span>
                            <input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full pl-12 pr-4 py-3 border-2 border-[#e6e1db] rounded-xl focus:ring-2 focus:ring-[#F27405] focus:border-[#F27405] outline-none transition-all text-[#181511] bg-white"
                                placeholder="••••••••"
                                required
                                disabled={loading}
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-gradient-to-r from-[#F27405] to-[#d66503] hover:from-[#d66503] hover:to-[#F27405] text-white font-bold py-4 px-4 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98]"
                    >
                        {loading ? (
                            <>
                                <span className="material-symbols-outlined animate-spin">progress_activity</span>
                                Iniciando sesión...
                            </>
                        ) : (
                            <>
                                <span className="material-symbols-outlined">login</span>
                                Iniciar Sesión
                            </>
                        )}
                    </button>
                </form>

                <div className="mt-8 text-center">
                    <p className="text-sm text-[#8c785f]">
                        ¿No tienes cuenta?{' '}
                        <a href="/register" className="text-[#F27405] hover:text-[#d66503] font-bold transition-colors">
                            Regístrate
                        </a>
                    </p>
                </div>
            </div>
        </div>
    );
}
