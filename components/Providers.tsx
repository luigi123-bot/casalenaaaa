'use client';

import { ThemeProvider as ThemeContextProvider } from '@/contexts/ThemeContext';

export function Providers({ children }: { children: React.ReactNode }) {
    return <ThemeContextProvider>{children}</ThemeContextProvider>;
}
