'use client';

import { useTheme } from '@/contexts/ThemeContext';

export default function ThemeToggle() {
    const { theme, toggleTheme } = useTheme();

    return (
        <button
            onClick={toggleTheme}
            className="p-2 rounded-lg bg-surface dark:bg-gray-800 border border-border dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200"
            aria-label="Toggle theme"
        >
            {theme === 'light' ? (
                <span className="material-symbols-outlined text-xl text-gray-700 dark:text-gray-300">
                    dark_mode
                </span>
            ) : (
                <span className="material-symbols-outlined text-xl text-yellow-500">
                    light_mode
                </span>
            )}
        </button>
    );
}
