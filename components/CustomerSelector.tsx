'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/utils/supabase/client';

interface Customer {
    id: number;
    full_name: string;
    phone?: string;
    email?: string;
}

interface CustomerSelectorProps {
    onSelect: (customer: Customer | null) => void;
    selectedCustomer: Customer | null;
}

export default function CustomerSelector({ onSelect, selectedCustomer }: CustomerSelectorProps) {
    const [searchTerm, setSearchTerm] = useState('');
    const [results, setResults] = useState<Customer[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [newCustomerBadges, setNewCustomerBadges] = useState(false);

    // New Customer Form State
    const [newCustomerName, setNewCustomerName] = useState('');
    const [newCustomerPhone, setNewCustomerPhone] = useState('');

    const wrapperRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    useEffect(() => {
        if (searchTerm.length > 2) {
            searchCustomers();
        } else {
            setResults([]);
        }
    }, [searchTerm]);

    const searchCustomers = async () => {
        const { data } = await supabase
            .from('customers')
            .select('*')
            .ilike('full_name', `%${searchTerm}%`)
            .limit(5);
        setResults(data || []);
        setIsOpen(true);
    };

    const handleCreateCustomer = async () => {
        if (!newCustomerName) return;

        const { data, error } = await supabase
            .from('customers')
            .insert({
                full_name: newCustomerName,
                phone: newCustomerPhone
            })
            .select()
            .single();

        if (error) {
            console.error('Error creating customer:', error);
            alert('Error al crear cliente');
            return;
        }

        onSelect(data);
        setIsCreating(false);
        setNewCustomerName('');
        setNewCustomerPhone('');
        setNewCustomerBadges(false);
    };

    if (isCreating) {
        return (
            <div className="bg-[#f8f7f5] p-4 rounded-xl mb-4 border border-[#e6e1db] animate-in slide-in-from-top-2">
                <div className="flex justify-between items-center mb-3">
                    <h3 className="font-bold text-[#181511]">Nuevo Cliente</h3>
                    <button onClick={() => setIsCreating(false)} className="text-[#8c785f] hover:text-[#181511]">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>
                <div className="space-y-3">
                    <input
                        type="text"
                        placeholder="Nombre Completo *"
                        className="w-full p-2 rounded-lg border border-[#e6e1db] outline-none focus:border-primary"
                        value={newCustomerName}
                        onChange={(e) => setNewCustomerName(e.target.value)}
                        autoFocus
                    />
                    <input
                        type="tel"
                        placeholder="Teléfono (Opcional)"
                        className="w-full p-2 rounded-lg border border-[#e6e1db] outline-none focus:border-primary"
                        value={newCustomerPhone}
                        onChange={(e) => setNewCustomerPhone(e.target.value)}
                    />
                    <button
                        onClick={handleCreateCustomer}
                        className="w-full bg-primary text-white font-bold py-2 rounded-lg hover:bg-[#e68a1b] transition-colors"
                    >
                        Guardar Cliente
                    </button>
                </div>
            </div>
        );
    }

    if (selectedCustomer) {
        return (
            <div className="bg-[#f8f7f5] p-3 rounded-xl mb-4 border border-[#e6e1db] flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <div className="size-10 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold">
                        {selectedCustomer.full_name[0].toUpperCase()}
                    </div>
                    <div>
                        <p className="font-bold text-[#181511] text-sm">{selectedCustomer.full_name}</p>
                        <p className="text-xs text-[#8c785f]">{selectedCustomer.phone || 'Sin teléfono'}</p>
                    </div>
                </div>
                <button
                    onClick={() => onSelect(null)}
                    className="size-8 flex items-center justify-center rounded-full hover:bg-white text-[#8c785f] transition-colors"
                >
                    <span className="material-symbols-outlined">close</span>
                </button>
            </div>
        );
    }

    return (
        <div className="mb-4 relative" ref={wrapperRef}>
            <div className="flex bg-[#f8f7f5] p-1 rounded-xl items-center border border-transparent focus-within:border-primary/50 transition-colors">
                <span className="material-symbols-outlined text-[#8c785f] ml-2">search</span>
                <input
                    type="text"
                    placeholder="Buscar o crear cliente..."
                    className="w-full bg-transparent p-2 outline-none text-[#181511] text-sm font-medium placeholder-[#8c785f]"
                    value={searchTerm}
                    onChange={(e) => {
                        setSearchTerm(e.target.value);
                        setIsOpen(true);
                    }}
                    onFocus={() => setIsOpen(true)}
                />
                {(searchTerm || results.length > 0) && (
                    <button onClick={() => { setSearchTerm(''); setResults([]); }} className="p-1 text-[#8c785f]">
                        <span className="material-symbols-outlined text-sm">close</span>
                    </button>
                )}
            </div>

            {/* Dropdown Results */}
            {isOpen && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-[#e6e1db] overflow-hidden z-50">
                    {results.map((customer) => (
                        <button
                            key={customer.id}
                            onClick={() => {
                                onSelect(customer);
                                setIsOpen(false);
                                setSearchTerm('');
                            }}
                            className="w-full text-left p-3 hover:bg-[#f8f7f5] border-b border-[#f8f7f5] last:border-0 flex items-center justify-between group"
                        >
                            <span className="font-bold text-[#181511] text-sm">{customer.full_name}</span>
                            <span className="text-xs text-[#8c785f] group-hover:text-primary">{customer.phone}</span>
                        </button>
                    ))}

                    <button
                        onClick={() => {
                            setNewCustomerName(searchTerm);
                            setIsCreating(true);
                            setIsOpen(false);
                        }}
                        className="w-full p-3 bg-[#fcfbf9] text-primary font-bold text-sm hover:bg-[#f8f7f5] flex items-center justify-center gap-2 border-t border-[#e6e1db]"
                    >
                        <span className="material-symbols-outlined">add</span>
                        Crear "{searchTerm || 'Nuevo Cliente'}"
                    </button>
                </div>
            )}
        </div>
    );
}
