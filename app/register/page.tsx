'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function RegisterPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [address, setAddress] = useState('');
    const [role, setRole] = useState<'administrador' | 'cajero' | 'cocina' | 'cliente'>('cliente');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const router = useRouter();

    // Check query params manually since useSearchParams might need Suspense boundary
    const [isCheckout, setIsCheckout] = useState(false);
    const [redirectPath, setRedirectPath] = useState('/');

    useEffect(() => {
        // Safe check for browser environment
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            const checkout = params.get('checkout') === 'true';
            const redirect = params.get('redirect') || '/';

            setIsCheckout(checkout);
            setRedirectPath(redirect);

            if (checkout) {
                setRole('cliente'); // Force role for shoppers
            } else {
                setRole('cajero'); // Default for admin creation
            }
        }
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        setIsLoading(true);

        try {
            const response = await fetch('/api/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email,
                    password,
                    fullName,
                    role,
                    phoneNumber,
                    address
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Error al registrar usuario');
            }

            setSuccess(isCheckout ? '¡Cuenta creada! Volviendo a tu pedido...' : '¡Usuario creado exitosamente! Redirigiendo...');

            // Auto login logic (simulated by redirect to login, ideally API should return session)
            // Ideally we would auto-login here, but for security flow:
            setTimeout(() => {
                if (isCheckout) {
                    // Save fields to localStorage for checkout auto-fill
                    localStorage.setItem('pendingPhoneNumber', phoneNumber);
                    localStorage.setItem('pendingDeliveryAddress', address);

                    // Redirect to login with return params
                    router.push(`/login?redirect=${encodeURIComponent(redirectPath)}&checkout=true&email=${encodeURIComponent(email)}`);
                } else {
                    router.push('/');
                }
            }, 1500);

        } catch (err: any) {
            console.error('Registration error:', err);
            setError(err.message || 'Error al registrar usuario');
            setIsLoading(false);
        }
    };

    return (
        <div className="bg-background dark:bg-background-dark text-text-main dark:text-white font-display transition-colors duration-200 min-h-screen flex flex-col items-center justify-center p-4">
            <main className="w-full max-w-[500px]">
                <div className="flex flex-col bg-surface dark:bg-gray-900 rounded-xl shadow-xl border border-border dark:border-gray-800 overflow-hidden">
                    <div className="p-8 sm:p-10 flex flex-col gap-6">
                        <div className="flex flex-col items-center gap-4">
                            <div className="text-center">
                                <h1 className="text-2xl font-extrabold text-text-main dark:text-white tracking-tight">
                                    {isCheckout ? 'Completa tus Datos' : 'Registrar Nuevo Usuario'}
                                </h1>
                                <p className="text-text-sub dark:text-gray-400 text-sm font-medium mt-1">
                                    {isCheckout
                                        ? 'Necesitamos estos datos para enviar tu pedido'
                                        : 'Crea una cuenta para el sistema Casaleña'}
                                </p>
                            </div>
                        </div>

                        {error && (
                            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg text-sm font-medium flex items-center gap-2">
                                <span className="material-symbols-outlined text-[20px]">error</span>
                                {error}
                            </div>
                        )}

                        {success && (
                            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-600 dark:text-green-400 px-4 py-3 rounded-lg text-sm font-medium flex items-center gap-2">
                                <span className="material-symbols-outlined text-[20px]">check_circle</span>
                                {success}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                            {/* Nombre Completo */}
                            <div className="space-y-1">
                                <label className="text-sm font-bold text-text-main dark:text-white ml-1" htmlFor="fullName">
                                    Nombre Completo
                                </label>
                                <input
                                    className="block w-full px-3 py-3 border border-border dark:border-gray-700 rounded-lg bg-surface dark:bg-gray-800 text-text-main dark:text-white placeholder-text-sub/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm font-medium"
                                    id="fullName"
                                    placeholder="Nombre y Apellido"
                                    type="text"
                                    required
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                />
                            </div>

                            {/* Info de contacto para pedidos */}
                            {isCheckout && (
                                <>
                                    <div className="space-y-1">
                                        <label className="text-sm font-bold text-text-main dark:text-white ml-1" htmlFor="phoneNumber">
                                            Teléfono Celular <span className="text-primary font-normal text-xs">(Para contacto)</span>
                                        </label>
                                        <input
                                            className="block w-full px-3 py-3 border border-border dark:border-gray-700 rounded-lg bg-surface dark:bg-gray-800 text-text-main dark:text-white placeholder-text-sub/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm font-medium"
                                            id="phoneNumber"
                                            placeholder="Ej: 55 1234 5678"
                                            type="tel"
                                            required={isCheckout}
                                            value={phoneNumber}
                                            onChange={(e) => setPhoneNumber(e.target.value)}
                                        />
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-sm font-bold text-text-main dark:text-white ml-1" htmlFor="address">
                                            Dirección de Entrega
                                        </label>
                                        <input
                                            className="block w-full px-3 py-3 border border-border dark:border-gray-700 rounded-lg bg-surface dark:bg-gray-800 text-text-main dark:text-white placeholder-text-sub/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm font-medium"
                                            id="address"
                                            placeholder="Calle, Número, Colonia"
                                            type="text"
                                            required={isCheckout}
                                            value={address}
                                            onChange={(e) => setAddress(e.target.value)}
                                        />
                                    </div>
                                </>
                            )}

                            {/* Email */}
                            <div className="space-y-1">
                                <label className="text-sm font-bold text-text-main dark:text-white ml-1" htmlFor="email">
                                    Correo Electrónico
                                </label>
                                <input
                                    className="block w-full px-3 py-3 border border-border dark:border-gray-700 rounded-lg bg-surface dark:bg-gray-800 text-text-main dark:text-white placeholder-text-sub/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm font-medium"
                                    id="email"
                                    placeholder="tucorreo@ejemplo.com"
                                    required
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                />
                            </div>

                            {/* Contraseña */}
                            <div className="space-y-1">
                                <label className="text-sm font-bold text-text-main dark:text-white ml-1" htmlFor="password">
                                    Crear Contraseña
                                </label>
                                <input
                                    className="block w-full px-3 py-3 border border-border dark:border-gray-700 rounded-lg bg-surface dark:bg-gray-800 text-text-main dark:text-white placeholder-text-sub/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm font-medium"
                                    id="password"
                                    placeholder="Mínimo 6 caracteres"
                                    required
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                            </div>

                            {/* Rol - Oculto si es checkout */}
                            {!isCheckout && (
                                <div className="space-y-1">
                                    <label className="text-sm font-bold text-text-main dark:text-white ml-1" htmlFor="role">
                                        Rol
                                    </label>
                                    <select
                                        className="block w-full px-3 py-3 border border-border dark:border-gray-700 rounded-lg bg-surface dark:bg-gray-800 text-text-main dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm font-medium"
                                        id="role"
                                        value={role}
                                        onChange={(e) => setRole(e.target.value as any)}
                                    >
                                        <option value="cajero">Cajero</option>
                                        <option value="administrador">Administrador</option>
                                        <option value="cocina">Cocina</option>
                                        <option value="cliente">Cliente</option>
                                    </select>
                                </div>
                            )}

                            <button
                                className="mt-4 w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-white font-bold py-3.5 rounded-lg shadow-md hover:shadow-lg transition-all transform active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                                type="submit"
                                disabled={isLoading}
                            >
                                {isLoading ? (
                                    <>
                                        <span className="material-symbols-outlined text-[20px] animate-spin">progress_activity</span>
                                        <span>Procesando...</span>
                                    </>
                                ) : (
                                    <>
                                        <span className="material-symbols-outlined text-[20px]">{isCheckout ? 'check_circle' : 'person_add'}</span>
                                        <span>{isCheckout ? 'Registrar y Continuar' : 'Crear Usuario'}</span>
                                    </>
                                )}
                            </button>
                        </form>
                    </div>

                    <div className="bg-gray-50 dark:bg-gray-800 border-t border-border dark:border-gray-700 p-4 text-center">
                        <Link href="/login" className="text-sm text-primary hover:text-primary/80 font-medium">
                            ¿Ya tienes cuenta? Inicia Sesión
                        </Link>
                    </div>
                </div>
            </main>
        </div>
    );
}
