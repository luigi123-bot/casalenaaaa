/**
 * useSafeFetch
 *
 * Wraps fetch with an AbortController tied to the component lifecycle.
 * When the component unmounts, all in-flight requests are automatically
 * cancelled — and the resulting AbortError is silently swallowed so it
 * never surfaces as "signal is aborted without reason" in the console.
 *
 * Usage:
 *   const safeFetch = useSafeFetch();
 *   const data = await safeFetch('/api/something');
 */

import { useEffect, useRef, useCallback } from 'react';

export function useSafeFetch() {
    const controllerRef = useRef<AbortController | null>(null);

    useEffect(() => {
        // Create a fresh controller for this mount
        controllerRef.current = new AbortController();

        return () => {
            // Abort all pending requests on unmount
            controllerRef.current?.abort();
        };
    }, []);

    const safeFetch = useCallback(
        (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
            return fetch(input, {
                ...init,
                signal: controllerRef.current?.signal,
            }).catch((err: Error) => {
                // Silently swallow abort errors — they are expected on unmount
                if (err.name === 'AbortError') {
                    return new Promise(() => {}); // Never resolves — caller's useEffect cleanup handles it
                }
                throw err;
            });
        },
        []
    );

    return safeFetch;
}

/**
 * isAbortError
 *
 * Helper to check if an error is an AbortError in catch blocks
 * where you're not using useSafeFetch.
 *
 * Covers:
 * - Native fetch AbortError (err.name === 'AbortError')
 * - Supabase internal abort (empty object {}, or message containing 'aborted'/'signal')
 * - DOMException with name 'AbortError'
 */
export function isAbortError(err: unknown): boolean {
    if (!err) return false;

    // Empty object {} — Supabase throws this when the request is aborted internally
    if (typeof err === 'object' && Object.keys(err).length === 0) return true;

    if (err instanceof Error) {
        return (
            err.name === 'AbortError' ||
            err.message.includes('aborted') ||
            err.message.includes('signal') ||
            err.message.includes('The user aborted') ||
            err.message.includes('without reason')
        );
    }

    // String errors
    if (typeof err === 'string') {
        return (
            err.includes('AbortError') ||
            err.includes('aborted') ||
            err.includes('without reason')
        );
    }

    // Object with name/message properties (e.g. Supabase error shape)
    if (typeof err === 'object') {
        const e = err as Record<string, unknown>;
        const name = String(e.name || '');
        const message = String(e.message || '');
        return (
            name === 'AbortError' ||
            message.includes('aborted') ||
            message.includes('signal') ||
            message.includes('without reason')
        );
    }

    return false;
}
