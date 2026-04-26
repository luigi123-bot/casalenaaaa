'use client';

import { useState, useRef, useEffect } from 'react';

export interface CustomerData {
    name: string;
    phone: string;
    address: string;
}

interface CustomerSelectorProps {
    value: CustomerData;
    onChange: (data: CustomerData) => void;
    orderType?: string; // 'dine-in' | 'takeout' | 'delivery'
}

interface FoundCustomer {
    id: number;
    full_name: string;
    phone: string;
    address?: string;
}

export default function CustomerSelector({ value, onChange, orderType }: CustomerSelectorProps) {
    const [searchResults, setSearchResults] = useState<FoundCustomer[]>([]);
    const [showDropdown, setShowDropdown] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setShowDropdown(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // Search customers by phone or name — only triggered manually (button click)
    const handleSearch = async () => {
        const term = value.phone || value.name;
        if (!term || term.length < 3) return;

        setIsSearching(true);
        try {
            const res = await fetch(`/api/cashier/customers/search?term=${encodeURIComponent(term)}`);
            if (!res.ok) return;
            const data = await res.json();
            setSearchResults(data || []);
            setShowDropdown(true);
        } catch {
            // silently ignore
        } finally {
            setIsSearching(false);
        }
    };

    const handleSelectCustomer = (customer: FoundCustomer) => {
        onChange({
            name: customer.full_name,
            phone: customer.phone,
            address: customer.address || value.address,
        });
        setShowDropdown(false);
        setSearchResults([]);
    };

    const handleClear = () => {
        onChange({ name: '', phone: '', address: '' });
        setSearchResults([]);
        setShowDropdown(false);
    };

    const isDelivery = orderType === 'delivery' || orderType === 'Domicilio';

    return (
        <div className="space-y-2" ref={dropdownRef}>
            <p className="text-[10px] font-black text-[#8c785f] uppercase tracking-widest mb-2">
                Datos de Entrega
            </p>

            {/* Nombre */}
            <div className="relative flex items-center bg-white border border-[#e6e1db] rounded-xl px-3 py-2.5 gap-2 focus-within:border-primary/60 transition-colors">
                <span className="material-icons-round text-[#f7951d] text-lg shrink-0">person</span>
                <input
                    type="text"
                    placeholder="Nombre del cliente"
                    value={value.name}
                    onChange={(e) => onChange({ ...value, name: e.target.value })}
                    className="flex-1 bg-transparent outline-none text-sm text-[#181511] placeholder-[#c4b9a8] font-medium"
                />
                {/* Botón buscar — solo dispara búsqueda al hacer click */}
                <button
                    type="button"
                    onClick={handleSearch}
                    disabled={isSearching}
                    title="Buscar cliente existente"
                    className="shrink-0 text-[#f7951d] hover:text-[#e68a1b] transition-colors disabled:opacity-50"
                >
                    {isSearching
                        ? <span className="material-icons-round text-lg animate-spin">progress_activity</span>
                        : <span className="material-icons-round text-lg">download</span>
                    }
                </button>
            </div>

            {/* Teléfono */}
            <div className="relative flex items-center bg-white border border-[#e6e1db] rounded-xl px-3 py-2.5 gap-2 focus-within:border-primary/60 transition-colors">
                <span className="material-icons-round text-[#f7951d] text-lg shrink-0">phone</span>
                <input
                    type="tel"
                    placeholder="Teléfono"
                    value={value.phone}
                    onChange={(e) => onChange({ ...value, phone: e.target.value })}
                    className="flex-1 bg-transparent outline-none text-sm text-[#181511] placeholder-[#c4b9a8] font-medium"
                />
                <button
                    type="button"
                    onClick={handleSearch}
                    disabled={isSearching}
                    title="Buscar por teléfono"
                    className="shrink-0 text-[#f7951d] hover:text-[#e68a1b] transition-colors disabled:opacity-50"
                >
                    {isSearching
                        ? <span className="material-icons-round text-lg animate-spin">progress_activity</span>
                        : <span className="material-icons-round text-lg">download</span>
                    }
                </button>
            </div>

            {/* Dirección — solo visible en delivery */}
            {isDelivery && (
                <div className="flex items-center bg-white border border-[#e6e1db] rounded-xl px-3 py-2.5 gap-2 focus-within:border-primary/60 transition-colors">
                    <span className="material-icons-round text-[#f7951d] text-lg shrink-0">location_on</span>
                    <input
                        type="text"
                        placeholder="Dirección Completa"
                        value={value.address}
                        onChange={(e) => onChange({ ...value, address: e.target.value })}
                        className="flex-1 bg-transparent outline-none text-sm text-[#181511] placeholder-[#c4b9a8] font-medium"
                    />
                </div>
            )}

            {/* Dropdown de resultados */}
            {showDropdown && searchResults.length > 0 && (
                <div className="absolute z-50 left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-[#e6e1db] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                    <p className="px-3 py-2 text-[10px] font-black text-[#8c785f] uppercase tracking-widest border-b border-[#f0ece6]">
                        Clientes encontrados
                    </p>
                    {searchResults.map((c) => (
                        <button
                            key={c.id}
                            type="button"
                            onClick={() => handleSelectCustomer(c)}
                            className="w-full text-left px-3 py-2.5 hover:bg-[#fdf8f3] border-b border-[#f8f7f5] last:border-0 flex items-center justify-between gap-3 transition-colors"
                        >
                            <div className="flex items-center gap-2 min-w-0">
                                <div className="size-7 rounded-full bg-[#f7951d]/10 flex items-center justify-center text-[#f7951d] font-black text-xs shrink-0">
                                    {c.full_name[0]?.toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                    <p className="text-sm font-bold text-[#181511] truncate">{c.full_name}</p>
                                    {c.address && (
                                        <p className="text-[11px] text-[#8c785f] truncate">{c.address}</p>
                                    )}
                                </div>
                            </div>
                            <span className="text-xs text-[#8c785f] shrink-0">{c.phone}</span>
                        </button>
                    ))}
                    <button
                        type="button"
                        onClick={() => setShowDropdown(false)}
                        className="w-full px-3 py-2 text-xs text-[#8c785f] hover:bg-[#f8f7f5] text-center font-bold border-t border-[#f0ece6]"
                    >
                        Cerrar
                    </button>
                </div>
            )}

            {/* Limpiar datos si hay algo escrito */}
            {(value.name || value.phone || value.address) && (
                <button
                    type="button"
                    onClick={handleClear}
                    className="w-full text-xs text-[#8c785f] hover:text-red-500 font-bold py-1 transition-colors flex items-center justify-center gap-1"
                >
                    <span className="material-icons-round text-sm">close</span>
                    Limpiar datos
                </button>
            )}
        </div>
    );
}
