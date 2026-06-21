'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

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
    const [autoFilled, setAutoFilled] = useState(false);
    const [autoFillName, setAutoFillName] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    // Track if we already auto-filled for this phone to avoid re-triggering
    const lastAutoFilledPhone = useRef('');

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

    // ── Auto-search by phone with debounce ─────────────────────────────
    const performPhoneSearch = useCallback(async (phone: string) => {
        if (phone.length < 7) return;
        // Don't re-search if we already auto-filled this exact phone
        if (lastAutoFilledPhone.current === phone) return;

        setIsSearching(true);
        try {
            const res = await fetch(`/api/cashier/customers/search?term=${encodeURIComponent(phone)}`);
            if (!res.ok) return;
            const data = await res.json();
            const customers: FoundCustomer[] = (data.customers || []).map((c: any) => ({
                id: c.id,
                full_name: c.full_name || 'Sin Nombre',
                phone: c.phone || '',
                address: c.address || '',
            }));

            if (customers.length === 0) {
                setSearchResults([]);
                setShowDropdown(false);
                return;
            }

            // Try exact match first, then partial
            const exactMatch = customers.find(c => c.phone === phone);
            const bestMatch = exactMatch || customers[0];

            if (bestMatch) {
                // Auto-fill the data directly
                onChange({
                    name: bestMatch.full_name,
                    phone: bestMatch.phone || phone,
                    address: bestMatch.address || '',
                });
                lastAutoFilledPhone.current = bestMatch.phone || phone;
                setAutoFilled(true);
                setAutoFillName(bestMatch.full_name);
                setShowDropdown(false);
                setSearchResults([]);

                // Clear auto-fill indicator after 3s
                setTimeout(() => setAutoFilled(false), 3000);

                // If multiple results and no exact match, also show dropdown
                if (!exactMatch && customers.length > 1) {
                    setSearchResults(customers);
                    setShowDropdown(true);
                }
            }
        } catch {
            // silently ignore
        } finally {
            setIsSearching(false);
        }
    }, [onChange]);

    // Debounced phone change handler
    const handlePhoneChange = (newPhone: string) => {
        // Only keep digits to normalize
        const digitsOnly = newPhone.replace(/\D/g, '');
        onChange({ ...value, phone: newPhone });

        // Clear previous auto-fill state when user starts typing a new number
        if (lastAutoFilledPhone.current && newPhone !== lastAutoFilledPhone.current) {
            lastAutoFilledPhone.current = '';
            setAutoFilled(false);
        }

        // Debounce the search
        if (debounceRef.current) clearTimeout(debounceRef.current);

        if (digitsOnly.length >= 7) {
            debounceRef.current = setTimeout(() => {
                performPhoneSearch(newPhone.trim());
            }, 600);
        }
    };

    // Cleanup debounce on unmount
    useEffect(() => {
        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, []);

    // Search customers by phone or name — manual trigger (button click)
    const handleSearch = async () => {
        const term = value.phone || value.name;
        if (!term || term.length < 3) return;

        setIsSearching(true);
        try {
            const res = await fetch(`/api/cashier/customers/search?term=${encodeURIComponent(term)}`);
            if (!res.ok) return;
            const data = await res.json();
            const customers: FoundCustomer[] = (data.customers || []).map((c: any) => ({
                id: c.id,
                full_name: c.full_name || 'Sin Nombre',
                phone: c.phone || '',
                address: c.address || '',
            }));
            setSearchResults(customers);
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
        lastAutoFilledPhone.current = customer.phone;
        setAutoFilled(true);
        setAutoFillName(customer.full_name);
        setTimeout(() => setAutoFilled(false), 3000);
        setShowDropdown(false);
        setSearchResults([]);
    };

    const handleClear = () => {
        onChange({ name: '', phone: '', address: '' });
        setSearchResults([]);
        setShowDropdown(false);
        setAutoFilled(false);
        lastAutoFilledPhone.current = '';
    };

    const isDelivery = orderType === 'delivery' || orderType === 'Domicilio';

    return (
        <div className="space-y-2" ref={dropdownRef}>
            <p className="text-[10px] font-black text-[#8c785f] uppercase tracking-widest mb-2">
                Datos de Entrega
            </p>

            {/* Teléfono — FIRST (primary search field) */}
            <div className={`relative flex items-center bg-white border rounded-xl px-3 py-2.5 gap-2 transition-all duration-300 ${
                autoFilled ? 'border-green-400 bg-green-50/30 shadow-sm shadow-green-100' : 'border-[#e6e1db] focus-within:border-primary/60'
            }`}>
                <span className={`material-icons-round text-lg shrink-0 transition-colors ${autoFilled ? 'text-green-500' : 'text-[#f7951d]'}`}>phone</span>
                <input
                    type="tel"
                    placeholder="Celular del cliente"
                    value={value.phone}
                    onChange={(e) => handlePhoneChange(e.target.value)}
                    className="flex-1 bg-transparent outline-none text-sm text-[#181511] placeholder-[#c4b9a8] font-medium"
                />
                {isSearching ? (
                    <span className="material-icons-round text-[#f7951d] text-lg animate-spin shrink-0">progress_activity</span>
                ) : autoFilled ? (
                    <span className="material-icons-round text-green-500 text-lg shrink-0 animate-in zoom-in-50 duration-300">check_circle</span>
                ) : (
                    <button
                        type="button"
                        onClick={handleSearch}
                        disabled={isSearching}
                        title="Buscar por teléfono"
                        className="shrink-0 text-[#f7951d] hover:text-[#e68a1b] transition-colors disabled:opacity-50"
                    >
                        <span className="material-icons-round text-lg">search</span>
                    </button>
                )}
            </div>

            {/* Auto-fill success message */}
            {autoFilled && (
                <div className="flex items-center gap-1.5 px-2 animate-in fade-in slide-in-from-top-1 duration-300">
                    <span className="material-icons-round text-green-500 text-xs">check_circle</span>
                    <span className="text-[10px] font-black text-green-600 uppercase tracking-wider">
                        Cliente encontrado: {autoFillName}
                    </span>
                </div>
            )}

            {/* Nombre */}
            <div className={`relative flex items-center bg-white border rounded-xl px-3 py-2.5 gap-2 transition-all duration-300 ${
                autoFilled && value.name ? 'border-green-300/60' : 'border-[#e6e1db] focus-within:border-primary/60'
            }`}>
                <span className="material-icons-round text-[#f7951d] text-lg shrink-0">person</span>
                <input
                    type="text"
                    placeholder="Nombre del cliente"
                    value={value.name}
                    onChange={(e) => onChange({ ...value, name: e.target.value })}
                    className="flex-1 bg-transparent outline-none text-sm text-[#181511] placeholder-[#c4b9a8] font-medium"
                />
                <button
                    type="button"
                    onClick={handleSearch}
                    disabled={isSearching}
                    title="Buscar cliente existente"
                    className="shrink-0 text-[#f7951d] hover:text-[#e68a1b] transition-colors disabled:opacity-50"
                >
                    {isSearching
                        ? <span className="material-icons-round text-lg animate-spin">progress_activity</span>
                        : <span className="material-icons-round text-lg">search</span>
                    }
                </button>
            </div>

            {/* Dirección — solo visible en delivery */}
            {isDelivery && (
                <div className={`flex items-center bg-white border rounded-xl px-3 py-2.5 gap-2 transition-all duration-300 ${
                    autoFilled && value.address ? 'border-green-300/60' : 'border-[#e6e1db] focus-within:border-primary/60'
                }`}>
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
                        Clientes encontrados ({searchResults.length})
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
