'use client';

import { useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/utils/supabase/client';

/**
 * Mantiene la sesión de Supabase activa aunque la pestaña esté inactiva.
 *
 * ESTRATEGIA DE DEFENSA EN CAPAS:
 *  1. El cliente Supabase ya tiene autoRefreshToken: true — renueva solo.
 *  2. Este hook fuerza un refreshSession() REAL cada REFRESH_INTERVAL (20 min)
 *     como respaldo explícito por si el auto-refresh interno falla.
 *  3. Al recuperar visibilidad o foco, fuerza un refresh inmediato.
 *  4. NUNCA llama a onSessionLost si sólo hay un error de red transitorio;
 *     sólo lo hace si la sesión está definitivamente perdida (no hay refresh_token).
 */
export function useSessionKeepAlive(onSessionLost?: () => void) {
    // 20 minutos — suficientemente frecuente para no perder la sesión de 1h
    const REFRESH_INTERVAL = 20 * 60 * 1000;
    const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);
    const isMountedRef = useRef(true);
    const isRefreshingRef = useRef(false); // Guard para evitar llamadas concurrentes

    const refreshSession = useCallback(async () => {
        if (!isMountedRef.current) return;
        if (isRefreshingRef.current) return; // Ya se está refrescando, no doblar
        isRefreshingRef.current = true;

        try {
            // Usar refreshSession() EXPLÍCITO, no getSession().
            // getSession() puede devolver el token viejo cacheado si no ha expirado aún,
            // mientras que refreshSession() siempre pide un token nuevo al servidor.
            const { data: { session }, error } = await supabase.auth.refreshSession();

            if (!isMountedRef.current) return;

            if (error) {
                // Un error aquí puede ser temporal (red caída). No redirigir todavía.
                console.warn('[SessionKeepAlive] ⚠️ No se pudo refrescar sesión:', error.message);
                return;
            }

            if (!session) {
                // Sin session Y sin error: el refresh_token ya no es válido.
                // El usuario debe volver a iniciar sesión.
                console.warn('[SessionKeepAlive] ❌ Sesión expirada definitivamente.');
                onSessionLost?.();
                return;
            }

            console.log(
                '[SessionKeepAlive] ✅ Token renovado. Nuevo expiry:',
                new Date(session.expires_at! * 1000).toLocaleTimeString()
            );
        } catch (err) {
            // Error de red — no es una sesión perdida, es conectividad.
            // Simplemente lo ignoramos y el próximo ciclo lo reintentará.
            console.warn('[SessionKeepAlive] ⚠️ Error de red al refrescar (se reintentará):', err);
        } finally {
            isRefreshingRef.current = false;
        }
    }, [onSessionLost]);

    const scheduleRefresh = useCallback(() => {
        if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = setTimeout(async () => {
            await refreshSession();
            if (isMountedRef.current) scheduleRefresh(); // Reprogramar indefinidamente
        }, REFRESH_INTERVAL);
    }, [refreshSession, REFRESH_INTERVAL]);

    useEffect(() => {
        isMountedRef.current = true;

        // 1. Refrescar al montar (por si la sesión ya expiró mientras no se usaba)
        refreshSession();

        // 2. Programar refrescos periódicos
        scheduleRefresh();

        // 3. (Eliminado: Evitar spam de API en focus/visibility que causa Timeouts)

        return () => {
            isMountedRef.current = false;
            if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
        };
    }, [refreshSession, scheduleRefresh]);
}
