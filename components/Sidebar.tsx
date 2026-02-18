'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useState, useEffect } from 'react';

// Define the shape of our navigation items
interface NavItem {
    label: string;
    icon: string;
    href: string;
    filled?: boolean;
}

export default function Sidebar() {
    const pathname = usePathname();
    const { user, signOut } = useAuth();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isWindows, setIsWindows] = useState(false);

    useEffect(() => {
        const userAgent = navigator.userAgent.toLowerCase();
        const isWin = userAgent.includes('win');
        const isDesktop = !/android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
        setIsWindows(isWin || isDesktop);
    }, []);

    const handleDownloadDesktop = () => {
        const link = document.createElement('a');
        link.href = '/CasalenaPOS.exe';
        link.download = 'CasalenaPOS.exe';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const isActive = (path: string) => {
        if (path === '#chat') return false;
        if (path === '/admin' || path === '/cashier' || path === '/cocina' || path === '/tienda') {
            return pathname === path;
        }
        return pathname.startsWith(path);
    };

    // Navigation for Administrator
    const adminNavItems: NavItem[] = [
        { label: 'Dashboard', icon: 'grid_view', href: '/admin' },
        { label: 'Terminal Caja', icon: 'point_of_sale', href: '/cashier' },
        { label: 'Productos', icon: 'inventory_2', href: '/admin/productos' },
        { label: 'Anuncios', icon: 'campaign', href: '/admin/anuncios' },
        { label: 'Órdenes', icon: 'receipt_long', href: '/admin/orders' },
        { label: 'Chat Soporte', icon: 'forum', href: '#chat' },
        { label: 'Reportes', icon: 'analytics', href: '/admin/reports' },
        { label: 'Usuarios', icon: 'group', href: '/admin/users' },
        { label: 'Configuración', icon: 'settings', href: '/admin/settings' },
    ];

    // Navigation for Cashier
    const cashierNavItems: NavItem[] = [
        { label: 'Dashboard', icon: 'dashboard', href: '/cashier/dashboard' },
        { label: 'Terminal Caja', icon: 'point_of_sale', href: '/cashier' },
        { label: 'Órdenes', icon: 'receipt_long', href: '/cashier/orders' },
        { label: 'Inventario', icon: 'inventory_2', href: '/cashier/inventory' },
        { label: 'Chat Soporte', icon: 'forum', href: '#chat' },
    ];

    // Navigation for Kitchen (Cocina)
    const kitchenNavItems: NavItem[] = [
        { label: 'Cocina', icon: 'kitchen', href: '/cocina' },
        { label: 'Órdenes', icon: 'receipt_long', href: '/cocina/orders' },
    ];

    // Navigation for Client (Cliente)
    const clientNavItems: NavItem[] = [
        { label: 'Menú', icon: 'restaurant_menu', href: '/tienda' },
        { label: 'Mis Pedidos', icon: 'receipt_long', href: '/tienda/mis-pedidos' },
        { label: 'Historial', icon: 'history', href: '/tienda/history' },
    ];

    // Determine which items to show based on role
    let navItems: NavItem[] = [];
    if (user?.role === 'administrador') {
        navItems = adminNavItems;
    } else if (user?.role === 'cajero') {
        navItems = cashierNavItems;
    } else if (user?.role === 'cocina') {
        navItems = kitchenNavItems;
    } else if (user?.role === 'cliente') {
        navItems = clientNavItems;
    }

    const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
        if (href === '#chat') {
            e.preventDefault();
            window.dispatchEvent(new CustomEvent('open-admin-chat'));
        }
        setIsMobileMenuOpen(false);
    };

    return (
        <>
            {/* Mobile Menu Button - Fixed */}
            <button
                onClick={() => setIsMobileMenuOpen(true)}
                className="lg:hidden fixed top-4 left-4 z-40 p-2 rounded-xl bg-white border border-[#e6e1db] shadow-lg hover:bg-gray-50 transition-colors"
            >
                <span className="material-symbols-outlined text-2xl text-[#181511]">menu</span>
            </button>

            {/* Mobile Overlay */}
            {isMobileMenuOpen && (
                <div
                    className="lg:hidden fixed inset-0 bg-black/50 z-40"
                    onClick={() => setIsMobileMenuOpen(false)}
                />
            )}

            {/* Sidebar - Mini rail on desktop, expands on hover */}
            <aside className={`
                fixed inset-y-0 left-0 z-50
                flex flex-col bg-white border-r border-[#e6e1db] h-full
                transition-all duration-300 ease-in-out group/sidebar overflow-hidden shadow-2xl
                ${isMobileMenuOpen ? 'w-64 translate-x-0' : '-translate-x-full lg:translate-x-0 lg:w-[72px] lg:hover:w-64'}
            `}>
                {/* Mobile Close Button */}
                <button
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="lg:hidden absolute top-4 right-4 p-2 rounded-xl hover:bg-gray-100 transition-colors"
                >
                    <span className="material-symbols-outlined text-2xl text-[#181511]">close</span>
                </button>

                {/* Logo Section - Fixed width container to prevent layout shifts */}
                <div className="h-20 flex items-center px-[15px] shrink-0">
                    <div className="flex items-center gap-3">
                        <div
                            className="bg-center bg-no-repeat bg-cover rounded-full size-10 shrink-0 shadow-sm border border-gray-100 ring-2 ring-gray-50 transition-transform group-hover/sidebar:scale-105"
                            style={{ backgroundImage: 'url("/logo-main.jpg")' }}
                        ></div>
                        <div className="flex flex-col transition-all duration-300 opacity-0 -translate-x-4 group-hover/sidebar:opacity-100 group-hover/sidebar:translate-x-0">
                            <h1 className="text-[#181511] text-base font-black leading-none whitespace-nowrap">Casa Leña</h1>
                            <p className="text-[#8c785f] text-[10px] font-bold leading-normal whitespace-nowrap uppercase tracking-tighter">Kitchen & Grill</p>
                        </div>
                    </div>
                </div>

                {/* Navigation Items */}
                <nav className="flex-1 flex flex-col gap-2 p-3 mt-4 overflow-y-auto scrollbar-hide">
                    {navItems.map((item) => (
                        <Link
                            key={item.href}
                            href={item.href}
                            onClick={(e) => handleLinkClick(e, item.href)}
                            className={`flex items-center lg:justify-center group-hover/sidebar:justify-start rounded-xl transition-all h-11 lg:px-[11px] group-hover/sidebar:px-4 ${isActive(item.href)
                                ? 'bg-[#f7951d] text-white shadow-md'
                                : 'text-[#8c785f] hover:bg-[#f8f7f5] hover:text-[#181511]'
                                }`}
                        >
                            <span className={`material-symbols-outlined text-2xl shrink-0 transition-transform duration-300 ${isActive(item.href) ? 'scale-110' : 'group-hover/sidebar:scale-105'} ${item.filled && isActive(item.href) ? 'fill-1' : ''}`}>
                                {item.icon}
                            </span>
                            <span className={`ml-4 text-sm whitespace-nowrap transition-all duration-300 opacity-0 lg:hidden group-hover/sidebar:block group-hover/sidebar:opacity-100 group-hover/sidebar:translate-x-0 -translate-x-4 ${isActive(item.href) ? 'font-black' : 'font-bold'}`}>
                                {item.label}
                            </span>
                        </Link>
                    ))}
                </nav>

                {/* Footer Section */}
                <div className="p-3 border-t border-[#e6e1db] mb-2">
                    {user?.role === 'administrador' && pathname.startsWith('/cashier') ? (
                        <Link
                            href="/admin"
                            onClick={() => setIsMobileMenuOpen(false)}
                            className="flex items-center lg:justify-center group-hover/sidebar:justify-start h-11 lg:px-[11px] group-hover/sidebar:px-4 rounded-xl text-[#f7951d] hover:bg-orange-50 cursor-pointer transition-all"
                        >
                            <span className="material-symbols-outlined text-2xl shrink-0">arrow_back</span>
                            <span className="ml-4 text-sm font-black whitespace-nowrap transition-all duration-300 opacity-0 lg:hidden group-hover/sidebar:block group-hover/sidebar:opacity-100 group-hover/sidebar:translate-x-0 -translate-x-4">Volver al Admin</span>
                        </Link>
                    ) : (
                        <div className="flex flex-col gap-1">
                            {isWindows && (
                                <button
                                    onClick={handleDownloadDesktop}
                                    className="flex w-full items-center lg:justify-center group-hover/sidebar:justify-start h-11 lg:px-[11px] group-hover/sidebar:px-4 rounded-xl text-[#F7941D] hover:bg-orange-50 cursor-pointer transition-all border border-orange-100 mb-1"
                                >
                                    <span className="material-symbols-outlined text-2xl shrink-0 font-bold">laptop_windows</span>
                                    <span className="ml-4 text-xs font-black whitespace-nowrap transition-all duration-300 opacity-0 lg:hidden group-hover/sidebar:block group-hover/sidebar:opacity-100 group-hover/sidebar:translate-x-0 -translate-x-4">Descargar APP</span>
                                </button>
                            )}

                            <button
                                onClick={async () => {
                                    console.log('Iniciando cierre de sesión...');
                                    try {
                                        await signOut();
                                    } catch (error) {
                                        console.error('Error al cerrar sesión:', error);
                                        window.location.href = '/login';
                                    }
                                    setIsMobileMenuOpen(false);
                                }}
                                className="flex w-full items-center lg:justify-center group-hover/sidebar:justify-start h-11 lg:px-[11px] group-hover/sidebar:px-4 rounded-xl text-[#8c785f] hover:bg-red-50 hover:text-red-500 cursor-pointer transition-all"
                            >
                                <span className="material-symbols-outlined text-2xl shrink-0 font-bold">logout</span>
                                <span className="ml-4 text-sm font-bold whitespace-nowrap transition-all duration-300 opacity-0 lg:hidden group-hover/sidebar:block group-hover/sidebar:opacity-100 group-hover/sidebar:translate-x-0 -translate-x-4">Cerrar Sesión</span>
                            </button>
                        </div>
                    )}
                </div>
            </aside>
        </>
    );
}
