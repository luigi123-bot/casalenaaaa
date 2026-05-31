
import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
        'Faltan variables de entorno de Supabase: asegúrate de tener NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY en .env o .env.local, y reinicia el servidor de desarrollo.'
    )
}

export const supabase = createBrowserClient(
    supabaseUrl,
    supabaseAnonKey,
    {
        auth: {
            // Renovar token automáticamente antes de que expire.
            // Esto evita que la sesión muera cuando la pestaña está inactiva.
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: false,
        }
    }
)
