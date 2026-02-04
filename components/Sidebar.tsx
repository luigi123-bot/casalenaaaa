'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useState } from 'react';

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
                className="xl:hidden fixed top-4 left-4 z-40 p-2 rounded-xl bg-white border border-[#e6e1db] shadow-lg hover:bg-gray-50 transition-colors"
            >
                <span className="material-symbols-outlined text-2xl text-[#181511]">menu</span>
            </button>

            {/* Mobile Overlay */}
            {isMobileMenuOpen && (
                <div
                    className="xl:hidden fixed inset-0 bg-black/50 z-40"
                    onClick={() => setIsMobileMenuOpen(false)}
                />
            )}

            {/* Sidebar - Hidden on mobile, slides in when open */}
            <aside className={`
                fixed xl:static inset-y-0 left-0 z-50
                w-64 flex-shrink-0 flex flex-col bg-white border-r border-[#e6e1db] h-full overflow-y-auto
                transform transition-transform duration-300 ease-in-out
                ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full xl:translate-x-0'}
            `}>
                {/* Mobile Close Button */}
                <button
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="xl:hidden absolute top-4 right-4 p-2 rounded-xl hover:bg-gray-100 transition-colors"
                >
                    <span className="material-symbols-outlined text-2xl text-[#181511]">close</span>
                </button>

                <div className="p-6 pb-2">
                    <div className="flex items-center gap-3">
                        <div
                            className="bg-center bg-no-repeat bg-cover rounded-full size-10 shrink-0"
                            style={{ backgroundImage: 'url("/logo-main.jpg")' }}
                        ></div>
                        <div className="flex flex-col">
                            <h1 className="text-[#181511] text-base font-bold leading-normal">Casa Leña</h1>
                            <p className="text-[#8c785f] text-xs font-normal leading-normal">Wood-Fired Kitchen</p>
                        </div>
                    </div>
                </div>
                <nav className="flex-1 flex flex-col gap-2 p-4">
                    {navItems.map((item) => (
                        <Link
                            key={item.href}
                            href={item.href}
                            onClick={(e) => handleLinkClick(e, item.href)}
                            className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-colors ${isActive(item.href)
                                ? 'bg-primary/10 text-primary font-bold'
                                : 'text-[#8c785f] hover:bg-[#f5f2f0]'
                                }`}
                        >
                            <span className={`material-symbols-outlined text-2xl ${item.filled && isActive(item.href) ? 'fill-1' : ''}`}>
                                {item.icon}
                            </span>
                            <span className={`text-sm ${isActive(item.href) ? 'font-bold' : 'font-medium'}`}>
                                {item.label}
                            </span>
                        </Link>
                    ))}
                </nav>
                <div className="p-4 mt-auto border-t border-[#e6e1db]">
                    {user?.role === 'administrador' && pathname.startsWith('/cashier') ? (
                        <Link
                            href="/admin"
                            onClick={() => setIsMobileMenuOpen(false)}
                            className="flex w-full items-center gap-3 px-3 py-2 rounded-xl text-primary hover:bg-primary/10 cursor-pointer transition-colors"
                        >
                            <span className="material-symbols-outlined text-2xl">arrow_back</span>
                            <span className="text-sm font-bold">Volver al Admin</span>
                        </Link>
                    ) : (
                        <button
                            onClick={async () => {
                                console.log('Iniciando cierre de sesión...');
                                try {
                                    await signOut();
                                } catch (error) {
                                    console.error('Error al cerrar sesión:', error);
                                    // Force redirect anyway
                                    window.location.href = '/login';
                                }
                                setIsMobileMenuOpen(false);
                            }}
                            className="flex w-full items-center gap-3 px-3 py-2 rounded-xl text-[#8c785f] hover:bg-[#f5f2f0] cursor-pointer transition-colors"
                        >
                            <span className="material-symbols-outlined text-2xl">logout</span>
                            <span className="text-sm font-medium">Cerrar Sesión</span>
                        </button>
                    )}
                </div>
            </aside>
        </>
    );
}
