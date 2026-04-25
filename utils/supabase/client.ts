
import { createBrowserClient } from '@supabase/ssr'

export const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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
