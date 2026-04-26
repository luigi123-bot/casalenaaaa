'use client';

import { useEffect } from 'react';
import { ThemeProvider as ThemeContextProvider } from '@/contexts/ThemeContext';

/**
 * Suppress AbortError noise from Supabase's internal Web Locks API (locks.js).
 * These errors are expected — they happen when a Supabase operation is in flight
 * and the component unmounts or the tab loses focus. They are not real errors.
 */
function useSupressAbortErrors() {
    useEffect(() => {
        const handler = (event: PromiseRejectionEvent) => {
            const err = event.reason;
            if (!err) return;

            const isAbort =
                err?.name === 'AbortError' ||
                err?.message?.includes('aborted') ||
                err?.message?.includes('signal') ||
                err?.message?.includes('without reason') ||
                // Supabase locks.js specific
                (typeof err?.stack === 'string' && err.stack.includes('locks.js'));

            if (isAbort) {
                event.preventDefault(); // stops it from appearing in the console
            }
        };

        window.addEventListener('unhandledrejection', handler);
        return () => window.removeEventListener('unhandledrejection', handler);
    }, []);
}

export function Providers({ children }: { children: React.ReactNode }) {
    useSupressAbortErrors();
    return <ThemeContextProvider>{children}</ThemeContextProvider>;
}
