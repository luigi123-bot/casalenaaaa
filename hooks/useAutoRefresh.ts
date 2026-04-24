import { useEffect } from 'react';

/**
 * Hook to automatically trigger a callback when the browser tab regains visibility or focus.
 * This is crucial for PWA and single-page apps to catch up on missed real-time events
 * after the tab goes to sleep or is backgrounded.
 * 
 * @param callback Function to execute when the tab becomes active again
 */
export function useAutoRefresh(callback: () => void) {
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                callback();
            }
        };

        const handleFocus = () => {
            callback();
        };

        // Listen for visibility changes (tab switching, minimizing)
        document.addEventListener('visibilitychange', handleVisibilityChange);
        // Listen for window focus (clicking back into the window)
        window.addEventListener('focus', handleFocus);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('focus', handleFocus);
        };
    }, [callback]);
}
