'use client';

import { useState } from 'react';
import { supabase } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

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

            if (error) throw error;

            // Get user role from profiles table
            const { data: profile } = await supabase
                .from('profiles')
                .select('role')
                .eq('id', data.user.id)
                .single();

            // Redirect based on role
            const role = profile?.role;
            console.log('👤 [Login] User role found:', role);

            if (role === 'admin' || role === 'administrador') {
                router.push('/admin');
            } else if (role === 'cashier' || role === 'cajero') {
                router.push('/cashier');
            } else if (role === 'kitchen' || role === 'cocina') {
                router.push('/cocina');
            } else {
                // Default to store for clients and others
                router.push('/tienda');
            }
        } catch (error: any) {
            setError(error.message || 'Error al iniciar sesión');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex relative overflow-hidden">
            {/* Left Side - Brand Information with Enhanced Effects */}
            <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-[#1e3a5f] via-[#2d5a8f] to-[#4a7bb8] relative overflow-hidden">
                {/* Animated Background Gradient */}
                <div className="absolute inset-0 bg-gradient-to-br from-[#1e3a5f]/50 via-[#2d5a8f]/30 to-[#4a7bb8]/50 animate-gradient-shift"></div>

                {/* Floating Particles/Orbs */}
                <div className="absolute inset-0 opacity-20">
                    <div className="absolute top-20 left-20 w-72 h-72 bg-white rounded-full blur-3xl animate-float-slow"></div>
                    <div className="absolute bottom-20 right-20 w-96 h-96 bg-[#F7941D] rounded-full blur-3xl animate-float-slower"></div>
                    <div className="absolute top-1/2 left-1/3 w-64 h-64 bg-white rounded-full blur-2xl animate-float"></div>
                </div>

                {/* Geometric Pattern Overlay */}
                <div className="absolute inset-0 opacity-5" style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
                }}></div>

                {/* Content */}
                <div className="relative z-10 flex flex-col justify-center px-16 text-white">
                    {/* Logo - LARGER with Animation */}
                    <div className="mb-12 relative group">
                        {/* Glow Effect Behind Logo */}
                        <div className="absolute inset-0 bg-[#F7941D] rounded-3xl blur-2xl opacity-40 group-hover:opacity-60 transition-opacity duration-500 animate-pulse-slow"></div>

                        {/* Logo Container */}
                        <div className="relative">
                            <img
                                src="/logo-main.jpg"
                                alt="Casa Leña Logo"
                                className="w-32 h-32 rounded-3xl shadow-2xl transform hover:scale-110 transition-all duration-500 animate-float ring-4 ring-white/20 hover:ring-[#F7941D]/50"
                            />
                            {/* Shine Effect */}
                            <div className="absolute inset-0 rounded-3xl bg-gradient-to-tr from-transparent via-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                        </div>
                    </div>

                    {/* Title with Gradient Animation */}
                    <h1 className="text-5xl font-black mb-4 leading-tight animate-fade-in-up">
                        Sistema de<br />
                        <span className="text-[#F7941D] bg-clip-text text-transparent bg-gradient-to-r from-[#F7941D] via-[#FFC107] to-[#F7941D] bg-[length:200%_auto] animate-gradient-text">
                            Punto de Venta
                        </span>
                    </h1>

                    <p className="text-lg text-blue-100 mb-12 max-w-md animate-fade-in-up animation-delay-200">
                        Gestión profesional y control total de tu restaurante
                    </p>

                    {/* Features with Stagger Animation */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-3 animate-fade-in-left animation-delay-300 hover:translate-x-2 transition-transform duration-300">
                            <div className="w-12 h-12 bg-white/10 backdrop-blur rounded-xl flex items-center justify-center shadow-lg hover:bg-white/20 transition-all">
                                <span className="material-icons-round text-[#F7941D] text-2xl">restaurant_menu</span>
                            </div>
                            <span className="text-sm font-medium">Gestión de pedidos en tiempo real</span>
                        </div>
                        <div className="flex items-center gap-3 animate-fade-in-left animation-delay-400 hover:translate-x-2 transition-transform duration-300">
                            <div className="w-12 h-12 bg-white/10 backdrop-blur rounded-xl flex items-center justify-center shadow-lg hover:bg-white/20 transition-all">
                                <span className="material-icons-round text-[#F7941D] text-2xl">inventory_2</span>
                            </div>
                            <span className="text-sm font-medium">Control de inventario inteligente</span>
                        </div>
                        <div className="flex items-center gap-3 animate-fade-in-left animation-delay-500 hover:translate-x-2 transition-transform duration-300">
                            <div className="w-12 h-12 bg-white/10 backdrop-blur rounded-xl flex items-center justify-center shadow-lg hover:bg-white/20 transition-all">
                                <span className="material-icons-round text-[#F7941D] text-2xl">analytics</span>
                            </div>
                            <span className="text-sm font-medium">Reportes y análisis detallados</span>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="absolute bottom-8 left-16 text-xs text-blue-200 animate-fade-in">
                        © 2025 Casa Leña. Todos los derechos reservados.
                    </div>
                </div>
            </div>

            {/* Right Side - Login Form */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-gradient-to-br from-slate-50 via-white to-slate-100 relative">
                {/* Subtle Background Pattern */}
                <div className="absolute inset-0 opacity-[0.02]" style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M11 18c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm48 25c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm-43-7c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm63 31c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM34 90c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm56-76c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM12 86c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm28-65c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm23-11c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-6 60c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm29 22c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zM32 63c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm57-13c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-9-21c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM60 91c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM35 41c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM12 60c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2z' fill='%23000000' fill-opacity='1' fill-rule='evenodd'/%3E%3C/svg%3E")`,
                }}></div>

                {/* Mobile Logo - LARGER */}
                <div className="lg:hidden absolute top-8 left-8 group">
                    <div className="absolute inset-0 bg-[#F7941D] rounded-2xl blur-xl opacity-40 group-hover:opacity-60 transition-opacity animate-pulse-slow"></div>
                    <img
                        src="/logo-main.jpg"
                        alt="Casa Leña Logo"
                        className="relative w-20 h-20 rounded-2xl shadow-xl transform hover:scale-110 transition-all duration-500 animate-float ring-2 ring-[#F7941D]/30"
                    />
                </div>

                <div className="w-full max-w-md animate-fade-in-up">
                    {/* Login Card with Enhanced Shadow */}
                    <div className="bg-white rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.1)] hover:shadow-[0_20px_80px_rgba(0,0,0,0.15)] transition-shadow duration-500 p-8 backdrop-blur-sm border border-white/20">
                        {/* Header */}
                        <div className="mb-8">
                            <h2 className="text-3xl font-black text-gray-900 mb-2">
                                Iniciar Sesión en<br />
                                <span className="text-[#F7941D]">CasaleñaPOS</span>
                            </h2>
                            <p className="text-sm text-gray-500">
                                ¡Bienvenido de vuelta! Inicia sesión para continuar
                            </p>
                        </div>

                        {/* Error Message */}
                        {error && (
                            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm animate-shake">
                                {error}
                            </div>
                        )}

                        {/* Form */}
                        <form onSubmit={handleLogin} className="space-y-5">
                            <div className="group">
                                <label className="block text-sm font-bold text-gray-700 mb-2">
                                    Correo electrónico o usuario
                                </label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#F7941D] focus:border-transparent focus:bg-white text-[#181511] placeholder-gray-400 font-medium transition-all group-hover:border-gray-300"
                                    placeholder="Ingresa tu correo o usuario"
                                    required
                                />
                            </div>

                            <div className="group">
                                <div className="flex justify-between items-center mb-2">
                                    <label className="block text-sm font-bold text-gray-700">
                                        Contraseña
                                    </label>
                                    <a href="#" className="text-xs font-bold text-[#F7941D] hover:text-[#e8891a] transition-colors">
                                        ¿Olvidaste tu contraseña?
                                    </a>
                                </div>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#F7941D] focus:border-transparent focus:bg-white text-[#181511] placeholder-gray-400 font-medium transition-all group-hover:border-gray-300"
                                    placeholder="Ingresa tu contraseña"
                                    required
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-gradient-to-r from-[#4a7bb8] to-[#2d5a8f] text-white py-3.5 rounded-xl font-bold shadow-lg hover:shadow-2xl transform hover:-translate-y-1 hover:scale-[1.02] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2 relative overflow-hidden group"
                            >
                                <div className="absolute inset-0 bg-gradient-to-r from-[#2d5a8f] to-[#4a7bb8] opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                                <span className="relative z-10 flex items-center gap-2">
                                    {loading ? (
                                        <>
                                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                            Iniciando sesión...
                                        </>
                                    ) : (
                                        <>
                                            Continuar
                                            <span className="material-icons-round text-lg group-hover:translate-x-1 transition-transform">arrow_forward</span>
                                        </>
                                    )}
                                </span>
                            </button>
                        </form>
                    </div>
                </div>
            </div>

            {/* Custom Animations CSS */}
            <style jsx>{`
                @keyframes float {
                    0%, 100% { transform: translateY(0px) translateX(0px); }
                    33% { transform: translateY(-20px) translateX(10px); }
                    66% { transform: translateY(10px) translateX(-10px); }
                }
                @keyframes float-slow {
                    0%, 100% { transform: translateY(0px) translateX(0px) scale(1); }
                    50% { transform: translateY(-30px) translateX(20px) scale(1.1); }
                }
                @keyframes float-slower {
                    0%, 100% { transform: translateY(0px) translateX(0px) rotate(0deg); }
                    50% { transform: translateY(20px) translateX(-30px) rotate(5deg); }
                }
                @keyframes gradient-shift {
                    0%, 100% { opacity: 0.5; }
                    50% { opacity: 0.8; }
                }
                @keyframes gradient-text {
                    0% { background-position: 0% 50%; }
                    50% { background-position: 100% 50%; }
                    100% { background-position: 0% 50%; }
                }
                @keyframes pulse-slow {
                    0%, 100% { opacity: 0.4; }
                    50% { opacity: 0.6; }
                }
                @keyframes fade-in {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes fade-in-up {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @keyframes fade-in-left {
                    from { opacity: 0; transform: translateX(-20px); }
                    to { opacity: 1; transform: translateX(0); }
                }
                @keyframes shake {
                    0%, 100% { transform: translateX(0); }
                    25% { transform: translateX(-10px); }
                    75% { transform: translateX(10px); }
                }
                .animate-float { animation: float 6s ease-in-out infinite; }
                .animate-float-slow { animation: float-slow 8s ease-in-out infinite; }
                .animate-float-slower { animation: float-slower 10s ease-in-out infinite; }
                .animate-gradient-shift { animation: gradient-shift 4s ease-in-out infinite; }
                .animate-gradient-text { animation: gradient-text 3s ease infinite; }
                .animate-pulse-slow { animation: pulse-slow 3s ease-in-out infinite; }
                .animate-fade-in { animation: fade-in 1s ease-out; }
                .animate-fade-in-up { animation: fade-in-up 0.8s ease-out; }
                .animate-fade-in-left { animation: fade-in-left 0.8s ease-out; }
                .animate-shake { animation: shake 0.5s ease-in-out; }
                .animation-delay-200 { animation-delay: 0.2s; }
                .animation-delay-300 { animation-delay: 0.3s; }
                .animation-delay-400 { animation-delay: 0.4s; }
                .animation-delay-500 { animation-delay: 0.5s; }
            `}</style>
        </div>
    );
}
