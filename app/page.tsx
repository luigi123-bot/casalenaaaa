'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/utils/supabase/client';
// import ThemeToggle from '@/components/ThemeToggle'; // Temporalmente deshabilitado

export default function Home() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    // Console log para ver las credenciales ingresadas
    console.log('=== INTENTO DE LOGIN ===');
    console.log('Email ingresado:', email);
    console.log('Contraseña ingresada:', password);

    try {
      // 1. Authenticate with Supabase
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      console.log('Respuesta de autenticación:', authData);
      if (authError) {
        console.error('Error de autenticación:', authError);
        throw authError;
      }

      if (authData.user) {
        console.log('Usuario autenticado:', authData.user);

        // 2. Fetch User Profile to get Role
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', authData.user.id)
          .single();

        console.log('Datos del perfil en tabla profiles:', profileData);
        if (profileError) {
          console.error('Error al buscar perfil:', profileError);
          // Fallback if profile not found (shouldn't happen with triggers)
          // Default to cashier or show error
          console.error('Error fetching profile:', profileError);
          router.push('/cashier');
        } else {
          // 3. Redirect based on Role
          console.log('Rol del usuario:', profileData.role);
          if (profileData.role === 'administrador') {
            console.log('Redirigiendo a /admin');
            router.push('/admin');
          } else {
            console.log('Redirigiendo a /cashier');
            router.push('/cashier');
          }
        }
      }

    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.message || 'Error al iniciar sesión. Verifique sus credenciales.');
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-background dark:bg-background-dark text-text-main dark:text-white font-display transition-colors duration-200 min-h-screen flex flex-col items-center justify-center p-4 relative">
      {/* Theme Toggle - Temporalmente deshabilitado */}
      {/* <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div> */}

      <main className="w-full max-w-[420px]">
        <div className="flex flex-col bg-surface dark:bg-gray-900 rounded-xl shadow-xl border border-border dark:border-gray-800 overflow-hidden">
          <div className="p-8 sm:p-10 flex flex-col gap-8">
            <div className="flex flex-col items-center gap-4">
              <div
                className="bg-center bg-no-repeat bg-cover rounded-full size-16 shadow-md border-4 border-background dark:border-gray-800"
                style={{ backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuBcCs0IqRkjjxBFm8C2d1LwGqzJ5UxwP83EiWZ2VfwMZN-P5Tssbi_WfcsyykyZHNyH-Y6fUsCaIdsFlKuTJ8EJLOboBFtMxx_6NWmh7-gldLO06JvPWTJkW-Vc_G2UzEHP3sioROAfcSK1Ik-ObSy5m7FWzbiSGfG0II-ibC-Slntv0GeeDZdDNlQeWCD64EElivoKp7RSauYml8W1eetwr_RU5yO7Hx58jYqyjGexRhbt1I3LlFzGl4AKVNSecW6sMn9muAUCuqEz')" }}
              />
              <div className="text-center">
                <h1 className="text-2xl font-extrabold text-text-main dark:text-white tracking-tight">
                  Casaleña
                </h1>
                <p className="text-text-sub dark:text-gray-400 text-sm font-medium mt-1">
                  Bienvenido, por favor inicia sesión
                </p>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg text-sm font-medium flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px]">error</span>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              <div className="space-y-2">
                <label
                  className="text-sm font-bold text-text-main dark:text-white ml-1"
                  htmlFor="email"
                >
                  Correo Electrónico
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="material-symbols-outlined text-text-sub text-[20px]">
                      mail
                    </span>
                  </div>
                  <input
                    className="block w-full pl-10 pr-3 py-3 border border-border dark:border-gray-700 rounded-lg bg-surface dark:bg-gray-800 text-text-main dark:text-white placeholder-text-sub/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm font-medium"
                    id="email"
                    name="email"
                    placeholder="name@restaurant.com"
                    required
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center ml-1">
                  <label
                    className="text-sm font-bold text-text-main dark:text-white"
                    htmlFor="password"
                  >
                    Contraseña
                  </label>
                  <a
                    className="text-xs font-bold text-primary hover:text-primary/80 transition-colors"
                    href="#"
                  >
                    ¿Olvidaste tu contraseña?
                  </a>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="material-symbols-outlined text-text-sub text-[20px]">
                      lock
                    </span>
                  </div>
                  <input
                    className="block w-full pl-10 pr-3 py-3 border border-border dark:border-gray-700 rounded-lg bg-surface dark:bg-gray-800 text-text-main dark:text-white placeholder-text-sub/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm font-medium"
                    id="password"
                    name="password"
                    placeholder="••••••••"
                    required
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </div>

              <button
                className="mt-2 w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-white font-bold py-3.5 rounded-lg shadow-md hover:shadow-lg transition-all transform active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                type="submit"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <span className="material-symbols-outlined text-[20px] animate-spin">progress_activity</span>
                    <span>Iniciando Sesión...</span>
                  </>
                ) : (
                  <>
                    <span>Iniciar Sesión</span>
                    <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
                  </>
                )}
              </button>
            </form>
          </div>

          <div className="bg-gray-50 dark:bg-gray-800 border-t border-border dark:border-gray-700 p-4 text-center">
            <p className="text-sm text-text-sub dark:text-gray-400 font-medium">
              ¿Nueva cuenta?{' '}
              <a href="/register" className="text-primary hover:text-primary/80 font-bold">
                Regístrate aquí
              </a>
            </p>
          </div>
        </div>

        <footer className="mt-8 text-center px-4">
          <p className="text-xs font-medium text-text-sub/70 dark:text-gray-500">
            © 2023 Casaleña. Sistema de Punto de Venta.
          </p>
        </footer>
      </main>
    </div>
  );
}

