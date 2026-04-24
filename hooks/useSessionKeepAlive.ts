'use client';

import { useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/utils/supabase/client';

/**
 * Mantiene la sesión de Supabase activa aunque la pestaña esté inactiva.
 *
 * Supabase emite tokens JWT con expiración de 1 hora. Si la pestaña
 * queda en background o sin actividad, el token expira y las siguientes
 * llamadas a la DB se cuelgan o fallan silenciosamente.
 *
 * Este hook:
 *  - Refresca el token cada REFRESH_INTERVAL ms (defecto: 45 min) de forma
 *    proactiva usando getSession(), que llama a refreshSession() internamente.
 *  - Al recuperar visibilidad/foco, refresca inmediatamente para evitar lag.
 *  - Llama a onSessionLost() si detecta que la sesión se perdió definitivamente.
 */
export function useSessionKeepAlive(onSessionLost?: () => void) {
    const REFRESH_INTERVAL = 45 * 60 * 1000; // 45 minutos
    const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);
    const isMountedRef = useRef(true);

    const refreshSession = useCallback(async () => {
        if (!isMountedRef.current) return;
        try {
            console.log('[SessionKeepAlive] 🔄 Refrescando token de sesión...');
            // getSession() automáticamente refresca el access_token si está próximo a expirar
            const { data: { session }, error } = await supabase.auth.getSession();

            if (error) {
                console.warn('[SessionKeepAlive] ⚠️ Error al refrescar sesión:', error.message);
                return;
            }

            if (!session) {
                console.warn('[SessionKeepAlive] ❌ Sesión perdida — redirigiendo al login.');
                onSessionLost?.();
                return;
            }

            console.log('[SessionKeepAlive] ✅ Sesión activa. Expira:', new Date(session.expires_at! * 1000).toLocaleTimeString());
        } catch (err) {
            console.warn('[SessionKeepAlive] ⚠️ Excepción al refrescar sesión:', err);
        }
    }, [onSessionLost]);

    const scheduleRefresh = useCallback(() => {
        if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = setTimeout(() => {
            refreshSession();
            scheduleRefresh(); // Reprogramar indefinidamente
        }, REFRESH_INTERVAL);
    }, [refreshSession, REFRESH_INTERVAL]);

    useEffect(() => {
        isMountedRef.current = true;

        // 1. Refrescar al montar (por si la sesión ya expiró cuando se carga la página)
        refreshSession();

        // 2. Programar refrescos periódicos
        scheduleRefresh();

        // 3. Refrescar inmediatamente al recuperar visibilidad (tab switching)
        const handleVisibility = () => {
            if (document.visibilityState === 'visible') {
                console.log('[SessionKeepAlive] 👁️ Tab visible — refrescando sesión inmediatamente.');
                refreshSession();
                scheduleRefresh(); // Reiniciar el timer desde ahora
            }
        };

        // 4. Refrescar al recuperar foco de ventana
        const handleFocus = () => {
            console.log('[SessionKeepAlive] 🖱️ Ventana enfocada — refrescando sesión.');
            refreshSession();
            scheduleRefresh();
        };

        document.addEventListener('visibilitychange', handleVisibility);
        window.addEventListener('focus', handleFocus);

        return () => {
            isMountedRef.current = false;
            if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
            document.removeEventListener('visibilitychange', handleVisibility);
            window.removeEventListener('focus', handleFocus);
        };
    }, [refreshSession, scheduleRefresh]);
}
