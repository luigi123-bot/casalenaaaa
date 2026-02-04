'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';

export default function UpdatePasswordPage() {
    const router = useRouter();
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        // Optional: Check if user is actually logged in (which they should be if they came from the recovery link)
        const checkSession = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                // If checking session fails or no session, maybe they shouldn't be here (or handled gracefully)
                console.log("No active session found on update-password page.");
                // We won't redirect immediately to allow for edge cases or manual navigation if they are already logged in via other means
            }
        };
        checkSession();
    }, []);

    const handleUpdatePassword = async (e: React.FormEvent) => {
        e.preventDefault();

        if (password !== confirmPassword) {
            setError('Las contraseñas no coinciden');
            return;
        }

        if (password.length < 6) {
            setError('La contraseña debe tener al menos 6 caracteres');
            return;
        }

        setLoading(true);
        setError('');
        setSuccess(false);

        try {
            const { error } = await supabase.auth.updateUser({
                password: password
            });

            if (error) throw error;

            setSuccess(true);
            setTimeout(() => {
                router.push('/login');
            }, 3000); // Redirect after 3 seconds
        } catch (error: any) {
            setError(error.message || 'Error al actualizar la contraseña');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex relative overflow-hidden">
            {/* Left Side - Brand Information */}
            <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-[#1e3a5f] via-[#2d5a8f] to-[#4a7bb8] relative overflow-hidden">
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
                <div className="relative z-10 flex flex-col justify-center px-16 text-white w-full h-full">
                    <div className="mb-8">
                        <h1 className="text-4xl font-black mb-4 leading-tight animate-fade-in-up">
                            Actualizar<br />
                            <span className="text-[#F7941D] bg-clip-text text-transparent bg-gradient-to-r from-[#F7941D] via-[#FFC107] to-[#F7941D] bg-[length:200%_auto] animate-gradient-text">
                                Contraseña
                            </span>
                        </h1>
                        <p className="text-lg text-blue-100 max-w-md animate-fade-in-up animation-delay-200">
                            Ingresa tu nueva contraseña para asegurar tu cuenta.
                        </p>
                    </div>
                </div>
            </div>

            {/* Right Side - Form */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-gradient-to-br from-slate-50 via-white to-slate-100 relative">
                <div className="w-full max-w-md animate-fade-in-up">
                    <div className="bg-white rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.1)] p-8 backdrop-blur-sm border border-white/20">
                        {/* Header */}
                        <div className="mb-8">
                            <h2 className="text-2xl font-black text-gray-900 mb-2">
                                Nueva Contraseña
                            </h2>
                            <p className="text-sm text-gray-500">
                                Por favor ingresa una nueva contraseña.
                            </p>
                        </div>

                        {/* Messages */}
                        {error && (
                            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm animate-shake">
                                {error}
                            </div>
                        )}

                        {success && (
                            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm animate-fade-in">
                                ¡Contraseña actualizada con éxito! Redirigiendo al inicio de sesión...
                            </div>
                        )}

                        {!success && (
                            <form onSubmit={handleUpdatePassword} className="space-y-5">
                                <div className="group">
                                    <label className="block text-sm font-bold text-gray-700 mb-2">
                                        Nueva Contraseña
                                    </label>
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#F7941D] focus:border-transparent focus:bg-white text-[#181511] placeholder-gray-400 font-medium transition-all group-hover:border-gray-300"
                                        placeholder="Nueva contraseña"
                                        required
                                        minLength={6}
                                    />
                                </div>

                                <div className="group">
                                    <label className="block text-sm font-bold text-gray-700 mb-2">
                                        Confirmar Contraseña
                                    </label>
                                    <input
                                        type="password"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#F7941D] focus:border-transparent focus:bg-white text-[#181511] placeholder-gray-400 font-medium transition-all group-hover:border-gray-300"
                                        placeholder="Confirmar contraseña"
                                        required
                                        minLength={6}
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
                                                Actualizando...
                                            </>
                                        ) : (
                                            <>
                                                Actualizar Contraseña
                                                <span className="material-icons-round text-lg group-hover:translate-x-1 transition-transform">check_circle</span>
                                            </>
                                        )}
                                    </span>
                                </button>
                            </form>
                        )}

                        {success && (
                            <div className="text-center mt-6">
                                <button
                                    type="button"
                                    onClick={() => router.push('/login')}
                                    className="text-sm font-bold text-gray-500 hover:text-gray-700 transition-colors flex items-center justify-center gap-2 mx-auto"
                                >
                                    <span className="material-icons-round text-sm">arrow_back</span>
                                    Volver al inicio de sesión ahora
                                </button>
                            </div>
                        )}
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
                @keyframes fade-in {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes fade-in-up {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
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
                .animate-fade-in { animation: fade-in 1s ease-out; }
                .animate-fade-in-up { animation: fade-in-up 0.8s ease-out; }
                .animate-shake { animation: shake 0.5s ease-in-out; }
                .animation-delay-200 { animation-delay: 0.2s; }
            `}</style>
        </div>
    );
}
