'use client';

import { createContext, useContext, useState, ReactNode } from 'react';

interface CashierContextType {
    searchTerm: string;
    setSearchTerm: (term: string) => void;
    activeCategory: string;
    setActiveCategory: (category: string) => void;
}

const CashierContext = createContext<CashierContextType | undefined>(undefined);

export function CashierProvider({ children }: { children: ReactNode }) {
    const [searchTerm, setSearchTerm] = useState('');
    const [activeCategory, setActiveCategory] = useState('Pizzas');

    return (
        <CashierContext.Provider
            value={{
                searchTerm,
                setSearchTerm,
                activeCategory,
                setActiveCategory,
            }}
        >
            {children}
        </CashierContext.Provider>
    );
}

export function useCashier() {
    const context = useContext(CashierContext);
    if (context === undefined) {
        throw new Error('useCashier must be used within a CashierProvider');
    }
    return context;
}

export function useSafeCashier() {
    return useContext(CashierContext);
}
